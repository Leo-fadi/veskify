import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/projects/[projectId]/editor/design-agent-panel.tsx"),
  "utf8",
);

describe("merchant AI review accessibility boundary", () => {
  it("keeps review controls merchant-facing and confirmation keyboard-safe", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain("trigger?.focus()");
    expect(source).not.toMatch(/JSON\.stringify|page_home-|componentRegistry|Puck|Outline|Blocks/);
  });

  it("provides complete English and Finnish review action labels", () => {
    expect(source).toContain('proposal: "Design proposal"');
    expect(source).toContain('proposal: "Suunnitteluehdotus"');
    expect(source).toContain('confirmApply: "Apply storefront proposal"');
    expect(source).toContain('confirmApply: "Ota kauppaehdotus käyttöön"');
    expect(source).toContain('reject: "Reject"');
    expect(source).toContain('reject: "Hylkää"');
    expect(source).toContain('close: "Close"');
    expect(source).toContain('close: "Sulje"');
  });
});
