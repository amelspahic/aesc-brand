#!/usr/bin/env python3
"""
crtaj-ikonu.py — nacrtaj favicon.ico i src/app/apple-icon.png iz istog znaka kao icon.svg.

    python3 brand/znak/crtaj-ikonu.py            # ispiše u scratch, pa se ručno kopira
    OUT=src/app python3 brand/znak/crtaj-ikonu.py

## Zašto tri fajla umjesto jednog SVG-a

`src/app/icon.svg` je znak za karticu preglednika i to je ispravan format za tu svrhu. Ali:

  * Google Search NE prihvata SVG favicon — podržani formati su BMP, GIF, ICO, PNG, JPEG, PPM i
    TIFF. Sajt koji nudi samo SVG u rezultatu pretrage nema favicon.
  * Next uz `app/icon.svg` lijepi hash izveden iz sadržaja (`/icon?<hash>`), pa se URL mijenja
    svaki put kad se crtež dirne — a Google traži da adresa favicona bude stabilna.
    `app/favicon.ico` se servira na tačno `/favicon.ico` i ne miče se.
  * `apple-icon` po Next-ovoj konvenciji smije biti .jpg/.jpeg/.png, ali NE .svg.

Zato ovaj skript: jedan izvor geometrije, tri izlaza koji se ne smiju razići.

## Zašto se crta u PIL-u, a ne rasterizuje SVG

Da se ne uvodi zavisnost (cairosvg/resvg) zbog dva fajla koja se mijenjaju jednom u nekoliko
godina. Geometrija je ista kao u icon.svg i drži se iste mreže od 64 jedinice — ako se jedno
promijeni, promijeni i drugo.

## Prsten pada ispod 48px

Na 16px je potez prstena tanji od pola piksela i pretvara se u sivu izmaglicu oko slova. Zato 16
i 32 nose samo A, deblje i veće, a prsten se pojavljuje od 48 naviše. To je i razlog zašto .ico
nosi pet veličina umjesto jedne skalirane: ICO format postoji upravo zbog toga.

Boje su `--color-zlato` i `--color-mastilo` iz globals.css, jedini par koji brend koristi na
znaku — mastilo na zlatu je 10.85:1.
"""

from PIL import Image, ImageDraw
import math
import os

GOLD = (246, 191, 31, 255)     # --color-zlato  #f6bf1f
INK  = (23, 20, 13, 255)       # --color-mastilo #17140d
SS   = 8                       # supersample factor

def draw(size, with_ring=True):
    S = size * SS
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = S / 64.0                                   # one unit of the 64 design grid

    # Ground: rounded square, radius 14/64 — matches the previous icon's silhouette.
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=14 * u, fill=GOLD)

    cx = cy = 32 * u

    if with_ring:
        # The ring, broken at upper-right and lower-left, from public/images/logo.png.
        r  = 25 * u
        w  = 3.6 * u
        bb = [cx - r, cy - r, cx + r, cy + r]
        # Two arcs, two equal 40deg gaps at upper-right and lower-left, as in logo.png.
        # PIL angles: 0deg = 3 o'clock, increasing clockwise.
        for a0, a1 in ((30, 200), (240, 380)):
            d.arc(bb, a0, a1, fill=INK, width=int(round(w)))

    # The A: a chevron with a crossbar. Heavier than the ring so it survives the downsample.
    aw = (5.0 if with_ring else 8.0) * u
    apex   = (32 * u, (22 if with_ring else 15) * u)
    left   = ((23 if with_ring else 15) * u, (41 if with_ring else 48) * u)
    right  = ((41 if with_ring else 49) * u, (41 if with_ring else 48) * u)
    d.line([left, apex],  fill=INK, width=int(round(aw)), joint='curve')
    d.line([apex, right], fill=INK, width=int(round(aw)), joint='curve')
    # round the apex and the two feet
    for p in (apex, left, right):
        d.ellipse([p[0] - aw / 2, p[1] - aw / 2, p[0] + aw / 2, p[1] + aw / 2], fill=INK)
    # crossbar
    ybar = (35 if with_ring else 38) * u
    half = (6.0 if with_ring else 9.5) * u
    d.line([(cx - half, ybar), (cx + half, ybar)], fill=INK, width=int(round(aw * 0.85)))

    return im.resize((size, size), Image.LANCZOS)

# Small sizes drop the ring — 4/64 of a stroke is under a pixel at 16px and turns to grey haze.
frames = {
    16:  draw(16,  with_ring=False),
    32:  draw(32,  with_ring=False),
    48:  draw(48,  with_ring=True),
    64:  draw(64,  with_ring=True),
    128: draw(128, with_ring=True),
}
OUT = os.environ.get('OUT', '.')
os.makedirs(OUT, exist_ok=True)
draw(180, with_ring=True).save(f'{OUT}/apple-icon.png')

# Multi-resolution ICO. Pillow writes every frame it is given via append_images.
frames[128].save(f'{OUT}/favicon.ico', format='ICO',
                 sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128)])

print(f'wrote {OUT}/favicon.ico and {OUT}/apple-icon.png')
