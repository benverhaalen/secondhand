// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DepthGeometry",
    products: [.library(name: "DepthGeometry", targets: ["DepthGeometry"])],
    targets: [
        .target(name: "DepthGeometry"),
        .testTarget(name: "DepthGeometryTests", dependencies: ["DepthGeometry"])
    ]
)
