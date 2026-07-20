import { designOperationSchema, type DesignOperation } from "@/application/design-operations";
import { getComponentDefinition } from "@/components/registry";
import type { PageModel } from "@/domain/storefront";
import {
  designSkillDefinitionSchema,
  type DesignIntent,
  type DesignSkillDefinition,
  type DesignSkillExecutionContext,
  type DesignSkillScope,
} from "./contract";

const executableContentPattern =
  /<\/?[a-z][^>]*>|javascript\s*:|\b(?:eval|function)\s*\(|=>\s*\{|```(?:html|css|js|javascript|jsx|tsx)|(?:^|\n)\s*(?:[.#][\w-]+|[a-z][\w-]*)\s*\{[^}]*:[^}]*\}|\b(?:background|color|display|font-family|position)\s*:\s*[^;\n]+;/i;

export function assertNoExecutableContent(value: unknown) {
  const visit = (item: unknown): void => {
    if (typeof item === "string" && executableContentPattern.test(item)) {
      throw new Error("Design skills cannot emit executable or embedded content.");
    }
    if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === "object") Object.values(item).forEach(visit);
  };
  visit(value);
}

function operationComponent(
  operation: DesignOperation,
  componentsBySectionId: Map<string, string>,
) {
  if (operation.type === "ADD_APPROVED_SECTION") return operation.component;
  if ("sectionId" in operation) return componentsBySectionId.get(operation.sectionId);
  return undefined;
}

function assertProtectedPaths(operation: DesignOperation, protectedPaths: readonly string[]) {
  if (operation.type !== "CHANGE_LOCALIZED_SECTION_TEXT") return;
  const normalizedField = operation.field.toLowerCase();
  const forbidden = protectedPaths.some((path) => {
    const finalSegment = path.split(".").at(-1)?.replace("*", "").toLowerCase();
    return (
      finalSegment !== undefined && finalSegment.length > 0 && normalizedField === finalSegment
    );
  });
  if (forbidden) {
    throw new Error(`Skill operation targets protected field ${operation.field}.`);
  }
}

export class DesignSkillRegistry {
  readonly #definitions: Map<string, DesignSkillDefinition>;

  constructor(definitions: readonly DesignSkillDefinition[]) {
    this.#definitions = new Map();
    for (const input of definitions) {
      const definition = designSkillDefinitionSchema.parse(input);
      if (this.#definitions.has(definition.id)) {
        throw new Error(`Duplicate design skill ID: ${definition.id}.`);
      }
      for (const component of definition.allowedComponentTypes) getComponentDefinition(component);
      this.#definitions.set(definition.id, definition);
    }
  }

  get(id: string): DesignSkillDefinition {
    const definition = this.#definitions.get(id);
    if (!definition) throw new Error(`Unknown design skill: ${id}.`);
    return definition;
  }

  list(): DesignSkillDefinition[] {
    return [...this.#definitions.values()];
  }

  listByIntent(intent: DesignIntent): DesignSkillDefinition[] {
    return this.list().filter((definition) => definition.supportedIntents.includes(intent));
  }

  filterByPageTypeAndScope(
    pageType: PageModel["type"],
    scope: DesignSkillScope,
  ): DesignSkillDefinition[] {
    return this.list().filter(
      (definition) =>
        definition.supportedPageTypes.includes(pageType) && definition.scope === scope,
    );
  }

  execute(id: string, context: Readonly<DesignSkillExecutionContext>): DesignOperation[] {
    const definition = this.get(id);
    if (!definition.supportedPageTypes.includes(context.pageType)) {
      throw new Error(`Skill ${id} does not support ${context.pageType} pages.`);
    }
    const rawOutput = definition.execute(context);
    const parsedOutput = definition.outputSchema.parse(rawOutput);
    if (!Array.isArray(parsedOutput)) {
      throw new Error(`Skill ${id} must return an operation array.`);
    }
    assertNoExecutableContent(parsedOutput);

    const operations = parsedOutput.map((operation) => designOperationSchema.parse(operation));
    const componentsBySectionId = new Map(
      context.page.sections.map((section) => [section.id, section.component]),
    );
    for (const operation of operations) {
      if (!definition.allowedOperationTypes.includes(operation.type)) {
        throw new Error(`Skill ${id} emitted undeclared operation ${operation.type}.`);
      }
      const component = operationComponent(operation, componentsBySectionId);
      if (component && !definition.allowedComponentTypes.some((allowed) => allowed === component)) {
        throw new Error(`Skill ${id} cannot modify component ${component}.`);
      }
      if (operation.type === "ADD_APPROVED_SECTION") {
        if (componentsBySectionId.has(operation.sectionId)) {
          throw new Error(`Skill ${id} attempted to reuse section ID ${operation.sectionId}.`);
        }
        componentsBySectionId.set(operation.sectionId, operation.component);
      } else if (operation.type === "REMOVE_OPTIONAL_SECTION") {
        componentsBySectionId.delete(operation.sectionId);
      } else if ("sectionId" in operation && component === undefined) {
        throw new Error(`Skill ${id} targeted unknown section ${operation.sectionId}.`);
      }
      if (operation.type === "REORDER_SECTIONS") {
        const undeclaredComponent = [...componentsBySectionId.values()].find(
          (item) => !definition.allowedComponentTypes.some((allowed) => allowed === item),
        );
        if (undeclaredComponent) {
          throw new Error(`Skill ${id} cannot reorder component ${undeclaredComponent}.`);
        }
      }
      assertProtectedPaths(operation, definition.protectedPaths);
    }
    return operations;
  }
}

export function createDesignSkillRegistry(definitions: readonly DesignSkillDefinition[]) {
  return new DesignSkillRegistry(definitions);
}
