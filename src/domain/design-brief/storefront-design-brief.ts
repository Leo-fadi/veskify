import { ZodError, z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  localeSchema,
  safeExternalUrlSchema,
  type Locale,
} from "@/domain/shared";

export const STOREFRONT_DESIGN_BRIEF_SCHEMA_VERSION = 1 as const;

export const storefrontDesignBriefStatusSchema = z.enum(["collecting", "ready", "consumed"]);
export type StorefrontDesignBriefStatus = z.infer<typeof storefrontDesignBriefStatusSchema>;

export const storefrontCreationContextTypeSchema = z.enum([
  "new-storefront",
  "redesign-existing-storefront",
  "demo-storefront",
]);
export type StorefrontCreationContextType = z.infer<typeof storefrontCreationContextTypeSchema>;

export const storefrontIndustrySchema = z.enum([
  "jewellery",
  "watches",
  "fashion",
  "beauty",
  "home",
  "food",
  "services",
  "electronics",
  "sports",
  "health",
  "other",
]);
export type StorefrontIndustry = z.infer<typeof storefrontIndustrySchema>;

export const briefPageTypeValues = [
  "home",
  "collection",
  "product",
  "about",
  "contact",
  "faq",
  "policy",
  "content",
] as const;
export const storefrontBriefPageTypeSchema = z.enum(briefPageTypeValues);
export type StorefrontBriefPageType = z.infer<typeof storefrontBriefPageTypeSchema>;

/** The minimum page slice required before the deterministic planner can generate a storefront. */
export const requiredStorefrontPageTypes = ["home", "collection", "product"] as const;

const requiredStorefrontPageIssues = {
  home: { code: "missing-homepage", message: "Select the required homepage." },
  collection: {
    code: "missing-collection-page",
    message: "Select a collection or category page.",
  },
  product: { code: "missing-product-page", message: "Select a product page." },
} as const;

export const catalogueContextValues = [
  "existing-vesko-catalogue",
  "controlled-demo-catalogue",
  "empty-catalogue",
] as const;
export const catalogueContextSchema = z.enum(catalogueContextValues);
export type CatalogueContext = z.infer<typeof catalogueContextSchema>;

export const typographyDirectionSchema = z.enum(["serif", "sans", "mixed", "system"]);
export const visualStyleDirectionSchema = z.enum([
  "minimal",
  "editorial",
  "luxury",
  "playful",
  "bold",
  "natural",
]);
export const imageryDirectionSchema = z.enum(["studio", "lifestyle", "editorial", "mixed"]);
export const visualDensitySchema = z.enum(["compact", "balanced", "airy"]);
export const contentEmphasisSchema = z.enum(["concise", "balanced", "storytelling"]);
export const merchandisingEmphasisSchema = z.enum(["low", "balanced", "high"]);
export const sectionRichnessSchema = z.enum(["minimal", "balanced", "rich"]);
export const accessibilityPreferenceSchema = z.enum(["standard", "high-contrast"]);

const briefText = (maximum: number) => z.string().trim().max(maximum);
const hexColourSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{6})$/, "Use a six-digit hexadecimal colour.");

/** Metadata only. The brief never stores binary files or downloads an asset URL. */
export const briefAssetReferenceSchema = z
  .object({
    id: idSchema,
    label: briefText(120).optional(),
  })
  .strict();
export type BriefAssetReference = z.infer<typeof briefAssetReferenceSchema>;

export const creationContextSchema = z
  .object({
    type: storefrontCreationContextTypeSchema.nullable().default(null),
    existingStorefrontUrl: safeExternalUrlSchema.nullable().default(null),
  })
  .strict();

