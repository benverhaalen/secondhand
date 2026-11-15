import XCTest
@testable import DepthGeometry

// Independent ray/box fixture: samples the visible top and sides, then perturbs
// metric depth at fixed pixels, as a depth sensor does. No production geometry used.
struct DepthFrameFixture {
    var seed: UInt64 = 0x4e4f495345
    mutating func gaussian() -> Double {
        func uniform(_ seed: inout UInt64) -> Double {
            seed = seed &* 6364136223846793005 &+ 1442695040888963407
            return (Double(seed >> 11) + 0.5) / 9007199254740992
        }
        return sqrt(-2 * log(uniform(&seed))) * cos(2 * .pi * uniform(&seed))
    }

    mutating func frame(tilt: Double = .pi / 5, rotation: Double = 0,
                        noise: Double = 0, boxWidth: Double = 0.30,
                        columns: Int = 400, rows: Int = 320,
                        stickGap: Double? = nil, offset: Double = 0) -> [DepthSample] {
        let c = cos(rotation), s = sin(rotation), ct = cos(tilt), st = sin(tilt)
        let origin = [1.2 * st * s, 1.2 * st * c, 1.2 * ct]
        func hit(_ direction: [Double], low: [Double], high: [Double]) -> Double? {
            var near = 0.0, far = Double.infinity
            for axis in 0..<3 {
                if abs(direction[axis]) < 1e-12 {
                    if origin[axis] < low[axis] || origin[axis] > high[axis] { return nil }
                } else {
                    let a = (low[axis] - origin[axis]) / direction[axis]
                    let b = (high[axis] - origin[axis]) / direction[axis]
                    near = max(near, min(a, b)); far = min(far, max(a, b))
                }
            }
            return far >= near ? near : nil
        }
        var result: [DepthSample] = []
        // Dense raster for accuracy; the timing case explicitly uses 200 x 120 (24,000).
        for row in 0..<rows {
            for column in 0..<columns {
                let u = 96.5 + Double(column) * 447 / Double(columns - 1)
                let v = 72.5 + Double(row) * 335 / Double(rows - 1)
                let dx = (u - 320) / 400, dy = (v - 240) / 420
                let b = ct * dy - st
                let direction = [c * dx + s * b, -s * dx + c * b, -st * dy - ct]
                var depth = -origin[2] / direction[2]
                if let box = hit(direction, low: [-boxWidth/2 + offset, -0.10, 0],
                                 high: [boxWidth/2 + offset, 0.10, 0.10]) { depth = min(depth, box) }
                if let gap = stickGap,
                   let stick = hit(direction, low: [0.15 + gap, -0.025, 0],
                                   high: [0.35 + gap, 0.025, 0.10]) { depth = min(depth, stick) }
                result.append(DepthSample(u: u, v: v, depth: depth + noise * gaussian(), highConfidence: true))
            }
        }
        return result
    }
}

