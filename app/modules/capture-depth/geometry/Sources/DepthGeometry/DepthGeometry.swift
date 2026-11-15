import Foundation

public struct DepthIntrinsics: Equatable {
    public let fx: Double, fy: Double, ox: Double, oy: Double
    public init(fx: Double, fy: Double, ox: Double, oy: Double) {
        self.fx = fx; self.fy = fy; self.ox = ox; self.oy = oy
    }
}

// Inferred image/depth correspondence; see the module README's evidence link.
public func scaleIntrinsics(_ k: DepthIntrinsics, imageWidth: Double, imageHeight: Double,
                            depthWidth: Int, depthHeight: Int) -> DepthIntrinsics {
    let sx = Double(depthWidth) / imageWidth, sy = Double(depthHeight) / imageHeight
    return DepthIntrinsics(fx: k.fx * sx, fy: k.fy * sy, ox: k.ox * sx, oy: k.oy * sy)
}

public struct DepthSample {
    public let u: Double, v: Double, depth: Double
    public let highConfidence: Bool
    public init(u: Double, v: Double, depth: Double, highConfidence: Bool) {
        self.u = u; self.v = v; self.depth = depth; self.highConfidence = highConfidence
    }
}

/// Centimeters; width is the longer side of the rectangle on the support plane.
public struct DepthExtent: Equatable {
    public let width: Double, depth: Double, height: Double
}

private struct Point {
    let x: Double, y: Double, z: Double
    static func + (a: Point, b: Point) -> Point { Point(x: a.x+b.x, y: a.y+b.y, z: a.z+b.z) }
    static func - (a: Point, b: Point) -> Point { Point(x: a.x-b.x, y: a.y-b.y, z: a.z-b.z) }
    static func * (a: Point, b: Double) -> Point { Point(x: a.x*b, y: a.y*b, z: a.z*b) }
    func dot(_ b: Point) -> Double { x*b.x + y*b.y + z*b.z }
    func cross(_ b: Point) -> Point { Point(x: y*b.z-z*b.y, y: z*b.x-x*b.z, z: x*b.y-y*b.x) }
    var length: Double { sqrt(dot(self)) }
}

private struct Plane {
    let normal: Point, offset: Double
    func distance(_ p: Point) -> Double { normal.dot(p) + offset }
}

private struct Point2: Equatable {
    let x: Double, y: Double
}

/// The central sensor window, defined by pixel centres in [15%, 85%).
public struct DepthWindow {
    fileprivate static let inset = 0.15 // Keep support and item away from the sensor's outer edges.
    public let columns: Range<Int>, rows: Range<Int>
    private let minU: Double, maxU: Double, minV: Double, maxV: Double
    public init(width: Int, height: Int) {
        minU = Double(width) * Self.inset; maxU = Double(width) * (1 - Self.inset)
        minV = Double(height) * Self.inset; maxV = Double(height) * (1 - Self.inset)
        func pixels(_ low: Double, _ high: Double) -> Range<Int> {
            let lower = Int(ceil(low - 0.5)), upper = Int(ceil(high - 0.5))
            return lower..<max(lower, upper)
        }
        columns = pixels(minU, maxU); rows = pixels(minV, maxV)
    }
    public func contains(u: Double, v: Double) -> Bool {
        u.isFinite && v.isFinite && u >= minU && u < maxU && v >= minV && v < maxV
    }
    func touchesBorder(u: Double, v: Double) -> Bool {
        u <= minU || u >= maxU || v <= minV || v >= maxV
    }
}

/// A fixed square: its side is 10% of the shorter dimension of DepthWindow.
struct DepthDistanceWindow {
    private let centreU: Double, centreV: Double, halfSide: Double
    init(width: Int, height: Int) {
        centreU = Double(width) / 2; centreV = Double(height) / 2
        // Use the continuous window size rather than rounded pixel counts.
        halfSide = Double(min(width, height)) * (1 - 2 * DepthWindow.inset) * 0.10 / 2
    }
    func contains(_ sample: DepthSample) -> Bool {
        sample.u >= centreU - halfSide && sample.u < centreU + halfSide
            && sample.v >= centreV - halfSide && sample.v < centreV + halfSide
    }
}

/// Median camera-space Z in metres, independent of support-plane or item fitting.
public func distanceMeters(samples: [DepthSample], width: Int, height: Int) -> Double? {
    guard width > 0, height > 0 else { return nil }
    let window = DepthDistanceWindow(width: width, height: height)
    let depths = samples.filter {
        $0.highConfidence && $0.depth.isFinite && $0.depth > 0 && window.contains($0)
    }.map(\.depth).sorted()
    guard depths.count >= 20 else { return nil }
    let middle = depths.count / 2
    return depths.count.isMultiple(of: 2) ? depths[middle - 1] / 2 + depths[middle] / 2 : depths[middle]
}

