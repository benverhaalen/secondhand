import ExpoModulesCore
import UIKit

public final class MarketplaceLinksModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MarketplaceLinks")

    AsyncFunction("openListing") { (url: URL, _: String?, promise: Promise) in
      guard url.scheme == "https" else {
        promise.resolve(false)
        return
      }
      UIApplication.shared.open(url, options: [.universalLinksOnly: true]) { opened in
        promise.resolve(opened)
      }
    }.runOnQueue(.main)
  }
}
