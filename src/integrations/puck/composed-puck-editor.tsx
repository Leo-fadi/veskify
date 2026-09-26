"use client";

import { Puck, createUsePuck, type Data, type PuckAction } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getComponentDefinition } from "@/components/registry";
import {
  composedRegionSlotName,
  type createComposedPuckSession,
} from "@/integrations/puck/composed-page-adapter";
import { createComposedPagePuckConfig } from "@/integrations/puck/composed-page-config";

const useComposedPuck = createUsePuck();
type Session = ReturnType<typeof createComposedPuckSession>;
type SlotOrders = Readonly<Record<string, readonly string[] | "invalid">>;

export type ComposedPuckStatePathObservation = Readonly<{
  phase: "mounted" | "read-only" | "drag-start" | "drag-end" | "action" | "commit";
  epoch: number;
  recoveryEpoch: number;
  session?: string;
  dragging?: boolean;
  action?: "move";
  moveScope?: "known" | "foreign-or-invalid";
  source?: Readonly<{ slot: string; index: number }>;
  destination?: Readonly<{ slot: string; index: number }>;
  before?: SlotOrders;
  reduced?: SlotOrders;
  onChange?: SlotOrders;
  projected?: SlotOrders;
  zones?: "absent" | "empty" | "complete" | "invalid";
  canonicalOrder?: readonly string[];
  outcome?: "accepted" | "unchanged" | "rejected";
  rejection?: Readonly<{ name: string; message: string }>;
}>;
const sessionKeys = new WeakMap<object, string>();
let nextSessionKey = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function diagnosticOrders(
  data: unknown,
  allowedSlots: ReadonlyMap<string, ReadonlySet<string>>,
): SlotOrders {
  const props =
    isRecord(data) && isRecord(data.root) && isRecord(data.root.props)
      ? data.root.props
      : undefined;
  return Object.freeze(
    Object.fromEntries(
      [...allowedSlots].map(([slot, allowed]): [string, readonly string[] | "invalid"] => {
        const items = props?.[slot];
        if (!Array.isArray(items)) return [slot, "invalid"];
        const ids = items.map((item) =>
          isRecord(item) && isRecord(item.props) && typeof item.props.id === "string"
            ? item.props.id
            : undefined,
        );
        if (
          ids.some((id) => !id || !allowed.has(id)) ||
          new Set(ids).size !== ids.length ||
          ids.length !== allowed.size
        )
          return [slot, "invalid"];
        return [slot, Object.freeze(ids as string[])];
      }),
    ),
  );
}

function diagnosticZones(
  data: unknown,
  slots: ReadonlyMap<string, ReadonlySet<string>>,
): ComposedPuckStatePathObservation["zones"] {
  if (!isRecord(data) || !("zones" in data)) return "absent" as const;
  const zones = data.zones;
  if (!isRecord(zones)) return "invalid" as const;
  if (!Object.keys(zones).length) return "empty" as const;
  const expected = [...slots.keys()].map((slot) => `root:${slot}`);
  return Object.keys(zones).every((zone) => expected.includes(zone)) &&
    expected.every((zone) => zone in zones)
    ? "complete"
    : "invalid";
}

function boundedRejection(error: unknown) {
  if (!(error instanceof Error)) return Object.freeze({ name: "Error", message: "Rejected." });
  const message = /^Composed Puck editor rejected: [a-z -]+\.$/u.test(error.message)
    ? error.message
    : "Rejected by the canonical editor boundary.";
  return Object.freeze({ name: error.name, message });
}

/** Custom Preview omits Puck's stock Canvas sizing; keep its full document in normal flow. */
function ComposedEditorFrame({
  document: frameDocument,
  children,
}: {
  document?: Document;
  children: ReactNode;
}) {
  const renderedContent = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = frameDocument?.defaultView?.frameElement;
    const content = renderedContent.current;
    if (!element || element.tagName !== "IFRAME" || !content) return;
    const frame = element as HTMLIFrameElement;
    const previous = frame.style.height;
    const resize = () => {
      const height = Math.ceil(content.getBoundingClientRect().height);
      if (height > 0 && frame.style.height !== `${height}px`)
        frame.style.setProperty("height", `${height}px`);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(content);
    resize();
    return () => {
      observer.disconnect();
      frame.style.setProperty("height", previous);
    };
  }, [frameDocument]);
  // Puck's frame root is always at least the iframe viewport tall. Measure the
  // portal child instead so overflow can grow and later shrink the iframe.
  return <div ref={renderedContent}>{children}</div>;
}

const composedEditorOverrides = { iframe: ComposedEditorFrame };

function sessionKey(session: Session) {
  const existing = sessionKeys.get(session);
  if (existing) return existing;
  const key = `composed-session-${nextSessionKey}`;
  nextSessionKey += 1;
  sessionKeys.set(session, key);
  return key;
}