/// Copies scalar samples only; row strides are bytes and may include padding.
public func samples(depth: UnsafeRawPointer, depthStride: Int, confidence: UnsafeRawPointer,
                    confidenceStride: Int, width: Int, height: Int,
                    isHigh: (UInt8) -> Bool) -> [DepthSample] {
    let window = DepthWindow(width: width, height: height)
    var result: [DepthSample] = []
    result.reserveCapacity(window.columns.count * window.rows.count)
    for y in window.rows {
        for x in window.columns {
            let flag = confidence.load(fromByteOffset: y * confidenceStride + x, as: UInt8.self)
            guard isHigh(flag) else { continue }
            let value = depth.loadUnaligned(fromByteOffset: y * depthStride + x * MemoryLayout<Float>.stride, as: Float.self)
            result.append(DepthSample(u: Double(x) + 0.5, v: Double(y) + 0.5,
                                      depth: Double(value), highConfidence: true))
        }
    }
    return result
}

public enum DepthMeasurement: Equatable {
    case extent(DepthExtent)
    case clipped
    case insufficientGeometry
}

struct DepthMeasurementInput {
    let samples: [DepthSample]
    let intrinsics: DepthIntrinsics
    let width: Int, height: Int
}

/// Admission and completion belong to the delegate queue; only copied values
/// cross to the measurement queue. A busy worker never calls the copy closure.
final class DepthMeasurementQueue {
    private let callbackQueue: DispatchQueue
    private let queue = DispatchQueue(label: "secondhand.capture-depth.measurement")
    private let measure: (DepthMeasurementInput) -> DepthMeasurement
    private(set) var isBusy = false
    private var revision = 0

    init(callbackQueue: DispatchQueue,
         measure: @escaping (DepthMeasurementInput) -> DepthMeasurement = {
             DepthGeometry.measurement(samples: $0.samples, intrinsics: $0.intrinsics, width: $0.width, height: $0.height)
         }) {
        self.callbackQueue = callbackQueue; self.measure = measure
    }

    @discardableResult
    func submit(copy: () -> DepthMeasurementInput?, completion: @escaping (DepthMeasurement?) -> Void) -> Bool {
        dispatchPrecondition(condition: .onQueue(callbackQueue))
        guard !isBusy, let input = copy() else { return false }
        isBusy = true
        let submittedRevision = revision
        queue.async { [self] in
            let result = measure(input)
            callbackQueue.async { [self] in
                isBusy = false
                completion(submittedRevision == revision ? result : nil)
            }
        }
        return true
    }

    func invalidate() {
        dispatchPrecondition(condition: .onQueue(callbackQueue))
        revision += 1
    }
}

struct DepthStatus {
    private var previous: String?
    mutating func changed(to state: String) -> Bool {
        guard state != previous else { return false }
        previous = state
        return true
    }
}

private struct Cell: Hashable {
    let x: Int, y: Int
}

private struct ItemPoint {
    let projected: Point2
    let distance: Double
}

public enum DepthGeometry {
    private static let minimumPoints = 12 // Require support and item evidence beyond a few pixels.
    public static let maximumRANSACPoints = 3000 // Bound Debug fitting work independently of sensor resolution.
    private static let ransacTrials = 384 // Deterministic attempts include minority support below a dominant box top.
    private static let planeTolerance = 0.003 // Initial consensus radius admits millimetre-scale depth noise.
    private static let minimumMargin = 0.005 // Keep a 5 mm separation even on an exact synthetic plane.
    private static let noiseMultiples = 3.0 // Three residual sigmas exclude most Gaussian table noise on either side.
    private static let maximumBelowFraction = 0.02 // Reject box tops with visible support underneath.
    private static let cellSize = 0.01 // A centimetre occupancy grid separates detached clutter.
    private static let heightPercentile = 0.98 // One flying pixel must not set the height.
    private static let heightNoiseQuantile = 2.0537489106 // Gaussian 98th percentile bias, in measured item-top sigmas.
    private static let gaussianMedianDeviation = 0.6744897502 // Converts a Gaussian median absolute deviation to sigma.
    private static let radiusPercentile = 0.99 // Trim distant in-plane pixels before the hull.
    private static let edgeTailFraction = 0.005 // Trim rare edge noise after finding rectangle orientation.