export const businessIdentitySchema = z
  .object({
    businessName: briefText(120).default(""),
    shortDescription: briefText(2_000).default(""),
    industry: storefrontIndustrySchema.nullable().default(null),
    targetCustomer: briefText(500).default(""),
    primaryMarket: briefText(120).default(""),
    secondaryMarkets: z.array(briefText(120)).max(20).default([]),
  })
  .strict()
  .superRefine((identity, context) => {
    const normalizedMarkets = identity.secondaryMarkets.map((market) => market.toLocaleLowerCase());
    if (new Set(normalizedMarkets).size !== normalizedMarkets.length) {
      context.addIssue({
        code: "custom",
        path: ["secondaryMarkets"],
        message: "Secondary markets must be unique.",
      });
    }
    if (
      identity.primaryMarket.length > 0 &&
      normalizedMarkets.includes(identity.primaryMarket.toLocaleLowerCase())
    ) {
      context.addIssue({
        code: "custom",
        path: ["secondaryMarkets"],
        message: "The primary market must not also be a secondary market.",
      });
    }
  });

export const brandDirectionSchema = z
  .object({
    logoAssetRef: briefAssetReferenceSchema.nullable().default(null),
    supportingImageAssetRefs: z.array(briefAssetReferenceSchema).max(20).default([]),
    preferredBrandColours: z.array(hexColourSchema).max(8).default([]),
    typographyDirection: typographyDirectionSchema.nullable().default(null),
    visualStyleDirection: visualStyleDirectionSchema.nullable().default(null),
    imageryDirection: imageryDirectionSchema.nullable().default(null),
    toneKeywords: z.array(z.string().trim().min(2).max(40)).max(12).default([]),
  })
  .strict()
  .superRefine((brand, context) => {
    const assetIds = brand.supportingImageAssetRefs.map((asset) => asset.id);
    if (brand.logoAssetRef && assetIds.includes(brand.logoAssetRef.id)) {
      context.addIssue({
        code: "custom",
        path: ["supportingImageAssetRefs"],
        message: "The logo reference must not be repeated as a supporting image.",
      });
    }
    if (new Set(assetIds).size !== assetIds.length) {
      context.addIssue({
        code: "custom",
        path: ["supportingImageAssetRefs"],
        message: "Supporting image references must be unique.",
      });
    }
    const colours = brand.preferredBrandColours.map((colour) => colour.toLocaleLowerCase());
    if (new Set(colours).size !== colours.length) {
      context.addIssue({
        code: "custom",
        path: ["preferredBrandColours"],
        message: "Preferred brand colours must be unique.",
      });
    }
    const keywords = brand.toneKeywords.map((keyword) => keyword.toLocaleLowerCase());
    if (new Set(keywords).size !== keywords.length) {
      context.addIssue({
        code: "custom",
        path: ["toneKeywords"],
        message: "Tone keywords must be unique.",
      });
    }
  });

export const storefrontStructureSchema = z
  .object({
    pageTypes: z.array(storefrontBriefPageTypeSchema).max(briefPageTypeValues.length).default([]),
  })
  .strict()
  .superRefine((structure, context) => {
    if (new Set(structure.pageTypes).size !== structure.pageTypes.length) {
      context.addIssue({
        code: "custom",
        path: ["pageTypes"],
        message: "Storefront page types must be unique.",
      });
    }
    if (structure.pageTypes.length > 0 && !structure.pageTypes.includes("home")) {
      context.addIssue({
        code: "custom",
        path: ["pageTypes"],
        message: "The homepage is required.",
      });
    }
  });

export const languagePlanSchema = z
  .object({
    selectedLanguages: z.array(localeSchema).max(2).default([]),
    primaryLanguage: localeSchema.nullable().default(null),
  })
  .strict()
  .superRefine((languagePlan, context) => {
    if (new Set(languagePlan.selectedLanguages).size !== languagePlan.selectedLanguages.length) {
      context.addIssue({
        code: "custom",
        path: ["selectedLanguages"],
        message: "Selected storefront languages must be unique.",
      });
    }
    if (
      languagePlan.primaryLanguage !== null &&
      !languagePlan.selectedLanguages.includes(languagePlan.primaryLanguage)
    ) {
      context.addIssue({
        code: "custom",
        path: ["primaryLanguage"],
        message: "The primary language must be selected.",
      });
    }
    if (languagePlan.selectedLanguages.length === 0 && languagePlan.primaryLanguage !== null) {
      context.addIssue({
        code: "custom",
        path: ["primaryLanguage"],
        message: "A primary language requires at least one selected language.",
      });
    }
  });