function sessionView(session: Session) {
  const renderer = session.renderer();
  return { renderer, data: session.project(), config: createComposedPagePuckConfig(renderer) };
}

function SelectedSectionObserver({
  onSelected,
  restoreSelectionId,
}: {
  onSelected: (id: string | undefined) => void;
  restoreSelectionId: string | undefined;
}) {
  const api = useComposedPuck((state) => state);
  const restored = useRef(false);
  const selected = api.selectedItem as { props?: { id?: unknown } } | null;
  const id = selected?.props?.id;
  const selectedId = typeof id === "string" ? id : undefined;
  useEffect(() => onSelected(selectedId), [onSelected, selectedId]);
  useEffect(() => {
    if (!restoreSelectionId || restored.current) return;
    const selector = api.getSelectorForId(restoreSelectionId);
    if (selector) {
      restored.current = true;
      api.dispatch({ type: "setUi", ui: { itemSelector: selector } });
    }
  }, [api, restoreSelectionId]);
  return null;
}

export function ComposedPuckEditor({
  session,
  onAcceptedChange,
  readOnly = false,
  onStatePathObservation,
}: {
  session: Session;
  onAcceptedChange: () => void;
  readOnly?: boolean;
  onStatePathObservation?: (observation: ComposedPuckStatePathObservation) => void;
}) {
  return (
    <ComposedPuckEditorSession
      key={sessionKey(session)}
      session={session}
      onAcceptedChange={onAcceptedChange}
      readOnly={readOnly}
      onStatePathObservation={onStatePathObservation}
    />
  );
}

