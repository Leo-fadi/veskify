import type { ReactNode } from "react";
import type { Config, Field } from "@puckeditor/core";
import type { ComposedStorefrontPageRenderer } from "@/components/storefront/composed-storefront-page";
import { getComponentDefinition } from "@/components/registry";
import { composedRegionSlotName } from "@/integrations/puck/composed-page-adapter";

function textFields(component: string): Record<string, Field> {
  const definition = getComponentDefinition(component);
  return Object.entries(definition.editorFields).reduce<Record<string, Field>>(
    (fields, [name, metadata]) => {
      if (metadata.source !== "content" || metadata.localized !== true) return fields;
      if (metadata.control === "text") fields[name] = { type: "text", label: metadata.label };
      if (metadata.control === "textarea")
        fields[name] = { type: "textarea", label: metadata.label };
      return fields;
    },
    {},
  );
}

/** Builds one Puck config from a private validated compositor factory. */
export function createComposedPagePuckConfig(renderer: ComposedStorefrontPageRenderer): Config {
  const sections = renderer.regions.flatMap((region) => region.sections);
  const byId = new Map(sections.map((section) => [section.id, section]));
  const components = Object.fromEntries(
    [...new Set(sections.map((section) => section.component))].map((component) => [
      component,
      {
        label: getComponentDefinition(component).label,
        inline: true,
        fields: textFields(component),
        permissions: { insert: false, delete: false, duplicate: false },
        render: ({
          id,
          puck,
        }: {
          id: string;
          puck: { dragRef: (node: Element | null) => void };
        }) => {
          const section = byId.get(id);
          if (!section || section.component !== component)
            throw new Error("Composed Puck renderer rejected a foreign section item.");
          return (
            <div ref={puck.dragRef} data-composed-puck-section={id} data-composed-section={id}>
              {renderer.renderSection(id)}
            </div>
          );
        },
      },
    ]),
  );
  const rootFields = Object.fromEntries(
    renderer.regions.map((region) => [
      composedRegionSlotName(region.id),
      { type: "slot", allow: [...new Set(region.sections.map((section) => section.component))] },
    ]),
  );
  return {
    components,
    root: {
      fields: rootFields,
      render: (props: Record<string, unknown>) =>
        renderer.renderWithRegions((region) => {
          const slot = props[composedRegionSlotName(region.id)];
          if (typeof slot !== "function")
            throw new Error("Composed Puck renderer rejected a missing region slot.");
          return (slot as () => ReactNode)();
        }),
    },
  } as Config;
}
