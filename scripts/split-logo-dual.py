"""Split dual logo sheet into logo-light.png and logo-dark.png."""

from __future__ import annotations

from base64 import b64encode
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'brand' / 'logo-dual-source.png'
PUBLIC = ROOT / 'public'
BRAND = ROOT / 'brand'
PWA_BG = (15, 118, 110, 255)  # --accent


def is_bg(p: tuple[int, ...], tol: int = 30) -> bool:
    r, g, b, a = p
    if a < 12:
        return True
    return r + g + b < tol * 3


def content_bbox(im: Image.Image, pad: int = 4) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    min_x, min_y, max_x, max_y = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if not is_bg(px[x, y]):
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    if max_x < 0:
        return 0, 0, w, h
    return (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + 1 + pad),
        min(h, max_y + 1 + pad),
    )


def make_transparent(im: Image.Image) -> Image.Image:
    out = im.convert('RGBA')
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            if is_bg(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    return out


def export_logo(im: Image.Image, dest: Path, size: int = 512) -> Image.Image:
    clean = make_transparent(im)
    box = content_bbox(clean)
    cropped = clean.crop(box)
    cw, ch = cropped.size
    side = max(cw, ch)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)
    final = canvas.resize((size, size), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    final.save(dest, 'PNG', optimize=True)
    print(f'wrote {dest} ({final.size})')
    return final


def rounded_icon(
    mark: Image.Image,
    size: int,
    bg: tuple[int, int, int, int],
    pad_ratio: float,
) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = int(size * 0.22)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=bg)
    inner = int(size * (1 - pad_ratio * 2))
    fitted = mark.resize((inner, inner), Image.Resampling.LANCZOS)
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
    if not SRC.exists():
        raise SystemExit(f'Missing source sheet: {SRC}')

    sheet = Image.open(SRC).convert('RGBA')
    w, h = sheet.size
    print('sheet', w, h)

    mid = w // 2
    # left = white house → dark theme; right = green house → light theme
    left = sheet.crop((0, 0, mid, h))
    right = sheet.crop((mid, 0, w, h))

    export_logo(left, PUBLIC / 'logo-dark.png')
    light = export_logo(right, PUBLIC / 'logo-light.png')
    export_logo(left, BRAND / 'logo-dark.png')
    export_logo(right, BRAND / 'logo-light.png')

    # PWA / favicon: light mark (dark frame) on brand teal
    mark = light.resize((512, 512), Image.Resampling.LANCZOS)
    rounded_icon(mark, 512, PWA_BG, 0.14).save(PUBLIC / 'pwa-512.png')
    rounded_icon(mark, 192, PWA_BG, 0.14).save(PUBLIC / 'pwa-192.png')
    rounded_icon(mark, 512, PWA_BG, 0.22).save(PUBLIC / 'pwa-512-maskable.png')
    rounded_icon(mark, 180, PWA_BG, 0.14).convert('RGB').save(PUBLIC / 'apple-touch-icon.png')
    favicon = rounded_icon(mark, 32, PWA_BG, 0.12)
    favicon.save(PUBLIC / 'favicon-32.png')
    write_favicon_svg(PUBLIC / 'favicon-32.png')
    print('Updated PWA icons + favicon from new light logo')


if __name__ == '__main__':
    main()
