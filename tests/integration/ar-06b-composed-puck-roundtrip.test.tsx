import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Data } from "@puckeditor/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAr06aComposedTemplate } from "@/data/demo/ar-06a-composed-template";
import { Ar06bComposedEditorProof } from "@/integrations/puck/ar-06b-composed-editor-proof";
import { createComposedPuckSession } from "@/integrations/puck/composed-page-adapter";
import {
  ComposedPuckEditor,
  type ComposedPuckStatePathObservation,
} from "@/integrations/puck/composed-puck-editor";
import {
  ar06bDragSteps,
  ar06bDropOffset,
  ar06bFrameBox,
  ar06bUpwardDrop,
  inspectAr06bCacheControl,
  observeAr06bVisibilityInDocument,
} from "../helpers/ar-06b-edit-observation";

type TestProps = {
  data: Data;
  children: ReactNode;
  overrides?: {
    iframe: (props: { document?: Document; children: ReactNode }) => ReactNode;
  };
  onChange?: (data: Data) => void;
  onAction?: (
    action: {
      type: "move";
      sourceIndex: number;
      sourceZone: string;
      destinationIndex: number;
      destinationZone: string;
    },
    appState: { data: Data },
    previous: { data: Data },
  ) => void;
  permissions: Record<string, boolean>;
  config: {
    root: { render: (props: Record<string, unknown>) => ReactNode };
    components: Record<string, { render: (props: Record<string, unknown>) => ReactNode }>;
  };
};
const puck = vi.hoisted(() => ({
  props: undefined as TestProps | undefined,
  change: undefined as ((data: Data) => void) | undefined,
  action: undefined as
    | ((
        action: {
          type: "move";
          sourceIndex: number;
          sourceZone: string;
          destinationIndex: number;
          destinationZone: string;
        },
        data: Data,
        previous: Data,
      ) => void)
    | undefined,
  mounts: 0,
  dispatch: vi.fn(),
  selectedId: "section_home_hero",
  selectionListeners: new Set<() => void>(),
  select(id: string) {
    puck.selectedId = id;
    puck.selectionListeners.forEach((listener) => listener());
  },
}));
// Models installed Puck's initial-data-only boundary; real Puck is covered by the browser spec.
vi.mock("@puckeditor/core", async () => {
  const React = await import("react");
  let current: Data;
  const Puck = Object.assign(
    (props: TestProps) => {
      const [data, setData] = React.useState(props.data);
      current = data;
      puck.props = props;
      puck.change = (next) => {
        setData(next);
        props.onChange?.({ ...next, zones: next.zones ?? {} });
      };
      puck.action = (action, next, previous) =>
        props.onAction?.(action, { data: next }, { data: previous });
      React.useEffect(() => {
        puck.mounts++;
      }, []);
      return <>{props.children}</>;
    },
    {
      Preview: () => {
        const config = puck.props!.config;
        return (
          <div data-testid="puck-canvas">
            {config.root.render(
              Object.fromEntries(
                Object.entries(current.root.props as Record<string, unknown>).map(
                  ([key, value]) => [
                    key,
                    () =>
                      (value as { type: string; props: Record<string, unknown> }[]).map((item) => (
                        <div key={String(item.props.id)}>
                          {config.components[item.type].render({
                            ...item.props,
                            puck: { dragRef: () => undefined },
                          })}
                        </div>
                      )),
                  ],
                ),
              ),
            )}
          </div>
        );
      },
      Fields: () => <div data-testid="puck-fields" />,
    },
  );
  return {
    Puck,
    createUsePuck: () => (selector: (api: unknown) => unknown) => {
      const selectedId = React.useSyncExternalStore(
        (listener) => {
          puck.selectionListeners.add(listener);
          return () => puck.selectionListeners.delete(listener);
        },
        () => puck.selectedId,
      );
      return selector({
        selectedItem: selectedId ? { props: { id: selectedId } } : undefined,
        getSelectorForId: (id: string) =>
          id === "section_home_hero" ? { index: 0, zone: "root:region_orientation" } : undefined,
        dispatch: puck.dispatch,
      });
    },
  };
});
function session(locale: "en" | "fi" = "en") {
  const f = createAr06aComposedTemplate("offset");
  return createComposedPuckSession({
    snapshot: f.snapshot,
    pageId: f.homeId,
    catalogue: f.catalogue,
    activeLocale: locale,
    primaryLocale: "en",
    enabledLocales: ["en", "fi"],
    resolveAuthority: f.resolver,
  });
}
function edited(value: ReturnType<typeof session>, title: string) {
  const d = structuredClone(value.project());
  (
    (d.root.props as Record<string, unknown>).region_orientation as {
      props: Record<string, unknown>;
    }[]
  )[0].props.title = title;
  return d;
}
function reordered(value: ReturnType<typeof session>) {
  const data = structuredClone(value.project());
  const units = (data.root.props as Record<string, unknown>).region_primary_discovery as unknown[];
  [units[0], units[1]] = [units[1], units[0]];
  return data;
}
function pageWithoutComposition(snapshot: ReturnType<typeof session>["snapshot"]) {
  return snapshot.pages.map((page) => {
    if (!("composition" in page)) return page;
    const { composition: _composition, ...plain } = page;
    void _composition;
    return plain;
  });
}
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.doUnmock("next/cache");
  vi.doUnmock("@/integrations/puck/ar-06b-composed-editor-proof");
  puck.mounts = 0;
  puck.selectedId = "section_home_hero";
  puck.selectionListeners.clear();
  puck.dispatch.mockClear();
});

