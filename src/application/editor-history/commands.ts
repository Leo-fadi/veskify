import { pageModelSchema, type PageModel, type SectionInstance } from "@/domain/storefront";

type PageMetadataPatch = {
  type?: PageModel["type"];
  slug?: string;
  title?: PageModel["title"];
  seo?: PageModel["seo"];
  themeOverride?: PageModel["themeOverride"] | null;
};

export type CanonicalEditorCommand =
  | { type: "patchPageMetadata"; patch: PageMetadataPatch }
  | { type: "insertSection"; index: number; section: SectionInstance }
  | { type: "removeSection"; index: number; sectionId: string }
  | { type: "replaceSection"; sectionId: string; section: SectionInstance }
  | { type: "reorderSections"; sectionIds: string[] }
  | { type: "setSectionVisibility"; sectionId: string; visible: boolean };

export type CanonicalCommandTransaction = {
  pageId: string;
  label: string;
  forward: CanonicalEditorCommand[];
  inverse: CanonicalEditorCommand[];
};

export type CanonicalPageValidator = (page: unknown) => PageModel;

const clonePage = (page: PageModel) => structuredClone(page);
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function applyCommand(page: PageModel, command: CanonicalEditorCommand) {
  switch (command.type) {
    case "patchPageMetadata": {
      for (const [key, value] of Object.entries(command.patch) as Array<
        [keyof PageMetadataPatch, PageMetadataPatch[keyof PageMetadataPatch]]
      >) {
        if (key === "themeOverride" && value === null) {
          delete page.themeOverride;
        } else {
          Object.assign(page, { [key]: structuredClone(value) });
        }
      }
      return;
    }
    case "insertSection": {
      if (
        !Number.isInteger(command.index) ||
        command.index < 0 ||
        command.index > page.sections.length ||
        page.sections.some((section) => section.id === command.section.id)
      ) {
        throw new Error("The section insertion command cannot be applied.");
      }
      page.sections.splice(command.index, 0, structuredClone(command.section));
      return;
    }
    case "removeSection": {
      const index = page.sections.findIndex((section) => section.id === command.sectionId);
      if (index !== command.index) {
        throw new Error("The section removal command cannot be applied.");
      }
      page.sections.splice(index, 1);
      return;
    }
    case "replaceSection": {
      const index = page.sections.findIndex((section) => section.id === command.sectionId);
      if (index < 0 || command.section.id !== command.sectionId) {
        throw new Error("The section replacement command cannot be applied.");
      }
      page.sections[index] = structuredClone(command.section);
      return;
    }
    case "reorderSections": {
      const currentIds = page.sections.map((section) => section.id);
      if (
        command.sectionIds.length !== currentIds.length ||
        new Set(command.sectionIds).size !== command.sectionIds.length ||
        command.sectionIds.some((sectionId) => !currentIds.includes(sectionId))
      ) {
        throw new Error("The section reorder command cannot be applied.");
      }
      const sections = new Map(page.sections.map((section) => [section.id, section]));
      page.sections = command.sectionIds.map((sectionId) =>
        structuredClone(sections.get(sectionId)!),
      );
      return;
    }
    case "setSectionVisibility": {
      const section = page.sections.find((candidate) => candidate.id === command.sectionId);
      if (!section) throw new Error("The section visibility command cannot be applied.");
      section.visible = command.visible;
    }
  }
}

export function applyCanonicalCommands(
  pageInput: PageModel,
  commands: readonly CanonicalEditorCommand[],
  validatePage: CanonicalPageValidator = (page) => pageModelSchema.parse(page),
) {
  const candidate = clonePage(pageInput);
  for (const command of structuredClone(commands)) applyCommand(candidate, command);
  return clonePage(validatePage(candidate));
}

function metadataPatch(source: PageModel, target: PageModel) {
  const patch: PageMetadataPatch = {};
  for (const key of ["type", "slug", "title", "seo", "themeOverride"] as const) {
    if (equal(source[key], target[key])) continue;
    if (key === "themeOverride") {
      patch.themeOverride = target.themeOverride ? structuredClone(target.themeOverride) : null;
    } else {
      Object.assign(patch, { [key]: structuredClone(target[key]) });
    }
  }
  return patch;
}

function equalExceptVisibility(left: SectionInstance, right: SectionInstance) {
  return equal({ ...left, visible: true }, { ...right, visible: true });
}

export function deriveCanonicalCommands(sourceInput: PageModel, targetInput: PageModel) {
  const source = pageModelSchema.parse(structuredClone(sourceInput));
  const target = pageModelSchema.parse(structuredClone(targetInput));
  if (source.id !== target.id) throw new Error("A history transaction cannot change the page ID.");

  const commands: CanonicalEditorCommand[] = [];
  const patch = metadataPatch(source, target);
  if (Object.keys(patch).length > 0) commands.push({ type: "patchPageMetadata", patch });

  const sourceById = new Map(source.sections.map((section) => [section.id, section]));
  const targetById = new Map(target.sections.map((section) => [section.id, section]));

  source.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => !targetById.has(section.id))
    .sort((left, right) => right.index - left.index)
    .forEach(({ section, index }) =>
      commands.push({ type: "removeSection", sectionId: section.id, index }),
    );

  target.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => !sourceById.has(section.id))
    .forEach(({ section, index }) =>
      commands.push({ type: "insertSection", section: structuredClone(section), index }),
    );

  for (const targetSection of target.sections) {
    const sourceSection = sourceById.get(targetSection.id);
    if (!sourceSection || equal(sourceSection, targetSection)) continue;
    if (equalExceptVisibility(sourceSection, targetSection)) {
      commands.push({
        type: "setSectionVisibility",
        sectionId: targetSection.id,
        visible: targetSection.visible,
      });
    } else {
      commands.push({
        type: "replaceSection",
        sectionId: targetSection.id,
        section: structuredClone(targetSection),
      });
    }
  }

  const sourceOrder = source.sections.map((section) => section.id);
  const targetOrder = target.sections.map((section) => section.id);
  if (!equal(sourceOrder, targetOrder)) {
    commands.push({ type: "reorderSections", sectionIds: targetOrder });
  }
  return structuredClone(commands);
}

export function deriveCanonicalCommandTransaction(
  previous: PageModel,
  next: PageModel,
  label: string,
): CanonicalCommandTransaction {
  const normalizedLabel = label.trim();
  if (!normalizedLabel) throw new Error("A history transaction requires an action label.");
  if (previous.id !== next.id) throw new Error("A history transaction cannot change the page ID.");
  return {
    pageId: previous.id,
    label: normalizedLabel,
    forward: deriveCanonicalCommands(previous, next),
    inverse: deriveCanonicalCommands(next, previous),
  };
}