    public static func measure(samples: [DepthSample], intrinsics: DepthIntrinsics,
                               width: Int, height: Int) -> DepthExtent? {
        if case let .extent(extent) = measurement(samples: samples, intrinsics: intrinsics, width: width, height: height) {
            return extent
        }
        return nil
    }

    public static func measurement(samples: [DepthSample], intrinsics k: DepthIntrinsics,
                                   width: Int, height: Int) -> DepthMeasurement {
        guard width > 0, height > 0, k.fx.isFinite, k.fy.isFinite,
              k.fx > 0, k.fy > 0, k.ox.isFinite, k.oy.isFinite else { return .insufficientGeometry }
        let window = DepthWindow(width: width, height: height)
        var points: [Point] = []
        for s in samples {
            guard s.highConfidence, s.depth.isFinite, s.depth > 0, window.contains(u: s.u, v: s.v) else { continue }
            let p = Point(x: (s.u-k.ox)*s.depth/k.fx, y: (s.v-k.oy)*s.depth/k.fy, z: s.depth)
            guard p.x.isFinite, p.y.isFinite else { continue }
            points.append(p)
        }
        guard points.count >= minimumPoints, let (plane, margin, sigma) = supportPlane(points) else { return .insufficientGeometry }
        let reference = abs(plane.normal.x) < 0.9 ? Point(x: 1, y: 0, z: 0) : Point(x: 0, y: 1, z: 0)
        let cross = plane.normal.cross(reference)
        let axis = cross * (1 / cross.length), other = plane.normal.cross(axis)
        let item = points.indices.compactMap { i -> ItemPoint? in
            let distance = plane.distance(points[i])
            guard distance > margin else { return nil }
            return ItemPoint(projected: Point2(x: points[i].dot(axis), y: points[i].dot(other)), distance: distance)
        }
        // Intersect the window-centre ray with the support plane to choose in plane coordinates.
        let ray = Point(x: (Double(width)/2-k.ox)/k.fx, y: (Double(height)/2-k.oy)/k.fy, z: 1)
        let denominator = plane.normal.dot(ray)
        guard abs(denominator) > 1e-9 else { return .insufficientGeometry }
        let centre = ray * (-plane.offset / denominator)
        let kept = cluster(item, centre: Point2(x: centre.dot(axis), y: centre.dot(other)))
        guard kept.count >= minimumPoints else { return .insufficientGeometry }
        guard !kept.contains(where: { clippedCell($0, plane: plane, axis: axis, other: other, window: window, intrinsics: k) })
        else { return .clipped }
        let cx = kept.reduce(0) { $0 + $1.projected.x } / Double(kept.count)
        let cy = kept.reduce(0) { $0 + $1.projected.y } / Double(kept.count)
        let radii = kept.map { hypot($0.projected.x-cx, $0.projected.y-cy) }
        let radius = percentile(radii, radiusPercentile)
        let trimmed = kept.indices.filter { radii[$0] <= radius }.map { kept[$0].projected }
        guard let sides = rectangle(trimmed, trimEdges: sigma > minimumMargin/noiseMultiples),
              sides.0 > 0, sides.1 > 0 else { return .insufficientGeometry }
        let distances = kept.map(\.distance), rawHeight = percentile(distances, heightPercentile)
        let top = distances.filter { $0 >= rawHeight - noiseMultiples*max(planeTolerance, sigma) }
        let median = percentile(top, 0.5)
        let topSigma = percentile(top.map { abs($0-median) }, 0.5) / gaussianMedianDeviation
        return .extent(DepthExtent(width: max(sides.0, sides.1)*100, depth: min(sides.0, sides.1)*100,
                                   height: max(0, rawHeight - heightNoiseQuantile*topSigma)*100))
    }

    private static func percentile(_ values: [Double], _ fraction: Double) -> Double {
        let sorted = values.sorted()
        return sorted[Int(Double(sorted.count-1) * fraction)]
    }

    private static func clippedCell(_ point: ItemPoint, plane: Plane, axis: Point, other: Point,
                                    window: DepthWindow, intrinsics k: DepthIntrinsics) -> Bool {
        let x = floor(point.projected.x/cellSize)*cellSize, y = floor(point.projected.y/cellSize)*cellSize
        for dx in [0.0, cellSize] {
            for dy in [0.0, cellSize] {
                let corner = axis*(x+dx) + other*(y+dy) + plane.normal*(point.distance-plane.offset)
                if corner.z <= 0 || window.touchesBorder(u: k.fx*corner.x/corner.z+k.ox, v: k.fy*corner.y/corner.z+k.oy) {
                    return true
                }
            }
        }
        return false
    }

