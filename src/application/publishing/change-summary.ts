import {
  canonicalValueString,
  type PageModel,
  type SectionInstance,
  type StorefrontSnapshot,
} from "@/domain/storefront";
import { publishChangeSummarySchema, type PublishChangeSummary } from "./contract";

function sameValue(left: unknown, right: unknown): boolean {
  return canonicalValueString(left) === canonicalValueString(right);
}

function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .sort()
    .filter((key) => !sameValue(before[key], after[key]));
}

function changedLeafPaths(before: unknown, after: unknown, prefix = ""): string[] {
  if (sameValue(before, after)) return [];
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    return [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])]
      .sort()
      .flatMap((key) =>
        changedLeafPaths(beforeRecord[key], afterRecord[key], prefix ? `${prefix}.${key}` : key),
      );
  }
  return [prefix];
}

function pageReference(page: PageModel) {
  return { pageId: page.id, title: structuredClone(page.title) };
}

function sectionReference(page: PageModel, section: SectionInstance) {
  return {
    pageId: page.id,
    pageTitle: structuredClone(page.title),
    sectionId: section.id,
    component: section.component,
  };
}

function compareIds(left: { pageId: string; sectionId?: string }, right: typeof left): number {
  return (
    left.pageId.localeCompare(right.pageId) ||
    (left.sectionId ?? "").localeCompare(right.sectionId ?? "")
  );
}

