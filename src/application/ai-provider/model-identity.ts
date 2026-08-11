import { z } from "zod";

/** Safe provider/model identity shared without importing an executable planner. */
export const providerModelIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