    private static func cluster(_ item: [ItemPoint], centre: Point2) -> [ItemPoint] {
        func cell(_ p: Point2) -> Cell { Cell(x: Int(floor(p.x/cellSize)), y: Int(floor(p.y/cellSize))) }
        var bins: [Cell: [Int]] = [:]
        for i in item.indices { bins[cell(item[i].projected), default: []].append(i) }
        var seen: Set<Cell> = [], chosen: [Int] = [], nearest = Double.infinity
        // Input order, rather than Dictionary iteration, makes equal-distance choices repeatable.
        for point in item {
            let start = cell(point.projected)
            guard seen.insert(start).inserted else { continue }
            var pending = [start], head = 0, indices: [Int] = [], distance = Double.infinity
            while head < pending.count {
                let current = pending[head]; head += 1
                indices.append(contentsOf: bins[current]!)
                let dx = max(Double(current.x)*cellSize-centre.x, 0, centre.x-Double(current.x+1)*cellSize)
                let dy = max(Double(current.y)*cellSize-centre.y, 0, centre.y-Double(current.y+1)*cellSize)
                distance = min(distance, hypot(dx, dy))
                for x in -1...1 {
                    for y in -1...1 where x != 0 || y != 0 {
                        let neighbor = Cell(x: current.x+x, y: current.y+y)
                        if bins[neighbor] != nil && seen.insert(neighbor).inserted { pending.append(neighbor) }
                    }
                }
            }
            guard indices.count >= minimumPoints else { continue }
            if distance < nearest { nearest = distance; chosen = indices }
        }
        return chosen.map { item[$0] }
    }

    private static func supportPlane(_ allPoints: [Point]) -> (Plane, Double, Double)? {
        let stride = max(1, (allPoints.count + maximumRANSACPoints - 1) / maximumRANSACPoints)
        let points = Swift.stride(from: 0, to: allPoints.count, by: stride).map { allPoints[$0] }
        var seed: UInt64 = 0x43415054555245
        func nextIndex() -> Int {
            seed = seed &* 6364136223846793005 &+ 1442695040888963407
            return Int(((seed >> 32) * UInt64(points.count)) >> 32)
        }
        var candidates: [(plane: Plane, count: Int, residual: Double)] = []
        for _ in 0..<ransacTrials {
            let a = points[nextIndex()], b = points[nextIndex()], c = points[nextIndex()]
            let cross = (b-a).cross(c-a)
            guard cross.length > 1e-9 else { continue }
            var normal = cross * (1 / cross.length)
            if normal.dot(a) > 0 { normal = normal * -1 }
            let candidate = Plane(normal: normal, offset: -normal.dot(a))
            var count = 0, residual = 0.0
            for point in points {
                let distance = abs(candidate.distance(point))
                if distance <= planeTolerance { count += 1; residual += distance }
            }
            if count >= minimumPoints { candidates.append((candidate, count, residual)) }
        }
        candidates.sort { $0.count == $1.count ? $0.residual < $1.residual : $0.count > $1.count }
        var refitted: Set<[Int]> = []
        for candidate in candidates {
            // Widen consensus before measuring sigma: a 3 mm truncated distribution
            // would underestimate 3 mm Gaussian noise. Refit again on that consensus.
            let indices = points.indices.filter { abs(candidate.plane.distance(points[$0])) <= planeTolerance }
            // Identical consensus sets produce the same least-squares fit.
            guard refitted.insert(indices).inserted else { continue }
            let initial = indices.map { points[$0] }
            guard let first = leastSquares(initial) else { continue }
            let inliers = points.filter { abs(first.distance($0)) <= noiseMultiples * planeTolerance }
            guard let plane = leastSquares(inliers) else { continue }
            let sigma = sqrt(inliers.reduce(0) { $0 + pow(plane.distance($1), 2) } / Double(max(1, inliers.count-3)))
            let margin = max(minimumMargin, noiseMultiples * sigma)
            let below = points.reduce(0) { $0 + (plane.distance($1) < -margin ? 1 : 0) }
            if Double(below) <= Double(points.count) * maximumBelowFraction { return (plane, margin, sigma) }
        }
        return nil
    }