export function createPublishChangeSummary(
  published: StorefrontSnapshot,
  draft: StorefrontSnapshot,
): PublishChangeSummary {
  const beforePages = new Map(published.pages.map((page) => [page.id, page]));
  const afterPages = new Map(draft.pages.map((page) => [page.id, page]));
  const changedPageIds = new Set<string>();
  const changedSectionIds = new Set<string>();

  const pagesAdded = draft.pages
    .filter((page) => !beforePages.has(page.id))
    .map(pageReference)
    .sort(compareIds);
  const pagesRemoved = published.pages
    .filter((page) => !afterPages.has(page.id))
    .map(pageReference)
    .sort(compareIds);
  pagesAdded.forEach(({ pageId }) => changedPageIds.add(pageId));
  pagesRemoved.forEach(({ pageId }) => changedPageIds.add(pageId));

  const commonPageIds = new Set(
    published.pages.filter(({ id }) => afterPages.has(id)).map(({ id }) => id),
  );
  const beforePageIds = published.pages.map(({ id }) => id).filter((id) => commonPageIds.has(id));
  const afterPageIds = draft.pages.map(({ id }) => id).filter((id) => commonPageIds.has(id));
  const pageOrderChanged = !sameValue(beforePageIds, afterPageIds);
  if (pageOrderChanged) {
    const beforePositions = new Map(beforePageIds.map((id, index) => [id, index]));
    afterPageIds.forEach((id, index) => {
      if (beforePositions.has(id) && beforePositions.get(id) !== index) changedPageIds.add(id);
    });
  }

  const pageMetadataChanges: PublishChangeSummary["pageMetadataChanges"] = [];
  const pageThemeOverrideChanges: PublishChangeSummary["pageThemeOverrideChanges"] = [];
  const sectionsAdded: PublishChangeSummary["sectionsAdded"] = [];
  const sectionsRemoved: PublishChangeSummary["sectionsRemoved"] = [];
  const sectionOrderChanges: PublishChangeSummary["sectionOrderChanges"] = [];
  const sectionComponentChanges: PublishChangeSummary["sectionComponentChanges"] = [];
  const sectionContentChanges: PublishChangeSummary["sectionContentChanges"] = [];
  const sectionPropertyChanges: PublishChangeSummary["sectionPropertyChanges"] = [];
  const sectionVariantChanges: PublishChangeSummary["sectionVariantChanges"] = [];
  const sectionVisibilityChanges: PublishChangeSummary["sectionVisibilityChanges"] = [];

  for (const page of draft.pages.filter(({ id }) => !beforePages.has(id))) {
    for (const section of page.sections) {
      changedSectionIds.add(section.id);
      sectionsAdded.push(sectionReference(page, section));
    }
  }
  for (const page of published.pages.filter(({ id }) => !afterPages.has(id))) {
    for (const section of page.sections) {
      changedSectionIds.add(section.id);
      sectionsRemoved.push(sectionReference(page, section));
    }
  }

  for (const afterPage of [...draft.pages].sort((left, right) => left.id.localeCompare(right.id))) {
    const beforePage = beforePages.get(afterPage.id);
    if (!beforePage) {
      afterPage.sections.forEach(({ id }) => changedSectionIds.add(id));
      continue;
    }

    const metadataFields = (["type", "slug", "title", "seo"] as const).filter(
      (field) => !sameValue(beforePage[field], afterPage[field]),
    );
    if (metadataFields.length > 0) {
      changedPageIds.add(afterPage.id);
      pageMetadataChanges.push({
        ...pageReference(afterPage),
        beforeTitle: structuredClone(beforePage.title),
        afterTitle: structuredClone(afterPage.title),
        changedFields: metadataFields,
      });
    }
    if (!sameValue(beforePage.themeOverride, afterPage.themeOverride)) {
      changedPageIds.add(afterPage.id);
      pageThemeOverrideChanges.push(pageReference(afterPage));
    }

    const beforeSections = new Map(beforePage.sections.map((section) => [section.id, section]));
    const afterSections = new Map(afterPage.sections.map((section) => [section.id, section]));

    for (const section of afterPage.sections) {
      if (!beforeSections.has(section.id)) {
        changedPageIds.add(afterPage.id);
        changedSectionIds.add(section.id);
        sectionsAdded.push(sectionReference(afterPage, section));
      }
    }
    for (const section of beforePage.sections) {
      if (!afterSections.has(section.id)) {
        changedPageIds.add(afterPage.id);
        changedSectionIds.add(section.id);
        sectionsRemoved.push(sectionReference(beforePage, section));
      }
    }

    const commonSectionIds = new Set(
      beforePage.sections.filter(({ id }) => afterSections.has(id)).map(({ id }) => id),
    );
    const beforeOrder = beforePage.sections
      .map(({ id }) => id)
      .filter((id) => commonSectionIds.has(id));
    const afterOrder = afterPage.sections
      .map(({ id }) => id)
      .filter((id) => commonSectionIds.has(id));
    if (!sameValue(beforeOrder, afterOrder)) {
      changedPageIds.add(afterPage.id);
      sectionOrderChanges.push({
        ...pageReference(afterPage),
        beforeSectionIds: beforeOrder,
        afterSectionIds: afterOrder,
      });
      const beforePositions = new Map(beforeOrder.map((id, index) => [id, index]));
      afterOrder.forEach((id, index) => {
        if (beforePositions.get(id) !== index) changedSectionIds.add(id);
      });
    }

    for (const afterSection of afterPage.sections) {
      const beforeSection = beforeSections.get(afterSection.id);
      if (!beforeSection) continue;
      const reference = sectionReference(afterPage, afterSection);
      if (beforeSection.component !== afterSection.component) {
        sectionComponentChanges.push({
          ...reference,
          beforeComponent: beforeSection.component,
          afterComponent: afterSection.component,
        });
      }
      const contentFields = changedKeys(beforeSection.content, afterSection.content);
      if (contentFields.length > 0) {
        sectionContentChanges.push({ ...reference, changedFields: contentFields });
      }
      const propertyFields = [
        ...changedKeys(beforeSection.props, afterSection.props),
        ...changedKeys(beforeSection.styleOverrides ?? {}, afterSection.styleOverrides ?? {}).map(
          (key) => `styleOverrides.${key}`,
        ),
      ].sort();
      if (propertyFields.length > 0) {
        sectionPropertyChanges.push({ ...reference, changedFields: propertyFields });
      }
      if (beforeSection.variant !== afterSection.variant) {
        sectionVariantChanges.push({
          ...reference,
          beforeVariant: beforeSection.variant,
          afterVariant: afterSection.variant,
        });
      }
      if (beforeSection.visible !== afterSection.visible) {
        sectionVisibilityChanges.push({
          ...reference,
          beforeVisible: beforeSection.visible,
          afterVisible: afterSection.visible,
        });
      }
      if (
        beforeSection.component !== afterSection.component ||
        contentFields.length > 0 ||
        propertyFields.length > 0 ||
        beforeSection.variant !== afterSection.variant ||
        beforeSection.visible !== afterSection.visible
      ) {
        changedPageIds.add(afterPage.id);
        changedSectionIds.add(afterSection.id);
      }
    }
  }

  for (const beforePage of published.pages) {
    if (!afterPages.has(beforePage.id)) {
      beforePage.sections.forEach(({ id }) => changedSectionIds.add(id));
    }
  }

  const sortSectionChanges = <T extends { pageId: string; sectionId: string }>(values: T[]) =>
    values.sort(compareIds);
  const summary = {
    changedPages: [...changedPageIds]
      .sort()
      .map((pageId) => pageReference(afterPages.get(pageId) ?? beforePages.get(pageId)!)),
    pagesAdded,
    pagesRemoved,
    pageOrderChanged,
    pageMetadataChanges: pageMetadataChanges.sort(compareIds),
    pageThemeOverrideChanges: pageThemeOverrideChanges.sort(compareIds),
    sectionsAdded: sortSectionChanges(sectionsAdded),
    sectionsRemoved: sortSectionChanges(sectionsRemoved),
    sectionOrderChanges: sectionOrderChanges.sort(compareIds),
    sectionComponentChanges: sortSectionChanges(sectionComponentChanges),
    sectionContentChanges: sortSectionChanges(sectionContentChanges),
    sectionPropertyChanges: sortSectionChanges(sectionPropertyChanges),
    sectionVariantChanges: sortSectionChanges(sectionVariantChanges),
    sectionVisibilityChanges: sortSectionChanges(sectionVisibilityChanges),
    brandSystemChanges: changedLeafPaths(published.brandSystem, draft.brandSystem),
    navigationChanges: (["primary", "footer"] as const).filter(
      (area) => !sameValue(published.navigation[area], draft.navigation[area]),
    ),
    totalChangedPages: changedPageIds.size,
    totalChangedSections: changedSectionIds.size,
  };

  return publishChangeSummarySchema.parse(summary);
}
