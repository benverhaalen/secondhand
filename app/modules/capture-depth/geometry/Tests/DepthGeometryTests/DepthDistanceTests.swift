import XCTest
@testable import DepthGeometry

final class DepthDistanceTests: XCTestCase {
    private func point(_ z: Double, u: Double = 320, v: Double = 240,
                       high: Bool = true) -> DepthSample {
        DepthSample(u: u, v: v, depth: z, highConfidence: high)
    }
    func testFlatPlaneAtSixtyCentimetersAndDeterministicMedian() throws {
        let points = (0..<30).map { point(0.6 + Double($0 - 15) * 0.0001) }
        let distance = try XCTUnwrap(distanceMeters(samples: points, width: 640, height: 480))
        XCTAssertEqual(distance, 0.6, accuracy: 0.01)
        XCTAssertEqual(distanceMeters(samples: points, width: 640, height: 480),
                       distanceMeters(samples: points.reversed(), width: 640, height: 480))
    }
    func testFewerThanTwentyValidCentralHighConfidencePointsGivesNil() {
        let points = Array(repeating: point(0.6), count: 19)
            + [point(0.6, high: false), point(.nan), point(.infinity), point(0), point(-1),
               point(0.1, u: 400), point(0.1, v: 280)]
        XCTAssertNil(distanceMeters(samples: points, width: 640, height: 480))
        XCTAssertNil(distanceMeters(samples: [], width: 640, height: 480))
    }
    func testSquareIsCenteredAndTenPercentOfShorterDepthWindowSide() throws {
        // 640x480's depth window is 448x336, so the square is 33.6 pixels per side.
        let points = (0..<20).map { point($0 < 10 ? 0.4 : 0.8, u: 303.2, v: 223.2) }
            + Array(repeating: point(3, u: 336.8), count: 30)
            + Array(repeating: point(3, v: 256.8), count: 30)
        XCTAssertEqual(try XCTUnwrap(distanceMeters(samples: points, width: 640, height: 480)), 0.6, accuracy: 1e-10)
        XCTAssertNil(distanceMeters(samples: points, width: 0, height: 480))
    }
}
