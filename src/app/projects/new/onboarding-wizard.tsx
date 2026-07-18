"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OnboardingService, OnboardingTransitionError } from "@/application/onboarding";
import {
  getOnboardingStep,
  onboardingStepRegistry,
  type OnboardingCreationPath,
  type OnboardingSession,
} from "@/domain/onboarding";
import type { Locale } from "@/domain/shared";
import { BrowserOnboardingSessionRepository, OnboardingStorageError } from "@/services/onboarding";
import styles from "./onboarding.module.css";

type ViewState =
  | { kind: "loading" }
  | { kind: "storage-error" }
  | { kind: "recovery"; reason: "corrupt" | "incompatible" }
  | { kind: "ready"; session: OnboardingSession; origin: "new" | "resumed" };

const copy = {
  en: {
    eyebrow: "Guided storefront setup",
    heading: "Create your storefront with Veskify",
    draft: "Draft · onboarding",
    languageLabel: "Interface language",
    english: "English",
    finnish: "Suomi",
    loading: "Loading your onboarding progress…",
    newStatus: "A new onboarding draft is ready.",
    resumedStatus: "Your saved onboarding draft has been resumed.",
    step: "Step",
    of: "of",
    complete: "complete",
    back: "Back",
    continue: "Continue",
    skip: "Skip for now",
    restart: "Restart onboarding",
    futureLabel: "Coming in the next onboarding milestone",
    pathLegend: "Choose one starting path",
    pathRequired: "Choose a starting path before continuing.",
    notAvailable: "This step is a preview and cannot be completed in this foundation yet.",
    transitionError: "That step cannot be changed right now. Your progress is safe.",
    storageHeading: "We cannot access saved onboarding progress",
    storageBody:
      "Check that browser storage is available, then try again. No project or storefront has been changed.",
    retry: "Try again",
    corruptHeading: "Saved onboarding progress cannot be opened",
    corruptBody:
      "The saved onboarding draft is damaged. You can discard it and begin again safely.",
    incompatibleHeading: "Saved onboarding progress needs a fresh start",
    incompatibleBody:
      "This onboarding draft was created by an incompatible version. You can discard it and begin again safely.",
    discardRestart: "Discard and restart",
    confirmHeading: "Restart onboarding?",
    confirmBody:
      "Your current onboarding choices will be cleared. No project or storefront is affected.",
    confirmRestart: "Yes, start over",
    cancel: "Keep my progress",
  },
  fi: {
    eyebrow: "Ohjattu verkkokaupan aloitus",
    heading: "Luo verkkokauppasi Veskifylla",
    draft: "Luonnos · aloitus",
    languageLabel: "Käyttöliittymän kieli",
    english: "English",
    finnish: "Suomi",
    loading: "Ladataan aloituksen edistymistä…",
    newStatus: "Uusi aloitusluonnos on valmis.",
    resumedStatus: "Tallennettua aloitusluonnosta jatketaan.",
    step: "Vaihe",
    of: "/",
    complete: "valmis",
    back: "Takaisin",
    continue: "Jatka",
    skip: "Ohita nyt",
    restart: "Aloita alusta",
    futureLabel: "Tulossa seuraavassa aloituksen vaiheessa",
    pathLegend: "Valitse yksi tapa aloittaa",
    pathRequired: "Valitse tapa aloittaa ennen jatkamista.",
    notAvailable: "Tämä vaihe on esikatselu eikä sitä voi vielä suorittaa tässä perustassa.",
    transitionError: "Tätä vaihetta ei voi muuttaa juuri nyt. Edistymisesi on turvassa.",
    storageHeading: "Tallennettua aloitusta ei voida käyttää",
    storageBody:
      "Tarkista, että selaimen tallennustila on käytettävissä, ja yritä uudelleen. Projektia tai kauppaa ei ole muutettu.",
    retry: "Yritä uudelleen",
    corruptHeading: "Tallennettua aloitusta ei voida avata",
    corruptBody:
      "Tallennettu aloitusluonnos on vioittunut. Voit poistaa sen ja aloittaa turvallisesti uudelleen.",
    incompatibleHeading: "Tallennettu aloitus täytyy aloittaa uudelleen",
    incompatibleBody:
      "Tämä aloitusluonnos on tehty yhteensopimattomalla versiolla. Voit poistaa sen ja aloittaa turvallisesti uudelleen.",
    discardRestart: "Poista ja aloita uudelleen",
    confirmHeading: "Aloitetaanko alusta?",
    confirmBody:
      "Nykyiset aloitusvalinnat poistetaan. Tämä ei vaikuta projekteihin tai verkkokauppoihin.",
    confirmRestart: "Kyllä, aloita alusta",
    cancel: "Säilytä edistyminen",
  },
} as const;