export const generationPreferencesSchema = z
  .object({
    visualDensity: visualDensitySchema.default("balanced"),
    contentEmphasis: contentEmphasisSchema.default("balanced"),
    merchandisingEmphasis: merchandisingEmphasisSchema.default("balanced"),
    sectionRichness: sectionRichnessSchema.default("balanced"),
    accessibilityPreference: accessibilityPreferenceSchema.default("standard"),
  })
  .strict();

const briefAreasSchema = {
  creationContext: creationContextSchema,
  businessIdentity: businessIdentitySchema,
  brandDirection: brandDirectionSchema,
  storefrontStructure: storefrontStructureSchema,
  languagePlan: languagePlanSchema,
  catalogueContext: catalogueContextSchema.nullable().default(null),
  generationPreferences: generationPreferencesSchema,
} as const;

export const storefrontDesignBriefSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.literal(STOREFRONT_DESIGN_BRIEF_SCHEMA_VERSION),
    status: storefrontDesignBriefStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    ...briefAreasSchema,
  })
  .strict()
  .superRefine((brief, context) => {
    if (Date.parse(brief.updatedAt) < Date.parse(brief.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "The updated timestamp cannot precede creation.",
      });
    }

    const creationType = brief.creationContext.type;
    const existingUrl = brief.creationContext.existingStorefrontUrl;
    if (creationType === "redesign-existing-storefront" && existingUrl === null) {
      if (brief.status !== "collecting") {
        context.addIssue({
          code: "custom",
          path: ["creationContext", "existingStorefrontUrl"],
          message: "A redesign requires an existing storefront URL.",
        });
      }
    }
    if (creationType !== "redesign-existing-storefront" && existingUrl !== null) {
      context.addIssue({
        code: "custom",
        path: ["creationContext", "existingStorefrontUrl"],
        message: "An existing storefront URL is only valid for a redesign.",
      });
    }

    if (brief.status !== "collecting") {
      const requiredText: Array<
        ["businessName" | "shortDescription" | "targetCustomer" | "primaryMarket", string]
      > = [
        ["businessName", "Business name is required."],
        ["shortDescription", "A short business description is required."],
        ["targetCustomer", "A target customer is required."],
        ["primaryMarket", "A primary market is required."],
      ];
      requiredText.forEach(([field, message]) => {
        if (brief.businessIdentity[field].length === 0) {
          context.addIssue({ code: "custom", path: ["businessIdentity", field], message });
        }
      });
      if (brief.businessIdentity.industry === null) {
        context.addIssue({
          code: "custom",
          path: ["businessIdentity", "industry"],
          message: "An industry is required.",
        });
      }
      if (!brief.creationContext.type) {
        context.addIssue({
          code: "custom",
          path: ["creationContext", "type"],
          message: "A creation context is required.",
        });
      }
      requiredStorefrontPageTypes.forEach((pageType) => {
        if (!brief.storefrontStructure.pageTypes.includes(pageType)) {
          context.addIssue({
            code: "custom",
            path: ["storefrontStructure", "pageTypes"],
            message: requiredStorefrontPageIssues[pageType].message,
            params: { issueCode: requiredStorefrontPageIssues[pageType].code },
          });
        }
      });
      if (brief.languagePlan.selectedLanguages.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["languagePlan", "selectedLanguages"],
          message: "At least one storefront language is required.",
        });
      }
      if (brief.languagePlan.primaryLanguage === null) {
        context.addIssue({
          code: "custom",
          path: ["languagePlan", "primaryLanguage"],
          message: "A primary storefront language is required.",
        });
      }
      if (brief.catalogueContext === null) {
        context.addIssue({
          code: "custom",
          path: ["catalogueContext"],
          message: "A catalogue context is required.",
        });
      }
    }
  });

