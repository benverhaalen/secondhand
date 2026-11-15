import XCTest

// Opens each route of the installed secondhand app on a real phone or a simulator and keeps, per route, a screenshot
// and the accessibility tree with every element's frame. run.mjs passes the routes and reads the results back.
final class ScreensTests: XCTestCase {
  func keep(_ name: String, _ app: XCUIApplication) {
    let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    shot.name = name; shot.lifetime = .keepAlways; add(shot)
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = name + ".tree"; tree.lifetime = .keepAlways; add(tree)
  }

  func testScreens() throws {
    continueAfterFailure = true
    executionTimeAllowance = 900
    XCUIDevice.shared.orientation = .portrait
    let env = ProcessInfo.processInfo.environment
    let bundle = env["SH_APP"] ?? "dev.ben.secondhand"
    let settle = Double(env["SH_SETTLE"] ?? "2.5") ?? 2.5
    let routes = (env["SH_ROUTES"] ?? "today|/").split(separator: ";").map { $0.split(separator: "|", maxSplits: 1).map(String.init) }
    let app = XCUIApplication(bundleIdentifier: bundle)
    // On a phone the camera and photo prompts are system alerts that outlive a relaunch; answer them so they never cover a screen.
    addUIInterruptionMonitor(withDescription: "permission") { alert in
      for label in ["Allow", "OK", "Allow Full Access"] where alert.buttons[label].exists { alert.buttons[label].tap(); return true }
      return false
    }
    app.terminate()
    app.launch()
    _ = app.wait(for: .runningForeground, timeout: 20)
    Thread.sleep(forTimeInterval: settle)
    keep("launch", app)
    for r in routes where r.count == 2 {
      let url = URL(string: "secondhand://" + (r[1].hasPrefix("/") ? String(r[1].dropFirst()) : r[1]))!
      // A fresh launch per route, so a sheet or modal left by the last route never sits over this one.
      app.terminate()
      app.launch()
      _ = app.wait(for: .runningForeground, timeout: 20)
      app.open(url)
      Thread.sleep(forTimeInterval: settle)
      app.swipeUp(velocity: .slow); app.swipeDown(velocity: .slow) // lets the interruption monitor run
      XCTAssertEqual(app.state, .runningForeground, "\(r[0]) left the app (crash?)")
      keep(r[0], app)
    }
  }
}
