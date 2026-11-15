Pod::Spec.new do |s|
  s.name = 'MarketplaceLinks'
  s.version = '1.0.0'
  s.summary = 'Open marketplace listings in their native apps'
  s.author = 'secondhand'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.license = { :type => 'Proprietary' }
  s.source = { :git => '' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = 'ios/**/*.swift'
end