describe("AR-06B reusable editor lifecycle", () => {
  it.each([
    [1387.109375, 780.296875, 0, Infinity],
    [780.296875, 1387.109375, 0, Infinity],
    [500, 500, 24, Infinity],
    [1217.546875, 1712.609375, 0, 1080],
    [1712.609375, 1217.546875, 0, 1080],
  ])(
    "moves beyond the captured reverse self-overlap score without leaving the sibling (%s/%s/%s)",
    (source, target, gap, visibleEnd) => {
      const grab = Math.min(60, source / 2);
      const offset = ar06bDropOffset(source, target, grab, gap, visibleEnd),
        shift = offset + grab + gap;
      expect(Math.max(0, 1 - shift / source)).toBeLessThan(
        Math.min(source, target, shift - gap) / target,
      );
      expect(shift - gap).toBeGreaterThan(target * 0.55);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThan(target);
      expect(offset).toBeLessThan(visibleEnd);
      expect(() => ar06bDropOffset(source, target, grab, gap, target * 0.5 - grab)).toThrow(
        "No interior drag destination",
      );
      expect(() => ar06bDropOffset(source, 0, grab)).toThrow("Invalid drag geometry");
    },
  );
  it("samples the recorded reverse drag below the collision interval without changing its endpoint", () => {
    const distance = 2634.07568359375 - 2149.109375;
    expect(distance / 12).toBeGreaterThan(10); // Retained failed gesture's fixed step count.
    for (const scale of [0.5, 1, 2]) {
      const steps = ar06bDragSteps(distance, scale);
      const increment = distance / steps;
      expect(increment / scale).toBeLessThanOrEqual(8);
      expect(increment * steps).toBeCloseTo(distance, 10);
    }
    expect(() => ar06bDragSteps(distance, 0)).toThrow("Invalid drag geometry");
    expect(() => ar06bDragSteps(Number.NaN)).toThrow("Invalid drag geometry");
  });
  it("uses one frame/local observation for the recorded 768px positioning discrepancy", () => {
    const local = { x: 38.390625, y: 1137.96875, width: 691.21875, height: 732.3125 };
    const frame = { x: 0, y: -731, width: 768, height: 5246 };
    const size = { width: 768, height: 5246 };
    const box = ar06bFrameBox(local, frame, size);
    expect(box.y).toBe(406.96875);
    const oldWheel = 234.15625 + local.height - 120;
    expect(box.y + box.height - oldWheel - 120).toBe(172.8125);
    const correctedWheel = box.y + box.height - 120;
    expect(box.y + box.height - correctedWheel).toBe(120);
    for (const scale of [0.5, 1, 2]) {
      const projected = ar06bFrameBox(
        local,
        { ...frame, width: frame.width * scale, height: frame.height * scale },
        size,
      );
      expect(projected.y).toBe(frame.y + local.y * scale);
      expect(projected.height).toBe(local.height * scale);
    }
    expect(() => ar06bFrameBox(local, frame, { ...size, width: 0 })).toThrow(
      "Invalid frame geometry",
    );
  });
  it.each([747.375, 714.984375])(
    "plans the equivalent upward permutation for the captured 1024px tall target (%s)",
    (categoriesHeight) => {
      expect(() => ar06bDropOffset(categoriesHeight, 2734.546875, 60, 0, 1079.5625)).toThrow(
        "No interior drag destination",
      );
      const categories = { x: 524, y: 267, width: 448.8125, height: categoriesHeight };
      const products = { ...categories, y: categories.y + categories.height, height: 2734.546875 };
      const plan = ar06bUpwardDrop(products, categories, 0, 1200);
      expect(plan.delta).toBe(-categoriesHeight);
      expect(plan.targetScore).toBe(1);
      expect(plan.selfScore).toBeLessThan(plan.targetScore);
      expect(plan.movedTop).toBeLessThan(categories.y + categories.height * 0.45);
      expect(plan.start.y).toBeLessThan(1200);
      expect(plan.end.y).toBeGreaterThan(0);
      expect(() => ar06bUpwardDrop(products, { ...categories, y: 0 }, 0, 1200)).toThrow(
        "Invalid adjacent upward geometry",
      );
      expect(() => ar06bUpwardDrop(products, categories, 0, 300)).toThrow(
        "No valid visible upward collision",
      );
    },
  );
  it("sizes the actual Puck iframe override from rendered content and restores its inline height", () => {
    const callbacks: ResizeObserverCallback[] = [];
    class ControlledResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", ControlledResizeObserver);
    const value = session();
    render(<ComposedPuckEditor session={value} onAcceptedChange={vi.fn()} />);
    const Override = puck.props?.overrides?.iframe;
    if (!Override) throw new Error("Puck iframe override was not supplied");
    const frame = document.createElement("iframe");
    frame.style.height = "42px";
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error("iframe document is unavailable");
    expect(frameDocument.defaultView?.frameElement).toBe(frame);
    let height = 320;
    const view = render(
      <Override document={frameDocument}>
        <div>Measured composed content</div>
      </Override>,
    );
    const content = view.container.firstElementChild as HTMLElement;
    const box = vi
      .spyOn(content, "getBoundingClientRect")
      .mockImplementation(() => DOMRect.fromRect({ width: 200, height }));
    const callback = callbacks.at(-1);
    if (!callback) throw new Error("iframe content was not observed");
    try {
      act(() => callback([], {} as ResizeObserver));
      expect(frame.style.height).toBe("320px");
      height = 180;
      act(() => callback([], {} as ResizeObserver));
      expect(frame.style.height).toBe("180px");
      view.unmount();
      expect(frame.style.height).toBe("42px");
    } finally {
      box.mockRestore();
      frame.remove();
    }
  });
  it("reports actual canonical units in the validated renderer order", () => {
    const { container } = render(<Ar06bComposedEditorProof layout="offset" locale="en" />);
    expect(container.querySelector("[data-ar06b-ready]")).toHaveAttribute(
      "data-ar06b-canonical-order",
      [
        "section_home_hero",
        "section_home_categories",
        "section_home_products",
        "section_home_campaign",
        "section_home_story",
        "section_home_benefits",
        "section_home_newsletter",
      ].join(","),
    );
  });
  it("keeps Puck render configuration stable when the selected section changes", () => {
    const value = session();
    render(<ComposedPuckEditor session={value} onAcceptedChange={vi.fn()} />);
    const initial = puck.props?.config;
    if (!initial) throw new Error("Puck editor configuration is unavailable");
    const renderers = Object.fromEntries(
      Object.entries(initial.components).map(([type, component]) => [type, component.render]),
    );
    const mounts = puck.mounts;

    act(() => puck.select("section_home_categories"));

    expect(screen.getByText(/selected section: featured categories/iu)).toBeVisible();
    expect(puck.props?.config).toBe(initial);
    expect(puck.mounts).toBe(mounts);
    for (const [type, renderer] of Object.entries(renderers))
      expect(puck.props?.config.components[type]?.render).toBe(renderer);
  });
  it("observes a public Puck root-slot move through commit without making the action canonical", () => {
    const value = session();
    const observations = vi.fn<(observation: ComposedPuckStatePathObservation) => void>();
    const before = value.snapshot;
    const beforePages = structuredClone(pageWithoutComposition(before));
    const next = reordered(value);
    render(
      <ComposedPuckEditor
        session={value}
        onAcceptedChange={vi.fn()}
        onStatePathObservation={observations}
      />,
    );
    act(() =>
      puck.action!(
        {
          type: "move",
          sourceIndex: 0,
          sourceZone: "root:region_primary_discovery",
          destinationIndex: 1,
          destinationZone: "root:region_primary_discovery",
        },
        next,
        value.project(),
      ),
    );
    expect(value.snapshot).toBe(before);
    const action = observations.mock.calls.at(-1)?.[0];
    expect(action).toMatchObject({
      phase: "action",
      action: "move",
      source: { slot: "region_primary_discovery", index: 0 },
      destination: { slot: "region_primary_discovery", index: 1 },
    });
    expect(action?.before?.region_primary_discovery).toEqual([
      "section_home_categories",
      "section_home_products",
    ]);
    expect(action?.reduced?.region_primary_discovery).toEqual([
      "section_home_products",
      "section_home_categories",
    ]);
    act(() => puck.change!(next));
    const committed = observations.mock.calls.at(-1)?.[0];
    expect(committed).toMatchObject({ phase: "commit", outcome: "accepted" });
    expect(committed?.action).toBeUndefined();
    expect(committed?.onChange?.region_primary_discovery).toEqual([
      "section_home_products",
      "section_home_categories",
    ]);
    expect(committed?.projected?.region_primary_discovery).toEqual([
      "section_home_products",
      "section_home_categories",
    ]);
    expect(committed?.zones).toBe("empty");
    expect(committed?.canonicalOrder).toEqual([
      "section_home_hero",
      "section_home_products",
      "section_home_categories",
      "section_home_campaign",
      "section_home_story",
      "section_home_benefits",
      "section_home_newsletter",
    ]);
    expect(pageWithoutComposition(value.snapshot)).toEqual(beforePages);
  });
  it("retains mounted and reverse move observations with the original canonical unit order", () => {
    const value = session();
    const observations = vi.fn();
    render(
      <ComposedPuckEditor
        session={value}
        onAcceptedChange={vi.fn()}
        onStatePathObservation={observations}
      />,
    );
    expect(observations.mock.calls[0]?.[0]).toMatchObject({
      phase: "mounted",
      epoch: 0,
      recoveryEpoch: 0,
    });
    const forward = reordered(value);
    act(() =>
      puck.action!(
        {
          type: "move",
          sourceIndex: 0,
          sourceZone: "root:region_primary_discovery",
          destinationIndex: 1,
          destinationZone: "root:region_primary_discovery",
        },
        forward,
        value.project(),
      ),
    );
    act(() => puck.change!(forward));
    const reverse = reordered(value);
    act(() =>
      puck.action!(
        {
          type: "move",
          sourceIndex: 0,
          sourceZone: "root:region_primary_discovery",
          destinationIndex: 1,
          destinationZone: "root:region_primary_discovery",
        },
        reverse,
        value.project(),
      ),
    );
    act(() => puck.change!(reverse));
    expect(observations.mock.calls.at(-1)?.[0]).toMatchObject({
      phase: "commit",
      outcome: "accepted",
      canonicalOrder: [
        "section_home_hero",
        "section_home_categories",
        "section_home_products",
        "section_home_campaign",
        "section_home_story",
        "section_home_benefits",
        "section_home_newsletter",
      ],
    });
  });
  it("does not let a throwing observer alter an accepted canonical edit", () => {
    const value = session();
    const accepted = vi.fn();
    render(
      <ComposedPuckEditor
        session={value}
        onAcceptedChange={accepted}
        onStatePathObservation={() => {
          throw new Error("diagnostic sink failure");
        }}
      />,
    );
    act(() => puck.change!(edited(value, "Observer-safe heading")));
    expect(value.project()).toEqual(edited(value, "Observer-safe heading"));
    expect(accepted).toHaveBeenCalledTimes(1);
  });
  it("records a later text commit separately from an uncommitted move action", () => {
    const value = session();
    const observations = vi.fn<(observation: ComposedPuckStatePathObservation) => void>();
    render(
      <ComposedPuckEditor
        session={value}
        onAcceptedChange={vi.fn()}
        onStatePathObservation={observations}
      />,
    );
    act(() =>
      puck.action!(
        {
          type: "move",
          sourceIndex: 0,
          sourceZone: "root:region_primary_discovery",
          destinationIndex: 1,
          destinationZone: "root:region_primary_discovery",
        },
        reordered(value),
        value.project(),
      ),
    );
    act(() => puck.change!(edited(value, "A separate text edit")));
    const committed = observations.mock.calls
      .filter(([entry]) => entry.phase === "commit")
      .at(-1)?.[0];
    expect(committed).toMatchObject({ outcome: "accepted" });
    expect(committed?.action).toBeUndefined();
    expect(committed?.source).toBeUndefined();
    expect(committed?.destination).toBeUndefined();
    expect(committed?.projected?.region_primary_discovery).toEqual([
      "section_home_categories",
      "section_home_products",
    ]);
    expect(screen.getByTestId("puck-canvas")).toHaveTextContent("A separate text edit");
  });
  it("updates its own view without remount, rejects atomically, and restores valid selection", () => {
    const value = session(),
      accepted = vi.fn(),
      observations = vi.fn<(observation: ComposedPuckStatePathObservation) => void>();
    render(
      <ComposedPuckEditor
        session={value}
        onAcceptedChange={accepted}
        onStatePathObservation={observations}
      />,
    );
    const mounts = puck.mounts;
    act(() => puck.change!(edited(value, "Accepted heading")));
    expect(screen.getByTestId("puck-canvas")).toHaveTextContent("Accepted heading");
    expect(puck.mounts).toBe(mounts);
    expect(accepted).toHaveBeenCalledTimes(1);
    const before = value.snapshot,
      identity = value.identity,
      bad = edited(value, "Rejected heading");
    (
      (bad.root.props as Record<string, unknown>).region_orientation as {
        props: Record<string, unknown>;
      }[]
    )[0].props.__veskifyContent = {};
    act(() => puck.change!(bad));
    expect(value.snapshot).toBe(before);
    expect(value.identity).toBe(identity);
    expect(accepted).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("puck-canvas")).toHaveTextContent("Accepted heading");
    expect(screen.getByTestId("puck-canvas")).not.toHaveTextContent("Rejected heading");
    expect(puck.mounts).toBe(mounts + 1);
    expect(puck.dispatch).toHaveBeenCalledWith({
      type: "setUi",
      ui: { itemSelector: { index: 0, zone: "root:region_orientation" } },
    });
    expect(screen.getByText(/last valid design/u)).toBeVisible();
    expect(
      observations.mock.calls.filter(([entry]) => entry.phase === "commit").at(-1)?.[0],
    ).toMatchObject({
      phase: "commit",
      outcome: "rejected",
      rejection: { name: "Error" },
    });
    act(() => puck.change!(edited(value, "Recovered edit")));
    expect(screen.getByTestId("puck-canvas")).toHaveTextContent("Recovered edit");
  });
  it("recovers a stale callback from the current external canonical view", () => {
    const value = session();
    render(<ComposedPuckEditor session={value} onAcceptedChange={vi.fn()} />);
    const stale = puck.props?.onChange;
    if (!stale) throw new Error("Puck editor callback is unavailable");
    const oldData = value.project();
    const external = edited(value, "External canonical heading");
    value.apply(external, value.identity);
    const originalOrder = (
      (external.root.props as Record<string, unknown>).region_primary_discovery as {
        props: Record<string, unknown>;
      }[]
    ).map((item) => item.props.id);

    act(() => stale(oldData));

    expect(screen.getByTestId("puck-canvas")).toHaveTextContent("External canonical heading");
    expect(
      (
        (value.project().root.props as Record<string, unknown>).region_primary_discovery as {
          props: Record<string, unknown>;
        }[]
      ).map((item) => item.props.id),
    ).toEqual(originalOrder);
    const followUp = structuredClone(value.project());
    (
      (followUp.root.props as Record<string, unknown>).region_primary_discovery as {
        props: Record<string, unknown>;
      }[]
    )[0].props.heading = "Unrelated category heading";
    act(() => puck.change!(followUp));
    expect(screen.getByTestId("puck-canvas")).toHaveTextContent("External canonical heading");
    expect(screen.getByTestId("puck-canvas")).toHaveTextContent("Unrelated category heading");
  });
  it("resets for an external locale/session and ignores an unmounted session callback", () => {
    const en = session(),
      accepted = vi.fn(),
      view = render(<ComposedPuckEditor session={en} onAcceptedChange={accepted} />),
      old = puck.props!.onChange!;
    const fi = session("fi"),
      enBefore = en.snapshot;
    view.rerender(<ComposedPuckEditor session={fi} onAcceptedChange={accepted} />);
    expect(screen.getByTestId("puck-canvas")).toHaveTextContent("Tehty pohjoiseen valoon");
    act(() => old(edited(en, "Late event")));
    expect(en.snapshot).toBe(enBefore);
    expect(accepted).not.toHaveBeenCalled();
    act(() => puck.change!(edited(fi, "Uusi otsikko")));
    expect(screen.getByTestId("puck-canvas")).toHaveTextContent("Uusi otsikko");
  });
  it("removes editing in read-only mode including a retained earlier callback", () => {
    const value = session(),
      accepted = vi.fn(),
      view = render(<ComposedPuckEditor session={value} onAcceptedChange={accepted} />),
      old = puck.props!.onChange!,
      before = value.snapshot;
    view.rerender(<ComposedPuckEditor session={value} onAcceptedChange={accepted} readOnly />);
    expect(puck.props!.onChange).toBeUndefined();
    expect(puck.props!.permissions).toEqual({
      drag: false,
      edit: false,
      insert: false,
      delete: false,
      duplicate: false,
    });
    expect(screen.queryByTestId("puck-fields")).toBeNull();
    act(() => old(edited(value, "Forbidden edit")));
    expect(value.snapshot).toBe(before);
    expect(accepted).not.toHaveBeenCalled();
    expect(screen.getByRole("main")).toBeVisible();
  });
});

