/** WCAG-style relative luminance for a canonical six-digit hexadecimal colour. */
export function relativeLuminance(hex: string): number {
  const normalized = hex.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new Error("Contrast colours must be six-digit hexadecimal values.");
  }

  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(normalized.slice(1 + offset, 3 + offset), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** Returns the contrast ratio between foreground and background (1–21). */
export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export const standardTextContrastMinimum = 4.5;
export const highContrastTextMinimum = 7;