    /// Total least squares: the covariance eigenvector with smallest eigenvalue.
    private static func leastSquares(_ points: [Point]) -> Plane? {
        guard points.count >= minimumPoints else { return nil }
        let sum = points.reduce(Point(x: 0, y: 0, z: 0)) { Point(x: $0.x+$1.x, y: $0.y+$1.y, z: $0.z+$1.z) }
        let centre = sum * (1 / Double(points.count))
        var xx = 0.0, xy = 0.0, xz = 0.0, yy = 0.0, yz = 0.0, zz = 0.0
        for p in points {
            let v = p-centre
            xx += v.x*v.x; xy += v.x*v.y; xz += v.x*v.z
            yy += v.y*v.y; yz += v.y*v.z; zz += v.z*v.z
        }
        var a = [[xx, xy, xz], [xy, yy, yz], [xz, yz, zz]]
        var vectors = [[1.0, 0, 0], [0, 1.0, 0], [0, 0, 1.0]]
        for _ in 0..<24 {
            var p = 0, q = 1
            for i in 0..<3 { for j in (i+1)..<3 where abs(a[i][j]) > abs(a[p][q]) { p = i; q = j } }
            if abs(a[p][q]) < 1e-14 { break }
            let angle = 0.5 * atan2(2*a[p][q], a[q][q]-a[p][p])
            let c = cos(angle), s = sin(angle), app = a[p][p], aqq = a[q][q], apq = a[p][q]
            for i in 0..<3 where i != p && i != q {
                let aip = a[i][p], aiq = a[i][q]
                a[i][p] = c*aip-s*aiq; a[p][i] = a[i][p]
                a[i][q] = s*aip+c*aiq; a[q][i] = a[i][q]
            }
            a[p][p] = c*c*app-2*s*c*apq+s*s*aqq
            a[q][q] = s*s*app+2*s*c*apq+c*c*aqq; a[p][q] = 0; a[q][p] = 0
            for i in 0..<3 {
                let vip = vectors[i][p], viq = vectors[i][q]
                vectors[i][p] = c*vip-s*viq; vectors[i][q] = s*vip+c*viq
            }
        }
        let eigenvalues = (0..<3).sorted { a[$0][$0] < a[$1][$1] }
        guard a[eigenvalues[1]][eigenvalues[1]] > 1e-12 else { return nil }
        let i = eigenvalues[0]
        var normal = Point(x: vectors[0][i], y: vectors[1][i], z: vectors[2][i])
        if normal.dot(centre) > 0 { normal = normal * -1 }
        return Plane(normal: normal, offset: -normal.dot(centre))
    }

    private static func rectangle(_ points: [Point2], trimEdges: Bool) -> (Double, Double)? {
        let sorted = points.sorted { $0.x == $1.x ? $0.y < $1.y : $0.x < $1.x }
        var unique: [Point2] = []
        for p in sorted where unique.last != p { unique.append(p) }
        guard unique.count >= 3 else { return nil }
        func turn(_ a: Point2, _ b: Point2, _ c: Point2) -> Double {
            (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x)
        }
        func half(_ input: [Point2]) -> [Point2] {
            var out: [Point2] = []
            for p in input {
                while out.count >= 2 && turn(out[out.count-2], out[out.count-1], p) <= 0 { out.removeLast() }
                out.append(p)
            }
            return Array(out.dropLast())
        }
        let hull = half(unique) + half(Array(unique.reversed()))
        guard hull.count >= 3 else { return nil }
        var best: (Double, Double)?, area = Double.infinity, angle = (1.0, 0.0)
        for i in hull.indices {
            let p = hull[i], q = hull[(i+1) % hull.count]
            let dx = q.x-p.x, dy = q.y-p.y, length = hypot(dx, dy)
            let ux = dx/length, uy = dy/length
            var minX = Double.infinity, maxX = -Double.infinity
            var minY = Double.infinity, maxY = -Double.infinity
            for v in hull {
                let x = v.x*ux + v.y*uy, y = -v.x*uy + v.y*ux
                minX = min(minX, x); maxX = max(maxX, x)
                minY = min(minY, y); maxY = max(maxY, y)
            }
            let w = maxX-minX, d = maxY-minY
            if w*d < area { area = w*d; best = (w, d); angle = (ux, uy) }
        }
        if trimEdges {
            let x = points.map { $0.x*angle.0 + $0.y*angle.1 }
            let y = points.map { -$0.x*angle.1 + $0.y*angle.0 }
            return (percentile(x, 1-edgeTailFraction)-percentile(x, edgeTailFraction),
                    percentile(y, 1-edgeTailFraction)-percentile(y, edgeTailFraction))
        }
        return best
    }
}
