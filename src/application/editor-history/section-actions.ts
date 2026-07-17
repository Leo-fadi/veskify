import { validateRegisteredPage, type StorefrontRenderContext } from "@/components/registry";
import { idSchema } from "@/domain/shared";
import type { PageModel, SectionInstance } from "@/domain/storefront";

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
  return !requiredSingleInstanceComponents.has(section.component);
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
  const sourceIndex = page.sections.findIndex((section) => section.id === sectionId);
  if (sourceIndex < 0) throw new UnsafeSectionActionError("Select a section to duplicate.");
  const source = page.sections[sourceIndex];
  if (!canDuplicateSection(source)) {
    throw new UnsafeSectionActionError("This required section can only appear once.");
  }
  const reserved = new Set(existingSectionIds ?? page.sections.map((section) => section.id));
  const duplicate = structuredClone(source);
  duplicate.id = uniqueDuplicateId(source.id, reserved);
  const candidate = structuredClone(page);
  candidate.sections.splice(sourceIndex + 1, 0, duplicate);
  return validateRegisteredPage(candidate, context);
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
  const sectionIndex = page.sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex < 0) throw new UnsafeSectionActionError("Select a section to update.");
  const section = page.sections[sectionIndex];
  if (!visible && !canToggleSectionVisibility(section)) {
    throw new UnsafeSectionActionError("This required section must remain visible.");
  }
  const candidate = structuredClone(page);
  candidate.sections[sectionIndex] = { ...candidate.sections[sectionIndex], visible };
  return validateRegisteredPage(candidate, context);
}