describe("AR-06B guarded development route", () => {
  async function route(environment = "development", mode = "standalone", flag = "1") {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("VESKIFY_RUNTIME_MODE", mode);
    vi.stubEnv("VESKIFY_AR06B_ACCEPTANCE", flag);
    const events: string[] = [];
    vi.doMock("next/cache", () => ({ unstable_noStore: () => events.push("noStore") }));
    vi.doMock("@/integrations/puck/ar-06b-composed-editor-proof", () => {
      events.push("fixture-loaded");
      return { Ar06bComposedEditorProof: () => null };
    });
    return { module: await import("@/app/acceptance/ar-06b/page"), events };
  }
  it.each(["stack", "offset"])(
    "loads real %s selector after noStore with noindex",
    async (layout) => {
      const { module, events } = await route();
      const value = await module.default({
        searchParams: Promise.resolve({ case: layout, locale: "fi" }),
      });
      expect(events).toEqual(["noStore", "fixture-loaded"]);
      expect(value.props).toEqual({ layout, locale: "fi" });
      expect(module.metadata.robots).toEqual({ index: false, follow: false });
    },
  );
  it.each([
    ["production", "standalone", "1"],
    ["development", "integrated", "1"],
    ["development", "standalone", "0"],
    ["test", "standalone", "1"],
  ])("rejects %s/%s/%s before loading", async (environment, mode, flag) => {
    const { module, events } = await route(environment, mode, flag);
    await expect(
      module.default({ searchParams: Promise.resolve({ case: "offset", locale: "en" }) }),
    ).rejects.toThrow(/404/u);
    expect(events).toEqual([]);
  });
  it.each([
    { case: "unknown" },
    { case: "stack", locale: "de" },
    { case: "offset", snapshot: "foreign" },
  ])("rejects invalid selectors before loading", async (query) => {
    const { module, events } = await route();
    await expect(module.default({ searchParams: Promise.resolve(query) })).rejects.toThrow(/404/u);
    expect(events).toEqual(["noStore"]);
  });
  it("accepts only the bounded parsed development header exception", () => {
    const scope = {
      pathname: "/acceptance/ar-06b",
      nodeEnvironment: "development",
      runtimeMode: "standalone",
      flag: "1",
    };
    expect(inspectAr06bCacheControl("NO-CACHE, must-revalidate", scope).mode).toBe(
      "development-revalidation-only",
    );
    expect(inspectAr06bCacheControl("private, no-store, max-age=0", scope).mode).toBe(
      "private-or-no-store",
    );
    for (const raw of [
      undefined,
      "",
      "public",
      "immutable",
      "max-age=60",
      "no-cache, must-revalidate, stale-while-revalidate=0",
      "no-cache, no-cache",
      "no-cache=0",
    ])
      expect(() => inspectAr06bCacheControl(raw, scope)).toThrow();
    for (const altered of [
      { ...scope, flag: "0" },
      { ...scope, nodeEnvironment: "production" },
      { ...scope, runtimeMode: "integrated" },
      { ...scope, pathname: "/other" },
    ])
      expect(() => inspectAr06bCacheControl("no-cache,must-revalidate", altered)).toThrow();
  });
});

