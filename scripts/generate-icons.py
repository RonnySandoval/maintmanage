"""Crop the provided dual-mark sheet. Shape is not redrawn."""

from base64 import b64encode
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'brand' / 'logo-source.png'
PUBLIC = ROOT / 'public'

CYAN = (5, 164, 185, 255)


def knockout_black(im: Image.Image) -> Image.Image:
    out = im.convert('RGBA')
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            luma = r + g + b
            if luma < 20 and g < 35:
                px[x, y] = (r, g, b, 0)
            elif luma < 70 and g < 50:
                px[x, y] = (r, g, b, int((luma - 20) / 50 * 230))
    return out


def knockout_cyan(im: Image.Image) -> Image.Image:
    out = im.convert('RGBA')
    px = out.load()
    w, h = out.size
    cr, cg, cb, _ = CYAN
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            dist = abs(r - cr) + abs(g - cg) + abs(b - cb)
            if dist < 48:
                px[x, y] = (r, g, b, 0)
            elif dist < 110:
                px[x, y] = (r, g, b, int((dist - 48) / 62 * 230))
    return out


def trim(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    return im.crop(bbox)


def square_pad(im: Image.Image, pad_ratio: float = 0.06) -> Image.Image:
    w, h = im.size
    side = int(max(w, h) * (1 + pad_ratio * 2))
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    out.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return out


def rounded_icon(mark: Image.Image, size: int, bg: tuple[int, int, int, int], pad_ratio: float, radius_ratio: float) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=bg)
    inner = int(size * (1 - pad_ratio * 2))
    fitted = square_pad(mark, 0.0).resize((inner, inner), Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((size - inner) // 2, (size - inner) // 2), fitted)
    return canvas


def write_favicon_svg(png_path: Path) -> None:
    data = b64encode(png_path.read_bytes()).decode('ascii')
    (PUBLIC / 'favicon.svg').write_text(
        f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <image href="data:image/png;base64,{data}" width="32" height="32"/>
</svg>
""",
        encoding='utf-8',
    )


def main() -> None:
    sheet = Image.open(SOURCE).convert('RGBA')
    w, h = sheet.size
    split = next(
        (x for x in range(w // 3, (2 * w) // 3) if sheet.getpixel((x, 8))[1] > 80),
        w // 2,
    )
    right_end = next(
        (x for x in range(w - 1, split, -1) if sheet.getpixel((x, h // 2))[1] > 80),
        w,
    ) + 1

    left = knockout_black(sheet.crop((0, 0, max(split - 4, 1), h)))
    right = knockout_cyan(sheet.crop((split + 2, 0, right_end, h)))
    dark = square_pad(trim(left))
    light = square_pad(trim(right))

    PUBLIC.mkdir(exist_ok=True)
    light.resize((256, 256), Image.Resampling.LANCZOS).save(PUBLIC / 'logo-light.png')
    dark.resize((256, 256), Image.Resampling.LANCZOS).save(PUBLIC / 'logo-dark.png')

    icon_512 = rounded_icon(light, 512, CYAN, 0.12, 0.22)
    icon_192 = rounded_icon(light, 192, CYAN, 0.12, 0.22)
    icon_180 = rounded_icon(light, 180, CYAN, 0.12, 0.22)
    maskable = rounded_icon(light, 512, CYAN, 0.22, 0)
    favicon = rounded_icon(light, 32, CYAN, 0.1, 0.22)

    icon_192.save(PUBLIC / 'pwa-192.png')
    icon_512.save(PUBLIC / 'pwa-512.png')
    maskable.save(PUBLIC / 'pwa-512-maskable.png')
    icon_180.convert('RGB').save(PUBLIC / 'apple-touch-icon.png')
    favicon.save(PUBLIC / 'favicon-32.png')
    write_favicon_svg(PUBLIC / 'favicon-32.png')
    print(f'Icons from {SOURCE.name} (split={split}, right_end={right_end})')


if __name__ == '__main__':
    main()
