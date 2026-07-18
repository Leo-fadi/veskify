"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OnboardingBusinessBasicsValidationError,
  OnboardingExistingSourcesValidationError,
  OnboardingMutationQueue,
  OnboardingService,
  OnboardingTransitionError,
} from "@/application/onboarding";
import {
  businessBasicsFieldIds,
  type BusinessBasicsField,
  getOnboardingStep,
  onboardingStepRegistry,
  type OnboardingCreationPath,
  type OnboardingSession,
} from "@/domain/onboarding";
import {
  storefrontIndustryValues,
  type BusinessIdentity,
  type StorefrontIndustry,
} from "@/domain/design-brief";
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

const businessBasicsText = {
  en: {
    summary: "Check the highlighted fields before continuing.",
    businessName: {
      label: "Business name",
      description: "The name customers should see for your business.",
      placeholder: "For example, Aurum Nordic",
      required: "Enter your business name.",
    },
    shortDescription: {
      label: "Short business description",
      description: "A few sentences about what you offer and what makes your business useful.",
      placeholder:
        "For example, a Helsinki studio creating considered jewellery for everyday wear.",
      required: "Add a short description of your business.",
      length: (count: number) => `${count}/2000 characters`,
    },
    industry: {
      label: "Industry",
      description: "Choose the closest match so we can use the right storefront examples.",
      placeholder: "Choose an industry",
      required: "Choose an industry.",
    },
    targetCustomer: {
      label: "Target customer",
      description: "Describe the people you most want to reach.",
      placeholder: "For example, customers looking for lasting Nordic jewellery.",
      required: "Describe your target customer.",
    },
    primaryMarket: {
      label: "Primary market",
      description: "Where do you mainly sell or serve customers?",
      placeholder: "For example, Finland",
      required: "Add your primary market.",
    },
    industryLabels: {
      jewellery: "Jewellery",
      watches: "Watches",
      fashion: "Fashion",
      beauty: "Beauty",
      home: "Home and living",
      food: "Food and drink",
      services: "Services",
      electronics: "Electronics",
      sports: "Sports and wellbeing",
      health: "Health",
      other: "Other",
    } satisfies Record<StorefrontIndustry, string>,
  },
  fi: {
    summary: "Tarkista korostetut kentät ennen jatkamista.",
    businessName: {
      label: "Yrityksen nimi",
      description: "Nimi, jonka asiakkaat näkevät yrityksestäsi.",
      placeholder: "Esimerkiksi Aurum Nordic",
      required: "Anna yrityksesi nimi.",
    },
    shortDescription: {
      label: "Lyhyt kuvaus yrityksestä",
      description: "Muutama lause siitä, mitä tarjoat ja mikä tekee yrityksestäsi hyödyllisen.",
      placeholder: "Esimerkiksi helsinkiläinen studio, joka valmistaa harkittuja koruja arkeen.",
      required: "Lisää lyhyt kuvaus yrityksestäsi.",
      length: (count: number) => `${count}/2000 merkkiä`,
    },
    industry: {
      label: "Toimiala",
      description:
        "Valitse lähin vaihtoehto, jotta voimme käyttää sopivia verkkokauppaesimerkkejä.",
      placeholder: "Valitse toimiala",
      required: "Valitse toimiala.",
    },
    targetCustomer: {
      label: "Kohdeasiakas",
      description: "Kuvaile ihmiset, jotka haluat erityisesti tavoittaa.",
      placeholder: "Esimerkiksi kestävistä pohjoismaisista koruista kiinnostuneet asiakkaat.",
      required: "Kuvaile kohdeasiakkaasi.",
    },
    primaryMarket: {
      label: "Päämarkkina",
      description: "Missä myyt tai palvelet asiakkaita pääasiassa?",
      placeholder: "Esimerkiksi Suomi",
      required: "Anna päämarkkinasi.",
    },
    industryLabels: {
      jewellery: "Korut",
      watches: "Kellot",
      fashion: "Muoti",
      beauty: "Kauneus",
      home: "Koti ja asuminen",
      food: "Ruoka ja juoma",
      services: "Palvelut",
      electronics: "Elektroniikka",
      sports: "Urheilu ja hyvinvointi",
      health: "Terveys",
      other: "Muu",
    } satisfies Record<StorefrontIndustry, string>,
  },
} as const;

