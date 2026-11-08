"""Turn the concept images in output/video-frames/ into animation layers.

Writes video/public/layers/ (ignored by git). Rerun after replacing a source
image: `pnpm layers`. Needs Python with opencv-python and numpy.

Helmet pairs become three images each:
  *-base   the lights-off image, tone-matched to the lit one
  *-glow   only the light each LED adds (lit minus base)
  *-map    per-light data: R delay, G random phase, B kind

The shader adds glow to base, so lights switch on one at a time and the fully
lit frame still rebuilds the original image.
"""
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "output" / "video-frames"
OUT = ROOT / "video" / "public" / "layers"

WIDE_SIZE = (2560, 1440)  # The 4K files only hold 1672 x 941 of real detail.
LIGHT_THRESHOLD = 0.14  # Lit minus off above this means "near a light" for tone matching.
SEED_STRENGTH = 0.2  # A real light is at least this much brighter than base...
SEED_COLOUR = 0.3  # ...and at least this strongly coloured (gold pins and edges are not).

# Kinds stored in the map's blue channel, spaced so PNG rounding cannot merge them.
KIND_EARLY, KIND_WAVE, KIND_STRIP, KIND_HELMET = 0, 1, 2, 3
KIND_STEP = 60

# Helmet position in wide-frame coordinates (0-1), measured from the lit image.
HELMET = (0.5, 0.479)
HELMET_RADII = (0.082, 0.205)

# Largest pod in scene 03: outline drawn on a 7x enlargement of the crop at POD_CROP.
POD_CROP = (1025, 625)
POD_OUTLINE = [
    (92, 190), (130, 142), (205, 128), (345, 90), (510, 120), (540, 400),
    (490, 455), (290, 515), (150, 470), (105, 400),
]


