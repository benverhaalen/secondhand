import XCTest
@testable import DepthGeometry

final class DepthGeometryTests: XCTestCase {
    let intrinsics = DepthIntrinsics(fx: 400, fy: 420, ox: 320, oy: 240)

    // Independent fixture: rotate a table and its box into a tilted camera's frame,
    // then project to pixels. Production must recover the box from these depths.
    func scene(rotation: Double = 0, denseTop: Bool = false, tilt: Double = .pi / 5,
               noise: Double = 0) -> [DepthSample] {
        var random = DepthFrameFixture()
        func sample(_ x: Double, _ y: Double, _ height: Double) -> DepthSample {
            let a = x * cos(rotation) - y * sin(rotation)
            let b = x * sin(rotation) + y * cos(rotation)
            let cx = a
            let cy = b * cos(tilt) - height * sin(tilt)
            let cz = 1.2 - b * sin(tilt) - height * cos(tilt)
            return DepthSample(u: 400 * cx / cz + 320, v: 420 * cy / cz + 240,
                               depth: cz + noise * random.gaussian(), highConfidence: true)
        }
        var samples: [DepthSample] = []
        for x in -20...20 {
            for y in -20...20 {
                let px = Double(x) * 0.02, py = Double(y) * 0.02
                if abs(px) > 0.15 || abs(py) > 0.10 { samples.append(sample(px, py, 0)) }
            }
        }
        // At most 7.5 mm spacing keeps the box connected in a 1 cm occupancy grid.
        let steps = denseTop ? 70 : 40
        for x in 0...steps {
            for y in 0...steps {
                samples.append(sample(-0.15 + 0.30 * Double(x) / Double(steps),
                                      -0.10 + 0.20 * Double(y) / Double(steps), 0.10))
            }
        }
        return samples
    }

    func measure(_ samples: [DepthSample]) -> DepthExtent? {
        DepthGeometry.measure(samples: samples, intrinsics: intrinsics, width: 640, height: 480)
    }

    func assertBox(_ extent: DepthExtent?, file: StaticString = #filePath, line: UInt = #line) throws {
        let box = try XCTUnwrap(extent, file: file, line: line)
        XCTAssertEqual(box.width, 30, accuracy: 0.5, file: file, line: line)
        XCTAssertEqual(box.depth, 20, accuracy: 0.5, file: file, line: line)
        XCTAssertEqual(box.height, 10, accuracy: 0.5, file: file, line: line)
    }

    func testTiltedCameraDoesNotChangeThirtyByTwentyByTenCentimeterBox() throws {
        try assertBox(measure(scene()))
    }

    func testThirtyDegreeRotationDoesNotInflatePlaneRectangle() throws {
        try assertBox(measure(scene(rotation: .pi / 6)))
    }

    func testLowConfidenceOutliersCannotEnlargeBox() throws {
        let outliers = (0..<200).map { i in
            DepthSample(u: Double(150 + i), v: 180, depth: 0.3, highConfidence: false)
        }
        XCTAssertEqual(measure(scene() + outliers), measure(scene()))
        try assertBox(measure(scene() + outliers))
    }

    func testEmptyAndNearEmptyFramesCannotInventAnExtent() {
        XCTAssertNil(measure([]))
        XCTAssertNil(measure(Array(scene().prefix(3))))
    }

    func testIdenticalPointsProduceIdenticalBox() throws {
        let points = scene(rotation: .pi / 6)
        let first = try XCTUnwrap(measure(points))
        XCTAssertEqual(first, measure(points))
    }

    func testIntrinsicsScalingMapsImagePointToDepthPixelWithUnequalAxisScales() {
        let scaled = scaleIntrinsics(intrinsics, imageWidth: 640, imageHeight: 480,
                                     depthWidth: 160, depthHeight: 96)
        XCTAssertEqual(scaled, DepthIntrinsics(fx: 100, fy: 84, ox: 80, oy: 48))
        // At Z=2, X=.4 and Y=.2 project to (400,282) in the image, (100,56.4) in depth.
        XCTAssertEqual(scaled.fx * 0.4 / 2 + scaled.ox, 100, accuracy: 1e-10)
        XCTAssertEqual(scaled.fy * 0.2 / 2 + scaled.oy, 56.4, accuracy: 1e-10)
    }

    func testDominantBoxTopIsNotMistakenForSupportPlane() throws {
        try assertBox(measure(scene(denseTop: true)))
    }

    func testPixelsOutsideCenterAndInvalidDepthsCannotChangeBox() {
        let invalid = [
            DepthSample(u: 0, v: 0, depth: 0.2, highConfidence: true),
            DepthSample(u: 320, v: 240, depth: .nan, highConfidence: true),
            DepthSample(u: 320, v: 240, depth: .infinity, highConfidence: true),
            DepthSample(u: 320, v: 240, depth: -1, highConfidence: true)
        ]
        XCTAssertEqual(measure(scene() + invalid), measure(scene()))
    }

    func testPlaneOnlyAndCollinearPointsCannotInventVolume() {
        XCTAssertNil(measure(Array(scene().prefix(1000))))
        let line = (0..<100).map { DepthSample(u: Double(280 + $0), v: 240, depth: 1, highConfidence: true) }
        XCTAssertNil(measure(line))
    }
}
