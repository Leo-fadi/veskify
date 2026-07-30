import AppKit
import Foundation
import PDFKit

guard CommandLine.arguments.count == 3 else {
    fputs("usage: render-pdf-pages.swift <input.pdf> <output-directory>\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
guard let document = PDFDocument(url: inputURL) else {
    fputs("could not open PDF\n", stderr)
    exit(1)
}

try FileManager.default.createDirectory(
    at: outputURL,
    withIntermediateDirectories: true
)

func fail(_ message: String) -> Never {
    fputs("\(message)\n", stderr)
    exit(1)
}

var renderedPageCount = 0

for index in 0..<document.pageCount {
    guard let page = document.page(at: index) else {
        fail("could not load PDF page \(index + 1)")
    }
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2
    let width = Int(bounds.width * scale)
    let height = Int(bounds.height * scale)
    guard
        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: width,
            pixelsHigh: height,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
    )
    else {
        fail("could not allocate bitmap for PDF page \(index + 1)")
    }

    NSGraphicsContext.saveGraphicsState()
    guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        NSGraphicsContext.restoreGraphicsState()
        fail("could not create graphics context for PDF page \(index + 1)")
    }
    NSGraphicsContext.current = context
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()
    context.cgContext.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context.cgContext)
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()

    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        fail("could not encode PDF page \(index + 1) as PNG")
    }
    let fileName = String(format: "page-%03d.png", index + 1)
    do {
        try png.write(to: outputURL.appendingPathComponent(fileName))
        renderedPageCount += 1
    } catch {
        fail("could not write PDF page \(index + 1): \(error)")
    }
}

guard renderedPageCount == document.pageCount else {
    fail("rendered \(renderedPageCount) of \(document.pageCount) PDF pages")
}

print("Rendered \(renderedPageCount) pages to \(outputURL.path)")