function ComposedPuckEditorSession({
  session,
  onAcceptedChange,
  readOnly,
  onStatePathObservation,
}: {
  session: Session;
  onAcceptedChange: () => void;
  readOnly: boolean;
  onStatePathObservation?: (observation: ComposedPuckStatePathObservation) => void;
}) {
  const [selectedSectionId, setSelectedSectionId] = useState<string>();
  const [error, setError] = useState<string>();
  const [restoreSelectionId, setRestoreSelectionId] = useState<string>();
  const [recoveryEpoch, setRecoveryEpoch] = useState(0);
  const [view, setView] = useState(() => sessionView(session));
  const expectedIdentity = useRef(session.identity);
  const retainedSelection = useRef<string | undefined>(undefined);
  const active = useRef(true);
  const currentReadOnly = useRef(readOnly);
  const observationCallback = useRef(onStatePathObservation);
  useEffect(() => {
    observationCallback.current = onStatePathObservation;
  }, [onStatePathObservation]);
  useLayoutEffect(() => {
    currentReadOnly.current = readOnly;
  }, [readOnly]);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  // Selection preserves component identity; accepted edits replace the projection.
  // Rejection remounts Puck from this last accepted view.
  const { renderer, data, config } = view;
  const labels = new Map(
    renderer.regions.flatMap((region) =>
      region.sections.map((section) => [
        section.id,
        getComponentDefinition(section.component).label,
      ]),
    ),
  );
  const allowedSlots = new Map(
    renderer.regions.map((region) => [
      composedRegionSlotName(region.id),
      new Set(region.sections.map((section) => section.id)),
    ]),
  );
  const report = useCallback(
    (observation: ComposedPuckStatePathObservation) => {
      try {
        observationCallback.current?.(
          Object.freeze({ ...observation, session: sessionKey(session) }),
        );
      } catch {
        // Diagnostic reporting is never part of the canonical mutation boundary.
      }
    },
    [session],
  );
  const canonicalOrder = useCallback(() => {
    const currentRenderer = session.renderer();
    const page = session.snapshot.pages.find(
      (entry) => "composition" in entry && entry.id === session.identity.pageId,
    );
    const assignments = new Map(
      page && "composition" in page
        ? page.composition.regionAssignments.map((assignment) => [assignment.regionId, assignment])
        : [],
    );
    return Object.freeze(
      currentRenderer.regions.flatMap((region) =>
        (assignments.get(region.id)?.units ?? []).map((unit) =>
          unit.kind === "section" ? unit.sectionId : unit.kind,
        ),
      ),
    );
  }, [session]);
  useEffect(() => {
    report({
      phase: readOnly ? "read-only" : "mounted",
      epoch: session.identity.epoch,
      recoveryEpoch,
      canonicalOrder: canonicalOrder(),
    });
  }, [canonicalOrder, readOnly, recoveryEpoch, report, session]);
  const onSelected = useCallback((id: string | undefined) => {
    if (id) retainedSelection.current = id;
    setSelectedSectionId(id);
  }, []);
  const onAction = (
    action: PuckAction,
    appState: { data: Data; ui?: { isDragging?: boolean } },
    previous: { data: Data; ui?: { isDragging?: boolean } },
  ) => {
    if (
      action.type === "setUi" &&
      typeof appState.ui?.isDragging === "boolean" &&
      appState.ui.isDragging !== previous.ui?.isDragging
    ) {
      report({
        phase: appState.ui.isDragging ? "drag-start" : "drag-end",
        epoch: expectedIdentity.current.epoch,
        recoveryEpoch,
        dragging: appState.ui.isDragging,
      });
      return;
    }
    if (action.type !== "move") return;
    const source = action.sourceZone.startsWith("root:")
      ? action.sourceZone.slice("root:".length)
      : undefined;
    const destination = action.destinationZone.startsWith("root:")
      ? action.destinationZone.slice("root:".length)
      : undefined;
    if (
      !Number.isInteger(action.sourceIndex) ||
      !Number.isInteger(action.destinationIndex) ||
      !source ||
      !destination ||
      !allowedSlots.has(source) ||
      !allowedSlots.has(destination)
    ) {
      report({
        phase: "action",
        epoch: expectedIdentity.current.epoch,
        recoveryEpoch,
        action: "move",
        moveScope: "foreign-or-invalid",
      });
      return;
    }
    const observation = {
      phase: "action" as const,
      epoch: expectedIdentity.current.epoch,
      recoveryEpoch,
      action: "move" as const,
      moveScope: "known" as const,
      source: Object.freeze({ slot: source, index: action.sourceIndex }),
      destination: Object.freeze({ slot: destination, index: action.destinationIndex }),
      before: diagnosticOrders(previous.data, allowedSlots),
      reduced: diagnosticOrders(appState.data, allowedSlots),
      zones: diagnosticZones(appState.data, allowedSlots),
    };
    report(observation);
  };
  const onChange = (next: Data) => {
    if (!active.current || currentReadOnly.current) return;
    try {
      const accepted = session.apply(next, expectedIdentity.current);
      expectedIdentity.current = accepted.identity;
      setError(undefined);
      report({
        phase: "commit",
        epoch: accepted.identity.epoch,
        recoveryEpoch,
        onChange: diagnosticOrders(next, allowedSlots),
        projected: diagnosticOrders(session.project(), allowedSlots),
        zones: diagnosticZones(next, allowedSlots),
        canonicalOrder: canonicalOrder(),
        outcome: accepted.changed ? "accepted" : "unchanged",
      });
      if (accepted.changed) {
        setView(sessionView(session));
        onAcceptedChange();
      }
    } catch (error) {
      setError("That change could not be applied safely. Your last valid design is still shown.");
      report({
        phase: "commit",
        epoch: session.identity.epoch,
        recoveryEpoch,
        onChange: diagnosticOrders(next, allowedSlots),
        projected: diagnosticOrders(session.project(), allowedSlots),
        zones: diagnosticZones(next, allowedSlots),
        canonicalOrder: canonicalOrder(),
        outcome: "rejected",
        rejection: boundedRejection(error),
      });
      expectedIdentity.current = session.identity;
      setView(sessionView(session));
      setRestoreSelectionId(retainedSelection.current);
      setRecoveryEpoch((value) => value + 1);
    }
  };
  return (
    <section aria-label="Composed static page editor" data-ar06b-editor="true">
      <output aria-live="polite" data-ar06b-selected-section={selectedSectionId ?? ""}>
        {selectedSectionId
          ? `Selected section: ${labels.get(selectedSectionId) ?? "Section"}`
          : "Select a section to edit its permitted presentation text."}
      </output>
      {error ? <p role="status">{error}</p> : null}
      <Puck
        overrides={composedEditorOverrides}
        config={config}
        data={data}
        key={recoveryEpoch}
        onChange={readOnly ? undefined : onChange}
        onAction={onAction}
        permissions={{
          drag: !readOnly,
          insert: false,
          delete: false,
          duplicate: false,
          edit: !readOnly,
        }}
        ui={{ leftSideBarVisible: false, rightSideBarVisible: false }}
        viewports={[
          { width: 375, label: "375px" },
          { width: 768, label: "768px" },
          { width: 1024, label: "1024px" },
          { width: 1440, label: "1440px" },
        ]}
      >
        <SelectedSectionObserver onSelected={onSelected} restoreSelectionId={restoreSelectionId} />
        <div className="min-h-[44rem] bg-white">
          <div className="min-w-0">
            <Puck.Preview />
          </div>
          {readOnly ? null : (
            <aside className="border-t border-[var(--vesko-app-border)] bg-white p-3">
              <Puck.Fields />
            </aside>
          )}
        </div>
      </Puck>
    </section>
  );
}
