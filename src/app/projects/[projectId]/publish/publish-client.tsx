"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type PublishPreparation } from "@/application/publishing";
import { PublishConfirmation } from "@/components/publishing/publish-confirmation";
import { PublishStatus, publishingCopy } from "@/components/publishing/publish-status";
import type { Locale } from "@/domain/shared";
import {
  createBrowserProjectRepository,
  ProjectNotFoundError,
  type ProjectAggregate,
} from "@/services/storage";
import {
  P905bLocalDemoSynchronizationClientError,
  synchronizeP905bLocalDemoAggregate,
} from "@/integrations/ai/p9-05b-local-demo-client";
import {
  AuthoritativeMerchantPublishClientError,
  createAuthoritativeMerchantPublishClient,
  type MerchantPublishGatewayClient,
} from "./authoritative-publish-client";
import styles from "./publish.module.css";

type ProjectReader = Pick<ReturnType<typeof createBrowserProjectRepository>, "get">;
type RepositoryFactory = () => ProjectReader;
type LoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "failure" }
  | { status: "success"; aggregate: ProjectAggregate };
type PublishState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "ready"; preparation: PublishPreparation }
  | { status: "noChanges"; preparation: PublishPreparation }
  | { status: "confirming"; preparation: PublishPreparation }
  | { status: "stale"; message: string }
  | { status: "failure"; message: string }
  | { status: "success"; projectRevision: number };

const defaultRepositoryFactory: RepositoryFactory = () => createBrowserProjectRepository();

function errorMessage(error: unknown, locale: Locale): { stale: boolean; message: string } {
  const fi = locale === "fi";
  if (
    error instanceof AuthoritativeMerchantPublishClientError &&
    [
      "stalePublishConfirmation",
      "staleProjectRevision",
      "savedDraftMismatch",
      "publishedStateConflict",
      "idempotency-conflict",
    ].includes(error.code)
  ) {
    return {
      stale: true,
      message: fi
        ? "Tallennettu luonnos tai julkaistu verkkokauppa muuttui tarkistuksen jälkeen. Tarkista uusin luonnos ennen julkaisua."
        : "The saved draft or published storefront changed after your review. Review the latest draft before publishing.",
    };
  }
  if (error instanceof AuthoritativeMerchantPublishClientError && error.status === 409) {
    return {
      stale: true,
      message: fi
        ? "Julkaisua ei voitu vahvistaa turvallisesti. Tarkista uusin tallennettu luonnos ennen uutta yritystä."
        : "Publishing could not be confirmed safely. Review the latest saved draft before trying again.",
    };
  }
  if (error instanceof AuthoritativeMerchantPublishClientError && error.status === 400) {
    return {
      stale: false,
      message: fi
        ? "Tallennettua luonnosta ei voitu tarkistaa julkaisua varten. Mitään ei julkaistu."
        : "The saved draft could not be reviewed for publishing. Nothing was published.",
    };
  }
  return {
    stale: false,
    message: fi
      ? "Julkaisua ei voitu viimeistellä. Tallennettu luonnoksesi ja nykyinen verkkokauppa säilyivät ennallaan."
      : "Publishing could not be completed. Your saved draft and current storefront remain unchanged.",
  };
}

