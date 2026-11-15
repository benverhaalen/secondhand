import XCTest
@testable import DepthGeometry

final class DepthMeasurementQueueTests: XCTestCase {
    func testMeasurementLeavesDelegateQueueAndBusyFrameIsDroppedBeforeCopy() {
        let delegate = DispatchQueue(label: "test.depth.delegate")
        let started = expectation(description: "measurement starts on another queue")
        let finished = expectation(description: "result returns to delegate queue")
        let release = DispatchSemaphore(value: 0)
        let key = DispatchSpecificKey<Bool>()
        delegate.setSpecific(key: key, value: true)
        var calls = 0
        let worker = DepthMeasurementQueue(callbackQueue: delegate) { _ in
            XCTAssertNil(DispatchQueue.getSpecific(key: key), "RANSAC must not run on the delegate queue")
            calls += 1
            if calls == 1 { started.fulfill() }
            XCTAssertEqual(release.wait(timeout: .now() + 2), .success)
            return .insufficientGeometry
        }
        delegate.sync {
            XCTAssertTrue(worker.submit(copy: { self.input() }) { result in
                XCTAssertEqual(DispatchQueue.getSpecific(key: key), true)
                XCTAssertEqual(result, .insufficientGeometry)
                finished.fulfill()
            })
        }
        wait(for: [started], timeout: 2)
        delegate.sync {
            XCTAssertFalse(worker.submit(copy: { XCTFail("Busy frames must not be copied or retained"); return self.input() }) { _ in
                XCTFail("A dropped frame must never complete")
            })
        }
        release.signal()
        wait(for: [finished], timeout: 2)
        let next = expectation(description: "next frame is admitted after completion")
        delegate.sync {
            XCTAssertTrue(worker.submit(copy: { self.input() }) { _ in next.fulfill() })
        }
        release.signal()
        wait(for: [next], timeout: 2)
    }

    func testFailedCopyDoesNotLeaveWorkerBusy() {
        let delegate = DispatchQueue(label: "test.depth.delegate.copy")
        let worker = DepthMeasurementQueue(callbackQueue: delegate)
        delegate.sync {
            XCTAssertFalse(worker.submit(copy: { nil }) { _ in XCTFail("Invalid buffer must not measure") })
            XCTAssertFalse(worker.isBusy)
        }
    }

    func testStatusEmitsOnlyChangesAndAllowsReturningToAnEarlierState() {
        var status = DepthStatus()
        XCTAssertTrue(status.changed(to: "running"))
        XCTAssertTrue(status.changed(to: "insufficient_geometry"))
        XCTAssertFalse(status.changed(to: "insufficient_geometry"))
        XCTAssertTrue(status.changed(to: "item_clipped"))
        XCTAssertFalse(status.changed(to: "item_clipped"))
        XCTAssertTrue(status.changed(to: "running"))
    }

    func testInvalidationDiscardsPreInterruptionResultEvenAfterResume() {
        let delegate = DispatchQueue(label: "test.depth.interruption")
        let started = expectation(description: "pre-interruption measurement started")
        let finished = expectation(description: "invalidated result delivered as cancellation")
        let release = DispatchSemaphore(value: 0)
        let worker = DepthMeasurementQueue(callbackQueue: delegate) { _ in
            started.fulfill()
            XCTAssertEqual(release.wait(timeout: .now() + 2), .success)
            return .insufficientGeometry
        }
        delegate.sync {
            XCTAssertTrue(worker.submit(copy: { self.input() }) { result in
                XCTAssertNil(result, "An old pose must never be emitted after interruption/resume")
                XCTAssertFalse(worker.isBusy)
                finished.fulfill()
            })
        }
        wait(for: [started], timeout: 2)
        delegate.sync { worker.invalidate() }
        release.signal()
        wait(for: [finished], timeout: 2)
    }

    private func input() -> DepthMeasurementInput {
        DepthMeasurementInput(samples: [], intrinsics: DepthIntrinsics(fx: 1, fy: 1, ox: 0, oy: 0), width: 1, height: 1)
    }
}