const existingSourcesText = {
  en: {
    url: {
      label: "Current storefront address",
      description:
        "Add the secure website address you want us to use as a reference for this redesign. We will not fetch it yet.",
      placeholder: "For example, aurum.example",
      required: "Enter your current storefront address.",
      invalid: "Enter a complete secure website address, such as https://aurum.example.",
      insecure: "Use a secure HTTPS address.",
      unsupported: "Use a website address, not a file, data or other unsupported link.",
    },
    summary: "Check the storefront address before continuing.",
    newStorefront: "No existing storefront is needed for a new store. Continue when you are ready.",
    demoStorefront:
      "The demo uses controlled sample content, so you do not need to provide an existing storefront.",
  },
  fi: {
    url: {
      label: "Nykyisen verkkokaupan osoite",
      description:
        "Lisää uudistettavan verkkokaupan turvallinen verkko-osoite. Emme vielä hae sivustoa.",
      placeholder: "Esimerkiksi aurum.example",
      required: "Anna nykyisen verkkokauppasi osoite.",
      invalid: "Anna täydellinen turvallinen verkko-osoite, kuten https://aurum.example.",
      insecure: "Käytä turvallista HTTPS-osoitetta.",
      unsupported:
        "Käytä verkkosivun osoitetta, älä tiedosto-, data- tai muuta tukematonta linkkiä.",
    },
    summary: "Tarkista verkkokaupan osoite ennen jatkamista.",
    newStorefront:
      "Uudelle kaupalle ei tarvita olemassa olevaa verkkokauppaa. Jatka, kun olet valmis.",
    demoStorefront:
      "Demo käyttää hallittua esimerkkisisältöä, joten olemassa olevaa verkkokauppaa ei tarvita.",
  },
} as const;

type ExistingSourcesField = "existingStorefrontUrl";

