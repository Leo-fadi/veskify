import type { AiStorefrontProposal } from "@/application/ai-storefront";
import type { DesignOperation } from "@/application/design-operations";
import type { Locale } from "@/domain/shared";
import type { PageModel } from "@/domain/storefront";
import {
  localizedMerchantValue,
  merchantOperationChangePart,
  merchantSectionName,
} from "./proposal-change-details";

export type StorefrontProposalReviewItem = {
  title: string;
  summary: string;
  operationIndexes: number[];
};

export type StorefrontProposalPageReview = {
  pageId: string;
  title: string;
  operationCount: number;
  items: StorefrontProposalReviewItem[];
};

export type StorefrontProposalDynamicCommerceReview = {
  heading: string;
  summary: string;
  protectedBindingSummary: string;
  staticPageCount: number;
  collectionSearchArchetypeCount: number;
  productDetailArchetypeCount: number;
  archetypeCount: number;
  runtimeRouteCount: number;
  collectionRouteCount: number;
  productRouteCount: number;
  searchRouteCount: number;
  operationIndexes: number[];
};

export type StorefrontProposalCanonicalGenerationReview = {
  heading: string;
  summary: string;
  protectedBindingSummary: string;
  staticPageCount: number;
  collectionSearchArchetypeCount: number;
  productDetailArchetypeCount: number;
  archetypeCount: number;
  runtimeRouteCount: number;
};

export type StorefrontProposalReview = {
  scope: "homepage" | "storefront";
  scopeLabel: string;
  proposalLabel: string;
  heading: string;
  completeSummary: string;
  confirmationTitle: string;
  confirmationBody: string;
  confirmationApplyLabel: string;
  affectedPageCount: number;
  operationCount: number;
  materialChangeCount: number;
  globalChanges: StorefrontProposalReviewItem[];
  pages: StorefrontProposalPageReview[];
  dynamicCommerceConvergence: StorefrontProposalDynamicCommerceReview | null;
  canonicalGeneration: StorefrontProposalCanonicalGenerationReview | null;
  warnings: string[];
  blockers: string[];
  representedOperationIndexes: number[];
  complete: boolean;
};

function pageTitle(page: PageModel | undefined, locale: Locale, primaryLocale: Locale) {
  if (!page) return locale === "fi" ? "Kaupan sivu" : "Storefront page";
  if (page.type === "home") return locale === "fi" ? "Etusivu" : "Homepage";
  return (
    localizedMerchantValue(page.title, locale, primaryLocale) ??
    (locale === "fi" ? "Kaupan sivu" : "Storefront page")
  );
}

function sentence(parts: string[], locale: Locale) {
  const unique = [...new Set(parts.filter(Boolean))];
  const last = unique.pop();
  if (!last) return "";
  const value =
    unique.length === 0 ? last : `${unique.join(", ")} ${locale === "fi" ? "ja" : "and"} ${last}`;
  return `${value.charAt(0).toLocaleUpperCase(locale)}${value.slice(1)}.`;
}

function operationSectionId(operation: DesignOperation) {
  return "sectionId" in operation ? operation.sectionId : null;
}

