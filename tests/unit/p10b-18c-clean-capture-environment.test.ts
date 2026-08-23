import { describe, expect, it, vi } from "vitest";
import { P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV } from "../helpers/p10b-18c-production-server-composition";

const testAcceptanceToken = "p10b-18c-clean-capture-test-token-0001";

describe("P10B-18C clean-capture server environment", () => {
  it("composes isolated clean-capture environments without mutating P10B-18A or global state", async () => {
    const originalCleanCapture = process.env.P10B18C_CLEAN_CAPTURE;
    const originalAcceptanceToken = process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV];
    delete process.env.P10B18C_CLEAN_CAPTURE;
    process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV] = testAcceptanceToken;
    vi.resetModules();

    try {
      const inheritedConfig = (await import("../../playwright.p10b-18a.config")).default;
      const inheritedServers = Array.isArray(inheritedConfig.webServer)
        ? inheritedConfig.webServer
        : inheritedConfig.webServer
          ? [inheritedConfig.webServer]
          : [];

      expect(inheritedServers).toHaveLength(2);
      expect(inheritedServers.every(({ env }) => env?.P10B18C_CLEAN_CAPTURE === undefined)).toBe(
        true,
      );
      expect(process.env.P10B18C_CLEAN_CAPTURE).toBeUndefined();
      expect(process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV]).toBe(testAcceptanceToken);

      const cleanConfig = (await import("../../playwright.p10b-18c.config")).default;
      const cleanServers = Array.isArray(cleanConfig.webServer)
        ? cleanConfig.webServer
        : cleanConfig.webServer
          ? [cleanConfig.webServer]
          : [];

      expect(cleanServers).toHaveLength(2);
      cleanServers.forEach((server, index) => {
        const inheritedServer = inheritedServers[index];
        expect(inheritedServer).toBeDefined();
        expect(server).not.toBe(inheritedServer);
        expect(server.env).not.toBe(inheritedServer?.env);
        for (const [key, value] of Object.entries(inheritedServer?.env ?? {})) {
          if (
            key === "VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN" &&
            server.env?.VESKIFY_RUNTIME_MODE === "integrated"
          ) {
            continue;
          }
          expect(server.env?.[key]).toBe(value);
        }
        expect(server.env?.P10B18C_CLEAN_CAPTURE).toBe("1");
      });
      expect(cleanServers[0]?.env).not.toBe(cleanServers[1]?.env);
      expect(inheritedServers.every(({ env }) => env?.P10B18C_CLEAN_CAPTURE === undefined)).toBe(
        true,
      );
      expect(process.env.P10B18C_CLEAN_CAPTURE).toBeUndefined();
      const inheritedIntegrated = inheritedServers.find(
        ({ env }) => env?.VESKIFY_RUNTIME_MODE === "integrated",
      );
      const cleanIntegrated = cleanServers.find(
        ({ env }) => env?.VESKIFY_RUNTIME_MODE === "integrated",
      );
      expect(cleanIntegrated?.env?.VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN).toBe(
        testAcceptanceToken,
      );
      expect(inheritedIntegrated?.env?.VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE_TOKEN).not.toBe(
        testAcceptanceToken,
      );
    } finally {
      if (originalCleanCapture === undefined) delete process.env.P10B18C_CLEAN_CAPTURE;
      else process.env.P10B18C_CLEAN_CAPTURE = originalCleanCapture;
      if (originalAcceptanceToken === undefined) {
        delete process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV];
      } else {
        process.env[P10B18C_PLAYWRIGHT_ACCEPTANCE_TOKEN_ENV] = originalAcceptanceToken;
      }
      vi.resetModules();
    }
  });
});
