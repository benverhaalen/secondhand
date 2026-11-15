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

public enum DepthGeometry {
    // Agent-proposed fitting tolerances, not calibrated confidence (always zero at the bridge).
    private static let minimumPoints = 12
    private static let planeTolerance = 0.003
    private static let aboveMargin = 0.005

    public static func measure(samples: [DepthSample], intrinsics k: DepthIntrinsics,
                               width: Int, height: Int) -> DepthExtent? {
        guard width > 0, height > 0, k.fx.isFinite, k.fy.isFinite,
              k.fx > 0, k.fy > 0, k.ox.isFinite, k.oy.isFinite else { return nil }
        let points = samples.compactMap { s -> Point? in
            guard s.highConfidence, s.depth.isFinite, s.depth > 0,
                  s.u >= Double(width) * 0.15, s.u < Double(width) * 0.85,
                  s.v >= Double(height) * 0.15, s.v < Double(height) * 0.85 else { return nil }
            let p = Point(x: (s.u-k.ox)*s.depth/k.fx, y: (s.v-k.oy)*s.depth/k.fy, z: s.depth)
            return p.x.isFinite && p.y.isFinite ? p : nil
        }
        guard points.count >= minimumPoints, let plane = supportPlane(points) else { return nil }
        let item = points.filter { plane.distance($0) > aboveMargin }
        guard item.count >= minimumPoints else { return nil }
        let reference = abs(plane.normal.x) < 0.9 ? Point(x: 1, y: 0, z: 0) : Point(x: 0, y: 1, z: 0)
        let cross = plane.normal.cross(reference)
        let axis = cross * (1 / cross.length), other = plane.normal.cross(axis)
        let projected = item.map { Point2(x: $0.dot(axis), y: $0.dot(other)) }
        guard let sides = rectangle(projected), let height = item.map({ plane.distance($0) }).max(),
              sides.0 > 0, sides.1 > 0 else { return nil }
        return DepthExtent(width: max(sides.0, sides.1)*100,
                           depth: min(sides.0, sides.1)*100, height: height*100)
    }

    private static func supportPlane(_ points: [Point]) -> Plane? {
        var seed: UInt64 = 0x43415054555245
        func nextIndex() -> Int {
            seed = seed &* 6364136223846793005 &+ 1442695040888963407
            return Int((seed >> 32) % UInt64(points.count))
        }
        var best: Plane?, bestCount = 0, bestResidual = Double.infinity
        for _ in 0..<384 {
            let a = points[nextIndex()], b = points[nextIndex()], c = points[nextIndex()]
            let cross = (b-a).cross(c-a)
            guard cross.length > 1e-9 else { continue }
            var normal = cross * (1 / cross.length)
            // Orient toward the camera origin; no ARCamera world transform is needed.
            if normal.dot(a) > 0 { normal = normal * -1 }
            let candidate = Plane(normal: normal, offset: -normal.dot(a))
            var count = 0, below = 0, residual = 0.0
            for point in points {
                let distance = candidate.distance(point)
                if abs(distance) <= planeTolerance { count += 1; residual += abs(distance) }
                if distance < -aboveMargin { below += 1 }
            }
            // A box top is not a support plane when the table lies beneath it.
            guard below <= points.count / 50, count >= minimumPoints else { continue }
            if count > bestCount || (count == bestCount && residual < bestResidual) {
                best = candidate; bestCount = count; bestResidual = residual
            }
        }
        return best
    }

    private static func rectangle(_ points: [Point2]) -> (Double, Double)? {
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
        var best: (Double, Double)?, area = Double.infinity
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
            if w*d < area { area = w*d; best = (w, d) }
        }
        return best
    }
}