export type CreationContext = z.infer<typeof creationContextSchema>;
export type BusinessIdentity = z.infer<typeof businessIdentitySchema>;
export type BrandDirection = z.infer<typeof brandDirectionSchema>;
export type StorefrontStructure = z.infer<typeof storefrontStructureSchema>;
export type LanguagePlan = z.infer<typeof languagePlanSchema>;
export type GenerationPreferences = z.infer<typeof generationPreferencesSchema>;
export type StorefrontDesignBrief = z.infer<typeof storefrontDesignBriefSchema>;

type BriefIssuePath = Array<string | number>;

export type StorefrontDesignBriefValidationIssue = Readonly<{
  code: string;
  path: BriefIssuePath;
  message: string;
}>;

export class StorefrontDesignBriefError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "StorefrontDesignBriefError";
    this.code = code;
  }
}

export class StorefrontDesignBriefValidationError extends StorefrontDesignBriefError {
  readonly issues: readonly StorefrontDesignBriefValidationIssue[];

  constructor(issues: readonly StorefrontDesignBriefValidationIssue[]) {
    super(
      "invalid-storefront-design-brief",
      `The storefront design brief is not valid${issues[0] ? `: ${issues[0].message}` : "."}`,
    );
    this.name = "StorefrontDesignBriefValidationError";
    this.issues = issues;
  }
}

export class StorefrontDesignBriefLifecycleError extends StorefrontDesignBriefError {
  constructor(message: string) {
    super("invalid-storefront-design-brief-lifecycle", message);
    this.name = "StorefrontDesignBriefLifecycleError";
  }
}

function mapZodError(error: ZodError): StorefrontDesignBriefValidationError {
  return new StorefrontDesignBriefValidationError(
    error.issues.map((issue) => {
      const issueCode = (issue as { params?: { issueCode?: unknown } }).params?.issueCode;
      return {
        path: issue.path.filter(
          (part): part is string | number => typeof part === "string" || typeof part === "number",
        ),
        code: typeof issueCode === "string" ? issueCode : issue.code,
        message: issue.message,
      };
    }),
  );
}

function parseBrief(input: unknown): StorefrontDesignBrief {
  try {
    return storefrontDesignBriefSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) throw mapZodError(error);
    throw error;
  }
}

export function validateStorefrontDesignBrief(input: unknown): StorefrontDesignBrief {
  return parseBrief(input);
}

function isoNow(input?: Date | string): string {
  const date = input instanceof Date ? input : input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new StorefrontDesignBriefValidationError([
      { code: "invalid_date", path: ["updatedAt"], message: "The timestamp must be valid." },
    ]);
  }
  return date.toISOString();
}

let briefSequence = 0;

function createBriefId(): string {
  const uuid = globalThis.crypto?.randomUUID?.().replaceAll("-", "");
  if (uuid) return `brief_${uuid.slice(0, 32)}`;
  briefSequence += 1;
  return `brief_${Date.now().toString(36)}_${briefSequence}`;
}

export type CreateEmptyStorefrontDesignBriefOptions = Readonly<{
  id?: string;
  now?: Date | string;
}>;

export function createEmptyStorefrontDesignBrief(
  options: CreateEmptyStorefrontDesignBriefOptions = {},
): StorefrontDesignBrief {
  const timestamp = isoNow(options.now);
  return validateStorefrontDesignBrief({
    id: options.id ?? createBriefId(),
    schemaVersion: STOREFRONT_DESIGN_BRIEF_SCHEMA_VERSION,
    status: "collecting",
    createdAt: timestamp,
    updatedAt: timestamp,
    creationContext: {},
    businessIdentity: {},
    brandDirection: {},
    storefrontStructure: {},
    languagePlan: {},
    catalogueContext: null,
    generationPreferences: {},
  });
}

type DeepPartial<T> = T extends readonly (infer Item)[]
  ? readonly DeepPartial<Item>[]
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

export type StorefrontDesignBriefInput = DeepPartial<StorefrontDesignBrief>;

function trimText(value: string): string {
  return value.trim();
}

function uniqueNormalized(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.reduce<string[]>((result, value) => {
    const trimmed = trimText(value);
    const key = trimmed.toLocaleLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
    return result;
  }, []);
}

