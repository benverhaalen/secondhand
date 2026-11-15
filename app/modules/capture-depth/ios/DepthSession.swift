import ARKit
import CoreVideo

/// Session state belongs to the delegate queue; fitting uses a separate serial queue.
final class DepthSession: NSObject, ARSessionDelegate {
    let session: ARSession
    private let queue = DispatchQueue(label: "secondhand.capture-depth")
    private lazy var measurements = DepthMeasurementQueue(callbackQueue: queue)
    private var running = false
    private var interrupted = false
    private var frames = 0
    private var lastMeasurement = -Double.infinity
    private let measurementInterval = 0.5 // Limit copied frames and extent events to twice per second.
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
            measurements.invalidate()
            guard !running else { return }
            let configuration = ARWorldTrackingConfiguration()
            configuration.frameSemantics = [.sceneDepth]
            running = true
            interrupted = false
            lastMeasurement = -Double.infinity
            session.run(configuration)
            emit("onStatus", ["state": "running"])
        }
    }

    func pause() {
        queue.async { [self] in
            guard running else { return }
            running = false
            measurements.invalidate()
            session.pause()
            emit("onStatus", ["state": "paused"])
        }
    }

    deinit { session.pause() }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard running, !interrupted else { return }
        frames += 1
        guard !measurements.isBusy, frame.timestamp - lastMeasurement >= measurementInterval else { return }
        lastMeasurement = frame.timestamp
        guard frame.sceneDepth?.confidenceMap != nil else {
            emit("onStatus", ["state": "waiting_for_depth"])
            return
        }
        guard let input = copyFrame(frame) else {
            emit("onError", ["code": "invalid_depth_buffer"])
            return
        }
        let measuredGeneration = generation, measuredFrames = frames
        measurements.submit(copy: { input }) { [weak self] result in
            guard let self, let result, self.running, !self.interrupted, self.generation == measuredGeneration else { return }
            switch result {
            case .insufficientGeometry:
                self.emit("onStatus", ["state": "insufficient_geometry"])
            case .clipped:
                self.emit("onStatus", ["state": "item_clipped"])
            case let .extent(extent):
                self.emit("onStatus", ["state": "running"])
                self.emit("onExtent", [
                    "extent_cm": ["width": extent.width, "depth": extent.depth, "height": extent.height],
                    "extent_conf": 0, "rigid": true, "frames": measuredFrames
                ])
            }
        }
    }

    // This function returns only value types. Its frame and both locked buffers
    // leave scope before the measurement closure is created.
    private func copyFrame(_ frame: ARFrame) -> DepthMeasurementInput? {
        guard let depth = frame.sceneDepth, let confidence = depth.confidenceMap,
              let samples = readDepth(depth.depthMap, confidence: confidence) else { return nil }
        let k = frame.camera.intrinsics
        let width = CVPixelBufferGetWidth(depth.depthMap), height = CVPixelBufferGetHeight(depth.depthMap)
        let scaled = scaleIntrinsics(
            DepthIntrinsics(fx: Double(k[0][0]), fy: Double(k[1][1]), ox: Double(k[2][0]), oy: Double(k[2][1])),
            imageWidth: Double(frame.camera.imageResolution.width),
            imageHeight: Double(frame.camera.imageResolution.height), depthWidth: width, depthHeight: height)
        return DepthMeasurementInput(samples: samples, intrinsics: scaled, width: width, height: height)
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        running = false
        measurements.invalidate()
        session.pause()
        // Only a domain/code reaches JS; localized errors can contain capture details.
        let nativeError = error as NSError
        emit("onError", ["code": "ar_session_\(nativeError.domain)_\(nativeError.code)"])
    }

    func sessionWasInterrupted(_ session: ARSession) {
        interrupted = true
        measurements.invalidate()
        emit("onStatus", ["state": "interrupted"])
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        interrupted = false
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
        return samples(depth: UnsafeRawPointer(depths), depthStride: depthStride,
                       confidence: UnsafeRawPointer(flags), confidenceStride: flagStride,
                       width: width, height: height,
                       isHigh: { ARConfidenceLevel(rawValue: Int($0)) == .high })
    }
}
