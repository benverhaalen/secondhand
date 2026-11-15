package expo.modules.marketplacelinks

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MarketplaceLinksModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MarketplaceLinks")

    AsyncFunction("openListing") { value: String, packageName: String? ->
      val uri = Uri.parse(value)
      val context = appContext.reactContext
      if (uri.scheme != "https" || packageName == null || context == null) return@AsyncFunction false
      val intent = Intent(Intent.ACTION_VIEW, uri)
        .setPackage(packageName)
        .addCategory(Intent.CATEGORY_BROWSABLE)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        true
      } catch (_: ActivityNotFoundException) {
        false
      } catch (_: SecurityException) {
        false
      }
    }.runOnQueue(Queues.MAIN)
  }
}
