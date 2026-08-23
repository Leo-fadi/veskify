import { createHash } from "node:crypto";

const MAXIMUM_EVIDENCE_FILENAME_STEM_LENGTH = 150;

export function canonicalP10BEvidenceFilename(logicalFilename: string): string {
  const normalizedPath = logicalFilename.replaceAll("\\", "/");
  const segments = normalizedPath.split("/");
  const logicalBasename = segments.pop();
  if (
    !logicalBasename ||
    normalizedPath.startsWith("/") ||
    segments.some(
      (segment) =>
        !segment || segment === "." || segment === ".." || !/^[a-z0-9][a-z0-9-]*$/u.test(segment),
    )
  ) {
    throw new Error("P10B evidence filename must be a safe evidence-root-relative path.");
  }
  if (!/\.png$/iu.test(logicalBasename)) {
    throw new Error("P10B evidence filename must use the PNG extension.");
  }
  const normalizedStem = logicalBasename
    .replace(/\.png$/iu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  if (!normalizedStem) throw new Error("P10B evidence filename is empty.");
  const canonicalStem =
    normalizedStem.length <= MAXIMUM_EVIDENCE_FILENAME_STEM_LENGTH
      ? normalizedStem
      : `${normalizedStem.slice(0, 137)}-${createHash("sha256")
          .update(normalizedStem)
          .digest("hex")
          .slice(0, 12)}`;
  return [...segments, `${canonicalStem}.png`].join("/");
}
