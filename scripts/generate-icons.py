"""Build theme-aware logos and PWA icons from brand/logo-source.png."""

from __future__ import annotations

from base64 import b64encode
from collections import deque
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'brand' / 'logo-source.png'
PUBLIC = ROOT / 'public'
BRAND = ROOT / 'brand'

# Source sheet cyan (legacy mark art)
SOURCE_CYAN = (5, 164, 185, 255)

# Brand palette aligned with src/index.css accents
LIGHT = {
    'house': (15, 28, 39, 255),  # --text
    'path': (11, 92, 86, 255),  # --bloque-teal
    'check': (15, 118, 110, 255),  # --accent
}
DARK = {
    'house': (45, 212, 191, 255),  # --accent dark
    'path': (20, 184, 166, 255),  # teal-500
    'check': (236, 253, 245, 255),  # mint highlight
}
PWA_BG = (15, 118, 110, 255)  # --accent light
PWA = {
    'house': (2, 6, 23, 255),  # near-black for icon contrast
    'path': (2, 6, 23, 255),
    'check': (240, 253, 250, 255),  # mint-50
}


def is_source_cyan(pixel: tuple[int, ...], tol: int = 48) -> bool:
    r, g, b = pixel[:3]
    cr, cg, cb, _ = SOURCE_CYAN
    return abs(r - cr) + abs(g - cg) + abs(b - cb) < tol


def is_black(pixel: tuple[int, ...], tol: int = 40) -> bool:
    r, g, b = pixel[:3]
    return r + g + b < tol


