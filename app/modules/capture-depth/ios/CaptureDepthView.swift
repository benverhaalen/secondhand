import ARKit
import AVFoundation
import ExpoModulesCore

final class CaptureDepthView: ExpoView {
    let onExtent = EventDispatcher()
    let onError = EventDispatcher()
    let onStatus = EventDispatcher()
    private var capture: DepthSession?
    private var preview: ARSCNView?
    private var permissionPending = false
    private var generation = 0
    private var status = DepthStatus()

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        clipsToBounds = true
        NotificationCenter.default.addObserver(self, selector: #selector(pauseCapture),
                                               name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(resumeCapture),
                                               name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { pauseCapture() } else { resumeCapture() }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        preview?.frame = bounds
    }

    @objc private func pauseCapture() {
        generation += 1
        capture?.pause()
        if capture != nil { emitStatus("paused") }
    }

    @objc private func resumeCapture() {
        guard window != nil, UIApplication.shared.applicationState == .active else { return }
        guard ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else {
            emitStatus("unsupported")
            return
        }
        guard let description = Bundle.main.object(forInfoDictionaryKey: "NSCameraUsageDescription") as? String,
              !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            onError(["code": "missing_camera_usage_description"])
            return
        }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            startCapture()
        case .notDetermined:
            guard !permissionPending else { return }
            permissionPending = true
            emitStatus("requesting_camera_permission")
            AVCaptureDevice.requestAccess(for: .video) { [weak self] _ in
                DispatchQueue.main.async {
                    self?.permissionPending = false
                    self?.resumeCapture()
                }
            }
        case .denied, .restricted:
            onError(["code": "camera_permission_denied"])
        @unknown default:
            onError(["code": "camera_permission_unavailable"])
        }
    }

    private func emitStatus(_ state: String) {
        guard status.changed(to: state) else { return }
        onStatus(["state": state])
    }

    private func startCapture() {
        generation += 1
        if capture == nil {
            let view = ARSCNView(frame: bounds)
            let helper = DepthSession(session: view.session) { [weak self] generation, event, payload in
                DispatchQueue.main.async { [weak self] in
                    guard let self, self.window != nil, self.generation == generation else { return }
                    if event == "onExtent" {
                        guard UIApplication.shared.applicationState == .active else { return }
                        self.onExtent(payload)
                    } else if event == "onError" { self.onError(payload) }
                    else { self.emitStatus(payload["state"] as! String) }
                }
            }
            capture = helper
            addSubview(view)
            preview = view
        }
        capture?.start(generation: generation)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        capture?.pause()
    }
}
