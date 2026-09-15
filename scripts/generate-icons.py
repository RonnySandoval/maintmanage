"""Build theme logos + PWA icons from brand/logo-source (2×2 status mark)."""

from __future__ import annotations

from base64 import b64encode
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / 'brand'
PUBLIC = ROOT / 'public'

SOURCE_CANDIDATES = (
  BRAND / 'logo-source.png',
  BRAND / 'logo-source.jpg',
  BRAND / 'logo-source.jpeg',
  BRAND / 'logo-source.webp',
)

# Near-black background of the source mark
BG_LUMA_MAX = 28


def find_source() -> Path:
  for path in SOURCE_CANDIDATES:
    if path.exists():
      return path
  raise FileNotFoundError(
    'Missing brand/logo-source.(png|jpg). Place the 2×2 mark there first.',
  )


def is_bg(pixel: tuple[int, ...]) -> bool:
  r, g, b = pixel[:3]
  return (r + g + b) / 3 <= BG_LUMA_MAX


def background_mask(img: Image.Image) -> list[list[bool]]:
  """Flood-fill near-black connected to the image edges (gutters + outer field)."""
  rgb = img.convert('RGB')
  width, height = rgb.size
  px = rgb.load()
  mask = [[False] * width for _ in range(height)]
  q: deque[tuple[int, int]] = deque()

  def try_seed(x: int, y: int) -> None:
    if not mask[y][x] and is_bg(px[x, y]):
      mask[y][x] = True
      q.append((x, y))

  for x in range(width):
    try_seed(x, 0)
    try_seed(x, height - 1)
  for y in range(height):
    try_seed(0, y)
    try_seed(width - 1, y)

  while q:
    x, y = q.popleft()
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
      if 0 <= nx < width and 0 <= ny < height and not mask[ny][nx] and is_bg(px[nx, ny]):
        mask[ny][nx] = True
        q.append((nx, ny))
  return mask


def apply_background(
  img: Image.Image,
  mask: list[list[bool]],
  color: tuple[int, int, int, int],
) -> Image.Image:
  rgba = img.convert('RGBA')
  width, height = rgba.size
  px = rgba.load()
  for y in range(height):
    for x in range(width):
      if mask[y][x]:
        px[x, y] = color
  return rgba


def fit_square(img: Image.Image, size: int) -> Image.Image:
  return img.resize((size, size), Image.Resampling.LANCZOS)


def rounded_icon(mark: Image.Image, size: int, radius_ratio: float = 0.22) -> Image.Image:
  fitted = fit_square(mark, size)
  if radius_ratio <= 0:
    return fitted
  mask = Image.new('L', (size, size), 0)
  draw = ImageDraw.Draw(mask)
  radius = int(size * radius_ratio)
  draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
  out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
  out.paste(fitted, (0, 0), mask)
  return out


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
  source_path = find_source()
  source = Image.open(source_path).convert('RGBA')
  mask = background_mask(source)

  light = apply_background(source, mask, (255, 255, 255, 255))
  dark = apply_background(source, mask, (0, 0, 0, 255))

  BRAND.mkdir(exist_ok=True)
  PUBLIC.mkdir(exist_ok=True)

  light_256 = fit_square(light, 256)
  dark_256 = fit_square(dark, 256)
  light_256.save(PUBLIC / 'logo-light.png')
  dark_256.save(PUBLIC / 'logo-dark.png')
  light_256.save(BRAND / 'logo-light.png')
  dark_256.save(BRAND / 'logo-dark.png')

  # App / PWA icons: dark mark reads well as a home-screen tile
  icon_base = fit_square(dark, 512)
  icon_512 = rounded_icon(icon_base, 512, 0.22)
  icon_192 = rounded_icon(icon_base, 192, 0.22)
  icon_180 = rounded_icon(icon_base, 180, 0.22)
  maskable = rounded_icon(icon_base, 512, 0)
  favicon = rounded_icon(icon_base, 32, 0.22)

  icon_192.save(PUBLIC / 'pwa-192.png')
  icon_512.save(PUBLIC / 'pwa-512.png')
  maskable.save(PUBLIC / 'pwa-512-maskable.png')
  icon_180.convert('RGB').save(PUBLIC / 'apple-touch-icon.png')
  favicon.save(PUBLIC / 'favicon-32.png')
  write_favicon_svg(PUBLIC / 'favicon-32.png')

  print(f'Generated theme logos + PWA icons from {source_path.name}')


if __name__ == '__main__':
  main()
