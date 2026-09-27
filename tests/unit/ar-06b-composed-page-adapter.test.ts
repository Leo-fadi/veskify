import { describe, expect, it } from "vitest";
import { createAr06aComposedTemplate } from "@/data/demo/ar-06a-composed-template";
import {
  createComposedPuckSession,
  composedRegionSlotName,
} from "@/integrations/puck/composed-page-adapter";

function input(locale: "en" | "fi" = "en") {
  const fixture = createAr06aComposedTemplate("offset");
  return {
    fixture,
    input: {
      snapshot: fixture.snapshot,
      pageId: fixture.homeId,
      catalogue: fixture.catalogue,
      activeLocale: locale,
      primaryLocale: "en" as const,
      enabledLocales: ["en", "fi"] as const,
      resolveAuthority: fixture.resolver,
    },
  };
}

function session(locale: "en" | "fi" = "en") {
  return createComposedPuckSession(input(locale).input);
}

function root(data: ReturnType<ReturnType<typeof session>["project"]>) {
  return data.root?.props as Record<string, unknown>;
}

function transportWithZones(data: ReturnType<ReturnType<typeof session>["project"]>) {
  const copied = structuredClone(data);
  const props = root(copied);
  return {
    ...copied,
    zones: Object.fromEntries(
      Object.entries(props).map(([slot, entries]) => [`root:${slot}`, entries]),
    ),
  };
}

