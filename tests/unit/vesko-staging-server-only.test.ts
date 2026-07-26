// @vitest-environment node

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("P10-01 server-only staging boundary", () => {
  it("keeps staging configuration and transport code behind a server-only module", async () => {
    const transport = await readFile(
      `${root}/src/integrations/vesko-staging/transport.server.ts`,
      "utf8",
    );
    const index = await readFile(`${root}/src/integrations/vesko-staging/index.server.ts`, "utf8");

    expect(transport).toMatch(/^import "server-only";/);
    expect(index).toMatch(/^import "server-only";/);
    expect(transport).not.toContain("NEXT_PUBLIC_");
    expect(transport).not.toContain("console.");
  });
});
