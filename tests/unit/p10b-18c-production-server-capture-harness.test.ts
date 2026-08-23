import { describe, expect, it, vi } from "vitest";
import { P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV } from "../helpers/p10b-18c-production-server-composition";

const testAcceptanceToken = "p10b-18c-production-server-test-token-0001";

type ServerEntry = {
  command?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  reuseExistingServer?: boolean;
  timeout?: number;
  url?: string;
};

function serverEntries(config: { webServer?: ServerEntry | ServerEntry[] }): ServerEntry[] {
  if (!config.webServer) return [];
  return Array.isArray(config.webServer) ? config.webServer : [config.webServer];
}

describe("P10B-18C production-server capture harness", () => {
  it("composes two isolated production servers without mutating P10B-18A", async () => {
    const cleanCaptureBefore = process.env.P10B18C_CLEAN_CAPTURE;
    const productionCaptureBefore = process.env.P10B18C_PRODUCTION_CAPTURE;
    const acceptanceTokenBefore = process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV];
    process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV] = testAcceptanceToken;
    vi.resetModules();

    try {
      const [{ default: p10b18a }, { default: p10b18c }] = await Promise.all([
        import("../../playwright.p10b-18a.config"),
        import("../../playwright.p10b-18c.config"),
      ]);
      const inherited = serverEntries(p10b18a);
      const production = serverEntries(p10b18c);

      expect(inherited).toHaveLength(2);
      expect(production).toHaveLength(2);
      expect(p10b18c.timeout).toBe(p10b18a.timeout);
      expect(process.env.P10B18C_CLEAN_CAPTURE).toBe(cleanCaptureBefore);
      expect(process.env.P10B18C_PRODUCTION_CAPTURE).toBe(productionCaptureBefore);
      expect(process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV]).toBe(testAcceptanceToken);

      for (const [index, server] of production.entries()) {
        const baseline = inherited[index];
        expect(baseline).toBeDefined();
        expect(server.cwd).toBe(baseline.cwd);
        expect(server.url).toBe(baseline.url);
        for (const [key, value] of Object.entries(baseline.env ?? {})) {
          if (
            key === "VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN" &&
            server.env?.VESKIFY_RUNTIME_MODE === "integrated"
          ) {
            continue;
          }
          expect(server.env?.[key]).toBe(value);
        }
        expect(server.env?.P10B18C_CLEAN_CAPTURE).toBe("1");
        expect(server.reuseExistingServer).toBe(false);
        expect(server.timeout).toBe(600_000);
        expect(server.command).toBe(
          `pnpm build:webpack && pnpm start --port ${new URL(server.url!).port}`,
        );
        expect(baseline.command ?? "").not.toContain("build:webpack");
        expect(baseline.command ?? "").not.toContain("pnpm start");
        expect(baseline.timeout).not.toBe(600_000);
      }

      expect(production[0].cwd).not.toBe(production[1].cwd);
      expect(production[0].env).not.toBe(production[1].env);

      const standalone = production.find(({ env }) => env?.VESKIFY_RUNTIME_MODE === "standalone");
      const integrated = production.find(({ env }) => env?.VESKIFY_RUNTIME_MODE === "integrated");
      expect(standalone).toBeDefined();
      expect(integrated).toBeDefined();
      expect(standalone?.env?.P10B18C_PRODUCTION_CAPTURE).toBeUndefined();
      expect(integrated?.env?.VESKIFY_AI_PROVIDER).toBe("openai");
      expect(integrated?.env?.VESKIFY_P10B_16P_04_MOCK_TRANSPORT).toBe("1");
      expect(integrated?.env?.VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN).toBe(testAcceptanceToken);
      expect(inherited[1].env?.VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN).not.toBe(
        testAcceptanceToken,
      );
      expect(integrated?.env?.P10B18C_PRODUCTION_CAPTURE).toBe("1");
    } finally {
      if (acceptanceTokenBefore === undefined) {
        delete process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV];
      } else {
        process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV] = acceptanceTokenBefore;
      }
      vi.resetModules();
    }
  });
});