final class NoisyDepthGeometryTests: XCTestCase {
    let k = DepthIntrinsics(fx: 400, fy: 420, ox: 320, oy: 240)
    func measure(_ points: [DepthSample]) -> DepthExtent? {
        DepthGeometry.measure(samples: points, intrinsics: k, width: 640, height: 480)
    }
    func assertBox(_ result: DepthExtent?, file: StaticString = #filePath, line: UInt = #line) throws {
        let extent = try XCTUnwrap(result, file: file, line: line)
        XCTAssertEqual(extent.width, 30, accuracy: 0.5, file: file, line: line)
        XCTAssertEqual(extent.depth, 20, accuracy: 0.5, file: file, line: line)
        XCTAssertEqual(extent.height, 10, accuracy: 0.5, file: file, line: line)
    }
    func testTwentyFourThousandPointsFitWithinQuarterSecondInDebug() throws {
        var fixture = DepthFrameFixture()
        let points = fixture.frame(columns: 200, rows: 120)
        XCTAssertEqual(points.count, 24_000)
        let start = DispatchTime.now().uptimeNanoseconds
        let result = measure(points)
        let seconds = Double(DispatchTime.now().uptimeNanoseconds - start) / 1e9
        print("24,000-point measurement: \(seconds) seconds")
        XCTAssertLessThan(seconds, 0.25, "RANSAC must stay bounded in the test build")
        try assertBox(result)
    }
    func testThreeMillimeterGaussianDepthNoiseFlatTiltedAndRotated() throws {
        for (tilt, rotation) in [(0.0, 0.0), (Double.pi/5, 0), (.pi/5, .pi/6)] {
            var fixture = DepthFrameFixture()
            let points = fixture.frame(tilt: tilt, rotation: rotation, noise: 0.003)
            try assertBox(measure(points))
        }
    }
    func testOriginalBoxFixtureWithThreeMillimeterNoiseFlatTiltedAndRotated() throws {
        let fixture = DepthGeometryTests()
        for (tilt, rotation) in [(0.0, 0.0), (Double.pi/5, 0), (.pi/5, .pi/6)] {
            try fixture.assertBox(fixture.measure(fixture.scene(rotation: rotation, tilt: tilt, noise: 0.003)))
        }
    }
    func testNoisySupportCannotLowerAQuietItemTop() throws {
        let fixture = DepthGeometryTests()
        let quiet = fixture.scene(tilt: 0)
        let noisy = fixture.scene(tilt: 0, noise: 0.003)
        let points = quiet.indices.map { quiet[$0].depth > 1.15 ? noisy[$0] : quiet[$0] }
        try fixture.assertBox(fixture.measure(points))
    }
    func testTwentyFourThousandPointsWithDominantTopStayWithinQuarterSecond() throws {
        let fixture = DepthGeometryTests()
        let source = fixture.scene(denseTop: true)
        let points = (0..<24_000).map { source[$0 * source.count / 24_000] }
        let start = DispatchTime.now().uptimeNanoseconds
        let result = measure(points)
        let seconds = Double(DispatchTime.now().uptimeNanoseconds - start) / 1e9
        print("24,000-point dominant-top measurement: \(seconds) seconds")
        XCTAssertLessThan(seconds, 0.25, "Rejected box-top planes must not make refinement unbounded")
        try assertBox(result)
    }
    func testSeededGaussianFixtureRepeatsExactly() {
        var a = DepthFrameFixture(), b = DepthFrameFixture()
        XCTAssertEqual(a.frame(noise: 0.003).map(\.depth), b.frame(noise: 0.003).map(\.depth))
    }
    func testNoisySupportOnlyCannotBecomeAnItem() {
        let fixture = DepthGeometryTests()
        XCTAssertNil(fixture.measure(Array(fixture.scene(noise: 0.003).prefix(1000))))
    }
    func testOneFlyingPixelCannotChangeHeightOrSides() throws {
        var fixture = DepthFrameFixture()
        let points = fixture.frame(tilt: 0)
        let baseline = try XCTUnwrap(measure(points))
        let flying = DepthSample(u: 320.5, v: 240.5, depth: 0.9, highConfidence: true)
        let extent = try XCTUnwrap(measure(points + [flying]))
        XCTAssertEqual(extent.width, baseline.width, accuracy: 0.5)
        XCTAssertEqual(extent.depth, baseline.depth, accuracy: 0.5)
        XCTAssertEqual(extent.height, baseline.height, accuracy: 0.5)
    }
    func testTouchingFiveCentimeterWideStickIsKnownToGrowTheCluster() throws {
        var fixture = DepthFrameFixture()
        let extent = try XCTUnwrap(measure(fixture.frame(tilt: 0, stickGap: 0)))
        XCTAssertGreaterThan(extent.width, 45, "Touching clutter is part of the item; this is a known limit")
        XCTAssertEqual(extent.depth, 20, accuracy: 0.5)
    }
    func testDetachedStickFiveCentimetersAwayIsIgnored() throws {
        var fixture = DepthFrameFixture()
        try assertBox(measure(fixture.frame(tilt: 0, stickGap: 0.05)))
    }
    func testNearestClusterWhenWindowCenterIsEmpty() throws {
        var fixture = DepthFrameFixture()
        // The box is left of centre; the detached stick is farther to the right.
        try assertBox(measure(fixture.frame(tilt: 0, stickGap: 0.15, offset: -0.20)))
    }
    func testBoxWiderThanWindowIsClippedInsteadOfUnderestimated() {
        var fixture = DepthFrameFixture()
        let result = DepthGeometry.measurement(samples: fixture.frame(tilt: 0, boxWidth: 1.5),
                                               intrinsics: k, width: 640, height: 480)
        XCTAssertEqual(result, .clipped)
    }
    func testOccupiedCellTouchingBorderIsClippedWithoutAnExactBorderPixel() {
        var fixture = DepthFrameFixture()
        let points = fixture.frame(tilt: 0, boxWidth: 1.5).filter {
            $0.u > 97 && $0.u < 543 && $0.v > 73 && $0.v < 407
        }
        XCTAssertEqual(DepthGeometry.measurement(samples: points, intrinsics: k, width: 640, height: 480), .clipped)
    }
    func testPaddedDepthAndConfidenceRowsUsePixelCentersAndOneWindow() {
        let width = 11, height = 9, depthStride = 64, confidenceStride = 16
        let depth = UnsafeMutableRawPointer.allocate(byteCount: depthStride * height, alignment: 4)
        let confidence = UnsafeMutableRawPointer.allocate(byteCount: confidenceStride * height, alignment: 1)
        defer { depth.deallocate(); confidence.deallocate() }
        depth.initializeMemory(as: UInt8.self, repeating: 0xff, count: depthStride * height)
        confidence.initializeMemory(as: UInt8.self, repeating: 0xff, count: confidenceStride * height)
        for y in 0..<height {
            for x in 0..<width {
                depth.storeBytes(of: Float(y * width + x), toByteOffset: y * depthStride + x * 4, as: Float.self)
                confidence.storeBytes(of: UInt8((x + y) % 3), toByteOffset: y * confidenceStride + x, as: UInt8.self)
            }
        }
        let points = samples(depth: UnsafeRawPointer(depth), depthStride: depthStride,
                             confidence: UnsafeRawPointer(confidence), confidenceStride: confidenceStride,
                             width: width, height: height, isHigh: { $0 == 2 })
        // Pixel centres in [15%,85%): x=2...8, y=1...7 (no truncation off-by-one).
        var expected: [Double] = []
        for y in 1...7 { for x in 2...8 where (x+y) % 3 == 2 { expected.append(Double(y*width+x)) } }
        XCTAssertEqual(points.map(\.depth), expected)
        XCTAssertTrue(points.allSatisfy { $0.u == floor($0.u) + 0.5 && $0.v == floor($0.v) + 0.5 })
        let window = DepthWindow(width: width, height: height)
        XCTAssertEqual(window.columns, 2..<9)
        XCTAssertEqual(window.rows, 1..<8)
        XCTAssertTrue(points.allSatisfy { window.contains(u: $0.u, v: $0.v) })
    }
}
