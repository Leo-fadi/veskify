import {
  type DynamicCommerceComponentPresentation,
  type SectionInstance,
} from "@/domain/storefront";
import { failDynamicCommerceRouteAuthority as fail } from "./route-errors";

export function projectSectionStyleOverrides(
  styleOverrides:
    DynamicCommerceComponentPresentation["styleOverrides"] | SectionInstance["styleOverrides"],
): SectionInstance["styleOverrides"] {
  if (!styleOverrides) return undefined;
  const { surfaceTreatment, ...allowed } = styleOverrides as NonNullable<
    DynamicCommerceComponentPresentation["styleOverrides"]
  >;
  if (surfaceTreatment === "soft") {
    if (allowed.surface && allowed.surface !== "surface") {
      return fail(
        "invalid-presentation",
        "Soft surface treatment conflicts with the explicit section surface.",
      );
    }
    return { ...allowed, surface: "surface" };
  }
  return Object.keys(allowed).length > 0 ? allowed : undefined;
}
