"use client";

import { useRef, useState } from "react";
import { Puck, Render, type Data } from "@puckeditor/core";
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
  onPageChange,
  onValidationError,
}: {
  page: PageModel;
  context: StorefrontRenderContext;
  brandSystem: BrandSystem;
  resetKey: number;
  onPageChange: (page: PageModel) => void;
  onValidationError: (message: string) => void;
}) {
  const boundaryKey = `${page.id}-${context.activeLocale}-${resetKey}`;
  return (
    <VeskifyPuckCanvasSession
      brandSystem={brandSystem}
      context={context}
      key={boundaryKey}
      onPageChange={onPageChange}
      onValidationError={onValidationError}
      page={page}
    />
  );
}

function VeskifyPuckCanvasSession({
  page,
  context,
  brandSystem,
  onPageChange,
  onValidationError,
}: Omit<Parameters<typeof VeskifyPuckCanvas>[0], "resetKey">) {
  const [recoveryVersion, setRecoveryVersion] = useState(0);
  const trustedPage = useRef(page);
  const config = generateVeskifyPuckConfig(context, page.type, brandSystem);
  const data = pageToPuckData(page, context);

  function handleChange(nextData: Data) {
    try {
      onPageChange(puckDataToPage(nextData, trustedPage.current, context));
    } catch {
      onValidationError(
        "That change could not be applied safely. Your last valid design is still shown.",
      );
      trustedPage.current = page;
      setRecoveryVersion((current) => current + 1);
    }
  }

  return (
    <section aria-label="Visual editor canvas" className="min-h-[44rem] bg-white">
      <Puck
        config={config}
        data={data}
        headerTitle="Visual editor"
        height="calc(100vh - 12rem)"
        key={recoveryVersion}
        onChange={handleChange}
        overrides={{ headerActions: () => <></> }}
        permissions={{
          ...editingPermissions,
          delete: true,
          drag: true,
          edit: true,
          insert: true,
        }}
      />
    </section>
  );
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
