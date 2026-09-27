"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createComposedPuckSession } from "@/integrations/puck/composed-page-adapter";
import {
  createAr06aComposedTemplate,
  type Ar06aCompositionLayout,
  type Ar06aLocale,
} from "@/data/demo/ar-06a-composed-template";
import {
  ComposedPuckEditor,
  type ComposedPuckStatePathObservation,
} from "@/integrations/puck/composed-puck-editor";

function serializeOrders(orders: ComposedPuckStatePathObservation["before"]) {
  if (!orders) return "";
  return Object.entries(orders)
    .map(([slot, ids]) => `${slot}:${ids === "invalid" ? "invalid" : ids.join(",")}`)
    .join("|");
}

function statePathAttributes(statePath: ComposedPuckStatePathObservation | undefined) {
  return {
    "data-ar06b-puck-phase": statePath?.phase ?? "",
    "data-ar06b-puck-session": statePath?.session ?? "",
    "data-ar06b-puck-epoch": statePath?.epoch.toString() ?? "",
    "data-ar06b-puck-recovery-epoch": statePath?.recoveryEpoch.toString() ?? "",
    "data-ar06b-puck-dragging": statePath?.dragging === undefined ? "" : String(statePath.dragging),
    "data-ar06b-puck-action": statePath?.action ?? "",
    "data-ar06b-puck-move-scope": statePath?.moveScope ?? "",
    "data-ar06b-puck-source": statePath?.source
      ? `${statePath.source.slot}:${statePath.source.index}`
      : "",
    "data-ar06b-puck-destination": statePath?.destination
      ? `${statePath.destination.slot}:${statePath.destination.index}`
      : "",
    "data-ar06b-puck-before": serializeOrders(statePath?.before),
    "data-ar06b-puck-reduced": serializeOrders(statePath?.reduced),
    "data-ar06b-puck-on-change": serializeOrders(statePath?.onChange),
    "data-ar06b-puck-projected": serializeOrders(statePath?.projected),
    "data-ar06b-puck-canonical-order": statePath?.canonicalOrder?.join(",") ?? "",
    "data-ar06b-puck-zones": statePath?.zones ?? "",
    "data-ar06b-puck-outcome": statePath?.outcome ?? "",
    "data-ar06b-puck-rejection-name": statePath?.rejection?.name ?? "",
    "data-ar06b-puck-rejection-message": statePath?.rejection?.message ?? "",
  };
}

type RecordedStatePath = ComposedPuckStatePathObservation & Readonly<{ sequence: number }>;

function serializeStatePathEvents(events: readonly RecordedStatePath[]) {
  return JSON.stringify(
    events.map(({ sequence, ...event }) => ({ sequence, ...statePathAttributes(event) })),
  );
}

export function Ar06bComposedEditorProof({
  layout,
  locale,
}: Readonly<{ layout: Ar06aCompositionLayout; locale: Ar06aLocale }>) {
  const fixture = useMemo(() => createAr06aComposedTemplate(layout), [layout]);
  const session = useMemo(
    () =>
      createComposedPuckSession({
        snapshot: fixture.snapshot,
        pageId: fixture.homeId,
        catalogue: fixture.catalogue,
        activeLocale: locale,
        primaryLocale: "en",
        enabledLocales: ["en", "fi"],
        resolveAuthority: fixture.resolver,
      }),
    [fixture, locale],
  );
  const [acceptedVersion, setAcceptedVersion] = useState(0);
  const proofRoot = useRef<HTMLDivElement>(null);
  const statePath = useRef<readonly RecordedStatePath[]>([]);
  const nextSequence = useRef(1);
  const observeStatePath = useCallback((observation: ComposedPuckStatePathObservation) => {
    const event = Object.freeze({ ...observation, sequence: nextSequence.current });
    nextSequence.current += 1;
    statePath.current = Object.freeze([...statePath.current.slice(-31), event]);
    const root = proofRoot.current;
    if (!root) return;
    for (const [name, value] of Object.entries(statePathAttributes(event)))
      root.setAttribute(name, value);
    root.setAttribute("data-ar06b-puck-events", serializeStatePathEvents(statePath.current));
  }, []);
  const renderer = session.renderer();
  const page = session.snapshot.pages.find((entry) => entry.id === fixture.homeId);
  const canonicalAssignments = new Map(
    page && "composition" in page
      ? page.composition.regionAssignments.map((assignment) => [assignment.regionId, assignment])
      : [],
  );
  const canonicalOrder = renderer.regions.flatMap((region) =>
    (canonicalAssignments.get(region.id)?.units ?? []).map((unit) =>
      unit.kind === "section" ? unit.sectionId : unit.kind,
    ),
  );
  return (
    <div
      ref={proofRoot}
      data-ar06b-ready="true"
      data-ar06b-layout={layout}
      data-active-locale={locale}
      data-ar06b-content-fingerprint={session.identity.contentFingerprint}
      data-ar06b-composition-fingerprint={session.identity.compositionFingerprint}
      data-ar06b-canonical-order={canonicalOrder.join(",")}
    >
      <ComposedPuckEditor
        session={session}
        onAcceptedChange={() => setAcceptedVersion((value) => value + 1)}
        onStatePathObservation={observeStatePath}
      />
      <section
        aria-label="Read-only composed preview"
        data-ar06b-preview="true"
        data-ar06b-version={acceptedVersion}
      >
        {renderer.render()}
      </section>
    </div>
  );
}
