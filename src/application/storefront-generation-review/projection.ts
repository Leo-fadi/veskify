import {
  createStorefrontDesignBriefFingerprint,
  storefrontDesignBriefSchema,
  type StorefrontDesignBrief,
} from "@/domain/design-brief";
import { getTemplateById } from "@/application/storefront-templates";
import {
  validateGuidedStorefrontGenerationPlan,
  type GuidedStorefrontGenerationPlan,
} from "@/application/guided-storefront-generation";
import {
  cloneStorefrontGenerationReview,
  STOREFRONT_GENERATION_REVIEW_SCHEMA_VERSION,
  storefrontGenerationReviewSchema,
  type StorefrontGenerationReview,
  type StorefrontGenerationReviewDiagnostic,
  type StorefrontGenerationReviewFact,
  type StorefrontGenerationReviewSection,
  StorefrontGenerationReviewError,
} from "./contract";

type LocalizedCopy = { en: string; fi: string };

const copy = (en: string, fi: string): LocalizedCopy => ({ en, fi });

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createStorefrontGenerationReviewId(plan: GuidedStorefrontGenerationPlan): string {
  return `storefront-review-${stableHash(
    JSON.stringify({
      schemaVersion: STOREFRONT_GENERATION_REVIEW_SCHEMA_VERSION,
      guidedGenerationPlanId: plan.id,
      status: plan.status,
      brandFoundationPlanId: plan.brandFoundationPlan.id,
      templateSelectionPlanId: plan.templateSelectionPlan?.id ?? null,
      materializationPlanId: plan.initialStorefrontGenerationPlan?.id ?? null,
      briefFingerprint: plan.briefFingerprint,
    }),
  )}`;
}

function fact(id: string, label: LocalizedCopy, value: string): StorefrontGenerationReviewFact {
  return { id, label, value };
}

function section(
  id: StorefrontGenerationReviewSection["id"],
  heading: LocalizedCopy,
  summary: LocalizedCopy,
  status: StorefrontGenerationReviewSection["status"],
  source: string,
  sourceStage: StorefrontGenerationReviewSection["sourceStage"],
  facts: StorefrontGenerationReviewFact[] = [],
  diagnosticCodes: string[] = [],
): StorefrontGenerationReviewSection {
  return { id, heading, summary, status, source, sourceStage, facts, diagnosticCodes };
}

function diagnosticContext(stage: StorefrontGenerationReviewDiagnostic["stage"]): LocalizedCopy {
  if (stage === "brand-foundation") return copy("Brand foundation", "Brändiperusta");
  if (stage === "template-selection") return copy("Storefront template", "Kaupan mallipohja");
  return copy("Storefront materialization", "Kaupan muodostus");
}

function projectDiagnostics(
  plan: GuidedStorefrontGenerationPlan,
  brief: StorefrontDesignBrief | null,
): StorefrontGenerationReviewDiagnostic[] {
  const diagnostics = plan.diagnostics.map((item) => ({
    ...item,
    context: diagnosticContext(item.stage),
  }));
  if (brief?.catalogueContext === "existing-vesko-catalogue") {
    diagnostics.push({
      stage: "template-selection",
      code: "EXISTING_CATALOGUE_REFERENCE_UNRESOLVED",
      severity: "blocker",
      message:
        "The selected Vesko catalogue cannot be resolved safely in this standalone storefront flow.",
      planId: plan.templateSelectionPlan?.id ?? null,
      context: copy("Catalogue readiness", "Kuvaston valmius"),
    });
  }
  return diagnostics;
}

