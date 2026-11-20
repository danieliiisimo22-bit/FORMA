import AppKit

let size = 1024
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                              samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                              bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
let ctx = NSGraphicsContext.current!.cgContext
ctx.clear(CGRect(x: 0, y: 0, width: size, height: size))
ctx.translateBy(x: 80, y: 944)
ctx.scaleBy(x: 18, y: -18)
ctx.setFillColor(red: 216/255, green: 250/255, blue: 116/255, alpha: 1)
ctx.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: 48, height: 48),
                   cornerWidth: 11, cornerHeight: 11, transform: nil))
ctx.fillPath()
let points = [(12,12), (37,12), (31,19), (19,19), (19,24), (32,24), (26,31), (19,31), (19,37), (12,37)]
ctx.setFillColor(red: 23/255, green: 27/255, blue: 13/255, alpha: 1)
ctx.addLines(between: points.map { CGPoint(x: $0.0, y: $0.1) })
ctx.closePath()
ctx.fillPath()
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
