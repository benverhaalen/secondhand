import ARKit
import ExpoModulesCore
import RealityKit

public final class CaptureDepthModule: Module {
    public func definition() -> ModuleDefinition {
        Name("CaptureDepth")

        AsyncFunction("capabilities") { () async -> [String: Bool] in
            await MainActor.run {
                var objectCapture = false
                #if !targetEnvironment(simulator) && !targetEnvironment(macCatalyst)
                if #available(iOS 17.0, *) {
                    objectCapture = ObjectCaptureSession.isSupported
                }
                #endif
                return [
                    "has_lidar": ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth),
                    "object_capture": objectCapture
                ]
            }
        }

        View(CaptureDepthView.self) {
            Events("onExtent", "onError", "onStatus")
        }
    }
}
