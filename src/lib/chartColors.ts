// Validated categorical/sequential steps from the dataviz reference palette —
// single-hue per measure (not per category); see dashboard build notes.
// Re-validated with scripts/validate_palette.js after the design-token pass:
// the original light-mode green (#1baf7a) sat at 2.74:1 against the chart
// surface, below the 3:1 non-text-contrast floor with no label mitigation on
// that chart. Darkened to #0f9d6e, which clears every check (lightness band,
// chroma floor, CVD separation, contrast) with no other change needed.
export function chartColors(isDark: boolean) {
  return {
    blue: isDark ? "#3987e5" : "#2a78d6",
    aqua: isDark ? "#22ac7a" : "#0f9d6e",
    red: isDark ? "#e66767" : "#e34948",
    grid: isDark ? "#3f3f46" : "#e4e4e7",
    text: isDark ? "#c3c2b7" : "#52514e",
  };
}