function projectBusiness(brief: StorefrontDesignBrief | null, briefId: string) {
  const facts = [fact("brief-id", copy("Brief", "Suunnitelma"), briefId)];
  if (brief) {
    const optional = [
      [
        "business-name",
        copy("Business name", "Yrityksen nimi"),
        brief.businessIdentity.businessName,
      ],
      ["short-description", copy("Description", "Kuvaus"), brief.businessIdentity.shortDescription],
      ["industry", copy("Industry", "Toimiala"), brief.businessIdentity.industry ?? ""],
      [
        "target-customer",
        copy("Target customer", "Kohdeasiakas"),
        brief.businessIdentity.targetCustomer,
      ],
      [
        "primary-market",
        copy("Primary market", "Päämarkkina"),
        brief.businessIdentity.primaryMarket,
      ],
      [
        "creation-context",
        copy("Creation context", "Luomisen lähtökohta"),
        brief.creationContext.type ?? "",
      ],
    ] as const;
    optional.forEach(([id, label, value]) => {
      if (value) facts.push(fact(id, label, value));
    });
  }
  return section(
    "business",
    copy("What we understood", "Mitä ymmärsimme"),
    copy(
      "Your business information is carried into the storefront plan.",
      "Yrityksesi tiedot siirtyvät kaupan suunnitelmaan.",
    ),
    brief ? "complete" : "not-applicable",
    "canonical design brief",
    null,
    facts,
  );
}

function projectBrand(plan: GuidedStorefrontGenerationPlan): StorefrontGenerationReviewSection {
  const brand = plan.brandFoundationPlan;
  const system = brand.brandSystem;
  const facts = [
    fact("foundation", copy("Foundation", "Perusta"), brand.selectedPresetId),
    fact(
      "typography",
      copy("Typography", "Typografia"),
      `${system.typography.headingFont} / ${system.typography.bodyFont}`,
    ),
    fact("imagery", copy("Imagery", "Kuvatyyli"), system.imagery.style),
    fact("spacing", copy("Spacing", "Väljyys"), system.spacing.density),
    fact("shape", copy("Shape", "Muotokieli"), system.shape.radius),
    fact(
      "voice",
      copy("Voice", "Äänensävy"),
      `${system.voice.positioning}, ${system.voice.warmth}, ${system.voice.energy}`,
    ),
  ];
  const style = brand.provenance.colors.detail.en;
  if (style) facts.push(fact("colour-direction", copy("Colour direction", "Värisuunta"), style));
  return section(
    "brand-foundation",
    copy("Brand direction", "Brändisuunta"),
    brand.explanation,
    brand.status === "blocked" ? "blocked" : brand.warnings.length > 0 ? "warning" : "complete",
    "P3-05 brand foundation",
    "brand-foundation",
    facts,
    brand.warnings.map((item) => item.code),
  );
}

function projectTemplate(
  plan: GuidedStorefrontGenerationPlan,
  brief: StorefrontDesignBrief | null,
): StorefrontGenerationReviewSection {
  const selection = plan.templateSelectionPlan;
  if (!selection) {
    return section(
      "storefront-template",
      copy("Storefront template", "Kaupan mallipohja"),
      copy("Template selection was not run.", "Mallipohjan valintaa ei suoritettu."),
      "not-applicable",
      "P3-06 template selection",
      "template-selection",
    );
  }
  const template = selection.selectedTemplateId
    ? getTemplateById(selection.selectedTemplateId)
    : null;
  if (selection.selectedTemplateId && !template)
    throw new StorefrontGenerationReviewError(
      "inconsistent-review-source",
      "The selected storefront template is not registered.",
    );
  const facts = [
    ...(template ? [fact("template", copy("Template", "Mallipohja"), template.name.en)] : []),
    fact(
      "selection",
      copy("Selection", "Valinta"),
      selection.selectionSource === "merchant-override"
        ? "Merchant preference"
        : "Recommended foundation",
    ),
    fact(
      "required-pages",
      copy("Required pages", "Vaaditut sivut"),
      selection.resolvedPagePlans.map((page) => page.pageType).join(", ") || "Not available",
    ),
    fact(
      "requested-pages",
      copy("Requested pages", "Pyydetyt sivut"),
      brief?.storefrontStructure.pageTypes.join(", ") || "Not available",
    ),
  ];
  return section(
    "storefront-template",
    copy("Storefront template", "Kaupan mallipohja"),
    selection.explanation,
    selection.status === "blocked"
      ? "blocked"
      : selection.warnings.length > 0
        ? "warning"
        : "complete",
    "P3-06 template selection",
    "template-selection",
    facts,
    [...selection.warnings, ...selection.blockers].map((item) => item.code),
  );
}