describe("AR-06B composed Puck adapter", () => {
  it("projects only current localized presentation fields and revalidates an accepted edit", () => {
    const value = session();
    const before = value.identity;
    const data = structuredClone(value.project());
    const hero = root(data)[composedRegionSlotName("orientation")] as Array<{
      props: Record<string, unknown>;
    }>;
    hero[0].props.title = "Edited through Puck";
    const result = value.apply(data, before);
    const page = result.snapshot.pages.find((entry) => entry.id === before.pageId)!;
    expect(
      page.sections.find((section) => section.id === "section_home_hero")?.content.title,
    ).toEqual({
      en: "Edited through Puck",
      fi: "Tehty pohjoiseen valoon",
    });
    expect(result.changed).toBe(true);
    expect(result.identity.contentFingerprint).not.toBe(before.contentFingerprint);
    expect(result.identity.compositionFingerprint).toBe(before.compositionFingerprint);
  });

  it.each(["en", "fi"] as const)(
    "preserves the full aggregate through %s edit, reverse and serialization",
    (locale) => {
      const value = session(locale),
        original = structuredClone(value.snapshot),
        identity = value.identity;
      expect(value.apply(value.project(), identity).snapshot).toBe(value.snapshot);
      expect(value.snapshot).toEqual(original);
      const changed = structuredClone(value.project());
      const hero = (
        root(changed)[composedRegionSlotName("orientation")] as Array<{
          props: Record<string, unknown>;
        }>
      )[0];
      const title = hero.props.title;
      hero.props.title = "Localized edit";
      const result = value.apply(changed, identity),
        expected = structuredClone(original);
      const section = expected.pages
        .find((p) => p.id === identity.pageId)!
        .sections.find((s) => s.id === "section_home_hero")!;
      (section.content.title as Record<string, string>)[locale] = "Localized edit";
      expect(result.snapshot).toEqual(expected);
      expect(() => value.apply(changed, identity)).toThrow(/stale/u);
      const reverse = structuredClone(value.project());
      (
        root(reverse)[composedRegionSlotName("orientation")] as Array<{
          props: Record<string, unknown>;
        }>
      )[0].props.title = title;
      value.apply(reverse, value.identity);
      const ordered = structuredClone(value.project());
      (root(ordered)[composedRegionSlotName("primary-discovery")] as unknown[]).reverse();
      value.apply(ordered, value.identity);
      const reversed = structuredClone(value.project());
      (root(reversed)[composedRegionSlotName("primary-discovery")] as unknown[]).reverse();
      value.apply(reversed, value.identity);
      expect(value.snapshot).toEqual(original);
      const restored = createComposedPuckSession({
        ...input(locale).input,
        snapshot: JSON.parse(JSON.stringify(value.snapshot)),
      });
      expect(restored.snapshot).toEqual(original);
      expect(restored.identity.contentFingerprint).toBe(identity.contentFingerprint);
      expect(restored.identity.compositionFingerprint).toBe(identity.compositionFingerprint);
    },
  );

  it("preserves a missing inactive translation and does not issue a no-op revision", () => {
    const { fixture, input: sessionInput } = input("fi");
    const snapshot = structuredClone(fixture.snapshot);
    const page = snapshot.pages.find((entry) => entry.id === fixture.homeId);
    if (!page) throw new Error("missing fixture page");
    const hero = page.sections.find((entry) => entry.id === "section_home_hero");
    if (!hero) throw new Error("missing fixture hero");
    const title = hero.content.title as Record<string, string>;
    delete title.fi;
    const story = page.sections.find((entry) => entry.id === "section_home_story");
    if (!story) throw new Error("missing fixture story");
    delete story.content.eyebrow;
    const value = createComposedPuckSession({ ...sessionInput, snapshot });
    const before = value.identity;
    const result = value.apply(value.project(), before);
    const accepted = result.snapshot.pages.find((entry) => entry.id === fixture.homeId);
    const acceptedHero = accepted?.sections.find((entry) => entry.id === "section_home_hero");
    expect((acceptedHero?.content.title as Record<string, string>).fi).toBeUndefined();
    const acceptedStory = accepted?.sections.find((entry) => entry.id === "section_home_story");
    expect((acceptedStory?.content as Record<string, unknown>).eyebrow).toBeUndefined();
    expect(result.changed).toBe(false);
    expect(result.identity).toBe(before);
  });

  it("permits only the existing primary-discovery unit permutation", () => {
    const value = session();
    const before = value.identity;
    const data = structuredClone(value.project());
    const key = composedRegionSlotName("primary-discovery");
    (root(data)[key] as unknown[]).reverse();
    const result = value.apply(data, before);
    const page = result.snapshot.pages.find((entry) => entry.id === result.identity.pageId)!;
    if (!("composition" in page)) throw new Error("expected composed page");
    expect(
      page.composition.regionAssignments.find((entry) => entry.regionId === "primary-discovery")
        ?.units,
    ).toEqual([
      { kind: "section", sectionId: "section_home_products" },
      { kind: "section", sectionId: "section_home_categories" },
    ]);
    expect(result.identity.compositionFingerprint).not.toBe(before.compositionFingerprint);
  });

  it("accepts installed empty zones without losing a localized edit", () => {
    const value = session();
    const data = { ...value.project(), zones: {} };
    const hero = root(data)[composedRegionSlotName("orientation")] as Array<{
      props: Record<string, unknown>;
    }>;
    hero[0].props.title = "Root slot edit";
    const result = value.apply(data, value.identity);
    expect(result.changed).toBe(true);
    const page = result.snapshot.pages.find((entry) => entry.id === result.identity.pageId)!;
    expect(
      page.sections.find((section) => section.id === "section_home_hero")?.content.title,
    ).toEqual({ en: "Root slot edit", fi: "Tehty pohjoiseen valoon" });
  });

  it("accepts only complete exact nonempty Puck zone mirrors", () => {
    const value = session();
    const before = value.identity;
    const withZones = transportWithZones(value.project());
    expect(value.apply(withZones, before).changed).toBe(false);
    const mismatch = transportWithZones(value.project()) as Record<string, unknown>;
    const zones = mismatch.zones as Record<string, unknown>;
    zones[`root:${composedRegionSlotName("orientation")}`] = [];
    expect(() => value.apply(mismatch, value.identity)).toThrow(/zone mirror/u);
    const partial = transportWithZones(value.project());
    delete partial.zones[`root:${composedRegionSlotName("orientation")}`];
    expect(() => value.apply(partial, value.identity)).toThrow(/zone mirror/u);
    expect(() =>
      value.apply({ ...value.project(), zones: { foreign: [] } }, value.identity),
    ).toThrow(/zone mirror/u);
    expect(value.identity).toBe(before);
  });

  it.each([
    "hidden",
    "cross-region",
    "duplicate",
    "top-level",
    "root-level",
    "item-level",
    "stale",
  ])("rejects %s Puck transport atomically", (kind) => {
    const value = session();
    const before = value.identity;
    const data = structuredClone(value.project()) as Record<string, unknown>;
    if (kind === "hidden") {
      const item = root(data as ReturnType<ReturnType<typeof session>["project"]>)[
        composedRegionSlotName("orientation")
      ] as Array<{ props: Record<string, unknown> }>;
      item[0].props.__veskifyContent = {};
    }
    if (kind === "cross-region") {
      const rootProps = root(data as ReturnType<ReturnType<typeof session>["project"]>);
      const orientation = rootProps[composedRegionSlotName("orientation")] as unknown[];
      const discovery = rootProps[composedRegionSlotName("primary-discovery")] as unknown[];
      orientation[0] = discovery[0];
    }
    if (kind === "duplicate") {
      const primary = root(data as ReturnType<ReturnType<typeof session>["project"]>)[
        composedRegionSlotName("primary-discovery")
      ] as unknown[];
      primary[1] = primary[0];
    }
    if (kind === "top-level") data.private = true;
    if (kind === "root-level") (data.root as Record<string, unknown>).private = true;
    if (kind === "item-level") {
      const item = root(data as ReturnType<ReturnType<typeof session>["project"]>)[
        composedRegionSlotName("orientation")
      ] as Array<Record<string, unknown>>;
      item[0].private = true;
    }
    const expected = kind === "stale" ? { ...before, token: {} } : before;
    expect(() => value.apply(data, expected)).toThrow(/Composed Puck editor rejected/u);
    expect(value.identity).toBe(before);
  });

  it("rejects an identical-looking identity issued by a different session", () => {
    const { input: sessionInput } = input();
    const first = createComposedPuckSession(sessionInput);
    const second = createComposedPuckSession(sessionInput);
    expect(() => second.apply(second.project(), first.identity)).toThrow(/stale session identity/u);
  });

  it("round-trips a serialized accepted aggregate without version or protected-content drift", () => {
    const value = session();
    const edited = structuredClone(value.project());
    const hero = root(edited)[composedRegionSlotName("orientation")] as Array<{
      props: Record<string, unknown>;
    }>;
    hero[0].props.title = "Serialized edit";
    const accepted = value.apply(edited, value.identity);
    const restored = createComposedPuckSession({
      ...input().input,
      snapshot: JSON.parse(JSON.stringify(accepted.snapshot)),
    });
    expect(restored.project()).toEqual(accepted.data);
    expect(restored.identity.snapshotId).toBe(accepted.identity.snapshotId);
    expect(restored.identity.revision).toBe(accepted.identity.revision);
  });

  it("rejects unsupported snapshot versions before a projection can be exposed", () => {
    const { fixture, input: sessionInput } = input();
    const snapshot = structuredClone(fixture.snapshot) as Record<string, unknown>;
    snapshot.compositionExtensionVersion = "unsupported";
    expect(() => createComposedPuckSession({ ...sessionInput, snapshot })).toThrow();
  });

  it("rejects a foreign page owner before exposing any editable projection", () => {
    const { input: sessionInput } = input();
    expect(() => createComposedPuckSession({ ...sessionInput, pageId: "foreign-page" })).toThrow(
      /requested page is absent/u,
    );
  });

  it("pins the first owner authority through reverse, forward, and text edits", () => {
    const { fixture, input: sessionInput } = input();
    let calls = 0;
    const value = createComposedPuckSession({
      ...sessionInput,
      resolveAuthority: (request) => {
        calls += 1;
        if (calls > 1) throw new Error("resolver was called after authority acceptance");
        return fixture.resolver(request);
      },
    });
    const reordered = structuredClone(value.project());
    (root(reordered)[composedRegionSlotName("primary-discovery")] as unknown[]).reverse();
    const afterReorder = value.apply(reordered, value.identity);
    const restored = structuredClone(afterReorder.data);
    (root(restored)[composedRegionSlotName("primary-discovery")] as unknown[]).reverse();
    const afterRestore = value.apply(restored, afterReorder.identity);
    const edited = structuredClone(afterRestore.data);
    const hero = root(edited)[composedRegionSlotName("orientation")] as Array<{
      props: Record<string, unknown>;
    }>;
    hero[0].props.title = "Pinned authority";
    expect(value.apply(edited, afterRestore.identity).changed).toBe(true);
    expect(calls).toBe(1);
  });
});
