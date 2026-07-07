// Validated categorical/sequential steps from the dataviz reference palette.
// Single-hue per measure (not per category) — see dashboard build notes.
export function chartColors(isDark: boolean) {
  return {
    blue: isDark ? "#3987e5" : "#2a78d6",
    aqua: isDark ? "#199e70" : "#1baf7a",
    red: isDark ? "#e66767" : "#e34948",
    grid: isDark ? "#3f3f46" : "#e4e4e7",
    text: isDark ? "#c3c2b7" : "#52514e",
  };
}
