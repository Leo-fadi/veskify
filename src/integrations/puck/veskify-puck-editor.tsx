"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Puck, Render, type Data, type OnAction } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import type { StorefrontRenderContext } from "@/components/registry";
import type { BrandSystem } from "@/domain/design-system";
import type { PageModel } from "@/domain/storefront";
import {
  generateVeskifyPuckConfig,
  initialPuckData,
  pageToPuckData,
  puckDataToPage,
  validatePuckDraftPayload,
  veskifyPuckConfig,
} from "./config";

const editingPermissions = {
  drag: false,
  duplicate: false,
  delete: false,
  edit: false,
  insert: false,
};

export function VeskifyPuckCanvas({
  page,
  context,
  brandSystem,
  resetKey,
  sessionKey = "active",
  onPageChange,
  onValidationError,
  onSelectedSectionChange,
  readOnly = false,
  readOnlyLabel,
  validationErrorMessage,
  contextualPanel,
  showDesignFields = false,
  compactFieldsTargetId,
}: {
  page: PageModel;
  context: StorefrontRenderContext;
  brandSystem: BrandSystem;
  resetKey: number;
  sessionKey?: string;
  onPageChange: (page: PageModel) => void;
  onValidationError: (message: string) => void;
  onSelectedSectionChange?: (sectionId: string | undefined) => void;
  readOnly?: boolean;
  readOnlyLabel?: string;
  validationErrorMessage?: string;
  contextualPanel?: ReactNode;
  showDesignFields?: boolean;
  compactFieldsTargetId?: string;
}) {
  const boundaryKey = `${page.id}-${context.activeLocale}-${resetKey}-${sessionKey}`;
  return (
    <VeskifyPuckCanvasSession
      brandSystem={brandSystem}
      context={context}
      key={boundaryKey}
      onPageChange={onPageChange}
      onSelectedSectionChange={onSelectedSectionChange}
      onValidationError={onValidationError}
      page={page}
      readOnly={readOnly}
      readOnlyLabel={readOnlyLabel}
      validationErrorMessage={validationErrorMessage}
      contextualPanel={contextualPanel}
      showDesignFields={showDesignFields}
      compactFieldsTargetId={compactFieldsTargetId}
    />
  );
}

function VeskifyPuckCanvasSession({
  page,
  context,
  brandSystem,
  onPageChange,
  onValidationError,
  onSelectedSectionChange,
  readOnly,
  readOnlyLabel,
  validationErrorMessage,
  contextualPanel,
  showDesignFields,
  compactFieldsTargetId,
}: Omit<Parameters<typeof VeskifyPuckCanvas>[0], "resetKey" | "sessionKey">) {
  const [recoveryVersion, setRecoveryVersion] = useState(0);
  const trustedPage = useRef(page);
  const reportedSectionId = useRef<string | undefined>(undefined);
  const config = generateVeskifyPuckConfig(context, page.type, brandSystem);
  const data = pageToPuckData(page, context);

  function handleChange(nextData: Data) {
    try {
      onPageChange(puckDataToPage(nextData, trustedPage.current, context));
    } catch {
      onValidationError(
        validationErrorMessage ??
          "That change could not be applied safely. Your last valid design is still shown.",
      );
      trustedPage.current = page;
      setRecoveryVersion((current) => current + 1);
    }
  }

  const handleAction: OnAction = (_action, appState) => {
    if (readOnly || !onSelectedSectionChange) return;
    const selector = appState.ui.itemSelector;
    const selectedItem = selector ? appState.data.content[selector.index] : undefined;
    const selectedProps = selectedItem
      ? (selectedItem.props as Record<string, unknown>)
      : undefined;
    const selectedId = selectedProps?.id;
    const nextSectionId =
      typeof selectedId === "string" && page.sections.some((section) => section.id === selectedId)
        ? selectedId
        : undefined;
    if (nextSectionId === reportedSectionId.current) return;
    reportedSectionId.current = nextSectionId;
    queueMicrotask(() => onSelectedSectionChange(nextSectionId));
  };

  useEffect(() => {
    if (readOnly) reportedSectionId.current = undefined;
  }, [readOnly]);

  return (
    <section
      aria-label={readOnly ? (readOnlyLabel ?? "Proposal preview canvas") : "Visual editor canvas"}
      className="min-h-[44rem] bg-white"
    >
      <Puck
        config={config}
        data={data}
        height="calc(100vh - 12rem)"
        key={recoveryVersion}
        onAction={handleAction}
        onChange={readOnly ? undefined : handleChange}
        permissions={
          readOnly
            ? editingPermissions
            : { ...editingPermissions, delete: true, drag: true, edit: true, insert: true }
        }
        ui={{ leftSideBarVisible: false, rightSideBarVisible: false }}
      >
        <div
          className="grid h-full min-h-[44rem] bg-white"
          style={{
            gridTemplateColumns: contextualPanel ? "minmax(0, 1fr) minmax(18rem, 20rem)" : "1fr",
          }}
        >
          <div className="min-w-0">
            <Puck.Preview />
          </div>
          {contextualPanel ? (
            <aside className="overflow-y-auto border-l border-[var(--vesko-app-border)] bg-white p-3">
              {contextualPanel}
              {showDesignFields ? <Puck.Fields /> : null}
            </aside>
          ) : null}
          {compactFieldsTargetId ? <PuckFieldsPortal targetId={compactFieldsTargetId} /> : null}
        </div>
      </Puck>
    </section>
  );
}

function PuckFieldsPortal({ targetId }: { targetId: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => setTarget(document.getElementById(targetId)));
  }, [targetId]);

  return target ? createPortal(<Puck.Fields />, target) : null;
}

export function VeskifyPuckEditorProof() {
  const [status, setStatus] = useState("No draft handoff has been validated yet.");

  function handlePublishAttempt(data: Data) {
    validatePuckDraftPayload(data);
    setStatus("Puck output validated for Veskify draft handoff. Publishing remains deferred.");
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[var(--brand-radius)] border border-[var(--brand-color-border)] bg-[var(--brand-color-surface)] p-5">
        <h1 className="text-2xl font-semibold">Puck adapter proof</h1>
        <p className="mt-3 text-[var(--brand-color-muted-text)]">
          This route embeds Puck as editor infrastructure while Veskify owns the component schema,
          rendering component, validation, and future draft/publish workflow.
        </p>
        <p className="mt-3 rounded-xl bg-[var(--brand-color-background)] p-3 text-sm" role="status">
          {status}
        </p>
      </section>

      <section aria-label="Rendered through the same Puck configuration" className="grid gap-3">
        <h2 className="text-xl font-semibold">Shared renderer preview</h2>
        <Render config={veskifyPuckConfig} data={initialPuckData} />
      </section>

      <section
        aria-label="Puck editor proof"
        className="min-h-[720px] overflow-hidden rounded-xl border border-[var(--brand-color-border)] bg-white"
      >
        <Puck config={veskifyPuckConfig} data={initialPuckData} onPublish={handlePublishAttempt} />
      </section>
    </div>
  );
}