function normalizeCatalogueContext(value: unknown): unknown {
  if (value === "existing-vesko" || value === "existingVeskoCatalogue") {
    return "existing-vesko-catalogue";
  }
  if (value === "controlled-demo" || value === "controlledDemoCatalogue") {
    return "controlled-demo-catalogue";
  }
  if (value === "empty" || value === "emptyCatalogue") return "empty-catalogue";
  return value;
}

export function normalizeStorefrontDesignBriefInput(
  input: StorefrontDesignBriefInput = {},
): StorefrontDesignBrief {
  const empty = createEmptyStorefrontDesignBrief();
  const candidate = {
    ...empty,
    ...input,
    creationContext: { ...empty.creationContext, ...input.creationContext },
    businessIdentity: { ...empty.businessIdentity, ...input.businessIdentity },
    brandDirection: { ...empty.brandDirection, ...input.brandDirection },
    storefrontStructure: { ...empty.storefrontStructure, ...input.storefrontStructure },
    languagePlan: { ...empty.languagePlan, ...input.languagePlan },
    generationPreferences: {
      ...empty.generationPreferences,
      ...input.generationPreferences,
    },
    catalogueContext: normalizeCatalogueContext(input.catalogueContext ?? empty.catalogueContext),
  } as StorefrontDesignBrief;

  if (typeof candidate.creationContext.existingStorefrontUrl === "string") {
    candidate.creationContext.existingStorefrontUrl =
      candidate.creationContext.existingStorefrontUrl.trim();
  }
  candidate.businessIdentity.businessName = trimText(candidate.businessIdentity.businessName);
  candidate.businessIdentity.shortDescription = trimText(
    candidate.businessIdentity.shortDescription,
  );
  candidate.businessIdentity.targetCustomer = trimText(candidate.businessIdentity.targetCustomer);
  candidate.businessIdentity.primaryMarket = trimText(candidate.businessIdentity.primaryMarket);
  candidate.businessIdentity.secondaryMarkets = uniqueNormalized(
    candidate.businessIdentity.secondaryMarkets,
  );
  candidate.brandDirection.toneKeywords = uniqueNormalized(candidate.brandDirection.toneKeywords);
  candidate.languagePlan.selectedLanguages = [...new Set(candidate.languagePlan.selectedLanguages)];
  candidate.brandDirection.preferredBrandColours =
    candidate.brandDirection.preferredBrandColours.map(trimText);

  return validateStorefrontDesignBrief(candidate);
}

export function cloneStorefrontDesignBrief(brief: StorefrontDesignBrief): StorefrontDesignBrief {
  return validateStorefrontDesignBrief(structuredClone(brief));
}

export type StorefrontDesignBriefArea =
  | "creationContext"
  | "businessIdentity"
  | "brandDirection"
  | "storefrontStructure"
  | "languagePlan"
  | "catalogueContext"
  | "generationPreferences";

type BriefAreaValue = Pick<StorefrontDesignBrief, StorefrontDesignBriefArea>;

export function updateStorefrontDesignBriefArea<Area extends StorefrontDesignBriefArea>(
  brief: StorefrontDesignBrief,
  area: Area,
  update:
    | Partial<BriefAreaValue[Area]>
    | BriefAreaValue[Area]
    | ((current: BriefAreaValue[Area]) => BriefAreaValue[Area]),
  now?: Date | string,
): StorefrontDesignBrief {
  if (brief.status === "consumed") {
    throw new StorefrontDesignBriefLifecycleError(
      "A consumed storefront design brief cannot be edited.",
    );
  }

  const current = cloneStorefrontDesignBrief(brief);
  const nextValue =
    typeof update === "function"
      ? update(structuredClone(current[area]))
      : area === "catalogueContext"
        ? update
        : ({
            ...(current[area] as Record<string, unknown>),
            ...(update as Record<string, unknown>),
          } as BriefAreaValue[Area]);
  const requestedTimestamp = Date.parse(isoNow(now));
  const currentTimestamp = Date.parse(current.updatedAt);
  const next = {
    ...current,
    status: "collecting" as const,
    updatedAt: new Date(
      Math.max(Date.parse(current.createdAt), currentTimestamp + 1, requestedTimestamp),
    ).toISOString(),
    [area]: structuredClone(nextValue),
  };
  return normalizeStorefrontDesignBriefInput(next);
}