function projectPages(plan: GuidedStorefrontGenerationPlan): {
  section: StorefrontGenerationReviewSection;
  pages: StorefrontGenerationReview["pageSummaries"];
} {
  const materializationStages = plan.stageDiagnostics.filter(
    (entry) => entry.stage === "storefront-materialization",
  );
  if (materializationStages.length !== 1) {
    throw new StorefrontGenerationReviewError(
      "inconsistent-review-source",
      "The materialization stage status is inconsistent.",
    );
  }
  const materializationStage = materializationStages[0];
  if (materializationStage.status === "not-run") {
    if (plan.generatedSnapshot !== null || plan.initialStorefrontGenerationPlan !== null) {
      throw new StorefrontGenerationReviewError(
        "inconsistent-review-source",
        "Materialization cannot be not-run when its output exists.",
      );
    }
    return {
      section: section(
        "storefront-pages",
        copy("Storefront pages", "Kaupan sivut"),
        copy(
          "Page materialization was not run because an earlier stage was blocked.",
          "Sivujen muodostusta ei suoritettu, koska aiempi vaihe estyi.",
        ),
        "not-applicable",
        "P3-08 storefront materialization",
        "storefront-materialization",
        [],
        materializationStage.diagnostics.map((item) => item.code),
      ),
      pages: [],
    };
  }
  const snapshot = plan.generatedSnapshot;
  if (!snapshot) {
    return {
      section: section(
        "storefront-pages",
        copy("Storefront pages", "Kaupan sivut"),
        copy(
          "Pages were not materialized because generation is blocked.",
          "Sivuja ei muodostettu, koska generointi on estetty.",
        ),
        "blocked",
        "P3-08 storefront materialization",
        "storefront-materialization",
      ),
      pages: [],
    };
  }
  const pages = snapshot.pages.map((page, position) => ({
    id: page.id,
    type: page.type,
    path: page.slug,
    position,
    totalSectionCount: page.sections.length,
    visibleSectionCount: page.sections.filter((item) => item.visible).length,
    hiddenSectionCount: page.sections.filter((item) => !item.visible).length,
    componentIds: page.sections.map((item) => item.component),
  }));
  return {
    section: section(
      "storefront-pages",
      copy("Storefront pages", "Kaupan sivut"),
      copy(
        "The storefront will include the planned pages and registered sections.",
        "Kauppa sisältää suunnitellut sivut ja rekisteröidyt osiot.",
      ),
      "complete",
      "P3-08 storefront materialization",
      "storefront-materialization",
      pages.map((page) =>
        fact(page.type, copy(page.type, page.type), `${page.totalSectionCount} sections`),
      ),
      materializationStage.diagnostics.map((item) => item.code),
    ),
    pages,
  };
}

function projectLanguages(brief: StorefrontDesignBrief | null) {
  const selectedLanguages = brief?.languagePlan.selectedLanguages ?? [];
  const primaryLanguage = brief?.languagePlan.primaryLanguage ?? null;
  const complete =
    selectedLanguages.length > 0 &&
    primaryLanguage !== null &&
    selectedLanguages.includes(primaryLanguage);
  return {
    section: section(
      "languages",
      copy("Storefront languages", "Kaupan kielet"),
      copy(
        "These are the languages selected for the storefront.",
        "Nämä kielet on valittu kauppaa varten.",
      ),
      brief ? (complete ? "complete" : "blocked") : "not-applicable",
      "canonical design brief",
      null,
      selectedLanguages.map((language) => fact(language, copy(language, language), language)),
    ),
    languagePlan: { selectedLanguages, primaryLanguage },
  };
}

