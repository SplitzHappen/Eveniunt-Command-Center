#!/usr/bin/env python3
"""The apps' icons: the Archivist in the Eveniunt Dynasty's library under a night sky (owner-approved 2026-11-10).

Source art: command-center/art/archivist-x4.png, the owner's Archivist pet (one frame of the pet's sprite sheet),
enlarged four times with an EDSR super-resolution model. The library, sky and frame are drawn here, so the icons are
rebuilt byte for byte from this file and that image (random sequences are seeded).

Writes, for each app, icon-512.png (framed), icon-192.png (framed), icon-maskable-512.png (full bleed, figure inside the
safe zone) and apple-touch-icon.png (180 px, full bleed: the phone rounds the corners):
  Command Center  command-center/src/icons/                      the approved icon
  Tracker         site-src/icons/                                 the same, with a gold seal and a tick
  Atelier         ../ffxiv-cosmic-crafting-solver/atelier/site-src/icons/   the same, with a gold seal and a hammer
Then rebuild the sites (node tools/build-site.js, node command-center/build.js, the Atelier's site build).
Run: python3 -I command-center/make-archivist-icons.py   (needs Pillow and NumPy)
"""
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
T = os.path.dirname(HERE)
OUT = {
    'cc': os.path.join(HERE, 'src', 'icons'),
    'tracker': os.path.join(T, 'site-src', 'icons'),
    'atelier': os.path.join(T, '..', 'ffxiv-cosmic-crafting-solver', 'atelier', 'site-src', 'icons'),
}
S = 1024
G = (226, 188, 98)


def figure():
    src = np.array(Image.open(os.path.join(HERE, 'art', 'archivist-x4.png')).convert('RGBA')).astype(int)
    d = np.max(np.abs(src[:, :, :3] - np.array([18, 18, 24])), axis=2)  # the sprite's own dark ground becomes clear
    src[:, :, 3] = (np.clip((d - 16) / 14, 0, 1) * 255).astype(int)
    fig = Image.fromarray(src.astype('uint8'), 'RGBA')
    fig = ImageEnhance.Sharpness(fig).enhance(1.4)
    return fig.crop(fig.getbbox())


