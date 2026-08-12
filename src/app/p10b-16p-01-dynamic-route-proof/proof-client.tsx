"use client";

import { useEffect, useState } from "react";
import type { PageFactEvidenceReference } from "@/domain/storefront";
import { createBrowserProjectRepository, type ProjectAggregate } from "@/services/storage";
import { ProjectEditorClient } from "@/app/projects/[projectId]/editor/project-editor-client";

export function DynamicRouteArchetypeEditorProofClient({
  aggregate,
  evidenceReferences,
}: {
  aggregate: ProjectAggregate;
  evidenceReferences: readonly PageFactEvidenceReference[];
}) {
  const [status, setStatus] = useState<"seeding" | "ready" | "error">("seeding");

  useEffect(() => {
    let cancelled = false;
    const marker = `veskify:p10b-16p-01:${aggregate.project.id}`;
    const seed = async () => {
      if (window.sessionStorage.getItem(marker) !== "seeded") {
        await createBrowserProjectRepository().replaceLocalDemoAggregate(aggregate);
        window.sessionStorage.setItem(marker, "seeded");
      }
      if (!cancelled) setStatus("ready");
    };
    void seed().catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [aggregate]);

  if (status === "seeding") {
    return <p role="status">Preparing the dynamic commerce archetype proof…</p>;
  }
  if (status === "error") {
    return <p role="alert">The dynamic commerce archetype proof could not be prepared.</p>;
  }
  return (
    <ProjectEditorClient
      projectId={aggregate.project.id}
      initialEvidenceReferences={evidenceReferences}
    />
  );
}
