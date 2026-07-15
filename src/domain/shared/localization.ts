import type { Locale, LocalizedText } from "./schemas";

const supportedLocales: readonly Locale[] = ["en", "fi"];

export function resolveLocalizedText(
  text: LocalizedText,
  activeLocale: Locale,
  primaryLocale: Locale,
): string {
  return (
    text[activeLocale] ??
    text[primaryLocale] ??
    supportedLocales.map((locale) => text[locale]).find((value) => value !== undefined) ??
    ""
  );
}
