// @vitest-environment node

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("P4-06 server-only secret boundary", () => {
  it("isolates the SDK client, environment key, and provider selection in a server-only module", async () => {
    const serverClient = await readFile(
      `${root}/src/integrations/ai/openai/openai-client.server.ts`,
      "utf8",
    );
    const adapter = await readFile(`${root}/src/integrations/ai/openai/openai-provider.ts`, "utf8");
    const planningServerClient = await readFile(
      `${root}/src/integrations/ai/openai/whole-storefront-planning-client.server.ts`,
      "utf8",
    );
    const planningAdapter = await readFile(
      `${root}/src/integrations/ai/openai/whole-storefront-planning-provider.ts`,
      "utf8",
    );
    const prompt = await readFile(`${root}/src/integrations/ai/openai/prompt.ts`, "utf8");

    expect(serverClient).toMatch(/^import "server-only";/);
    expect(serverClient).toContain('from "openai"');
    expect(serverClient).toContain("process.env");
    expect(serverClient).toContain("OPENAI_API_KEY");
    expect(adapter).not.toContain("OPENAI_API_KEY");
    expect(planningServerClient).toMatch(/^import "server-only";/);
    expect(planningServerClient).toContain('from "openai"');
    expect(planningServerClient).toContain("OPENAI_API_KEY");
    expect(planningAdapter).not.toContain("OPENAI_API_KEY");
    expect(prompt).not.toContain("OPENAI_API_KEY");
    expect(`${serverClient}${adapter}${prompt}`).not.toContain("NEXT_PUBLIC_OPENAI");
  });

  it("protects the production route with the same server-only marker", async () => {
    const route = await readFile(`${root}/src/app/api/ai/proposals/route.ts`, "utf8");
    expect(route).toMatch(/^import "server-only";/);
    expect(route).not.toContain("OPENAI_API_KEY");
  });
});
