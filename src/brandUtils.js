// ── Brand color utilities ─────────────────────────────────

/** Extract dominant (most saturated, non-white, non-black) color from an image element */
export function extractDominantColor(imgElement) {
  try {
    const size = 60;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgElement, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let best = null, maxScore = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 128) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const lightness = (max + min) / 510; // 0..1
      if (lightness > 0.88 || lightness < 0.1) continue; // skip near-white / near-black
      const saturation = max === 0 ? 0 : (max - min) / max;
      const score = saturation * (1 - Math.abs(lightness - 0.45)); // favor mid-lightness
      if (score > maxScore) { maxScore = score; best = { r, g, b }; }
    }
    if (!best || maxScore < 0.1) return null;
    return rgbToHex(best.r, best.g, best.b);
  } catch {
    return null;
  }
}

/** Darken a hex color by pct (0..1) */
export function darkenColor(hex, pct = 0.15) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.round(r * (1 - pct)),
    Math.round(g * (1 - pct)),
    Math.round(b * (1 - pct)),
  );
}

/** Lighten a hex color toward white by pct (0..1) */
export function lightenColor(hex, pct = 0.88) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.round(r + (255 - r) * pct),
    Math.round(g + (255 - g) * pct),
    Math.round(b + (255 - b) * pct),
  );
}

/** Build a full brand theme from a primary hex color */
export function buildBrandTheme(primary) {
  if (!primary) return null;
  return {
    primary,
    primaryLight: lightenColor(primary, 0.88),
    primaryMid:   lightenColor(primary, 0.55),
    primaryDark:  darkenColor(primary, 0.15),
  };
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}
