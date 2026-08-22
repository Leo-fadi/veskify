export const KARVONEN_ACCEPTANCE_FIXTURE_ID = "project_karvonen" as const;

export type KarvonenFixtureLocale = "en" | "fi";

type KarvonenFixtureLocaleGateInput = Readonly<{
  fixtureId: typeof KARVONEN_ACCEPTANCE_FIXTURE_ID;
  enabledLocales: readonly KarvonenFixtureLocale[];
  customerFacingAuthority: Readonly<Record<string, unknown>>;
}>;

export class KarvonenFixtureLocaleAuthorityError extends Error {
  readonly code = "missing-enabled-customer-locale" as const;

  constructor(
    readonly fieldPath: string,
    readonly missingLocale: KarvonenFixtureLocale,
  ) {
    super(
      'Karvonen acceptance fixture is missing enabled locale "' +
        missingLocale +
        '" at "' +
        fieldPath +
        "." +
        missingLocale +
        '".',
    );
    this.name = "KarvonenFixtureLocaleAuthorityError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocalizedCustomerValue(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return (
    keys.length > 0 &&
    keys.some((key) => key === "en" || key === "fi") &&
    keys.every((key) => key === "en" || key === "fi")
  );
}

function assertCompleteValue(
  value: unknown,
  path: string,
  enabledLocales: readonly KarvonenFixtureLocale[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertCompleteValue(entry, path + "[" + index + "]", enabledLocales),
    );
    return;
  }
  if (!isRecord(value)) return;

  if (isLocalizedCustomerValue(value)) {
    for (const locale of enabledLocales) {
      const localizedValue = value[locale];
      if (typeof localizedValue !== "string" || localizedValue.trim().length === 0) {
        throw new KarvonenFixtureLocaleAuthorityError(path, locale);
      }
    }
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    assertCompleteValue(entry, path ? path + "." + key : key, enabledLocales);
  }
}

export function assertKarvonenFixtureCustomerLocaleCompleteness({
  fixtureId,
  enabledLocales,
  customerFacingAuthority,
}: KarvonenFixtureLocaleGateInput): void {
  if (fixtureId !== KARVONEN_ACCEPTANCE_FIXTURE_ID) return;
  for (const [key, value] of Object.entries(customerFacingAuthority)) {
    assertCompleteValue(value, key, enabledLocales);
  }
}