export function OnboardingWizard() {
  const [locale, setLocale] = useState<Locale>("en");
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [message, setMessage] = useState("");
  const [businessDraft, setBusinessDraft] = useState<BusinessIdentity | null>(null);
  const [businessErrors, setBusinessErrors] = useState<
    Partial<Record<BusinessBasicsField, string>>
  >({});
  const [existingSourceDraft, setExistingSourceDraft] = useState<string | null>(null);
  const [existingSourceErrors, setExistingSourceErrors] = useState<
    Partial<Record<ExistingSourcesField, string>>
  >({});
  const [restartOpen, setRestartOpen] = useState(false);
  const sessionRef = useRef<OnboardingSession | null>(null);
  const mutationQueue = useMemo(() => new OnboardingMutationQueue(), []);
  const repository = useMemo(() => new BrowserOnboardingSessionRepository(), []);
  const service = useMemo(() => new OnboardingService(repository), [repository]);
  const text = copy[locale];

  const applyResumeResult = useCallback(
    (result: Awaited<ReturnType<OnboardingService["resume"]>>) => {
      if (result.status === "new" || result.status === "resumed") {
        sessionRef.current = result.session;
        setBusinessDraft((current) => current ?? result.session.designBrief.businessIdentity);
        setExistingSourceDraft(
          (current) => current ?? result.session.designBrief.creationContext.existingStorefrontUrl,
        );
        setView({ kind: "ready", session: result.session, origin: result.status });
        setMessage("");
        setBusinessErrors({});
        setExistingSourceErrors({});
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
    await mutationQueue.whenIdle();
    mutationQueue.resume();
    setView({ kind: "loading" });
    const result = await service.resume();
    applyResumeResult(result);
  }, [applyResumeResult, mutationQueue, service]);

  useEffect(() => {
    let active = true;
    void service.resume().then((result) => {
      if (active) applyResumeResult(result);
    });
    return () => {
      active = false;
    };
  }, [applyResumeResult, service]);

  const updateSession = (
    action: (session: OnboardingSession) => Promise<OnboardingSession>,
  ): Promise<OnboardingSession | null> =>
    mutationQueue.enqueue(async () => {
      const currentSession = sessionRef.current;
      if (!currentSession) return null;
      try {
        const session = await action(currentSession);
        sessionRef.current = session;
        setView((current) => (current.kind === "ready" ? { ...current, session } : current));
        setBusinessDraft(session.designBrief.businessIdentity);
        setExistingSourceDraft(session.designBrief.creationContext.existingStorefrontUrl);
        setBusinessErrors({});
        setExistingSourceErrors({});
        setMessage("");
        return session;
      } catch (error) {
        if (error instanceof OnboardingStorageError) {
          mutationQueue.pause();
          setView({ kind: "storage-error" });
          return null;
        }
        if (error instanceof OnboardingBusinessBasicsValidationError) {
          const nextErrors = Object.fromEntries(
            error.missingFields.map((field) => [field, businessBasicsText[locale][field].required]),
          ) as Partial<Record<BusinessBasicsField, string>>;
          setBusinessErrors(nextErrors);
          setMessage(businessBasicsText[locale].summary);
          return null;
        }
        if (error instanceof OnboardingExistingSourcesValidationError) {
          const errorMessage =
            error.code === "EXISTING_STOREFRONT_URL_REQUIRED"
              ? existingSourcesText[locale].url.required
              : error.code === "EXISTING_STOREFRONT_URL_INSECURE"
                ? existingSourcesText[locale].url.insecure
                : error.code === "EXISTING_STOREFRONT_URL_UNSUPPORTED_PROTOCOL"
                  ? existingSourcesText[locale].url.unsupported
                  : existingSourcesText[locale].url.invalid;
          setExistingSourceErrors({ existingStorefrontUrl: errorMessage });
          setMessage(existingSourcesText[locale].summary);
          return null;
        }
        if (error instanceof OnboardingTransitionError) {
          setMessage(
            error.code === "CREATION_PATH_REQUIRED"
              ? text.pathRequired
              : error.code === "STEP_NOT_AVAILABLE"
                ? text.notAvailable
                : text.transitionError,
          );
          return null;
        }
        throw error;
      }
    });

  const restart = async () => {
    const session = await mutationQueue.enqueue(async () => {
      try {
        const nextSession = await service.reset();
        sessionRef.current = nextSession;
        setBusinessDraft(nextSession.designBrief.businessIdentity);
        setExistingSourceDraft(nextSession.designBrief.creationContext.existingStorefrontUrl);
        setBusinessErrors({});
        setExistingSourceErrors({});
        setView({ kind: "ready", session: nextSession, origin: "new" });
        return nextSession;
      } catch (error) {
        if (error instanceof OnboardingStorageError) {
          mutationQueue.pause();
          setView({ kind: "storage-error" });
          return null;
        }
        throw error;
      }
    });
    if (session !== null) {
      setRestartOpen(false);
      setMessage(text.newStatus);
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
            businessDraft={businessDraft ?? view.session.designBrief.businessIdentity}
            businessErrors={businessErrors}
            existingSourceDraft={
              existingSourceDraft ??
              view.session.designBrief.creationContext.existingStorefrontUrl ??
              ""
            }
            existingSourceErrors={existingSourceErrors}
            message={message || (view.origin === "new" ? text.newStatus : text.resumedStatus)}
            onBusinessDraftChange={setBusinessDraft}
            onBusinessField={(field, value) =>
              updateSession((session) => service.updateBusinessIdentityField(session, field, value))
            }
            onBusinessComplete={(draft) =>
              updateSession((session) => service.completeBusinessBasics(session, draft))
            }
            onExistingSourceDraftChange={setExistingSourceDraft}
            onExistingSourceField={(value) =>
              updateSession((session) => service.updateExistingStorefrontUrl(session, value))
            }
            onExistingSourcesComplete={(value) =>
              updateSession((session) => service.completeExistingSources(session, value))
            }
            onExistingSourcesSkip={() =>
              void updateSession((session) => service.skipExistingSources(session))
            }
            onBack={() => void updateSession((session) => service.goBack(session))}
            onContinue={() => void updateSession((session) => service.advance(session))}
            onPath={(path) =>
              void updateSession((session) => service.selectCreationPath(session, path))
            }
            onRestart={() => setRestartOpen(true)}
            onSkip={() => void updateSession((session) => service.skip(session))}
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
  businessDraft,
  businessErrors,
  existingSourceDraft,
  existingSourceErrors,
  locale,
  message,
  onBusinessDraftChange,
  onBusinessComplete,
  onBusinessField,
  onExistingSourceDraftChange,
  onExistingSourceField,
  onExistingSourcesComplete,
  onExistingSourcesSkip,
  onBack,
  onContinue,
  onPath,
  onRestart,
  onSkip,
  service,
  session,
}: {
  businessDraft: BusinessIdentity;
  businessErrors: Partial<Record<BusinessBasicsField, string>>;
  existingSourceDraft: string;
  existingSourceErrors: Partial<Record<ExistingSourcesField, string>>;
  locale: Locale;
  message: string;
  onBusinessDraftChange: (draft: BusinessIdentity) => void;
  onBusinessComplete: (
    draft: Partial<Pick<BusinessIdentity, BusinessBasicsField>>,
  ) => Promise<OnboardingSession | null>;
  onBusinessField: <Field extends BusinessBasicsField>(
    field: Field,
    value: BusinessIdentity[Field],
  ) => Promise<OnboardingSession | null>;
  onExistingSourceDraftChange: (value: string) => void;
  onExistingSourceField: (value: string) => Promise<OnboardingSession | null>;
  onExistingSourcesComplete: (value: string) => Promise<OnboardingSession | null>;
  onExistingSourcesSkip: () => void;
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
        ) : step.id === "business-basics" ? (
          <BusinessBasicsForm
            draft={businessDraft}
            errors={businessErrors}
            locale={locale}
            onComplete={onBusinessComplete}
            onDraftChange={onBusinessDraftChange}
            onField={onBusinessField}
          />
        ) : step.id === "existing-sources" ? (
          <ExistingSourcesStep
            draft={existingSourceDraft}
            errors={existingSourceErrors}
            locale={locale}
            onComplete={onExistingSourcesComplete}
            onDraftChange={onExistingSourceDraftChange}
            onField={onExistingSourceField}
            sourceType={session.designBrief.creationContext.type}
          />
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
            <button
              className={styles.secondaryButton}
              onClick={step.id === "existing-sources" ? onExistingSourcesSkip : onSkip}
            >
              {text.skip}
            </button>
          )}
          <button
            className={styles.primaryButton}
            disabled={continueDisabled}
            form={
              step.id === "business-basics"
                ? "business-basics-form"
                : step.id === "existing-sources" &&
                    session.designBrief.creationContext.type === "redesign-existing-storefront"
                  ? "existing-sources-form"
                  : undefined
            }
            onClick={
              step.id === "business-basics" ||
              (step.id === "existing-sources" &&
                session.designBrief.creationContext.type === "redesign-existing-storefront")
                ? undefined
                : onContinue
            }
            type={
              step.id === "business-basics" ||
              (step.id === "existing-sources" &&
                session.designBrief.creationContext.type === "redesign-existing-storefront")
                ? "submit"
                : "button"
            }
          >
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

function BusinessBasicsForm({
  draft,
  errors,
  locale,
  onComplete,
  onDraftChange,
  onField,
}: {
  draft: BusinessIdentity;
  errors: Partial<Record<BusinessBasicsField, string>>;
  locale: Locale;
  onComplete: (
    draft: Partial<Pick<BusinessIdentity, BusinessBasicsField>>,
  ) => Promise<OnboardingSession | null>;
  onDraftChange: (draft: BusinessIdentity) => void;
  onField: <Field extends BusinessBasicsField>(
    field: Field,
    value: BusinessIdentity[Field],
  ) => Promise<OnboardingSession | null>;
}) {
  const text = businessBasicsText[locale];
  const [localDraft, setLocalDraft] = useState(draft);
  const fieldRefs = useRef<
    Partial<
      Record<BusinessBasicsField, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>
    >
  >({});

  useEffect(() => {
    const firstInvalidField = businessBasicsFieldIds.find((field) => errors[field]);
    if (firstInvalidField) fieldRefs.current[firstInvalidField]?.focus();
  }, [errors]);

  const updateField = <Field extends BusinessBasicsField>(
    field: Field,
    value: BusinessIdentity[Field],
  ) => {
    const nextDraft = { ...localDraft, [field]: value };
    setLocalDraft(nextDraft);
    onDraftChange(nextDraft);
  };

  const persistField = <Field extends BusinessBasicsField>(
    field: Field,
    value: BusinessIdentity[Field],
  ) => {
    void onField(field, value);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onComplete({
      businessName: localDraft.businessName,
      shortDescription: localDraft.shortDescription,
      industry: localDraft.industry,
      targetCustomer: localDraft.targetCustomer,
      primaryMarket: localDraft.primaryMarket,
    });
  };

  const inputDescription = (field: BusinessBasicsField) =>
    `${field}-description${errors[field] ? ` ${field}-error` : ""}`;

  return (
    <form
      className={styles.businessForm}
      id="business-basics-form"
      onSubmit={(event) => {
        submit(event);
      }}
    >
      {Object.keys(errors).length > 0 && (
        <div aria-live="assertive" className={styles.validationSummary} role="alert">
          <strong>{text.summary}</strong>
          <ul>
            {businessBasicsFieldIds
              .filter((field) => errors[field])
              .map((field) => (
                <li key={field}>{errors[field]}</li>
              ))}
          </ul>
        </div>
      )}

      <div className={styles.formField}>
        <label htmlFor="business-name">{text.businessName.label}</label>
        <p id="businessName-description">{text.businessName.description}</p>
        <input
          aria-describedby={inputDescription("businessName")}
          aria-invalid={Boolean(errors.businessName)}
          id="business-name"
          maxLength={120}
          onChange={(event) => updateField("businessName", event.target.value)}
          onBlur={(event) => persistField("businessName", event.target.value)}
          placeholder={text.businessName.placeholder}
          ref={(element) => {
            fieldRefs.current.businessName = element;
          }}
          type="text"
          value={localDraft.businessName}
        />
        {errors.businessName && (
          <span className={styles.fieldError} id="businessName-error">
            {errors.businessName}
          </span>
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor="business-description">{text.shortDescription.label}</label>
        <p id="shortDescription-description">{text.shortDescription.description}</p>
        <textarea
          aria-describedby={inputDescription("shortDescription")}
          aria-invalid={Boolean(errors.shortDescription)}
          id="business-description"
          maxLength={2_000}
          onChange={(event) => updateField("shortDescription", event.target.value)}
          onBlur={(event) => persistField("shortDescription", event.target.value)}
          placeholder={text.shortDescription.placeholder}
          ref={(element) => {
            fieldRefs.current.shortDescription = element;
          }}
          rows={5}
          value={localDraft.shortDescription}
        />
        <span className={styles.lengthHint}>
          {text.shortDescription.length(localDraft.shortDescription.length)}
        </span>
        {errors.shortDescription && (
          <span className={styles.fieldError} id="shortDescription-error">
            {errors.shortDescription}
          </span>
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor="business-industry">{text.industry.label}</label>
        <p id="industry-description">{text.industry.description}</p>
        <select
          aria-describedby={inputDescription("industry")}
          aria-invalid={Boolean(errors.industry)}
          id="business-industry"
          onChange={(event) =>
            updateField(
              "industry",
              event.target.value === "" ? null : (event.target.value as StorefrontIndustry),
            )
          }
          onBlur={(event) =>
            persistField(
              "industry",
              event.target.value === "" ? null : (event.target.value as StorefrontIndustry),
            )
          }
          ref={(element) => {
            fieldRefs.current.industry = element;
          }}
          value={localDraft.industry ?? ""}
        >
          <option value="">{text.industry.placeholder}</option>
          {storefrontIndustryValues.map((industry) => (
            <option key={industry} value={industry}>
              {text.industryLabels[industry]}
            </option>
          ))}
        </select>
        {errors.industry && (
          <span className={styles.fieldError} id="industry-error">
            {errors.industry}
          </span>
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor="target-customer">{text.targetCustomer.label}</label>
        <p id="targetCustomer-description">{text.targetCustomer.description}</p>
        <textarea
          aria-describedby={inputDescription("targetCustomer")}
          aria-invalid={Boolean(errors.targetCustomer)}
          id="target-customer"
          maxLength={500}
          onChange={(event) => updateField("targetCustomer", event.target.value)}
          onBlur={(event) => persistField("targetCustomer", event.target.value)}
          placeholder={text.targetCustomer.placeholder}
          ref={(element) => {
            fieldRefs.current.targetCustomer = element;
          }}
          rows={3}
          value={localDraft.targetCustomer}
        />
        {errors.targetCustomer && (
          <span className={styles.fieldError} id="targetCustomer-error">
            {errors.targetCustomer}
          </span>
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor="primary-market">{text.primaryMarket.label}</label>
        <p id="primaryMarket-description">{text.primaryMarket.description}</p>
        <input
          aria-describedby={inputDescription("primaryMarket")}
          aria-invalid={Boolean(errors.primaryMarket)}
          id="primary-market"
          maxLength={120}
          onChange={(event) => updateField("primaryMarket", event.target.value)}
          onBlur={(event) => persistField("primaryMarket", event.target.value)}
          placeholder={text.primaryMarket.placeholder}
          ref={(element) => {
            fieldRefs.current.primaryMarket = element;
          }}
          type="text"
          value={localDraft.primaryMarket}
        />
        {errors.primaryMarket && (
          <span className={styles.fieldError} id="primaryMarket-error">
            {errors.primaryMarket}
          </span>
        )}
      </div>
    </form>
  );
}

function ExistingSourcesStep({
  draft,
  errors,
  locale,
  onComplete,
  onDraftChange,
  onField,
  sourceType,
}: {
  draft: string;
  errors: Partial<Record<ExistingSourcesField, string>>;
  locale: Locale;
  onComplete: (value: string) => Promise<OnboardingSession | null>;
  onDraftChange: (value: string) => void;
  onField: (value: string) => Promise<OnboardingSession | null>;
  sourceType: OnboardingSession["designBrief"]["creationContext"]["type"];
}) {
  if (sourceType !== "redesign-existing-storefront") {
    return (
      <div className={styles.placeholder}>
        <strong>
          {sourceType === "demo-storefront"
            ? existingSourcesText[locale].demoStorefront
            : existingSourcesText[locale].newStorefront}
        </strong>
      </div>
    );
  }

  return (
    <ExistingSourcesForm
      draft={draft}
      errors={errors}
      locale={locale}
      onComplete={onComplete}
      onDraftChange={onDraftChange}
      onField={onField}
    />
  );
}

function ExistingSourcesForm({
  draft,
  errors,
  locale,
  onComplete,
  onDraftChange,
  onField,
}: {
  draft: string;
  errors: Partial<Record<ExistingSourcesField, string>>;
  locale: Locale;
  onComplete: (value: string) => Promise<OnboardingSession | null>;
  onDraftChange: (value: string) => void;
  onField: (value: string) => Promise<OnboardingSession | null>;
}) {
  const text = existingSourcesText[locale];
  const fieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const firstInvalidField = errors.existingStorefrontUrl;
    if (firstInvalidField) fieldRef.current?.focus();
  }, [errors]);

  const updateDraft = (value: string) => {
    onDraftChange(value);
  };

  return (
    <form
      className={styles.businessForm}
      id="existing-sources-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void onComplete(draft);
      }}
    >
      {errors.existingStorefrontUrl && (
        <div aria-live="assertive" className={styles.validationSummary} role="alert">
          <strong>{text.summary}</strong>
          <ul>
            <li>{errors.existingStorefrontUrl}</li>
          </ul>
        </div>
      )}

      <div className={styles.formField}>
        <label htmlFor="existing-storefront-url">{text.url.label}</label>
        <p id="existingStorefrontUrl-description">{text.url.description}</p>
        <input
          aria-describedby={`existingStorefrontUrl-description${errors.existingStorefrontUrl ? " existingStorefrontUrl-error" : ""}`}
          aria-invalid={Boolean(errors.existingStorefrontUrl)}
          autoComplete="url"
          id="existing-storefront-url"
          inputMode="url"
          onBlur={(event) => {
            void onField(event.currentTarget.value);
          }}
          onChange={(event) => updateDraft(event.target.value)}
          placeholder={text.url.placeholder}
          ref={fieldRef}
          type="url"
          value={draft}
        />
        {errors.existingStorefrontUrl && (
          <span className={styles.fieldError} id="existingStorefrontUrl-error">
            {errors.existingStorefrontUrl}
          </span>
        )}
      </div>
    </form>
  );
}
