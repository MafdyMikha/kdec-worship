// macOS AppKit rasterization of the clean identity used by the website.
// Full KDEC Worship lockup for installed apps; tower only for the tiny favicon.
import AppKit

func artwork(_ name: String) throws -> NSImage {
    let svg = try String(contentsOfFile: "public/brand/" + name, encoding: .utf8)
        .replacingOccurrences(of: "currentColor", with: "#f6f5f1")
    guard let image = NSImage(data: Data(svg.utf8)) else { fatalError("Cannot load brand SVG") }
    return image
}
let lockup = try artwork("kdec-clean-lockup.svg")
let tower = try artwork("kdec-clean-tower.svg")
try FileManager.default.createDirectory(atPath: "public/icons", withIntermediateDirectories: true)
let assets: [(String, String, Int, CGFloat)] = [
    ("app-icon-192.png", "kdec-worship-v5-192.png", 192, 158),
    ("app-icon-512.png", "kdec-worship-v5-512.png", 512, 420),
    ("app-icon-maskable-512.png", "kdec-worship-v5-maskable-512.png", 512, 307),
    ("apple-touch-icon.png", "kdec-worship-v5-apple-180.png", 180, 148),
    ("favicon.png", "kdec-worship-v5-favicon.png", 64, 50),
]
for (legacyName, versionedName, size, artworkHeight) in assets {
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: size * 4, bitsPerPixel: 32),
        let context = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("Cannot create icon canvas") }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    NSColor(srgbRed: 16 / 255.0, green: 25 / 255.0, blue: 35 / 255.0, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: size, height: size).fill()
    context.imageInterpolation = .high
    let isFavicon = legacyName == "favicon.png"
    let artworkWidth = artworkHeight * (isFavicon ? 240 / 264.0 : 320 / 384.0)
    (isFavicon ? tower : lockup).draw(in: NSRect(x: (CGFloat(size) - artworkWidth) / 2,
        y: (CGFloat(size) - artworkHeight) / 2, width: artworkWidth, height: artworkHeight))
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else { fatalError("Cannot encode icon") }
    // Keep old URLs valid while new manifest/metadata URLs bypass stale icon caches.
    try png.write(to: URL(fileURLWithPath: "public/" + legacyName))
    try png.write(to: URL(fileURLWithPath: "public/icons/" + versionedName))
    print("Created \(versionedName): \(size)×\(size)")
}