def read(name):
    image = cv2.imread(str(SRC / name), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise SystemExit(f"Missing source image: {SRC / name}")
    return image


def rgb(image, trim=0):
    if trim:
        image = image[trim:-trim, trim:-trim]
    return image[..., :3].astype(np.float32) / 255


def similarity(moving, fixed, moving_mask=None, fixed_mask=None):
    """Scale and shift mapping `moving` pixels onto `fixed`, from SIFT matches."""
    sift = cv2.SIFT_create(8000)
    grey = lambda im: cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    kp1, des1 = sift.detectAndCompute(grey(moving), moving_mask)
    kp2, des2 = sift.detectAndCompute(grey(fixed), fixed_mask)
    matches = cv2.BFMatcher().knnMatch(des1, des2, k=2)
    good = [a for a, b in matches if a.distance < 0.75 * b.distance]
    src = np.float32([kp1[m.queryIdx].pt for m in good])
    dst = np.float32([kp2[m.trainIdx].pt for m in good])
    matrix, inliers = cv2.estimateAffinePartial2D(
        src, dst, method=cv2.RANSAC, ransacReprojThreshold=3.0
    )
    return float(np.hypot(matrix[0, 0], matrix[1, 0])), matrix[:, 2], int(inliers.sum())


def fit_curves(source, target):
    """One tone curve per colour, taking the look of `source` to `target` (N x 3 pixels)."""
    levels = np.linspace(0, 1, 129)
    curves = []
    for channel in range(3):
        a = np.quantile(source[..., channel], levels)
        b = np.quantile(target[..., channel], levels)
        curves.append((np.maximum.accumulate(a + np.arange(len(a)) * 1e-7), b))
    return curves


def apply_curves(image, curves):
    result = image.copy()
    for channel, (a, b) in enumerate(curves):
        result[..., channel] = np.interp(image[..., channel], a, b)
    return result


def stable_random(x, y, salt):
    """Random 0-1 from a coarse position, so one LED agrees across both pairs."""
    cell = int(x / 0.006) * 73856093 ^ int(y / 0.006) * 19349663 ^ salt * 83492791
    return np.random.default_rng(abs(cell)).random()


def classify(width, height, cx, cy):
    ex = (cx - HELMET[0]) / HELMET_RADII[0]
    ey = (cy - HELMET[1]) / HELMET_RADII[1]
    if ex * ex + ey * ey < 1:
        return KIND_HELMET
    if max(width, height) > 5 * min(width, height) and max(width, height) > 26:
        return KIND_STRIP
    return KIND_EARLY if stable_random(cx, cy, 1) < 0.4 else KIND_WAVE


def build_pair(name, on, off, to_wide):
    """Write one base/glow/map set. `to_wide` maps pixels to wide-frame 0-1."""
    difference = np.clip(on - off, 0, 1).max(axis=2)
    near_light = cv2.GaussianBlur((difference > LIGHT_THRESHOLD).astype(np.float32), (0, 0), 6)
    calm = near_light < 0.02
    base = apply_curves(off, fit_curves(off[calm], on[calm]))

    delta = np.clip(on - base, 0, 1)
    strength = delta.max(axis=2)
    colour = strength - delta.min(axis=2)
    lit = ((strength > SEED_STRENGTH) & (colour > SEED_COLOUR)).astype(np.uint8)
    # Merges the dots of one LED bank into one light.
    lit = cv2.morphologyEx(lit, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

    # Keep each light's soft halo; drop faint texture differences elsewhere.
    halo = cv2.dilate(lit, np.ones((21, 21), np.uint8)).astype(np.float32)
    halo = cv2.GaussianBlur(halo, (0, 0), 7)
    glow = delta * np.clip(halo * 1.5, 0, 1)[..., None]

    count, labels, stats, centres = cv2.connectedComponentsWithStats(lit, 8)
    rows = np.zeros((count, 3), np.uint8)
    kinds = [0, 0, 0, 0]
    for i in range(1, count):
        _, _, width, height, area = stats[i]
        if area < 3:
            continue
        wx, wy = to_wide(*centres[i])
        kind = classify(width, height, wx, wy)
        kinds[kind] += 1
        rows[i] = (
            round(stable_random(wx, wy, 2) * 255),
            round(stable_random(wx, wy, 3) * 255),
            kind * KIND_STEP,
        )

    # Every pixel takes the data of its nearest light, so halos fade as one piece.
    _, nearest = cv2.distanceTransformWithLabels(
        1 - (labels > 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
    )
    lookup = np.zeros(nearest.max() + 1, np.int32)
    lookup[nearest[labels > 0]] = labels[labels > 0]
    data = rows[lookup[nearest]]

    cv2.imwrite(str(OUT / f"{name}-base.png"), (base * 255 + 0.5).astype(np.uint8))
    cv2.imwrite(str(OUT / f"{name}-glow.png"), (glow * 255 + 0.5).astype(np.uint8))
    # cv2 writes BGR, so reverse to keep R delay / G phase / B kind.
    cv2.imwrite(str(OUT / f"{name}-map.png"), data[..., ::-1])
    print(f"{name}: {sum(kinds)} lights  early/wave/strip/helmet = {kinds}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # Helmet, wide pair.
    wide_on = rgb(read("scene-01-head-container-expanded-3840x2160-v1.png"), trim=1)
    wide_off = rgb(read("scene-01-head-container-lights-off-3840x2160-v1.png"), trim=1)
    wide_on = cv2.resize(wide_on, WIDE_SIZE, interpolation=cv2.INTER_AREA)
    wide_off = cv2.resize(wide_off, WIDE_SIZE, interpolation=cv2.INTER_AREA)

    # Helmet, close pair, registered inside the wide frame.
    close_on = rgb(read("scene-01-head-container-v2.png"))
    close_off = rgb(read("scene-01-head-container-close-lights-off-v1.png"))
    ch, cw = close_on.shape[:2]
    scale, shift, inliers = similarity(
        (close_on * 255).astype(np.uint8), (wide_on * 255).astype(np.uint8)
    )
    wh, ww = wide_on.shape[:2]
    close_rect = {
        "x": float(shift[0]) / ww,
        "y": float(shift[1]) / wh,
        "w": cw * scale / ww,
        "h": ch * scale / wh,
    }
    print(f"close inside wide: {close_rect} ({inliers} matched points)")

    # The wide image is about 29% brighter over the same wall. Match it to the
    # close image so the room does not lift as the camera pulls back.
    x0, y0 = round(close_rect["x"] * ww), round(close_rect["y"] * wh)
    x1, y1 = round((close_rect["x"] + close_rect["w"]) * ww), round((close_rect["y"] + close_rect["h"]) * wh)
    match = fit_curves(wide_on[y0:y1, x0:x1].reshape(-1, 3), close_on.reshape(-1, 3))
    wide_on, wide_off = apply_curves(wide_on, match), apply_curves(wide_off, match)

    build_pair("wide", wide_on, wide_off, lambda x, y: (x / ww, y / wh))
    build_pair(
        "close",
        close_on,
        close_off,
        lambda x, y: (
            close_rect["x"] + x / cw * close_rect["w"],
            close_rect["y"] + y / ch * close_rect["h"],
        ),
    )

    # Orbit: the plate, plus the sunlit cutout placed where the scene has the ship.
    plate = read("scene-03-background-plate-v1.png")[..., :3]
    armed = read("scene-03-cuculidae-armed-v1.png")[..., :3]
    cutout = read("cuculidae-sunlit-cutout-v1.png")
    cv2.imwrite(str(OUT / "plate.png"), plate)
    alpha = cutout[..., 3]
    ship_area = (cv2.absdiff(armed, plate).max(axis=2) > 28).astype(np.uint8)
    ship_area = cv2.dilate(ship_area, np.ones((9, 9), np.uint8))
    scale, shift, inliers = similarity(
        cutout[..., :3], armed, (alpha > 200).astype(np.uint8) * 255, ship_area * 255
    )
    ys, xs = np.where(alpha > 0)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    cv2.imwrite(str(OUT / "ship.png"), cutout[y0:y1, x0:x1])
    ship = {
        "x": float(shift[0] + x0 * scale),
        "y": float(shift[1] + y0 * scale),
        "w": float((x1 - x0) * scale),
        "h": float((y1 - y0) * scale),
    }
    print(f"ship on plate: {ship} ({inliers} matched points, scale {scale:.4f})")

    # One drop pod, cut from the scene with its sunlit edge and no flame.
    outline = np.float32(POD_OUTLINE) / 7 + np.float32(POD_CROP)
    x, y, width, height = cv2.boundingRect(outline)
    pad = 2
    tile = armed[y - pad : y + height + pad, x - pad : x + width + pad]
    mask = np.zeros(tile.shape[:2], np.uint8)
    corners = np.int32(outline - np.float32((x - pad, y - pad)) + 0.5)
    cv2.fillPoly(mask, [corners], 255, cv2.LINE_AA)
    mask = cv2.GaussianBlur(mask, (0, 0), 0.7)
    cv2.imwrite(str(OUT / "pod.png"), np.dstack([tile, mask]))

    (OUT / "layers.json").write_text(
        json.dumps(
            {
                "plate": {"w": plate.shape[1], "h": plate.shape[0]},
                "closeRect": close_rect,
                "ship": ship,
                "pod": {"w": width + 2 * pad, "h": height + 2 * pad},
                "helmet": {"x": HELMET[0], "y": HELMET[1]},
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
