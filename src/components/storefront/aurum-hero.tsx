import { resolveLocalizedText, type Locale, type LocalizedText } from "@/domain/shared";

export type AurumHeroVariant = "editorial";

export type AurumHeroProps = {
  variant: AurumHeroVariant;
  eyebrow: LocalizedText;
  title: LocalizedText;
  body: LocalizedText;
  activeLocale: Locale;
  primaryLocale: Locale;
};

export function AurumHero({
  eyebrow,
  title,
  body,
  activeLocale,
  primaryLocale,
}: AurumHeroProps) {
  return (
    <section className="rounded-[var(--brand-radius)] border border-[var(--brand-color-border)] bg-[var(--brand-color-surface)] p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-color-primary)]">
        {resolveLocalizedText(eyebrow, activeLocale, primaryLocale)}
      </p>
      <h2 className="mt-4 max-w-3xl font-serif text-3xl font-semibold tracking-tight text-[var(--brand-color-text)] sm:text-5xl">
        {resolveLocalizedText(title, activeLocale, primaryLocale)}
      </h2>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--brand-color-muted-text)]">
        {resolveLocalizedText(body, activeLocale, primaryLocale)}
      </p>
    </section>
  );
}
