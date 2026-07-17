"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listProjectHistory, type HistoryEntry } from "@/application/history";
import type { Locale } from "@/domain/shared";
import { createBrowserProjectRepository, type ProjectRepository } from "@/services/storage";
import styles from "./history.module.css";

type RepositoryFactory = () => ProjectRepository;
const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();
const copy = (locale: Locale) =>
  locale === "fi"
    ? {
        title: "Verkkokaupan aiemmat versiot",
        intro:
          "Tarkastele aiempia tallennettuja versioita turvallisesti. Palautus luo uuden luonnoksen eikä julkaise mitään.",
        currentPublished: "Nykyinen julkaistu versio",
        currentDraft: "Nykyinen tallennettu luonnos",
        previousVersion: "Aiempi versio",
        preview: "Esikatsele",
        restore: "Palauta luonnokseksi",
        pages: "sivua",
        unknown: "Tallennettu versio",
        user: "Kauppias",
        agent: "Suunnitteluavustaja",
        system: "Järjestelmä",
        loading: "Avataan aiempia versioita…",
        unavailable: "Aiemmat versiot eivät ole saatavilla",
        retry: "Yritä uudelleen",
        editor: "Avaa muokkaus",
      }
    : {
        title: "Previous storefront versions",
        intro:
          "Browse earlier saved versions safely. Restoring creates a new draft and does not publish anything.",
        currentPublished: "Current published version",
        currentDraft: "Current saved draft",
        previousVersion: "Previous version",
        preview: "Preview",
        restore: "Restore as draft",
        pages: "pages",
        unknown: "Saved version",
        user: "Merchant",
        agent: "Design assistant",
        system: "System",
        loading: "Opening previous versions…",
        unavailable: "Previous versions are unavailable",
        retry: "Try again",
        editor: "Open editor",
      };

export function HistoryClient({
  projectId,
  repositoryFactory = defaultRepositoryFactory,
}: {
  projectId: string;
  repositoryFactory?: RepositoryFactory;
}) {
  const repository = useRef<ProjectRepository | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const [entries, setEntries] = useState<HistoryEntry[]>();
  const [locale, setLocale] = useState<Locale>("en");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    repository
      .current!.get(projectId)
      .then(async (aggregate) => {
        const next = await listProjectHistory(projectId, repository.current!);
        if (!cancelled) {
          setLocale(aggregate.project.primaryLocale);
          setEntries(next);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, projectId]);
  const text = copy(locale);
  if (!entries && !error)
    return (
      <main className={styles.state}>
        <p aria-live="polite">{text.loading}</p>
      </main>
    );
  if (error)
    return (
      <main className={styles.state}>
        <h1>{text.unavailable}</h1>
        <p aria-live="polite">
          {locale === "fi"
            ? "Luonnostasi tai julkaistua verkkokauppaasi ei muutettu."
            : "Your draft and published storefront were not changed."}
        </p>
        <button
          onClick={() => {
            setError(false);
            setEntries(undefined);
            setAttempt((value) => value + 1);
          }}
          type="button"
        >
          {text.retry}
        </button>
      </main>
    );
  return (
    <main className={styles.history} lang={locale}>
      <header className={styles.header}>
        <Link href={`/projects/${projectId}/editor`}>{text.editor}</Link>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
      </header>
      <section aria-label={text.title} className={styles.list}>
        {entries!.map((entry) => {
          const title = text[entry.kind] ?? text.unknown;
          const date = new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(entry.createdAt));
          return (
            <article className={styles.card} key={entry.snapshotId}>
              <div>
                <h2>{title}</h2>
                <p>
                  {date} · {entry.pageCount} {text.pages}
                </p>
                <p>{text[entry.authorRole ?? "system"]}</p>
              </div>
              <div className={styles.actions}>
                <Link href={`/projects/${projectId}/history/${entry.snapshotId}`}>
                  {text.preview}
                </Link>
                {entry.kind !== "currentDraft" ? (
                  <Link href={`/projects/${projectId}/history/${entry.snapshotId}/restore`}>
                    {text.restore}
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