def scene(fig, fig_h, fig_dy):
    random.seed(11)
    rng = np.random.default_rng(5)
    base = Image.new('RGBA', (S, S), (10, 8, 14, 255))
    vx, vy = S / 2, S * 0.42
    Y, X = np.mgrid[0:S, 0:S]

    def layer(r, g, b, a):
        arr = np.zeros((S, S, 4)); arr[..., 0] = r; arr[..., 1] = g; arr[..., 2] = b; arr[..., 3] = np.clip(a, 0, 255)
        base.alpha_composite(Image.fromarray(arr.astype('uint8'), 'RGBA'))

    # night sky: deep navy, a faint Milky Way, stars of many sizes, a few bright ones
    t = np.clip(Y / (vy + 40), 0, 1)[..., None]
    sky = np.array([6, 9, 26]) * (1 - t) + np.array([16, 20, 40]) * t
    base.alpha_composite(Image.fromarray(np.dstack([sky, np.full((S, S, 1), 255)]).astype('uint8'), 'RGBA'))
    band = np.exp(-(((Y - 0.55 * X - 60) / 120.0) ** 2))
    nz = np.array(Image.fromarray((rng.random((S, S)) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(6))) / 255.0
    mw = np.zeros((S, S, 4)); mw[..., 0] = 150; mw[..., 1] = 160; mw[..., 2] = 200
    mw[..., 3] = np.clip(band * (nz - 0.35) * 160, 0, 60)
    base.alpha_composite(Image.fromarray(mw.astype('uint8'), 'RGBA').filter(ImageFilter.GaussianBlur(3)))
    sd = ImageDraw.Draw(base, 'RGBA')
    for _ in range(650):
        x = rng.uniform(0, S); y = rng.uniform(0, vy + 30); m = rng.random()
        r = 0.6 if m < 0.75 else (1.0 if m < 0.95 else 1.6)
        tint = [(255, 255, 255), (220, 230, 255), (255, 240, 215)][int(rng.integers(0, 3))]
        sd.ellipse((x - r, y - r, x + r, y + r), fill=tint + (int(rng.uniform(90, 230)),))
    for _ in range(6):
        x = rng.uniform(60, S - 60); y = rng.uniform(40, vy - 40)
        g2 = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(g2).ellipse((x - 5, y - 5, x + 5, y + 5), fill=(230, 235, 255, 150))
        base.alpha_composite(g2.filter(ImageFilter.GaussianBlur(4)))
        sd.ellipse((x - 1.6, y - 1.6, x + 1.6, y + 1.6), fill=(255, 255, 255, 255))

    # the library: two walls of shelves running into the dark, gold-trimmed where they meet the sky
    dr = ImageDraw.Draw(base, 'RGBA')
    L = 7

    def pos(tt, side):
        k = (1 - tt) ** 1.6
        return vx + side * (S / 2 + 60) * k, vy - (vy - 150) * k, vy + (S - vy + 60) * k

    for side in (-1, 1):
        for li in range(L):
            t0, t1 = li / L, (li + 1) / L
            x0, top0, bot0 = pos(t0, side); x1, top1, bot1 = pos(t1, side)
            fade = 0.3 + 0.7 * (1 - t0); sh = int(30 * fade)
            dr.polygon([(x0, top0), (x1, top1), (x1, bot1), (x0, bot0)], fill=(sh + 8, sh + 2, sh, 255))
            rows = 9
            for k in range(1, rows + 1):
                f, fp = k / rows, (k - 1) / rows
                ya0 = top0 + (bot0 - top0) * f; ya1 = top1 + (bot1 - top1) * f
                yb0 = top0 + (bot0 - top0) * fp; yb1 = top1 + (bot1 - top1) * fp
                n = int(16 * (1 - t0)) + 3
                for b in range(n):
                    u = (b + 0.5 + random.uniform(-0.2, 0.2)) / n
                    x = x0 + (x1 - x0) * u
                    ytop = yb0 + (yb1 - yb0) * u; ybot = ya0 + (ya1 - ya0) * u
                    h = (ybot - ytop) * random.uniform(0.6, 0.9); w = max(1.0, abs(x1 - x0) / n * 0.72)
                    c = random.choice([(90, 46, 30), (46, 34, 72), (74, 60, 30), (34, 46, 66), (96, 70, 34), (60, 28, 40)])
                    if h < 3:
                        continue
                    dr.rectangle((x - w / 2, ybot - h, x + w / 2, ybot - 1), fill=tuple(int(v * fade) for v in c) + (255,))
                    if random.random() < 0.3 and h > 10:
                        yy = ybot - h * 0.75
                        dr.line((x - w / 2, yy, x + w / 2, yy), fill=G + (int(120 * fade),), width=1)
                dr.line((x0, ya0, x1, ya1), fill=G + (int(90 * fade),), width=max(1, int(5 * (1 - t0)) + 1))
            dr.line((x0, top0, x0, bot0), fill=G + (int(60 * fade),), width=max(1, int(4 * (1 - t0))))
            dr.line((x0, top0, x1, top1), fill=G + (int(160 * fade),), width=max(2, int(8 * (1 - t0))))

    # mist down the aisle, a faint gold light deep in it, low fog, gold dust, a dark edge
    layer(12, 10, 18, np.exp(-((X - vx) ** 2) / (2 * 150 ** 2)) * 150 * np.clip((Y - (vy - 40)) / 120, 0, 1))
    layer(230, 178, 90, np.exp(-((X - vx) ** 2 + (Y - vy) ** 2) / (2 * 150 ** 2)) * 120)
    layer(30, 24, 40, np.clip((Y - S * 0.6) / (S * 0.4), 0, 1) * 180)
    md = ImageDraw.Draw(base, 'RGBA')
    for _ in range(110):
        x = random.gauss(vx, 240); y = random.uniform(70, S - 70); r = random.choice([1.5, 2, 2.5, 3.5])
        md.ellipse((x - r, y - r, x + r, y + r), fill=(255, 222, 140, random.randint(70, 210)))
    layer(0, 0, 0, (np.clip(np.hypot(X - S / 2, Y - S / 2) / (S * 0.72), 0, 1) ** 2.2) * 235)

    # the Archivist, body centred (the book reaches out to one side), with a warm rim of light
    sc = fig_h / fig.height
    f = fig.resize((int(fig.width * sc), int(fig.height * sc)), Image.LANCZOS)
    fx = (S - f.width) // 2 + int(46 * fig_h / 700); fy = S - f.height - fig_dy
    gl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); h = Image.new('RGBA', f.size, (255, 205, 120, 0))
    h.putalpha(f.split()[3].point(lambda q: int(q * 0.6))); gl.alpha_composite(h, (fx, fy))
    base.alpha_composite(gl.filter(ImageFilter.GaussianBlur(20))); base.alpha_composite(f, (fx, fy))
    return base