export function PublishClient({
  projectId,
  repositoryFactory = defaultRepositoryFactory,
  publishGateway,
  acceptedReceiptId,
  localDemoSession,
}: {
  projectId: string;
  repositoryFactory?: RepositoryFactory;
  publishGateway?: MerchantPublishGatewayClient;
  acceptedReceiptId?: string;
  localDemoSession?: { sessionId: string; authoritativeRevision: number };
}) {
  const repository = useRef<ProjectReader | undefined>(undefined);
  repository.current ??= repositoryFactory();
  const gateway = useRef<MerchantPublishGatewayClient | undefined>(undefined);
  gateway.current ??=
    publishGateway ??
    createAuthoritativeMerchantPublishClient({ sessionId: localDemoSession?.sessionId });
  const requestId = useRef<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [publishState, setPublishState] = useState<PublishState>({ status: "idle" });
  const [locale, setLocale] = useState<Locale>();
  const [authoritativeRevision, setAuthoritativeRevision] = useState<number | null>(
    localDemoSession?.authoritativeRevision ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    repository
      .current!.get(projectId)
      .then((aggregate) => {
        if (cancelled) return;
        setLocale(aggregate.project.primaryLocale);
        setLoadState({ status: "success", aggregate });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState({ status: error instanceof ProjectNotFoundError ? "notFound" : "failure" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, projectId]);

  const retryLoad = () => {
    requestId.current = undefined;
    setLoadState({ status: "loading" });
    setPublishState({ status: "idle" });
    setAttempt((current) => current + 1);
  };

  if (loadState.status === "loading") {
    return (
      <RouteStatus title="Loading publishing review" message="Opening your last saved draft…" />
    );
  }
  if (loadState.status === "notFound") {
    return (
      <RouteStatus
        title="Project not found"
        message="We could not find this saved storefront on this device. Nothing was published."
      />
    );
  }
  if (loadState.status === "failure") {
    return (
      <RouteStatus
        title="Publishing is unavailable"
        message="We could not open this project for publishing. Your draft has not been changed."
        retry={retryLoad}
      />
    );
  }

  const activeLocale = locale ?? loadState.aggregate.project.primaryLocale;
  const text = publishingCopy(activeLocale);
  const editorHref = localDemoSession
    ? `/projects/${projectId}/editor?p9-05b-session=${encodeURIComponent(localDemoSession.sessionId)}`
    : `/projects/${projectId}/editor`;
  const publishedHref = localDemoSession
    ? `/projects/${projectId}/published?p9-05b-session=${encodeURIComponent(localDemoSession.sessionId)}`
    : `/projects/${projectId}/published`;
  const draft = loadState.aggregate.snapshots.find(
    (snapshot) => snapshot.id === loadState.aggregate.project.draftSnapshotId,
  );
  const published = loadState.aggregate.snapshots.find(
    (snapshot) => snapshot.id === loadState.aggregate.project.publishedSnapshotId,
  );
  if (!draft || !published) {
    return (
      <RouteStatus
        title={
          activeLocale === "fi"
            ? "Tallennettu luonnos ei ole saatavilla"
            : "Saved draft unavailable"
        }
        message={activeLocale === "fi" ? "Julkaisua ei tehty." : "Nothing was published."}
      />
    );
  }

  const review = async () => {
    setPublishState({ status: "preparing" });
    try {
      requestId.current ??= `publish_request_${crypto.randomUUID().replaceAll("-", "")}`;
      if (!requestId.current) throw new Error("Missing publication request identity.");
      if (localDemoSession) {
        if (authoritativeRevision === null) {
          throw new P905bLocalDemoSynchronizationClientError("stale", 409);
        }
        const synchronization = await synchronizeP905bLocalDemoAggregate({
          projectId,
          sessionId: localDemoSession.sessionId,
          expectedRevision: authoritativeRevision,
          mode: "saved",
          aggregate: loadState.aggregate,
        });
        setAuthoritativeRevision(synchronization.authoritativeRevision);
      }
      const preparation = await gateway.current!.prepare({
        projectId,
        requestId: requestId.current,
        authority: acceptedReceiptId
          ? { kind: "accepted-ai", receiptId: acceptedReceiptId }
          : { kind: "manual" },
      });
      setPublishState(
        preparation.publishPermitted
          ? { status: "ready", preparation }
          : { status: "noChanges", preparation },
      );
    } catch (error) {
      requestId.current = undefined;
      const mapped = errorMessage(error, activeLocale);
      setPublishState(
        mapped.stale
          ? { status: "stale", message: mapped.message }
          : { status: "failure", message: mapped.message },
      );
    }
  };

  const startLatestReview = () => {
    requestId.current = undefined;
    void review();
  };

  const publish = async () => {
    if (publishState.status !== "ready") return;
    const preparation = publishState.preparation;
    setPublishState({ status: "confirming", preparation });
    try {
      if (!requestId.current) throw new Error("Missing publication request identity.");
      const result = await gateway.current!.confirm({
        projectId,
        requestId: requestId.current,
        preparationId: preparation.preparationId,
      });
      requestId.current = undefined;
      setPublishState({ status: "success", projectRevision: result.projectRevision });
    } catch (error) {
      const mapped = errorMessage(error, activeLocale);
      setPublishState(
        mapped.stale
          ? { status: "stale", message: mapped.message }
          : { status: "failure", message: mapped.message },
      );
    }
  };

  const confirmation =
    publishState.status === "ready" || publishState.status === "confirming" ? (
      <PublishConfirmation
        confirming={publishState.status === "confirming"}
        cancelHref={editorHref}
        locale={activeLocale}
        onConfirm={() => {
          void publish();
        }}
        onCancel={() => {
          requestId.current = undefined;
          setPublishState({ status: "idle" });
        }}
        preparation={publishState.preparation}
        primaryLocale={loadState.aggregate.project.primaryLocale}
      />
    ) : null;

  return (
    <main className={styles.publish} lang={activeLocale}>
      <header className={styles.header}>
        <div>
          <Link href={editorHref}>{text.editor}</Link>
          <a href={`/projects/${projectId}/history`}>{text.versionHistory}</a>
          <h1>{text.title}</h1>
          <p>{text.savedDraftOnly}</p>
        </div>
        <fieldset aria-label="Publishing language" className={styles.locale}>
          <legend>{activeLocale === "fi" ? "Kieli" : "Language"}</legend>
          {loadState.aggregate.project.enabledLocales.map((enabledLocale) => (
            <label key={enabledLocale}>
              <input
                checked={activeLocale === enabledLocale}
                name="publish-locale"
                onChange={() => setLocale(enabledLocale)}
                type="radio"
                value={enabledLocale}
              />
              <span>{publishingCopy(enabledLocale).localeName}</span>
            </label>
          ))}
        </fieldset>
      </header>

      <section className={styles.review}>
        <div className={styles.revisions}>
          <p>
            <span>{text.draftRevision}</span>
            <strong>{draft.revision}</strong>
          </p>
          <p>
            <span>{text.publishedRevision}</span>
            <strong>{published.revision}</strong>
          </p>
        </div>
        {publishState.status === "idle" ? (
          <button
            className={styles.primaryAction}
            onClick={() => {
              void review();
            }}
            type="button"
          >
            {text.reviewPublish}
          </button>
        ) : null}
        {publishState.status === "preparing" ? (
          <PublishStatus title={text.preparing} message={text.savedDraftOnly} />
        ) : null}
        {publishState.status === "noChanges" ? (
          <PublishStatus
            action={
              <button
                className={styles.secondaryAction}
                onClick={() => {
                  startLatestReview();
                }}
                type="button"
              >
                {text.reviewLatest}
              </button>
            }
            message={text.noChangesMessage}
            title={text.noChangesTitle}
          />
        ) : null}
        {publishState.status === "stale" || publishState.status === "failure" ? (
          <PublishStatus
            action={
              <button
                className={styles.secondaryAction}
                onClick={() => {
                  startLatestReview();
                }}
                type="button"
              >
                {text.reviewLatest}
              </button>
            }
            message={publishState.message}
            title={
              activeLocale === "fi"
                ? "Julkaisu vaatii uuden tarkistuksen"
                : "Review the latest saved draft"
            }
          />
        ) : null}
        {confirmation}
        {publishState.status === "success" ? (
          <section aria-live="polite" className={styles.success}>
            <h2>{text.successTitle}</h2>
            <p>{text.successMessage(publishState.projectRevision)}</p>
            <p>{text.successDraft}</p>
            <div>
              <Link href={editorHref}>{text.editor}</Link>
              <Link
                href={
                  localDemoSession
                    ? `${publishedHref}&published-revision=${publishState.projectRevision}`
                    : publishedHref
                }
                prefetch={false}
              >
                {text.publishedStorefront}
              </Link>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function RouteStatus({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <main className={styles.state}>
      <section aria-live="polite" className={styles.statePanel} role="status">
        <h1>{title}</h1>
        <p>{message}</p>
        {retry ? (
          <button onClick={retry} type="button">
            Try again
          </button>
        ) : null}
        <Link href="/">Return to Vesko home</Link>
      </section>
    </main>
  );
}