function projectCatalogue(
  plan: GuidedStorefrontGenerationPlan,
  brief: StorefrontDesignBrief | null,
  diagnostics: readonly StorefrontGenerationReviewDiagnostic[],
) {
  const context = brief?.catalogueContext ?? null;
  const label =
    context === "empty-catalogue"
      ? copy("No catalogue yet", "Kuvastoa ei vielä ole")
      : context === "controlled-demo-catalogue"
        ? copy("Controlled demo catalogue", "Hallittu demokuvasto")
        : context === "existing-vesko-catalogue"
          ? copy("Existing Vesko catalogue", "Olemassa oleva Vesko-kuvasto")
          : copy("Catalogue context unavailable", "Kuvaston tietoa ei ole saatavilla");
  return section(
    "catalogue",
    copy("Catalogue readiness", "Kuvaston valmius"),
    label,
    context === "existing-vesko-catalogue"
      ? "blocked"
      : context
        ? plan.diagnostics.some(
            (item) =>
              item.code === "EMPTY_CATALOGUE_MERCHANDISING" ||
              item.code === "DEMO_CATALOGUE_CONTENT",
          )
          ? "warning"
          : "complete"
        : "not-applicable",
    "canonical design brief and P3-06/P3-08 diagnostics",
    null,
    [
      fact("catalogue-ref", copy("Catalogue reference", "Kuvaston viite"), plan.catalogueRef),
      ...(context ? [fact("context", copy("Context", "Konteksti"), context)] : []),
    ],
    diagnostics
      .filter((item) => item.code.includes("CATALOGUE") || item.code.includes("catalogue"))
      .map((item) => item.code),
  );
}

