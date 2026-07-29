"""Convert the Gemini logo to a transparent PNG and write public assets."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

SRC = Path(
    r"C:\Users\Muhammet\.cursor\projects\c-Users-Muhammet-Projects-orbital-congestion-simulator"
    r"\assets\c__Users_Muhammet_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"e5e860606327167a027119c205b68604_images_image-58740443-519f-423b-b47a-35aaf9b03624.png"
)
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public"
OUT_LOGO = OUT_DIR / "logo.png"
OUT_FAVICON = OUT_DIR / "favicon.png"


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    # Sample near-corner background (logo sits on a dark navy plate, not pure black).
    samples = [
        pixels[2, 2][:3],
        pixels[w - 3, 2][:3],
        pixels[2, h - 3][:3],
        pixels[w - 3, h - 3][:3],
        pixels[w // 2, 2][:3],
        pixels[2, h // 2][:3],
    ]
    br = sum(s[0] for s in samples) / len(samples)
    bg = sum(s[1] for s in samples) / len(samples)
    bb = sum(s[2] for s in samples) / len(samples)
    print(f"bg sample rgb=({br:.1f}, {bg:.1f}, {bb:.1f})")

    # Soft keying thresholds (squared distance in RGB).
    # Keep Earth teal (~18,47,65) and cyan rings; drop the navy plate.
    hard = 18.0**2  # fully transparent inside this radius
    soft = 36.0**2  # fade to opaque by this radius

    opaque_xs: list[int] = []
    opaque_ys: list[int] = []
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0

    for y in range(h):
        for x in range(w):
            r, g, b, _a = pixels[x, y]
            dist2 = (r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2
            if dist2 <= hard:
                alpha = 0
            elif dist2 >= soft:
                alpha = 255
            else:
                t = (dist2 - hard) / (soft - hard)
                alpha = int(round(t * 255))

            # Drop Gemini UI sparkle chrome (gray star far from the mark).
            chroma = max(r, g, b) - min(r, g, b)
            radial = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if alpha > 0 and chroma < 22 and radial > min(w, h) * 0.42:
                alpha = 0

            pixels[x, y] = (r, g, b, alpha)
            if alpha > 8:
                opaque_xs.append(x)
                opaque_ys.append(y)

    if not opaque_xs:
        raise SystemExit("No opaque pixels found — threshold too aggressive")

    pad = 16
    x0 = max(0, min(opaque_xs) - pad)
    y0 = max(0, min(opaque_ys) - pad)
    x1 = min(w, max(opaque_xs) + pad + 1)
    y1 = min(h, max(opaque_ys) + pad + 1)
    cropped = img.crop((x0, y0, x1, y1))

    side = max(cropped.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - cropped.size[0]) // 2
    oy = (side - cropped.size[1]) // 2
    canvas.paste(cropped, (ox, oy), cropped)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_LOGO, "PNG")
    canvas.resize((64, 64), Image.Resampling.LANCZOS).save(OUT_FAVICON, "PNG")
    canvas.resize((32, 32), Image.Resampling.LANCZOS).save(OUT_DIR / "favicon-32.png", "PNG")

    opaque = sum(1 for p in canvas.getdata() if p[3] > 8)
    total = canvas.size[0] * canvas.size[1]
    print(f"wrote {OUT_LOGO} ({canvas.size})")
    print(f"wrote {OUT_FAVICON}")
    print(f"opaque pixels: {opaque / total * 100:.1f}%")


if __name__ == "__main__":
    main()