const pathOptions: ReadonlyArray<{
  value: OnboardingCreationPath;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
}> = [
  {
    value: "new-storefront",
    title: { en: "Create a new storefront", fi: "Luo uusi verkkokauppa" },
    description: {
      en: "Start with your business and brand information.",
      fi: "Aloita yrityksesi ja brändisi tiedoista.",
    },
  },
  {
    value: "redesign-existing-storefront",
    title: { en: "Redesign an existing storefront", fi: "Uudista nykyinen verkkokauppa" },
    description: {
      en: "Plan a fresh look while keeping useful existing material.",
      fi: "Suunnittele uusi ilme ja säilytä hyödyllinen nykyinen aineisto.",
    },
  },
  {
    value: "demo-preset",
    title: { en: "Use a demo preset", fi: "Käytä demopohjaa" },
    description: {
      en: "Begin from a ready-made retail example.",
      fi: "Aloita valmiista kaupan esimerkistä.",
    },
  },
];

export function OnboardingWizard() {
  const [locale, setLocale] = useState<Locale>("en");
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [message, setMessage] = useState("");
  const [restartOpen, setRestartOpen] = useState(false);
  const repository = useMemo(() => new BrowserOnboardingSessionRepository(), []);
  const service = useMemo(() => new OnboardingService(repository), [repository]);
  const text = copy[locale];

  const applyResumeResult = useCallback(
    (result: Awaited<ReturnType<OnboardingService["resume"]>>) => {
      if (result.status === "new" || result.status === "resumed") {
        setView({ kind: "ready", session: result.session, origin: result.status });
        setMessage("");
        return;
      }
      if (result.status === "corrupt" || result.status === "incompatible") {
        setView({ kind: "recovery", reason: result.status });
        return;
      }
      setView({ kind: "storage-error" });
    },
    [],
  );

  const resume = useCallback(async () => {
    setView({ kind: "loading" });
    const result = await service.resume();
    applyResumeResult(result);
  }, [applyResumeResult, service]);

  useEffect(() => {
    let active = true;
    void service.resume().then((result) => {
      if (active) applyResumeResult(result);
    });
    return () => {
      active = false;
    };
  }, [applyResumeResult, service]);

  const updateSession = async (action: () => Promise<OnboardingSession>) => {
    try {
      const session = await action();
      setView((current) => (current.kind === "ready" ? { ...current, session } : current));
      setMessage("");
    } catch (error) {
      if (error instanceof OnboardingStorageError) {
        setView({ kind: "storage-error" });
        return;
      }
      if (error instanceof OnboardingTransitionError) {
        setMessage(
          error.code === "CREATION_PATH_REQUIRED"
            ? text.pathRequired
            : error.code === "STEP_NOT_AVAILABLE"
              ? text.notAvailable
              : text.transitionError,
        );
        return;
      }
      setView({ kind: "storage-error" });
    }
  };

  const restart = async () => {
    try {
      const session = await service.reset();
      setView({ kind: "ready", session, origin: "new" });
      setRestartOpen(false);
      setMessage(text.newStatus);
    } catch {
      setRestartOpen(false);
      setView({ kind: "storage-error" });
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{text.eyebrow}</p>
          <h1>{text.heading}</h1>
          <span className={styles.context}>{text.draft}</span>
        </div>
        <fieldset className={styles.localeControl}>
          <legend>{text.languageLabel}</legend>
          {(["en", "fi"] as const).map((value) => (
            <label key={value}>
              <input
                checked={locale === value}
                name="interface-locale"
                onChange={() => setLocale(value)}
                type="radio"
                value={value}
              />
              <span>{value === "en" ? text.english : text.finnish}</span>
            </label>
          ))}
        </fieldset>
      </header>

      <section aria-label={text.heading} className={styles.card}>
        {view.kind === "loading" && (
          <div aria-live="polite" className={styles.centerState} role="status">
            <span aria-hidden="true" className={styles.spinner} />
            <p>{text.loading}</p>
          </div>
        )}

        {view.kind === "storage-error" && (
          <RecoveryState
            body={text.storageBody}
            heading={text.storageHeading}
            onAction={() => void resume()}
            action={text.retry}
          />
        )}

        {view.kind === "recovery" && (
          <RecoveryState
            body={view.reason === "corrupt" ? text.corruptBody : text.incompatibleBody}
            heading={view.reason === "corrupt" ? text.corruptHeading : text.incompatibleHeading}
            onAction={() => setRestartOpen(true)}
            action={text.discardRestart}
          />
        )}

        {view.kind === "ready" && (
          <ActiveStep
            locale={locale}
            message={message || (view.origin === "new" ? text.newStatus : text.resumedStatus)}
            onBack={() => void updateSession(() => service.goBack(view.session))}
            onContinue={() => void updateSession(() => service.advance(view.session))}
            onPath={(path) =>
              void updateSession(() => service.selectCreationPath(view.session, path))
            }
            onRestart={() => setRestartOpen(true)}
            onSkip={() => void updateSession(() => service.skip(view.session))}
            service={service}
            session={view.session}
          />
        )}
      </section>

      {restartOpen && (
        <div className={styles.dialogBackdrop}>
          <div
            aria-labelledby="restart-heading"
            aria-modal="true"
            className={styles.dialog}
            role="dialog"
          >
            <h2 id="restart-heading">{text.confirmHeading}</h2>
            <p>{text.confirmBody}</p>
            <div className={styles.dialogActions}>
              <button className={styles.secondaryButton} onClick={() => setRestartOpen(false)}>
                {text.cancel}
              </button>
              <button className={styles.dangerButton} onClick={() => void restart()}>
                {text.confirmRestart}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function RecoveryState({
  action,
  body,
  heading,
  onAction,
}: {
  action: string;
  body: string;
  heading: string;
  onAction: () => void;
}) {
  return (
    <div className={styles.centerState} role="alert">
      <h2>{heading}</h2>
      <p>{body}</p>
      <button className={styles.primaryButton} onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

function ActiveStep({
  locale,
  message,
  onBack,
  onContinue,
  onPath,
  onRestart,
  onSkip,
  service,
  session,
}: {
  locale: Locale;
  message: string;
  onBack: () => void;
  onContinue: () => void;
  onPath: (path: OnboardingCreationPath) => void;
  onRestart: () => void;
  onSkip: () => void;
  service: OnboardingService;
  session: OnboardingSession;
}) {
  const text = copy[locale];
  const step = getOnboardingStep(session.activeStepId);
  const progress = service.inspectProgress(session);
  const continueDisabled =
    !step.completableNow || (step.id === "creation-path" && !session.creationPath);

  return (
    <>
      <div className={styles.progressBlock}>
        <div className={styles.progressLabels}>
          <span>
            {text.step} {progress.current} {text.of} {progress.total}
          </span>
          <span>
            {progress.percent}% {text.complete}
          </span>
        </div>
        <progress
          aria-label={`${text.step} ${progress.current} ${text.of} ${progress.total}`}
          max={progress.total}
          value={progress.completed}
        />
        <ol aria-label={text.heading} className={styles.stepList}>
          {onboardingStepRegistry.map((item) => (
            <li
              aria-current={item.id === step.id ? "step" : undefined}
              className={item.id === step.id ? styles.currentStep : undefined}
              key={item.id}
            >
              <span aria-hidden="true">{item.position}</span>
              <span className={styles.visuallyHidden}>{item.title[locale]}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.stepContent}>
        <p aria-live="polite" className={styles.status} role="status">
          {message}
        </p>
        <p className={styles.stepNumber}>
          {text.step} {step.position}
        </p>
        <h2>{step.title[locale]}</h2>
        <p className={styles.description}>{step.description[locale]}</p>

        {step.id === "creation-path" ? (
          <fieldset className={styles.pathOptions}>
            <legend>{text.pathLegend}</legend>
            {pathOptions.map((option) => (
              <label key={option.value}>
                <input
                  checked={session.creationPath === option.value}
                  name="creation-path"
                  onChange={() => onPath(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <strong>{option.title[locale]}</strong>
                  <small>{option.description[locale]}</small>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className={styles.placeholder}>
            <strong>{text.futureLabel}</strong>
            <p>{step.placeholder[locale]}</p>
          </div>
        )}
      </div>

      <footer className={styles.actions}>
        <button className={styles.secondaryButton} disabled={!step.previousStepId} onClick={onBack}>
          {text.back}
        </button>
        <div className={styles.forwardActions}>
          {step.optional && (
            <button className={styles.secondaryButton} onClick={onSkip}>
              {text.skip}
            </button>
          )}
          <button className={styles.primaryButton} disabled={continueDisabled} onClick={onContinue}>
            {text.continue}
          </button>
        </div>
        <button className={styles.restartButton} onClick={onRestart}>
          {text.restart}
        </button>
      </footer>
    </>
  );
}
