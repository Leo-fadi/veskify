// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION as followUp,
  WHOLE_STOREFRONT_PROPOSAL_OPERATION_HEADER as operationHeader,
} from "@/application/ai-storefront-generation/contract";
import { PROMPTED_STOREFRONT_STUDIO_OPERATION as prompted } from "@/application/prompted-storefront-studio/contract";

const root = "@/app/api/ai/whole-storefront-proposals/";
const locals = [
  ["p04", "p10b-16p-04-composition.server", "createP10B16P04WholeStorefrontProposalRouteHandler"],
  ["p03", "p10b-16p-03-composition.server", "createP10B16P03WholeStorefrontProposalRouteHandler"],
  ["p9", "p9-05b-composition.server", "createP905bWholeStorefrontProposalRouteHandler"],
] as const;
type Selection = "normal" | "p04" | "p03" | "p9";
type Fault = "load" | "factory" | "handler" | "response";

function request(
  body = JSON.stringify({ operation: prompted }),
  header = followUp as string,
  session: string | undefined = "",
) {
  return new Request("http://localhost/api/ai/whole-storefront-proposals", {
    method: "POST",
    body,
    headers: {
      [operationHeader]: header,
      ...(session === undefined ? {} : { "x-veskify-p9-05b-session": session }),
    },
  });
}

async function setup(mode = "integrated", p04 = "1", fault?: Fault, selected: Selection = "p04") {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VESKIFY_RUNTIME_MODE", mode);
  vi.stubEnv("VESKIFY_AI_PROVIDER", "openai");
  vi.stubEnv("VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE", p04);
  vi.stubEnv("VESKIFY_P9_05B_LOCAL_DEMO", "1");
  const counts: Record<string, number> = {};
  const bump = (name: string) => {
    counts[name] = (counts[name] ?? 0) + 1;
  };
  function factory(name: Selection) {
    bump(name + ":factory");
    if (name === selected && fault === "factory") throw Error("local factory failed");
    return async (input: Request) => {
      bump(name + ":handler");
      const body = await input.text();
      if (name === selected && fault === "handler") throw Error("local handler failed");
      return Response.json(
        { selected: name, body },
        { status: name === selected && fault === "response" ? 401 : 200 },
      );
    };
  }
  vi.doMock("@/application/ai-storefront-generation", () => ({
    REGISTERED_STOREFRONT_FOLLOW_UP_OPERATION: followUp,
    WHOLE_STOREFRONT_PROPOSAL_OPERATION_HEADER: operationHeader,
  }));
  vi.doMock("@/application/prompted-storefront-studio", () => ({
    PROMPTED_STOREFRONT_STUDIO_OPERATION: prompted,
  }));
  vi.doMock(root + "handler", () => ({
    createWholeStorefrontPlanningRouteHandler: () => factory("normal"),
  }));
  for (const [name, module, exported] of locals)
    vi.doMock(root + module, () => {
      bump(name + ":load");
      if (name === selected && fault === "load") throw Error("local loader failed");
      return { [exported]: () => factory(name) };
    });
  return { ...(await import("@/app/api/ai/whole-storefront-proposals/route")), counts };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/application/ai-storefront-generation");
  vi.doUnmock("@/application/prompted-storefront-studio");
  vi.doUnmock(root + "handler");
  for (const [, module] of locals) vi.doUnmock(root + module);
  vi.resetModules();
});

describe("AR-04 route isolation", () => {
  it.each(["integrated", "standalone", "unconfigured"])(
    "never loads local factories in production %s",
    async (mode) => {
      const { POST, counts } = await setup(mode);
      vi.stubEnv("NODE_ENV", "production");
      const response = await POST(request());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        selected: "normal",
        body: JSON.stringify({ operation: prompted }),
      });
      for (const [name] of locals) expect(counts[name + ":load"] ?? 0).toBe(0);
      const { dispatchLocalAcceptance } =
        await import("@/app/api/ai/whole-storefront-proposals/local-acceptance-dispatch.server");
      expect(await dispatchLocalAcceptance(request())).toBeUndefined();
      for (const [name] of locals) expect(counts[name + ":load"] ?? 0).toBe(0);
    },
  );

  it("preserves live priority, original request bodies and all three cached handlers", async () => {
    const { POST, counts } = await setup();
    for (const [mode, flag, selected] of [
      ["integrated", "1", "p04"],
      ["standalone", "0", "p03"],
      ["integrated", "0", "p9"],
      ["integrated", "1", "p04"],
      ["standalone", "0", "p03"],
      ["integrated", "0", "p9"],
    ]) {
      vi.stubEnv("VESKIFY_RUNTIME_MODE", mode);
      vi.stubEnv("VESKIFY_P10B_16P_04_LOCAL_ACCEPTANCE", flag);
      const body = JSON.stringify({ operation: prompted });
      expect(await (await POST(request(body))).json()).toEqual({ selected, body });
    }
    expect(counts["normal:handler"] ?? 0).toBe(0);
    for (const [name] of locals) {
      expect(counts[name + ":factory"]).toBe(1);
      expect(counts[name + ":handler"]).toBe(2);
    }
  });

  it.each(["{}", "null", "[]", '{"operation":"unknown"}', "{"])(
    "leaves unmatched standalone body %s readable by the normal dispatcher",
    async (body) => {
      const { POST, counts } = await setup("standalone", "0");
      expect(await (await POST(request(body))).json()).toEqual({ selected: "normal", body });
      for (const [name] of locals) expect(counts[name + ":load"] ?? 0).toBe(0);
    },
  );

  it.each(["0", "true", ""])("requires exact local flag value, rejecting %j", async (flag) => {
    const { POST } = await setup("integrated", flag);
    vi.stubEnv("VESKIFY_P9_05B_LOCAL_DEMO", flag);
    expect(await (await POST(request())).json()).toEqual({
      selected: "normal",
      body: JSON.stringify({ operation: prompted }),
    });
  });

  it("requires exact follow-up header and session presence, allowing an empty session value", async () => {
    const { POST } = await setup("integrated", "0");
    expect(await (await POST(request("{}", "wrong"))).json()).toEqual({
      selected: "normal",
      body: "{}",
    });
    const missing = request("{}");
    missing.headers.delete("x-veskify-p9-05b-session");
    expect(await (await POST(missing)).json()).toEqual({ selected: "normal", body: "{}" });
    expect(await (await POST(request("{}", followUp, ""))).json()).toEqual({
      selected: "p9",
      body: "{}",
    });
  });

  for (const selected of ["p04", "p03", "p9"] as const) {
    it.each(["load", "factory", "handler", "response"] as const)(
      `${selected} %s failure is terminal without fallback`,
      async (fault) => {
        const { POST, counts } = await setup(
          selected === "p03" ? "standalone" : "integrated",
          selected === "p04" ? "1" : "0",
          fault,
          selected,
        );
        if (fault === "response") {
          const response = await POST(request());
          expect(response.status).toBe(401);
          expect(await response.json()).toEqual({
            selected,
            body: JSON.stringify({ operation: prompted }),
          });
        } else if (fault === "load") {
          // Vitest wraps a module factory exception; its original cause must survive.
          await expect(POST(request())).rejects.toHaveProperty(
            "cause.message",
            "local loader failed",
          );
        } else await expect(POST(request())).rejects.toThrow(`local ${fault} failed`);
        expect(counts["normal:handler"] ?? 0).toBe(0);
        for (const [other] of locals)
          if (other !== selected) expect(counts[other + ":load"] ?? 0).toBe(0);
      },
    );
  }
});