export function createStorefrontProposalReview(
  proposal: AiStorefrontProposal,
  locale: Locale,
  primaryLocale: Locale,
): StorefrontProposalReview {
  const originalById = new Map(proposal.originalStorefront.pages.map((page) => [page.id, page]));
  const proposedById = new Map(proposal.proposedStorefront.pages.map((page) => [page.id, page]));
  const represented = new Set<number>();
  const blockers: string[] = [];
  const globalChanges: StorefrontProposalReviewItem[] = [];
  const canonicalGenerationAuthority = proposal.wholeStorefrontGeneration
    ? proposal.proposedStorefront.dynamicCommercePresentation
    : undefined;
  if (proposal.wholeStorefrontGeneration && !canonicalGenerationAuthority) {
    blockers.push(
      locale === "fi"
        ? "Luodun verkkokaupan dynaamista kauppa-auktoriteettia ei voida näyttää turvallisesti."
        : "The generated storefront's dynamic-commerce authority cannot be represented safely.",
    );
  }
  const migrationAuthority = proposal.dynamicCommerceMigration
    ? proposal.proposedStorefront.dynamicCommercePresentation
    : undefined;
  if (proposal.dynamicCommerceMigration && !migrationAuthority) {
    blockers.push(
      locale === "fi"
        ? "Dynaamisen kaupankäynnin ehdotettua rakennetta ei voida näyttää turvallisesti."
        : "The proposed dynamic-commerce structure cannot be represented safely.",
    );
  }
  const migratedAwayPageIds = new Set(
    proposal.dynamicCommerceMigration && migrationAuthority
      ? proposal.target.affectedPageIds.filter((pageId) => {
          const original = originalById.get(pageId);
          return (
            original !== undefined &&
            !proposedById.has(pageId) &&
            migrationAuthority.routeInventory.some(({ id }) => id === pageId) &&
            (original.type === "collection" || original.type === "product")
          );
        })
      : [],
  );
  const convergenceOperationIndexes: number[] = [];

  proposal.operations.forEach((envelope, operationIndex) => {
    if (envelope.target.kind !== "storefrontDesignSystem") return;
    const part = merchantOperationChangePart(envelope.operation, null, locale);
    if (!part) return;
    represented.add(operationIndex);
    globalChanges.push({
      title: locale === "fi" ? "Kaupan yhteinen ilme" : "Storefront design",
      summary: sentence([part], locale),
      operationIndexes: [operationIndex],
    });
  });

  if (proposal.wholeStorefrontGeneration) {
    globalChanges.push({
      title: locale === "fi" ? "Koko verkkokaupan suunnittelu" : "Complete storefront design",
      summary:
        locale === "fi"
          ? "Rajattu brändijärjestelmä, yhteinen kehys ja navigaatio korvautuvat yhtenä koottuna verkkokauppasuunnitelmana."
          : "The brand design, shared layout, and navigation are updated together as one complete storefront design.",
      operationIndexes: [],
    });
  }

  if (migrationAuthority) {
    proposal.operations.forEach((envelope, operationIndex) => {
      if (
        envelope.target.kind !== "storefrontDesignSystem" &&
        migratedAwayPageIds.has(envelope.target.pageId)
      ) {
        represented.add(operationIndex);
        convergenceOperationIndexes.push(operationIndex);
      }
    });
  }

  const affectedPageIds = new Set(proposal.target.affectedPageIds);
  const pageIdsInCanonicalOrder = proposal.wholeStorefrontGeneration
    ? [...proposal.proposedStorefront.pageOrder]
    : [
        ...proposal.originalStorefront.pageOrder.filter((pageId) => affectedPageIds.has(pageId)),
        ...proposal.target.affectedPageIds.filter(
          (pageId) => !proposal.originalStorefront.pageOrder.includes(pageId),
        ),
      ].filter((pageId) => !migratedAwayPageIds.has(pageId));
  const pages = pageIdsInCanonicalOrder.map((pageId) => {
    const original = originalById.get(pageId);
    const proposed = proposedById.get(pageId);
    if ((!proposal.wholeStorefrontGeneration && !original) || !proposed) {
      blockers.push(
        locale === "fi"
          ? "Yhtä kohdesivua ei voida näyttää turvallisesti."
          : "One affected page cannot be represented safely.",
      );
    }
    const groups = new Map<
      string,
      { sectionId: string | null; parts: string[]; operationIndexes: number[] }
    >();
    proposal.operations.forEach((envelope, operationIndex) => {
      if (envelope.target.kind === "storefrontDesignSystem") return;
      if (envelope.target.pageId !== pageId) return;
      const sectionId = operationSectionId(envelope.operation);
      const part = merchantOperationChangePart(
        envelope.operation,
        sectionId,
        locale,
        proposed,
        original,
      );
      if (!part) return;
      represented.add(operationIndex);
      const key = sectionId ?? `page:${pageId}`;
      const group = groups.get(key) ?? { sectionId, parts: [], operationIndexes: [] };
      group.parts.push(part);
      group.operationIndexes.push(operationIndex);
      groups.set(key, group);
    });
    const items = [...groups.values()].map((group) => ({
      title:
        group.sectionId === null
          ? pageTitle(proposed ?? original, locale, primaryLocale)
          : merchantSectionName(
              proposed?.sections.find((section) => section.id === group.sectionId) ??
                original?.sections.find((section) => section.id === group.sectionId),
              locale,
              primaryLocale,
            ),
      summary: sentence(group.parts, locale),
      operationIndexes: [...new Set(group.operationIndexes)],
    }));
    if (proposal.wholeStorefrontGeneration && proposed) {
      items.push({
        title: pageTitle(proposed, locale, primaryLocale),
        summary:
          locale === "fi"
            ? `Koottu rekisteröity sivurakenne, jossa on ${proposed.sections.length} osiota.`
            : `Complete page composition with ${proposed.sections.length} sections.`,
        operationIndexes: [],
      });
    }
    return {
      pageId,
      title: pageTitle(proposed ?? original, locale, primaryLocale),
      operationCount: new Set(items.flatMap((item) => item.operationIndexes)).size,
      items,
    };
  });

  const representedOperationIndexes = [...represented].sort((left, right) => left - right);
  if (representedOperationIndexes.length !== proposal.operations.length) {
    blockers.push(
      locale === "fi"
        ? "Kaikkia suunniteltuja muutoksia ei voida näyttää tarkistuksessa."
        : "Not every planned change can be represented in this review.",
    );
  }
  const globalKeys = new Set(
    globalChanges.flatMap((item) =>
      item.operationIndexes.map((index) => proposal.operations[index]?.operation.type),
    ),
  );
  if (
    globalKeys.has("APPLY_REGISTERED_BRAND_SYSTEM")
      ? proposal.affectedDesignState === null
      : (proposal.affectedDesignState?.colors && !globalKeys.has("APPLY_APPROVED_BRAND_COLOURS")) ||
        (proposal.affectedDesignState?.typography &&
          !globalKeys.has("APPLY_APPROVED_BRAND_TYPOGRAPHY"))
  ) {
    blockers.push(
      locale === "fi"
        ? "Kaupan yhteistä ilmettä ei voida näyttää kokonaan."
        : "The global storefront design changes are not fully represented.",
    );
  }
  const pageOperationCount = proposal.operations.filter(
    ({ target }) => target.kind === "page" || target.kind === "section",
  ).length;
  const globalOperationCount = proposal.operations.length - pageOperationCount;
  const homepageScope = proposal.target.scope === "page";
  const scope = homepageScope ? ("homepage" as const) : ("storefront" as const);
  const scopeLabel = homepageScope
    ? locale === "fi"
      ? "Etusivu"
      : "Homepage"
    : locale === "fi"
      ? "Koko verkkokauppa"
      : "Entire storefront";
  const collectionSearchArchetypeCount = migrationAuthority?.collectionSearchArchetypes.length ?? 0;
  const productDetailArchetypeCount = migrationAuthority?.productDetailArchetypes.length ?? 0;
  const archetypeCount = collectionSearchArchetypeCount + productDetailArchetypeCount;
  const dynamicCommerceConvergence = migrationAuthority
    ? {
        heading:
          locale === "fi"
            ? "Yhtenäinen verkkokaupan sivuilme"
            : "Coordinated storefront page design",
        summary:
          locale === "fi"
            ? `${migratedAwayPageIds.size} tuote-, kokoelma- ja hakusivun ilmeet yhtenäistetään ${archetypeCount} uudelleenkäytettäväksi kaupan asetteluksi. ${migrationAuthority.routeInventory.length} tuote-, kokoelma- ja hakusivua säilyttävät omat sisältönsä ilman erillisiä muokattavia sivuja.`
            : `${migratedAwayPageIds.size} product, collection, and search page designs are coordinated into ${archetypeCount} reusable shopping layouts. ${migrationAuthority.routeInventory.length} product, collection, and search pages keep their own content without becoming separate editable pages.`,
        protectedBindingSummary:
          locale === "fi"
            ? "Tuotteet, kokoelmat, kokoelmien järjestys, hinnat, saatavuus, varasto, valinnat ja tuotekuvat säilyvät ennallaan."
            : "Products, collections, collection order, prices, availability, stock, options, and product imagery stay unchanged.",
        staticPageCount: proposal.proposedStorefront.pages.length,
        collectionSearchArchetypeCount,
        productDetailArchetypeCount,
        archetypeCount,
        runtimeRouteCount: migrationAuthority.routeInventory.length,
        collectionRouteCount: migrationAuthority.routeInventory.filter(
          ({ kind }) => kind === "collection",
        ).length,
        productRouteCount: migrationAuthority.routeInventory.filter(
          ({ kind }) => kind === "product",
        ).length,
        searchRouteCount: migrationAuthority.routeInventory.filter(({ kind }) => kind === "search")
          .length,
        operationIndexes: [...new Set(convergenceOperationIndexes)].sort(
          (left, right) => left - right,
        ),
      }
    : null;
  const canonicalGeneration = canonicalGenerationAuthority
    ? {
        heading: locale === "fi" ? "Koko verkkokaupan ehdotus" : "Complete storefront proposal",
        summary:
          locale === "fi"
            ? `${proposal.proposedStorefront.pages.length} verkkokaupan sivua ja ${canonicalGenerationAuthority.collectionSearchArchetypes.length + canonicalGenerationAuthority.productDetailArchetypes.length} uudelleenkäytettävää kaupan asettelua korvaavat nykyisen lähtöilmeen yhtenä kokonaisena ehdotuksena.`
            : `${proposal.proposedStorefront.pages.length} storefront pages and ${canonicalGenerationAuthority.collectionSearchArchetypes.length + canonicalGenerationAuthority.productDetailArchetypes.length} reusable shopping layouts replace the current starting design as one complete proposal.`,
        protectedBindingSummary:
          locale === "fi"
            ? "Tuotteet, kokoelmat, hinnat, saatavuus, varasto, valinnat ja tuotekuvat säilyvät ennallaan."
            : "Products, collections, prices, availability, stock, options, and product imagery stay unchanged.",
        staticPageCount: proposal.proposedStorefront.pages.length,
        collectionSearchArchetypeCount:
          canonicalGenerationAuthority.collectionSearchArchetypes.length,
        productDetailArchetypeCount: canonicalGenerationAuthority.productDetailArchetypes.length,
        archetypeCount:
          canonicalGenerationAuthority.collectionSearchArchetypes.length +
          canonicalGenerationAuthority.productDetailArchetypes.length,
        runtimeRouteCount: canonicalGenerationAuthority.routeInventory.length,
      }
    : null;
  const heading = homepageScope
    ? locale === "fi"
      ? `Etusivuehdotus · ${pageOperationCount} suunniteltua asettelumuutosta`
      : `Homepage proposal · ${pageOperationCount} planned layout ${pageOperationCount === 1 ? "change" : "changes"}`
    : canonicalGeneration
      ? locale === "fi"
        ? `Verkkokauppaehdotus · ${canonicalGeneration.staticPageCount} sivua · ${canonicalGeneration.archetypeCount} uudelleenkäytettävää kaupan asettelua`
        : `Storefront proposal · ${canonicalGeneration.staticPageCount} pages · ${canonicalGeneration.archetypeCount} reusable shopping layouts`
      : dynamicCommerceConvergence
        ? locale === "fi"
          ? `Verkkokauppaehdotus · ${dynamicCommerceConvergence.staticPageCount} sivua · ${dynamicCommerceConvergence.archetypeCount} uudelleenkäytettävää kaupan asettelua`
          : `Storefront proposal · ${dynamicCommerceConvergence.staticPageCount} pages · ${dynamicCommerceConvergence.archetypeCount} reusable shopping layouts`
        : locale === "fi"
          ? `Verkkokauppaehdotus · ${pageOperationCount} sivumuutosta${globalOperationCount > 0 ? ` · ${globalOperationCount} yhteisen ilmeen muutosta` : ""}`
          : `Storefront proposal · ${pageOperationCount} page ${pageOperationCount === 1 ? "change" : "changes"}${globalOperationCount > 0 ? ` · ${globalOperationCount} shared design ${globalOperationCount === 1 ? "change" : "changes"}` : ""}`;

  return {
    scope,
    scopeLabel,
    proposalLabel:
      homepageScope && locale === "fi"
        ? "Etusivun suunnitteluehdotus"
        : homepageScope
          ? "Homepage design proposal"
          : locale === "fi"
            ? "Verkkokaupan suunnitteluehdotus"
            : "Storefront design proposal",
    heading,
    completeSummary: homepageScope
      ? locale === "fi"
        ? "Kaikki suunnitellut etusivun muutokset näkyvät alla."
        : "Every planned homepage change is represented below."
      : locale === "fi"
        ? "Kaikki suunnitellut verkkokaupan muutokset näkyvät alla."
        : "Every planned storefront change is represented below.",
    confirmationTitle: homepageScope
      ? locale === "fi"
        ? "Otetaanko tämä etusivuehdotus käyttöön?"
        : "Apply this homepage proposal?"
      : locale === "fi"
        ? "Otetaanko tämä kauppaehdotus käyttöön?"
        : "Apply this storefront proposal?",
    confirmationBody: homepageScope
      ? locale === "fi"
        ? "Tämä päivittää vain etusivun yhtenä tallentamattomana luonnosmuutoksena. Voit kumota muutoksen yhdellä toiminnolla."
        : "This updates only the homepage as one unsaved draft change. You can undo the change in one step."
      : canonicalGeneration
        ? locale === "fi"
          ? "Tämä korvaa nykyisen lähtöilmeen valmiilla brändi-ilmeellä, yhteisellä asettelulla, verkkokaupan sivuilla ja uudelleenkäytettävillä kaupan asetteluilla yhtenä tallentamattomana luonnosmuutoksena. Tuote-, kokoelma-, hinta-, saatavuus-, varasto-, valinta- ja kuvasi säilyvät ennallaan. Voit kumota koko muutoksen yhdellä toiminnolla."
          : "This replaces the current starting design with the complete brand design, shared layout, storefront pages, and reusable shopping layouts as one unsaved draft change. Your product, collection, price, availability, stock, option, and product imagery details stay unchanged. You can undo the complete change in one step."
        : dynamicCommerceConvergence
          ? locale === "fi"
            ? "Tämä ottaa verkkokaupan sivut ja uudelleenkäytettävät kaupan asettelut käyttöön yhtenä tallentamattomana luonnosmuutoksena. Tuote- ja kokoelmasivut saavat yhtenäisen ilmeen, mutta niiden tuote- ja kokoelmatiedot säilyvät ennallaan. Voit kumota koko muutoksen yhdellä toiminnolla."
            : "This applies the storefront pages and reusable shopping layouts as one unsaved draft change. Product and collection pages share a consistent design while their product and collection details stay unchanged. You can undo the complete change in one step."
          : locale === "fi"
            ? "Tämä päivittää tarkistuksessa luetellut sivut ja yhteisen ilmeen muutokset yhtenä tallentamattomana luonnosmuutoksena. Voit kumota koko muutoksen yhdellä toiminnolla."
            : "This updates the pages and shared design changes listed in the review as one unsaved draft change. You can undo the complete change in one step.",
    confirmationApplyLabel: homepageScope
      ? locale === "fi"
        ? "Ota etusivuehdotus käyttöön"
        : "Apply homepage proposal"
      : locale === "fi"
        ? "Ota kauppaehdotus käyttöön"
        : "Apply storefront proposal",
    affectedPageCount: dynamicCommerceConvergence
      ? dynamicCommerceConvergence.staticPageCount + dynamicCommerceConvergence.archetypeCount
      : canonicalGeneration
        ? canonicalGeneration.staticPageCount + canonicalGeneration.archetypeCount
        : proposal.target.affectedPageIds.length,
    operationCount:
      proposal.operations.length + (proposal.wholeStorefrontGeneration === undefined ? 0 : 1),
    materialChangeCount: canonicalGeneration
      ? canonicalGeneration.staticPageCount + canonicalGeneration.archetypeCount + 1
      : proposal.operations.length,
    globalChanges,
    pages,
    dynamicCommerceConvergence,
    canonicalGeneration,
    warnings: [],
    blockers,
    representedOperationIndexes,
    complete:
      blockers.length === 0 &&
      pages.length === pageIdsInCanonicalOrder.length &&
      representedOperationIndexes.every((operationIndex, index) => operationIndex === index),
  };
}
