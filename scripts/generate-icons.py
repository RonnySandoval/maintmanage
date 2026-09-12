"""Crop the dual-house brand sheet and write app icons."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'brand' / 'logo-source.png'
PUBLIC = ROOT / 'public'
NAVY = (7, 47, 99, 255)


def cut_house(im: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = im.crop(box).convert('RGBA')
    pixels = crop.load()
    w, h = crop.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            luma = r + g + b
            if luma < 22 and b < 40:
                pixels[x, y] = (r, g, b, 0)
            elif luma < 55 and b < 55:
                pixels[x, y] = (r, g, b, int((luma - 22) / 33 * 220))
    return crop.crop(crop.getbbox())


def square_pad(im: Image.Image, pad_ratio: float = 0.08) -> Image.Image:
    w, h = im.size
    side = int(max(w, h) * (1 + pad_ratio * 2))
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    out.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return out


def app_icon(house: Image.Image, size: int, pad_ratio: float, radius_ratio: float = 0.22) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=NAVY)
    inner = int(size * (1 - pad_ratio * 2))
    mark = square_pad(house, 0.02).resize((inner, inner), Image.Resampling.LANCZOS)
    canvas.paste(mark, ((size - inner) // 2, (size - inner) // 2), mark)
    return canvas.convert('RGBA')


def main() -> None:
    sheet = Image.open(SOURCE).convert('RGBA')
    light = cut_house(sheet, (90, 100, 430, 415))
    dark = cut_house(sheet, (598, 98, 936, 415))
    light_sq = square_pad(light)
    dark_sq = square_pad(dark)

    PUBLIC.mkdir(exist_ok=True)
    light_sq.resize((256, 256), Image.Resampling.LANCZOS).save(PUBLIC / 'logo-light.png')
    dark_sq.resize((256, 256), Image.Resampling.LANCZOS).save(PUBLIC / 'logo-dark.png')

    icon_512 = app_icon(dark, 512, pad_ratio=0.18)
    icon_192 = app_icon(dark, 192, pad_ratio=0.18)
    icon_180 = app_icon(dark, 180, pad_ratio=0.18)
    maskable = app_icon(dark, 512, pad_ratio=0.24, radius_ratio=0)
    favicon = app_icon(dark, 32, pad_ratio=0.16, radius_ratio=0.22)

    icon_192.save(PUBLIC / 'pwa-192.png')
    icon_512.save(PUBLIC / 'pwa-512.png')
    maskable.save(PUBLIC / 'pwa-512-maskable.png')
    icon_180.convert('RGB').save(PUBLIC / 'apple-touch-icon.png')
    favicon.save(PUBLIC / 'favicon-32.png')
    print('Icons written to public/')


if __name__ == '__main__':
    main()