def flood_background(px, width: int, height: int) -> list[list[bool]]:
    bg = [[False] * width for _ in range(height)]
    q: deque[tuple[int, int]] = deque()
    for x in range(width):
        for y in (0, height - 1):
            if is_source_cyan(px[x, y]):
                bg[y][x] = True
                q.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if is_source_cyan(px[x, y]) and not bg[y][x]:
                bg[y][x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and not bg[ny][nx] and is_source_cyan(px[nx, ny]):
                bg[ny][nx] = True
                q.append((nx, ny))
    return bg


def connected_components(mask: Image.Image) -> list[list[tuple[int, int]]]:
    width, height = mask.size
    px = mask.load()
    seen = [[False] * width for _ in range(height)]
    comps: list[list[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            if not px[x, y] or seen[y][x]:
                continue
            q: deque[tuple[int, int]] = deque([(x, y)])
            seen[y][x] = True
            cells: list[tuple[int, int]] = []
            while q:
                cx, cy = q.popleft()
                cells.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < width and 0 <= ny < height and px[nx, ny] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            comps.append(cells)
    return comps


def extract_layers(sheet: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image]:
    width, height = sheet.size
    split = next(
        (x for x in range(width // 3, (2 * width) // 3) if sheet.getpixel((x, 8))[1] > 80),
        width // 2,
    )
    right_end = next(
        (x for x in range(width - 1, split, -1) if sheet.getpixel((x, height // 2))[1] > 80),
        width,
    ) + 1
    right = sheet.crop((split + 2, 0, right_end, height))
    rw, rh = right.size
    px = right.load()
    bg = flood_background(px, rw, rh)

    body = Image.new('L', (rw, rh), 0)
    detail = Image.new('L', (rw, rh), 0)
    bp, dp = body.load(), detail.load()
    for y in range(rh):
        for x in range(rw):
            if is_black(px[x, y]):
                bp[x, y] = 255
            elif is_source_cyan(px[x, y]) and not bg[y][x]:
                dp[x, y] = 255

    house = Image.new('L', (rw, rh), 0)
    path = Image.new('L', (rw, rh), 0)
    hp, pp = house.load(), path.load()
    path_threshold = int(rh * 0.72)
    for cells in connected_components(body):
        cy = sum(y for _x, y in cells) // len(cells)
        target = pp if cy >= path_threshold else hp
        for x, y in cells:
            target[x, y] = 255

    return house, path, detail


def trim_masks(*masks: Image.Image) -> tuple[Image.Image, ...]:
    bbox = None
    for mask in masks:
        mb = mask.getbbox()
        if not mb:
            continue
        bbox = mb if bbox is None else (
            min(bbox[0], mb[0]),
            min(bbox[1], mb[1]),
            max(bbox[2], mb[2]),
            max(bbox[3], mb[3]),
        )
    if bbox is None:
        return masks
    return tuple(mask.crop(bbox) for mask in masks)


def square_pad_masks(masks: tuple[Image.Image, ...], pad_ratio: float = 0.06) -> tuple[Image.Image, ...]:
    width, height = masks[0].size
    side = int(max(width, height) * (1 + pad_ratio * 2))
    ox, oy = (side - width) // 2, (side - height) // 2
    out: list[Image.Image] = []
    for mask in masks:
        canvas = Image.new('L', (side, side), 0)
        canvas.paste(mask, (ox, oy))
        out.append(canvas)
    return tuple(out)


def compose(
    masks: tuple[Image.Image, ...],
    palette: dict[str, tuple[int, int, int, int]],
    size: int,
) -> Image.Image:
    house, path, detail = (m.resize((size, size), Image.Resampling.LANCZOS) for m in masks)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for mask, key in ((house, 'house'), (path, 'path'), (detail, 'check')):
        layer = Image.new('RGBA', (size, size), palette[key])
        out.paste(layer, (0, 0), mask)
    return out


def rounded_icon(
    mark: Image.Image,
    size: int,
    bg: tuple[int, int, int, int],
    pad_ratio: float,
    radius_ratio: float,
) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=bg)
    inner = int(size * (1 - pad_ratio * 2))
    fitted = mark.resize((inner, inner), Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((size - inner) // 2, (size - inner) // 2), fitted)
    return canvas


def mask_to_png_data_uri(mask: Image.Image, size: int = 256) -> str:
    alpha = mask.resize((size, size), Image.Resampling.LANCZOS)
    rgba = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    rgba.putalpha(alpha)
    buf = BytesIO()
    rgba.save(buf, format='PNG')
    return 'data:image/png;base64,' + b64encode(buf.getvalue()).decode('ascii')


def write_logo_mark_svg(house: Image.Image, path: Image.Image, detail: Image.Image) -> None:
    size = 256
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="MaintManage">',
        '  <style>',
        '    :root {',
        '      --logo-house: #0f1c27;',
        '      --logo-path: #0b5c56;',
        '      --logo-check: #0f766e;',
        '    }',
        '    @media (prefers-color-scheme: dark) {',
        '      :root {',
        '        --logo-house: #2dd4bf;',
        '        --logo-path: #14b8a6;',
        '        --logo-check: #ecfdf5;',
        '      }',
        '    }',
        '  </style>',
    ]
    for mask, cls, fill in (
        (house, 'house', 'var(--logo-house)'),
        (path, 'path', 'var(--logo-path)'),
        (detail, 'check', 'var(--logo-check)'),
    ):
        href = mask_to_png_data_uri(mask, size)
        mid = f'mask-{cls}'
        parts.append(f'  <mask id="{mid}"><image width="{size}" height="{size}" href="{href}"/></mask>')
        parts.append(f'  <rect class="{cls}" width="{size}" height="{size}" fill="{fill}" mask="url(#{mid})"/>')
    parts.append('</svg>')
    (BRAND / 'logo-mark.svg').write_text('\n'.join(parts) + '\n', encoding='utf-8')


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
    house, path, detail = trim_masks(*extract_layers(sheet))
    masks = square_pad_masks((house, path, detail))

    BRAND.mkdir(exist_ok=True)
    PUBLIC.mkdir(exist_ok=True)

    for name, mask in zip(('house', 'path', 'check'), masks, strict=True):
        mask.save(BRAND / f'logo-mask-{name}.png')

    write_logo_mark_svg(*masks)

    light = compose(masks, LIGHT, 256)
    dark = compose(masks, DARK, 256)
    pwa_mark = compose(masks, PWA, 512)

    light.save(PUBLIC / 'logo-light.png')
    dark.save(PUBLIC / 'logo-dark.png')

    icon_512 = rounded_icon(pwa_mark, 512, PWA_BG, 0.12, 0.22)
    icon_192 = rounded_icon(pwa_mark, 192, PWA_BG, 0.12, 0.22)
    icon_180 = rounded_icon(pwa_mark, 180, PWA_BG, 0.12, 0.22)
    maskable = rounded_icon(pwa_mark, 512, PWA_BG, 0.22, 0)
    favicon = rounded_icon(pwa_mark, 32, PWA_BG, 0.1, 0.22)

    icon_192.save(PUBLIC / 'pwa-192.png')
    icon_512.save(PUBLIC / 'pwa-512.png')
    maskable.save(PUBLIC / 'pwa-512-maskable.png')
    icon_180.convert('RGB').save(PUBLIC / 'apple-touch-icon.png')
    favicon.save(PUBLIC / 'favicon-32.png')
    write_favicon_svg(PUBLIC / 'favicon-32.png')
    print('Generated theme logos + PWA icons from layered brand mark')


if __name__ == '__main__':
    main()