def badge(img, kind, cx, cy, r):
    if kind is None:
        return img
    d = ImageDraw.Draw(img, 'RGBA')
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse((cx - r - 6, cy - r + 4, cx + r + 6, cy + r + 14), fill=(0, 0, 0, 150))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(24, 18, 40, 255), outline=G + (255,), width=max(4, r // 9))
    d.ellipse((cx - r * 0.8, cy - r * 0.8, cx + r * 0.8, cy + r * 0.8), outline=(255, 230, 160, 120), width=max(2, r // 30))
    w = max(6, r // 6)
    if kind == 'tick':
        d.line([(cx - r * 0.42, cy + r * 0.02), (cx - r * 0.1, cy + r * 0.34), (cx + r * 0.46, cy - r * 0.32)], fill=G + (255,), width=w, joint='curve')
    elif kind == 'hammer':
        a = math.radians(-40)
        def p(u, v):  # u along the handle, v across it, in units of r
            return (cx + r * (u * math.cos(a) - v * math.sin(a)), cy + r * (u * math.sin(a) + v * math.cos(a)))
        d.polygon([p(-0.52, -0.07), p(0.30, -0.07), p(0.30, 0.07), p(-0.52, 0.07)], fill=G + (255,))
        d.polygon([p(0.18, -0.40), p(0.50, -0.40), p(0.50, 0.40), p(0.18, 0.40)], fill=G + (255,))
    return img


def framed(sc_img):
    m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).rounded_rectangle((14, 14, S - 15, S - 15), 208, fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(sc_img, (0, 0), m); dd = ImageDraw.Draw(out)
    dd.rounded_rectangle((14, 14, S - 15, S - 15), 208, outline=G + (255,), width=18)
    dd.rounded_rectangle((40, 40, S - 41, S - 41), 184, outline=(255, 230, 160, 90), width=3)
    return out


def main():
    fig = figure()
    full = scene(fig, 700, 58)          # framed and phone icons
    safe = scene(fig, 560, 150)         # maskable: the figure inside the central safe zone
    for app, kind in (('cc', None), ('tracker', 'tick'), ('atelier', 'hammer')):
        os.makedirs(OUT[app], exist_ok=True)
        a = badge(full.copy(), kind, 820, 820, 120)
        fr = framed(a)
        fr.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT[app], 'icon-512.png'), optimize=True)
        fr.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT[app], 'icon-192.png'), optimize=True)
        a.convert('RGB').resize((180, 180), Image.LANCZOS).save(os.path.join(OUT[app], 'apple-touch-icon.png'), optimize=True)
        mk = badge(safe.copy(), kind, 740, 740, 92)
        mk.convert('RGB').resize((512, 512), Image.LANCZOS).save(os.path.join(OUT[app], 'icon-maskable-512.png'), optimize=True)
        print(app, OUT[app])


if __name__ == '__main__':
    main()