export type GenerationReadinessIssue = Readonly<{
  code: string;
  area: StorefrontDesignBriefArea;
  message: string;
}>;

export type GenerationReadiness = Readonly<{
  ready: boolean;
  blockingIssues: readonly GenerationReadinessIssue[];
  warnings: readonly GenerationReadinessIssue[];
  completedAreas: readonly StorefrontDesignBriefArea[];
  missingAreas: readonly StorefrontDesignBriefArea[];
}>;

function issue(
  code: string,
  area: StorefrontDesignBriefArea,
  message: string,
): GenerationReadinessIssue {
  return { code, area, message };
}

function readinessForBrief(brief: StorefrontDesignBrief): GenerationReadiness {
  const blockingIssues: GenerationReadinessIssue[] = [];
  const warnings: GenerationReadinessIssue[] = [];
  const completedAreas: StorefrontDesignBriefArea[] = [];
  const missingAreas: StorefrontDesignBriefArea[] = [];

  const creationReady =
    brief.creationContext.type !== null &&
    (brief.creationContext.type !== "redesign-existing-storefront" ||
      brief.creationContext.existingStorefrontUrl !== null);
  if (creationReady) completedAreas.push("creationContext");
  else {
    missingAreas.push("creationContext");
    blockingIssues.push(
      issue(
        brief.creationContext.type === "redesign-existing-storefront"
          ? "missing-redesign-url"
          : "missing-creation-context",
        "creationContext",
        brief.creationContext.type === "redesign-existing-storefront"
          ? "Add the existing storefront URL before generating a redesign."
          : "Choose whether this is a new, redesign, or demo storefront.",
      ),
    );
  }

  const identity = brief.businessIdentity;
  const identityReady =
    identity.businessName.length > 0 &&
    identity.shortDescription.length > 0 &&
    identity.industry !== null &&
    identity.targetCustomer.length > 0 &&
    identity.primaryMarket.length > 0;
  if (identityReady) completedAreas.push("businessIdentity");
  else {
    missingAreas.push("businessIdentity");
    if (!identity.businessName) {
      blockingIssues.push(
        issue("missing-business-name", "businessIdentity", "Add the business name."),
      );
    }
    if (!identity.shortDescription) {
      blockingIssues.push(
        issue(
          "missing-business-description",
          "businessIdentity",
          "Add a short description of the business.",
        ),
      );
    }
    if (!identity.industry) {
      blockingIssues.push(issue("missing-industry", "businessIdentity", "Choose an industry."));
    }
    if (!identity.targetCustomer) {
      blockingIssues.push(
        issue("missing-target-customer", "businessIdentity", "Describe the target customer."),
      );
    }
    if (!identity.primaryMarket) {
      blockingIssues.push(
        issue("missing-primary-market", "businessIdentity", "Add the primary market."),
      );
    }
  }

  const brand = brief.brandDirection;
  const brandReady =
    brand.logoAssetRef !== null ||
    brand.supportingImageAssetRefs.length > 0 ||
    brand.preferredBrandColours.length > 0 ||
    brand.typographyDirection !== null ||
    brand.visualStyleDirection !== null ||
    brand.imageryDirection !== null ||
    brand.toneKeywords.length > 0;
  if (brandReady) completedAreas.push("brandDirection");
  else missingAreas.push("brandDirection");
  if (!brand.logoAssetRef) {
    warnings.push(issue("missing-logo", "brandDirection", "A logo has not been provided."));
  }
  if (brand.preferredBrandColours.length === 0) {
    warnings.push(
      issue("missing-brand-colours", "brandDirection", "No preferred brand colours were provided."),
    );
  }
  if (!brand.typographyDirection) {
    warnings.push(
      issue(
        "missing-typography-direction",
        "brandDirection",
        "No typography direction was provided.",
      ),
    );
  }
  if (!brand.visualStyleDirection) {
    warnings.push(
      issue("missing-visual-style", "brandDirection", "No visual style direction was provided."),
    );
  }
  if (!brand.imageryDirection) {
    warnings.push(
      issue("missing-imagery-direction", "brandDirection", "No imagery direction was provided."),
    );
  }

  const missingRequiredPages = requiredStorefrontPageTypes.filter(
    (pageType) => !brief.storefrontStructure.pageTypes.includes(pageType),
  );
  const structureReady = missingRequiredPages.length === 0;
  if (structureReady) completedAreas.push("storefrontStructure");
  else {
    missingAreas.push("storefrontStructure");
    missingRequiredPages.forEach((pageType) => {
      const pageIssue = requiredStorefrontPageIssues[pageType];
      blockingIssues.push(issue(pageIssue.code, "storefrontStructure", pageIssue.message));
    });
  }

  const languages = brief.languagePlan;
  const languageReady =
    languages.selectedLanguages.length > 0 &&
    languages.primaryLanguage !== null &&
    languages.selectedLanguages.includes(languages.primaryLanguage);
  if (languageReady) completedAreas.push("languagePlan");
  else {
    missingAreas.push("languagePlan");
    if (languages.selectedLanguages.length === 0) {
      blockingIssues.push(
        issue("missing-languages", "languagePlan", "Select at least one storefront language."),
      );
    }
    if (languages.primaryLanguage === null) {
      blockingIssues.push(
        issue(
          "missing-primary-language",
          "languagePlan",
          "Choose the primary storefront language.",
        ),
      );
    } else if (!languages.selectedLanguages.includes(languages.primaryLanguage)) {
      blockingIssues.push(
        issue(
          "invalid-primary-language",
          "languagePlan",
          "The primary language must be one of the selected languages.",
        ),
      );
    }
  }

  if (brief.catalogueContext) completedAreas.push("catalogueContext");
  else {
    missingAreas.push("catalogueContext");
    blockingIssues.push(
      issue("missing-catalogue-context", "catalogueContext", "Choose a catalogue context."),
    );
  }
  if (brief.catalogueContext === "empty-catalogue") {
    warnings.push(
      issue(
        "sample-catalogue-required",
        "catalogueContext",
        "The later planner must supply controlled sample catalogue data for the selected industry before project creation.",
      ),
    );
  }

  completedAreas.push("generationPreferences");

  return {
    ready: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    completedAreas,
    missingAreas,
  };
}

