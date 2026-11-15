Pod::Spec.new do |s|
  s.name = 'CaptureDepth'
  s.version = '1.0.0'
  s.summary = 'Optional LiDAR scene depth measurements for secondhand'
  s.description = 'A local Expo module with independently testable camera-space geometry.'
  s.author = 'secondhand'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.license = { :type => 'Proprietary' }
  s.source = { :git => '' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ARKit', 'RealityKit', 'SwiftUI', 'AVFoundation', 'SceneKit', 'CoreVideo'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = 'ios/**/*.swift', 'geometry/Sources/DepthGeometry/DepthGeometry.swift'
end
