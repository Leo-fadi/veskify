import { z } from "zod";

/** A bounded, non-executable regional overlay for an already registered direction. */
export const expressiveVisualPreferencesV2Schema = z
  .object({
    version: z.literal("2.0.0"),
    regionalDensity: z
      .object({
        navigation: z.enum(["compact", "balanced", "spacious"]),
        content: z.enum(["compact", "balanced", "spacious"]),
        commerce: z.enum(["compact", "balanced", "spacious"]),
      })
      .strict(),
  })
  .strict();

export type ExpressiveVisualPreferencesV2 = z.infer<typeof expressiveVisualPreferencesV2Schema>;