export function evaluateStorefrontDesignBriefReadiness(input: unknown): GenerationReadiness {
  try {
    return readinessForBrief(validateStorefrontDesignBrief(input));
  } catch (error) {
    if (!(error instanceof StorefrontDesignBriefValidationError)) throw error;

    const missingAreas = error.issues
      .map((item) => item.path[0])
      .filter(
        (area): area is StorefrontDesignBriefArea =>
          typeof area === "string" &&
          [
            "creationContext",
            "businessIdentity",
            "brandDirection",
            "storefrontStructure",
            "languagePlan",
            "catalogueContext",
            "generationPreferences",
          ].includes(area),
      );
    const uniqueMissingAreas = [...new Set(missingAreas)];
    return {
      ready: false,
      blockingIssues: error.issues.map((item) => ({
        code:
          item.path[0] === "languagePlan" && item.path[1] === "primaryLanguage"
            ? "invalid-primary-language"
            : item.code,
        area: uniqueMissingAreas.includes(item.path[0] as StorefrontDesignBriefArea)
          ? (item.path[0] as StorefrontDesignBriefArea)
          : "businessIdentity",
        message: item.message,
      })),
      warnings: [],
      completedAreas: [],
      missingAreas: uniqueMissingAreas,
    };
  }
}

export const createEmptyBrief = createEmptyStorefrontDesignBrief;
export const validateBrief = validateStorefrontDesignBrief;
export const normalizeBrief = normalizeStorefrontDesignBriefInput;
export const cloneBrief = cloneStorefrontDesignBrief;
export const updateBriefArea = updateStorefrontDesignBriefArea;
export const evaluateGenerationReadiness = evaluateStorefrontDesignBriefReadiness;

export type { Locale };
