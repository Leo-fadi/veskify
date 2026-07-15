"use client";

import { useState } from "react";
import { Puck, Render, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { initialPuckData, validatePuckDraftPayload, veskifyPuckConfig } from "./config";

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

      <section aria-label="Puck editor proof" className="min-h-[720px] overflow-hidden rounded-xl border border-[var(--brand-color-border)] bg-white">
        <Puck config={veskifyPuckConfig} data={initialPuckData} onPublish={handlePublishAttempt} />
      </section>
    </div>
  );
}