describe("AR-06B actual selection-wrapper observation", () => {
  it("accepts only the visible sampled control or its exact Puck hit wrapper", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div><main><div data-puck-component="true"><button aria-label="Control" style="pointer-events:none"></button><span></span></div></main></div>';
    document.body.append(container);
    const button = container.querySelector("button")!;
    const component = button.parentElement!;
    const foreign = component.querySelector("span")!;
    Object.defineProperty(button, "scrollIntoView", { value: () => undefined });
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(10, 10, 100, 20));
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const previous = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
    let hit: Element | null = component;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => hit });
    const samples = () => observeAr06bVisibilityInDocument(container);
    try {
      expect(samples()).toHaveLength(1);
      expect(samples()[0].unobscured).toBe(true);
      hit = button;
      expect(samples()[0].unobscured).toBe(true);
      for (const blocked of [foreign, component.parentElement, null]) {
        hit = blocked;
        expect(samples()[0].unobscured).toBe(false);
      }
      hit = component;
      button.style.pointerEvents = "auto";
      expect(samples()[0].unobscured).toBe(false);
      button.style.pointerEvents = "none";
      component.style.opacity = "0";
      expect(samples()[0].unobscured).toBe(false);
      component.style.opacity = "1";
      component.style.visibility = "hidden";
      expect(samples()[0].unobscured).toBe(false);
    } finally {
      rect.mockRestore();
      scroll.mockRestore();
      container.remove();
      if (previous) Object.defineProperty(document, "elementFromPoint", previous);
      else Reflect.deleteProperty(document, "elementFromPoint");
    }
  });
});
