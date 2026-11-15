import ARKit
import CoreVideo

/// All session and delegate work is serialized off the UI thread.
final class DepthSession: NSObject, ARSessionDelegate {
    let session: ARSession
    private let queue = DispatchQueue(label: "secondhand.capture-depth")
    private var running = false
    private var frames = 0
    private var lastMeasurement = -Double.infinity
    private var generation = 0
    private let deliver: (Int, String, [String: Any]) -> Void

    init(session: ARSession, emit: @escaping (Int, String, [String: Any]) -> Void) {
        self.session = session
        self.deliver = emit
        super.init()
        session.delegateQueue = queue
        session.delegate = self
    }

    private func emit(_ event: String, _ payload: [String: Any]) {
        deliver(generation, event, payload)
    }

    func start(generation: Int) {
        queue.async { [self] in
            self.generation = generation
            guard !running else { return }
            let configuration = ARWorldTrackingConfiguration()
            configuration.frameSemantics = [.sceneDepth]
            running = true
            lastMeasurement = -Double.infinity
            session.run(configuration)
            emit("onStatus", ["state": "running"])
        }
    }

    func pause() {
        queue.async { [self] in
            guard running else { return }
            running = false
            session.pause()
            emit("onStatus", ["state": "paused"])
        }
    }

    deinit { session.pause() }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard running else { return }
        frames += 1
        guard frame.timestamp - lastMeasurement >= 0.5 else { return }
        lastMeasurement = frame.timestamp
        guard let depth = frame.sceneDepth, let confidence = depth.confidenceMap else {
            emit("onStatus", ["state": "waiting_for_depth"])
            return
        }
        guard let samples = readDepth(depth.depthMap, confidence: confidence) else {
            emit("onError", ["code": "invalid_depth_buffer"])
            return
        }
        let k = frame.camera.intrinsics
        let width = CVPixelBufferGetWidth(depth.depthMap), height = CVPixelBufferGetHeight(depth.depthMap)
        let scaled = scaleIntrinsics(
            DepthIntrinsics(fx: Double(k[0][0]), fy: Double(k[1][1]), ox: Double(k[2][0]), oy: Double(k[2][1])),
            imageWidth: Double(frame.camera.imageResolution.width),
            imageHeight: Double(frame.camera.imageResolution.height), depthWidth: width, depthHeight: height)
        guard let extent = DepthGeometry.measure(samples: samples, intrinsics: scaled, width: width, height: height) else {
            emit("onStatus", ["state": "insufficient_geometry"])
            return
        }
        emit("onExtent", [
            "extent_cm": ["width": extent.width, "depth": extent.depth, "height": extent.height],
            "extent_conf": 0, "rigid": true, "frames": frames
        ])
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        running = false
        session.pause()
        // Only a domain/code reaches JS; localized errors can contain capture details.
        let nativeError = error as NSError
        emit("onError", ["code": "ar_session_\(nativeError.domain)_\(nativeError.code)"])
    }

    func sessionWasInterrupted(_ session: ARSession) {
        emit("onStatus", ["state": "interrupted"])
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        lastMeasurement = -Double.infinity
        emit("onStatus", ["state": "interruption_ended"])
    }

    private func readDepth(_ depth: CVPixelBuffer, confidence: CVPixelBuffer) -> [DepthSample]? {
        let width = CVPixelBufferGetWidth(depth), height = CVPixelBufferGetHeight(depth)
        guard CVPixelBufferGetPixelFormatType(depth) == kCVPixelFormatType_DepthFloat32,
              CVPixelBufferGetPixelFormatType(confidence) == kCVPixelFormatType_OneComponent8,
              CVPixelBufferGetWidth(confidence) == width, CVPixelBufferGetHeight(confidence) == height,
              CVPixelBufferLockBaseAddress(depth, .readOnly) == kCVReturnSuccess else { return nil }
        defer { CVPixelBufferUnlockBaseAddress(depth, .readOnly) }
        guard CVPixelBufferLockBaseAddress(confidence, .readOnly) == kCVReturnSuccess else { return nil }
        defer { CVPixelBufferUnlockBaseAddress(confidence, .readOnly) }
        guard let depths = CVPixelBufferGetBaseAddress(depth),
              let flags = CVPixelBufferGetBaseAddress(confidence) else { return nil }
        let depthStride = CVPixelBufferGetBytesPerRow(depth), flagStride = CVPixelBufferGetBytesPerRow(confidence)
        var samples: [DepthSample] = []
        for y in Int(Double(height)*0.15)..<Int(Double(height)*0.85) {
            let row = depths.advanced(by: y*depthStride).assumingMemoryBound(to: Float.self)
            let confidenceRow = flags.advanced(by: y*flagStride).assumingMemoryBound(to: UInt8.self)
            for x in Int(Double(width)*0.15)..<Int(Double(width)*0.85) {
                guard ARConfidenceLevel(rawValue: Int(confidenceRow[x])) == .high else { continue }
                samples.append(DepthSample(u: Double(x), v: Double(y), depth: Double(row[x]), highConfidence: true))
            }
        }
        return samples
    }
}