export function createStorefrontGenerationReview(
  input: unknown,
  briefInput?: unknown,
): StorefrontGenerationReview {
  let planInput = input;
  if (input && typeof input === "object" && "guidedGenerationPlan" in input) {
    const envelope = input as { guidedGenerationPlan: unknown; brief?: unknown };
    planInput = envelope.guidedGenerationPlan;
    if (briefInput === undefined) briefInput = envelope.brief;
  }
  let plan: GuidedStorefrontGenerationPlan;
  try {
    plan = validateGuidedStorefrontGenerationPlan(planInput);
  } catch (cause) {
    throw new StorefrontGenerationReviewError(
      "invalid-guided-plan",
      "The guided storefront generation plan is invalid.",
      cause,
    );
  }
  let brief: StorefrontDesignBrief | null = null;
  if (briefInput !== undefined) {
    try {
      brief = storefrontDesignBriefSchema.parse(briefInput);
    } catch (cause) {
      throw new StorefrontGenerationReviewError(
        "invalid-guided-plan",
        "The design brief for review is invalid.",
        cause,
      );
    }
    if (brief.id !== plan.briefId)
      throw new StorefrontGenerationReviewError(
        "inconsistent-review-source",
        "The review brief does not match the guided generation plan.",
      );
    if (createStorefrontDesignBriefFingerprint(brief) !== plan.briefFingerprint)
      throw new StorefrontGenerationReviewError(
        "inconsistent-review-source",
        "The review brief does not match the guided generation source version.",
      );
  }
  const diagnostics = projectDiagnostics(plan, brief);
  const warnings = diagnostics.filter((item) => item.severity === "warning");
  const blockers = diagnostics.filter((item) => item.severity === "blocker");
  const pages = projectPages(plan);
  const languages = projectLanguages(brief);
  const catalogue = projectCatalogue(plan, brief, diagnostics);
  const requiredPages = ["home", "collection", "product"];
  const hasRequiredPages = requiredPages.every((type) =>
    pages.pages.some((page) => page.type === type),
  );
  const hasRequiredLanguages =
    languages.languagePlan.selectedLanguages.length > 0 &&
    languages.languagePlan.primaryLanguage !== null &&
    languages.languagePlan.selectedLanguages.includes(languages.languagePlan.primaryLanguage);
  if (plan.status !== "blocked" && (!plan.generatedSnapshot || !hasRequiredPages))
    throw new StorefrontGenerationReviewError(
      "inconsistent-review-source",
      "A successful generation plan does not contain all required storefront pages.",
    );
  const canCreateProject =
    plan.status !== "blocked" &&
    plan.generatedSnapshot !== null &&
    blockers.length === 0 &&
    hasRequiredPages &&
    hasRequiredLanguages;
  const assumptions = plan.assumptions.map((value) => copy(value, value));
  const review = {
    schemaVersion: STOREFRONT_GENERATION_REVIEW_SCHEMA_VERSION,
    id: createStorefrontGenerationReviewId(plan),
    guidedGenerationPlanId: plan.id,
    briefId: plan.briefId,
    briefFingerprint: plan.briefFingerprint,
    status: plan.status,
    canCreateProject,
    title: copy("Review your storefront plan", "Tarkista kaupan suunnitelma"),
    summary: canCreateProject
      ? copy(
          "Your storefront plan is ready to review.",
          "Kaupan suunnitelma on valmis tarkistettavaksi.",
        )
      : copy(
          "Some information needs attention before project creation can continue.",
          "Jotkin tiedot vaativat huomiota ennen projektin luomista.",
        ),
    sections: [
      projectBusiness(brief, plan.briefId),
      projectBrand(plan),
      projectTemplate(plan, brief),
      pages.section,
      languages.section,
      catalogue,
      section(
        "assumptions",
        copy("Assumptions", "Oletukset"),
        copy(
          "The plan uses these controlled assumptions.",
          "Suunnitelma käyttää näitä hallittuja oletuksia.",
        ),
        assumptions.length ? "complete" : "not-applicable",
        "guided generation",
        null,
        assumptions.map((item, index) =>
          fact(`assumption-${index}`, copy("Assumption", "Oletus"), item.en),
        ),
      ),
      section(
        "warnings",
        copy("Warnings", "Huomautukset"),
        warnings.length
          ? copy("Review these points before continuing.", "Tarkista nämä kohdat ennen jatkamista.")
          : copy("No warnings were reported.", "Huomautuksia ei ilmoitettu."),
        warnings.length ? "warning" : "not-applicable",
        "guided generation diagnostics",
        null,
        [],
        warnings.map((item) => item.code),
      ),
      section(
        "blockers",
        copy("Blockers", "Estävät tekijät"),
        blockers.length
          ? copy("Project creation cannot continue yet.", "Projektin luominen ei voi vielä jatkua.")
          : copy("There are no blockers.", "Estäviä tekijöitä ei ole."),
        blockers.length ? "blocked" : "not-applicable",
        "guided generation diagnostics",
        null,
        [],
        blockers.map((item) => item.code),
      ),
    ],
    assumptions,
    warnings,
    blockers,
    sourceDiagnostics: diagnostics,
    stageStatuses: plan.stageDiagnostics.map((stage) => ({
      stage: stage.stage,
      status: stage.status,
    })),
    pageSummaries: pages.pages,
    languagePlan: languages.languagePlan,
    catalogueContext: brief?.catalogueContext ?? null,
    catalogueRef: plan.catalogueRef,
    selectedPresetId: plan.brandFoundationPlan.selectedPresetId,
    selectedTemplateId: plan.templateSelectionPlan?.selectedTemplateId ?? null,
    brandFoundationPlanId: plan.brandFoundationPlan.id,
    templateSelectionPlanId: plan.templateSelectionPlan?.id ?? null,
    materializationPlanId: plan.initialStorefrontGenerationPlan?.id ?? null,
    generatedSnapshotId: plan.generatedSnapshot?.id ?? null,
    provenance: {
      brief: "validated canonical StorefrontDesignBrief",
      brandFoundation: "P3-05 BrandFoundationPlan",
      templateSelection: "P3-06 StorefrontTemplateSelectionPlan",
      storefrontMaterialization: "P3-08 InitialStorefrontGenerationPlan",
    },
  };
  try {
    return cloneStorefrontGenerationReview(storefrontGenerationReviewSchema.parse(review));
  } catch (cause) {
    throw new StorefrontGenerationReviewError(
      "inconsistent-review-source",
      "The storefront generation review is internally inconsistent.",
      cause,
    );
  }
}
