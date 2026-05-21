#!/usr/bin/env python3
"""Generate favicon.ico for Strong Translator - blue square with white 'S' letter."""
import struct
import zlib
import os

# Font 5x7 for letter 'S' (1 = white, 0 = blue)
FONT_S = [
    "01110",
    "10001",
    "10000",
    "01110",
    "00001",
    "10000",
    "01110"
]

BLUE = (30, 60, 114, 255)   # RGBA
WHITE = (255, 255, 255, 255)

def compute_pixel(x, y, size):
    """Return RGBA tuple for pixel (x, y) in icon of given size."""
    margin = size // 8
    inner = size - 2 * margin
    if inner <= 0:
        return BLUE
    # Local coordinates within inner area
    lx = x - margin
    ly = y - margin
    if 0 <= lx < inner and 0 <= ly < inner:
        # Map to 5x7 font grid
        col = int(lx * 5 / inner)
        row = int(ly * 7 / inner)
        if 0 <= row < 7 and 0 <= col < 5:
            if FONT_S[row][col] == '1':
                return WHITE
    return BLUE

def chunk(chunk_type, data):
    """Create PNG chunk with CRC."""
    length = struct.pack('>I', len(data))
    crc_val = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    crc = struct.pack('<I', crc_val)
    return length + chunk_type + data + crc

def create_png(size):
    """Create PNG image bytes for icon size."""
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    # IHDR
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png += chunk(b'IHDR', ihdr)
    # IDAT - image data
    rows = []
    for y in range(size):
        row = bytes([0])  # filter type: none
        for x in range(size):
            r, g, b, a = compute_pixel(x, y, size)
            row += bytes([r, g, b, a])
        rows.append(row)
    raw = b''.join(rows)
    compressed = zlib.compress(raw, 9)
    png += chunk(b'IDAT', compressed)
    # IEND
    png += chunk(b'IEND', b'')
    return png

def main():
    sizes = [16, 32, 48]
    pngs = [create_png(s) for s in sizes]

    # ICO header
    # Reserved: 0, Type: 1 (icon), Count: len(sizes)
    ico = struct.pack('<HHH', 0, 1, len(sizes))

    # Directory entries (16 bytes each)
    offset = 6 + len(sizes) * 16  # after header+dir
    for s, png in zip(sizes, pngs):
        # Width, height (0 = 256)
        w = s if s < 256 else 0
        h = s if s < 256 else 0
        # Colors, reserved
        colors = 0
        reserved = 0
        planes = 1
        bpp = 32
        size_png = len(png)
        entry = struct.pack('<BBBBHHII', w, h, colors, reserved, planes, bpp, size_png, offset)
        ico += entry
        offset += size_png

    # Append PNG data
    for png in pngs:
        ico += png

    out_path = os.path.join(os.path.dirname(__file__), 'favicon.ico')
    with open(out_path, 'wb') as f:
        f.write(ico)
    print(f"favicon.ico created: sizes {sizes}")

if __name__ == '__main__':
    main()
