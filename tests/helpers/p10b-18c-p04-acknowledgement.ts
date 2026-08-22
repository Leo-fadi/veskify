export type P10B18CP04Acknowledgement = Readonly<{ ok: true }>;

export function requireP10B18CP04Acknowledgement(value: unknown): P10B18CP04Acknowledgement {
  if (value === null || typeof value !== "object" || !("ok" in value) || value.ok !== true) {
    throw new Error("The P10B-16P-04 acknowledgement is invalid.");
  }
  return { ok: true };
}
