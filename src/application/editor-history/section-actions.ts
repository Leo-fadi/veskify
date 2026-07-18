import { validateRegisteredPage, type StorefrontRenderContext } from "@/components/registry";
import { idSchema } from "@/domain/shared";
import type { PageModel, SectionInstance } from "@/domain/storefront";
import { applyCanonicalCommands, type CanonicalCommandTransaction } from "./commands";

const requiredSingleInstanceComponents = new Set(["header", "footer"]);

export class UnsafeSectionActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeSectionActionError";
  }
}

export function canDuplicateSection(section: SectionInstance) {
  return !requiredSingleInstanceComponents.has(section.component);
}

export function canToggleSectionVisibility(section: SectionInstance) {
  return section.visible ? !requiredSingleInstanceComponents.has(section.component) : true;
}

function uniqueDuplicateId(sourceId: string, existingIds: ReadonlySet<string>) {
  const truncatedSource = sourceId.slice(0, 68).replace(/[-_]+$/, "");
  const base = idSchema.parse(`${truncatedSource}_copy`);
  if (!existingIds.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = idSchema.parse(`${base.slice(0, 74)}_${suffix}`);
    if (!existingIds.has(candidate)) return candidate;
  }
  throw new UnsafeSectionActionError("A unique duplicate section could not be created.");
}

export function createDuplicateSectionTransaction({
  page,
  sectionId,
  existingSectionIds,
  label = "Duplicate section",
}: {
  page: PageModel;
  sectionId: string;
  existingSectionIds?: ReadonlySet<string>;
  label?: string;
}): CanonicalCommandTransaction {
  const sourceIndex = page.sections.findIndex((section) => section.id === sectionId);
  if (sourceIndex < 0) throw new UnsafeSectionActionError("Select a section to duplicate.");
  const source = page.sections[sourceIndex];
  if (!canDuplicateSection(source)) {
    throw new UnsafeSectionActionError("This required section can only appear once.");
  }
  const reserved = new Set(existingSectionIds ?? page.sections.map((section) => section.id));
  const duplicate = structuredClone(source);
  duplicate.id = uniqueDuplicateId(source.id, reserved);
  return {
    pageId: page.id,
    label,
    forward: [{ type: "insertSection", index: sourceIndex + 1, section: duplicate }],
    inverse: [{ type: "removeSection", index: sourceIndex + 1, sectionId: duplicate.id }],
  };
}

export function duplicateCanonicalSection({
  page,
  sectionId,
  existingSectionIds,
  context,
}: {
  page: PageModel;
  sectionId: string;
  existingSectionIds?: ReadonlySet<string>;
  context?: StorefrontRenderContext;
}) {
  const transaction = createDuplicateSectionTransaction({ page, sectionId, existingSectionIds });
  return applyCanonicalCommands(page, transaction.forward, (candidate) =>
    validateRegisteredPage(candidate, context),
  );
}

export function createSectionVisibilityTransaction({
  page,
  sectionId,
  visible,
  label = visible ? "Show section" : "Hide section",
}: {
  page: PageModel;
  sectionId: string;
  visible: boolean;
  label?: string;
}): CanonicalCommandTransaction {
  const sectionIndex = page.sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex < 0) throw new UnsafeSectionActionError("Select a section to update.");
  const section = page.sections[sectionIndex];
  if (!visible && requiredSingleInstanceComponents.has(section.component)) {
    throw new UnsafeSectionActionError("This required section must remain visible.");
  }
  return {
    pageId: page.id,
    label,
    forward: [{ type: "setSectionVisibility", sectionId, visible }],
    inverse: [{ type: "setSectionVisibility", sectionId, visible: section.visible }],
  };
}

export function setCanonicalSectionVisibility({
  page,
  sectionId,
  visible,
  context,
}: {
  page: PageModel;
  sectionId: string;
  visible: boolean;
  context?: StorefrontRenderContext;
}) {
  const transaction = createSectionVisibilityTransaction({ page, sectionId, visible });
  return applyCanonicalCommands(page, transaction.forward, (candidate) =>
    validateRegisteredPage(candidate, context),
  );
}
