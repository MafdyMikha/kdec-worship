// macOS AppKit rasterization of the same clean SVG used by the website.
// Run through generate-app-icons.sh from the repository root.
import AppKit

let svg = try String(contentsOfFile: "public/brand/kdec-clean-tower.svg", encoding: .utf8)
    .replacingOccurrences(of: "currentColor", with: "#f6f5f1")
guard let image = NSImage(data: Data(svg.utf8)) else { fatalError("Cannot load clean tower SVG") }
let assets: [(String, Int, CGFloat)] = [
    ("app-icon-192.png", 192, 150),
    ("app-icon-512.png", 512, 400),
    ("app-icon-maskable-512.png", 512, 300),
    ("apple-touch-icon.png", 180, 140),
    ("favicon.png", 64, 50),
]
for (name, size, artworkHeight) in assets {
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: size * 4, bitsPerPixel: 32),
        let context = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("Cannot create icon canvas") }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    NSColor(srgbRed: 16 / 255.0, green: 25 / 255.0, blue: 35 / 255.0, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: size, height: size).fill()
    context.imageInterpolation = .high
    let artworkWidth = artworkHeight * 240 / 264
    image.draw(in: NSRect(x: (CGFloat(size) - artworkWidth) / 2,
        y: (CGFloat(size) - artworkHeight) / 2, width: artworkWidth, height: artworkHeight))
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else { fatalError("Cannot encode icon") }
    try png.write(to: URL(fileURLWithPath: "public/" + name))
    print("Created \(name): \(size)×\(size)")
}
