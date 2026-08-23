export const KARVONEN_ACCEPTANCE_FIXTURE_ID = "project_karvonen" as const;

export type KarvonenFixtureLocale = "en" | "fi";

type KarvonenFixtureLocaleGateInput = Readonly<{
  fixtureId: typeof KARVONEN_ACCEPTANCE_FIXTURE_ID;
  enabledLocales: readonly KarvonenFixtureLocale[];
  customerFacingAuthority: Readonly<Record<string, unknown>>;
}>;

const primitiveAttributeLocaleAuthority: Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<KarvonenFixtureLocale, string>>>>>
> = {
  material: {
    gold: { en: "Gold", fi: "Kulta" },
    silver: { en: "Silver", fi: "Hopea" },
  },
  colour: {
    silver: { en: "Silver", fi: "Hopea" },
    yellow: { en: "Yellow", fi: "Keltainen" },
  },
  metalColour: {
    white: { en: "White gold", fi: "Valkokulta" },
    yellow: { en: "Yellow gold", fi: "Keltakulta" },
  },
  fineness: {
    "925": { en: "925", fi: "925" },
  },
  karat: {
    "18K": { en: "18K", fi: "18K" },
  },
  ringSizes: {
    "15,5–17": { en: "15.5–17", fi: "15,5–17" },
    "17–18,5": { en: "17–18.5", fi: "17–18,5" },
    "18,5–21": { en: "18.5–21", fi: "18,5–21" },
  },
  ringSize: {
    "15,5–17": { en: "15.5–17", fi: "15,5–17" },
    "17–18,5": { en: "17–18.5", fi: "17–18,5" },
    "18,5–21": { en: "18.5–21", fi: "18,5–21" },
  },
};

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
  if (!isRecord(value)) {
    const attribute = path.match(/\.attributes\.([A-Za-z0-9_-]+)(?:\[\d+\])?$/)?.[1];
    if (attribute === undefined) return;
    const localizedValue = primitiveAttributeLocaleAuthority[attribute]?.[String(value)];
    for (const locale of enabledLocales) {
      if (localizedValue?.[locale].trim().length) continue;
      throw new KarvonenFixtureLocaleAuthorityError(path, locale);
    }
    return;
  }

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
