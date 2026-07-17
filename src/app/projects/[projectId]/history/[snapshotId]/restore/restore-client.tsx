"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  confirmRestore,
  prepareRestore,
  StaleRestorePreparationError,
  type RestorePreparation,
} from "@/application/history";
import type { Locale } from "@/domain/shared";
import {
  createBrowserProjectRepository,
  InvalidRestoreTargetError,
  type ProjectRepository,
} from "@/services/storage";

type RepositoryFactory = () => ProjectRepository;
const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();
const text = (locale: Locale) =>
  locale === "fi"
    ? {
        title: "Palauta aiempi versio",
        loading: "Valmistellaan palautusta…",
        body: "Tämä aiempi versio luodaan uutena tallennettuna luonnoksena. Julkaistu verkkokauppasi ei muutu, ja voit julkaista erikseen myöhemmin.",
        confirm: "Palauta uutena luonnoksena",
        confirming: "Palautetaan…",
        cancel: "Palaa aiempiin versioihin",
        stale:
          "Tallennettu luonnos muuttui tarkistuksen jälkeen. Palaa aiempiin versioihin ja valmistele palautus uudelleen.",
        failure:
          "Versiota ei voitu palauttaa turvallisesti. Julkaistu verkkokauppasi säilyi ennallaan.",
        success: "Uusi tallennettu luonnos on valmis",
        successBody:
          "Julkaistu verkkokauppasi säilyi ennallaan. Tarkista uusi luonnos ennen erillistä julkaisua.",
        editor: "Avaa palautettu luonnos",
        publish: "Tarkista julkaisu",
        history: "Palaa aiempiin versioihin",
      }
    : {
        title: "Restore a previous version",
        loading: "Preparing restore…",
        body: "This previous version will become a new saved draft. Your published storefront will stay unchanged, and you can publish separately later.",
        confirm: "Restore as new draft",
        confirming: "Restoring…",
        cancel: "Return to previous versions",
        stale:
          "The saved draft changed after your review. Return to previous versions and prepare restore again.",
        failure:
          "This version could not be restored safely. Your published storefront remains unchanged.",
        success: "Your new saved draft is ready",
        successBody:
          "Your published storefront remains unchanged. Review the new draft before publishing separately.",
        editor: "Open restored draft",
        publish: "Review publish",
        history: "Return to previous versions",
      };

export function RestoreClient({
  projectId,
  snapshotId,
  repositoryFactory = defaultRepositoryFactory,
}: {
  projectId: string;
  snapshotId: string;
  repositoryFactory?: RepositoryFactory;
}) {
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [locale, setLocale] = useState<Locale>("en");
  const [preparation, setPreparation] = useState<RestorePreparation>();
  const [state, setState] = useState<
    "loading" | "ready" | "confirming" | "stale" | "failure" | "success"
  >("loading");
  useEffect(() => {
    let cancelled = false;
    repository
      .current!.get(projectId)
      .then(async (aggregate) => {
        const prepared = await prepareRestore(projectId, snapshotId, repository.current!);
        if (!cancelled) {
          setLocale(aggregate.project.primaryLocale);
          setPreparation(prepared);
          setState("ready");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState(error instanceof InvalidRestoreTargetError ? "stale" : "failure");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, snapshotId]);
  const copy = text(locale);
  const historyHref = `/projects/${projectId}/history`;
  const restore = async () => {
    if (!preparation || state !== "ready") return;
    setState("confirming");
    try {
      await confirmRestore(preparation, repository.current!);
      setState("success");
    } catch (error) {
      setState(error instanceof StaleRestorePreparationError ? "stale" : "failure");
    }
  };
  if (state === "loading")
    return (
      <main className="project-state">
        <section aria-live="polite" className="project-state__panel">
          <h1>{copy.loading}</h1>
        </section>
      </main>
    );
  if (state === "success")
    return (
      <main className="project-state">
        <section aria-live="polite" className="project-state__panel">
          <h1>{copy.success}</h1>
          <p>{copy.successBody}</p>
          <Link href={`/projects/${projectId}/editor`}>{copy.editor}</Link>
          <Link href={`/projects/${projectId}/publish`}>{copy.publish}</Link>
          <Link href={historyHref}>{copy.history}</Link>
        </section>
      </main>
    );
  if (state === "stale" || state === "failure")
    return (
      <main className="project-state">
        <section aria-live="assertive" className="project-state__panel">
          <h1>{copy.title}</h1>
          <p>{state === "stale" ? copy.stale : copy.failure}</p>
          <Link href={historyHref}>{copy.cancel}</Link>
        </section>
      </main>
    );
  return (
    <main className="project-state" lang={locale}>
      <section className="project-state__panel">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <div>
          <button
            disabled={state === "confirming"}
            onClick={() => {
              void restore();
            }}
            type="button"
          >
            {state === "confirming" ? copy.confirming : copy.confirm}
          </button>
          <Link href={historyHref}>{copy.cancel}</Link>
        </div>
      </section>
    </main>
  );
}
