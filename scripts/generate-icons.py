"""Draw the house-check mark in the app palette and write icons."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
BRAND = ROOT / 'brand'

# App palette
ACCENT = (15, 118, 110, 255)  # --accent light #0f766e
ACCENT_DARK = (45, 212, 191, 255)  # --accent dark #2dd4bf
NIGHT = (11, 18, 32, 255)  # --bg dark #0b1220
WHITE = (255, 255, 255, 255)


def cubic(p0, p1, p2, p3, steps: int):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def draw_mark(size: int, fill: tuple[int, int, int, int], cut: tuple[int, int, int, int]) -> Image.Image:
    """Viewbox 80x80. House + dots + check + path."""
    scale = size / 80
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def xy(x: float, y: float) -> tuple[float, float]:
        return (x * scale, y * scale)

    def poly(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
        return [xy(x, y) for x, y in points]

    d.polygon(poly([(8, 33), (40, 8), (72, 33)]), fill=fill)
    d.rectangle([xy(18, 32), xy(62, 56)], fill=fill)

    for cx in (33, 40, 47):
        r = 1.7 * scale
        cxp, cyp = xy(cx, 36.4)
        d.ellipse((cxp - r, cyp - r, cxp + r, cyp + r), fill=cut)

    tail = cubic((25.5, 45.5), (24.2, 43.2), (28.5, 42.6), (31.8, 46.2), 20)
    stem = cubic((31.8, 46.2), (34.6, 51.8), (36.4, 54.2), (37.4, 53.2), 16)
    arm = cubic((37.4, 53.2), (42.0, 46.0), (49.5, 36.5), (54.8, 33.2), 24)
    check = tail + stem[1:] + arm[1:]
    chk_w = int(4.6 * scale)
    d.line([xy(x, y) for x, y in check], fill=cut, width=chk_w, joint='curve')
    for x, y in (check[0], check[-1]):
        cxp, cyp = xy(x, y)
        rr = chk_w / 2
        d.ellipse((cxp - rr, cyp - rr, cxp + rr, cyp + rr), fill=cut)

    road = cubic((29, 56), (14, 64), (20, 76), (66, 70), 56)
    width = 5.2 * scale
    d.line([xy(x, y) for x, y in road], fill=fill, width=int(width), joint='curve')
    for x, y in (road[0], road[-1]):
        cxp, cyp = xy(x, y)
        rr = width / 2
        d.ellipse((cxp - rr, cyp - rr, cxp + rr, cyp + rr), fill=fill)
    return im


def square_pad(im: Image.Image, pad_ratio: float = 0.04) -> Image.Image:
    w, h = im.size
    side = int(max(w, h) * (1 + pad_ratio * 2))
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    out.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return out


def render(fill, cut, size=1024) -> Image.Image:
    mark = draw_mark(size, fill, cut)
    bbox = mark.getbbox()
    if bbox:
        mark = mark.crop(bbox)
    return square_pad(mark, 0.06)


def app_icon(mark: Image.Image, size: int, bg: tuple[int, int, int, int], pad_ratio: float, radius_ratio: float) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=bg)
    inner = int(size * (1 - pad_ratio * 2))
    fitted = square_pad(mark, 0.02).resize((inner, inner), Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((size - inner) // 2, (size - inner) // 2), fitted)
    return canvas


def write_svg() -> None:
    BRAND.mkdir(exist_ok=True)
    PUBLIC.mkdir(exist_ok=True)
    (PUBLIC / 'favicon.svg').write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0f766e"/>
  <g transform="translate(2 2) scale(0.75)">
    <path fill="#f3f5f7" d="M8 33 L40 8 L72 33 H62 V56 H18 V33 Z"/>
    <circle fill="#0f766e" cx="33" cy="36.4" r="1.7"/>
    <circle fill="#0f766e" cx="40" cy="36.4" r="1.7"/>
    <circle fill="#0f766e" cx="47" cy="36.4" r="1.7"/>
    <path fill="none" stroke="#0f766e" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"
      d="M25.5 45.5 C24.2 43.2 28.5 42.6 31.8 46.2 C34.6 51.8 36.4 54.2 37.4 53.2 C42 46 49.5 36.5 54.8 33.2"/>
    <path fill="none" stroke="#f3f5f7" stroke-width="5.2" stroke-linecap="round"
      d="M29 56 C14 64 20 76 66 70"/>
  </g>
</svg>
""",
        encoding='utf-8',
    )
    (BRAND / 'logo-mark.svg').write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <path fill="currentColor" d="M8 33 L40 8 L72 33 H62 V56 H18 V33 Z"/>
  <path fill="none" stroke="currentColor" stroke-width="5.2" stroke-linecap="round" d="M29 56 C14 64 20 76 66 70"/>
</svg>
""",
        encoding='utf-8',
    )


def main() -> None:
    write_svg()
    light = render(ACCENT, WHITE)
    dark = render(ACCENT_DARK, NIGHT)
    white_on_teal = render(WHITE, ACCENT)

    light.resize((256, 256), Image.Resampling.LANCZOS).save(PUBLIC / 'logo-light.png')
    dark.resize((256, 256), Image.Resampling.LANCZOS).save(PUBLIC / 'logo-dark.png')

    icon_512 = app_icon(white_on_teal, 512, ACCENT, 0.14, 0.22)
    icon_192 = app_icon(white_on_teal, 192, ACCENT, 0.14, 0.22)
    icon_180 = app_icon(white_on_teal, 180, ACCENT, 0.14, 0.22)
    maskable = app_icon(white_on_teal, 512, ACCENT, 0.22, 0)
    favicon = app_icon(white_on_teal, 32, ACCENT, 0.12, 0.22)

    icon_192.save(PUBLIC / 'pwa-192.png')
    icon_512.save(PUBLIC / 'pwa-512.png')
    maskable.save(PUBLIC / 'pwa-512-maskable.png')
    icon_180.convert('RGB').save(PUBLIC / 'apple-touch-icon.png')
    favicon.save(PUBLIC / 'favicon-32.png')
    print('Icons written to public/')


if __name__ == '__main__':
    main()
