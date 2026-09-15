import type { CompiledPageBlueprintCompositionMaterialV1 } from "@/domain/storefront/compiled-page-blueprint-composition";
import {
  compileSelectedPageBlueprintComposition,
  type PageBlueprintCompositionAuthority,
} from "./validate-page-blueprint-composition";

export type PageBlueprintCompositionSelection = Omit<
  CompiledPageBlueprintCompositionMaterialV1,
  "blueprint" | "support" | "bindingFingerprint"
>;

/** Compiling is deliberately only a convenience: it returns the same branded acceptance path as reads. */
export function compilePageBlueprintComposition(
  selection: PageBlueprintCompositionSelection,
  authority: PageBlueprintCompositionAuthority,
) {
  return compileSelectedPageBlueprintComposition(selection, authority);
}
