"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { resolveLocalizedText, type Locale } from "@/domain/shared";
import { proposalChangeDetails, proposalDetailsHeading } from "./proposal-change-details";
import type { DesignAgentSessionController } from "./use-design-agent-session";
import styles from "./design-agent-panel.module.css";

export const designAgentExamplePrompts = {
  en: [
    "Make the homepage feel more luxurious.",
    "Make the layout more minimal.",
    "Add a campaign section.",
  ],
  fi: ["Tee etusivusta ylellisempi.", "Tee ulkoasusta pelkistetympi.", "Lisää kampanjaosio."],
} as const;

const copy = {
  en: {
    eyebrow: "Design assistant",
    heading: "What would you like to change?",
    intro: "Describe the result you want, then review it on the canvas before applying it.",
    currentPage: "Current page",
    selectedSection: "Selected section",
    noSection: "No section selected — this request will use the page context.",
    request: "Your request",
    placeholder: "For example: Make the homepage feel more luxurious.",
    keyboardGuidance: "Press Control or Command + Enter to create the proposal.",
    create: "Create proposal",
    examples: "Try an example",
    clarification: "Your answer",
    continue: "Continue",
    cancel: "Cancel",
    ready: "Proposal ready",
    applyFailed: "Proposal needs attention",
    unavailable: "Proposal unavailable",
    preview: "This is only a preview. Your editor page has not changed.",
    affectedPage: "Affected page",
    affected: "Affected scope",
    pageScope: "This page",
    operationCount: "Planned changes",
    warnings: "Warnings and diagnostics",
    noWarnings: "No warnings for this validated proposal.",
    assumptions: "Assumptions",
    noAssumptions: "No additional assumptions.",
    accept: "Accept and apply",
    accepting: "Applying proposal…",
    retryAccept: "Try applying again",
    retryGuidance:
      "Review the current storefront, then try again or reject this proposal. No changes were applied.",
    unavailableGuidance:
      "Try the request again or continue editing manually. Your current storefront is unchanged.",
    staleGuidance:
      "The storefront changed after this proposal was prepared. Start over to create a current proposal.",
    supersededGuidance: "A newer request replaced this proposal. Start over when you are ready.",
    revision: "How should this proposal change?",
    revise: "Revise",
    regenerate: "Regenerate",
    reject: "Reject",
    startOver: "Start over",
    unsaved: "Accepting adds an unsaved editor change. It does not save or publish it.",
  },
  fi: {
    eyebrow: "Suunnitteluavustaja",
    heading: "Mitä haluaisit muuttaa?",
    intro: "Kuvaile toivottu lopputulos ja tarkista se sivulla ennen hyväksymistä.",
    currentPage: "Nykyinen sivu",
    selectedSection: "Valittu osio",
    noSection: "Osiota ei ole valittu — pyyntö käyttää koko sivun kontekstia.",
    request: "Pyyntösi",
    placeholder: "Esimerkiksi: Tee etusivusta ylellisempi.",
    keyboardGuidance: "Luo ehdotus painamalla Control tai Command + Enter.",
    create: "Luo ehdotus",
    examples: "Kokeile esimerkkiä",
    clarification: "Vastauksesi",
    continue: "Jatka",
    cancel: "Peruuta",
    ready: "Ehdotus valmis",
    applyFailed: "Ehdotus vaatii huomiota",
    unavailable: "Ehdotusta ei voitu luoda",
    preview: "Tämä on vain esikatselu. Muokkaussivu ei ole vielä muuttunut.",
    affectedPage: "Kohdesivu",
    affected: "Muutoksen laajuus",
    pageScope: "Tämä sivu",
    operationCount: "Suunnitellut muutokset",
    warnings: "Varoitukset ja diagnostiikka",
    noWarnings: "Validoidussa ehdotuksessa ei ole varoituksia.",
    assumptions: "Oletukset",
    noAssumptions: "Ei lisäoletuksia.",
    accept: "Hyväksy ja käytä",
    accepting: "Ehdotusta sovelletaan…",
    retryAccept: "Yritä soveltamista uudelleen",
    retryGuidance:
      "Tarkista nykyinen kauppa ja yritä uudelleen tai hylkää ehdotus. Muutoksia ei tehty.",
    unavailableGuidance:
      "Yritä pyyntöä uudelleen tai jatka muokkaamista käsin. Nykyinen kauppa säilyi ennallaan.",
    staleGuidance:
      "Kauppa muuttui ehdotuksen valmistelun jälkeen. Aloita alusta ja luo ajantasainen ehdotus.",
    supersededGuidance: "Uudempi pyyntö korvasi tämän ehdotuksen. Aloita alusta, kun olet valmis.",
    revision: "Miten ehdotusta pitäisi muuttaa?",
    revise: "Muokkaa ehdotusta",
    regenerate: "Luo uudelleen",
    reject: "Hylkää",
    startOver: "Aloita alusta",
    unsaved: "Hyväksyminen lisää tallentamattoman muutoksen. Se ei tallenna tai julkaise.",
  },
} as const;

export function DesignAgentPanel({
  controller,
  locale,
  primaryLocale,
  pageTitle,
  selectedSectionLabel,
}: {
  controller: DesignAgentSessionController;
  locale: Locale;
  primaryLocale: Locale;
  pageTitle: string;
  selectedSectionLabel?: string;
}) {
  const text = copy[locale];
  const requestRef = useRef<HTMLTextAreaElement>(null);
  const clarificationRef = useRef<HTMLTextAreaElement>(null);
  const proposalHeadingRef = useRef<HTMLHeadingElement>(null);
  const busy = ["generating", "revising", "accepting"].includes(controller.visibleState);
  const needsClarification = controller.session?.state === "needsClarification";

  useEffect(() => {
    if (needsClarification) clarificationRef.current?.focus();
  }, [needsClarification]);

  useEffect(() => {
    if (controller.previewActive) proposalHeadingRef.current?.focus();
  }, [controller.generatedProposal?.proposal.id, controller.previewActive]);

  useEffect(() => {
    if (
      !controller.previewActive &&
      ["failed", "stale", "superseded"].includes(controller.visibleState)
    ) {
      requestRef.current?.focus();
    }
  }, [controller.previewActive, controller.visibleState]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    controller.submitRequest();
  };

  const clarify = (event: FormEvent) => {
    event.preventDefault();
    controller.answerClarification();
  };

  const revise = (event: FormEvent) => {
    event.preventDefault();
    controller.reviseProposal();
  };

  const submitFromKeyboard = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    controller.submitRequest();
  };

  const proposal = controller.generatedProposal?.proposal ?? null;
  const session = controller.session;
  const applicationFailed = session?.state === "failed" && proposal !== null;
  const accepting = session?.state === "accepting";
  const changeDetails = proposal
    ? proposalChangeDetails(proposal, locale, primaryLocale)
    : { items: [], representedOperationIndexes: [], complete: false };
  const scope = session
    ? session.affectedSectionIds.length > 0
      ? `${pageTitle} · ${session.affectedSectionIds.length} ${
          locale === "fi" ? "osiota" : "sections"
        }`
      : pageTitle
    : text.pageScope;

  return (
    <aside
      aria-busy={busy}
      aria-label="Design request"
      className={styles.panel}
      data-agent-state={controller.visibleState}
    >
      <div className={styles.introduction}>
        <p className={styles.eyebrow}>{text.eyebrow}</p>
        <h2>{text.heading}</h2>
        <p>{text.intro}</p>
      </div>

      <dl className={styles.context}>
        <div>
          <dt>{text.currentPage}</dt>
          <dd>{pageTitle}</dd>
        </div>
        <div>
          <dt>{text.selectedSection}</dt>
          <dd>{selectedSectionLabel ?? text.noSection}</dd>
        </div>
      </dl>

      <form className={styles.form} onSubmit={submit}>
        <label htmlFor="design-request">{text.request}</label>
        <textarea
          aria-describedby="design-request-guidance"
          aria-invalid={session?.state === "failed" && !controller.request.trim()}
          disabled={controller.controlsDisabled || controller.previewActive || needsClarification}
          id="design-request"
          onChange={(event) => controller.setRequest(event.target.value)}
          onKeyDown={submitFromKeyboard}
          placeholder={text.placeholder}
          ref={requestRef}
          rows={4}
          value={controller.request}
        />
        <p className={styles.guidance} id="design-request-guidance">
          {text.keyboardGuidance}
        </p>
        <button
          disabled={
            controller.controlsDisabled ||
            controller.previewActive ||
            needsClarification ||
            !controller.request.trim()
          }
          type="submit"
        >
          {text.create}
        </button>
        <div className={styles.examples}>
          <span>{text.examples}</span>
          {designAgentExamplePrompts[locale].map((prompt) => (
            <button
              disabled={
                controller.controlsDisabled || controller.previewActive || needsClarification
              }
              key={prompt}
              onClick={() => controller.setRequest(prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>
      </form>

      <div
        aria-atomic="true"
        aria-live={
          ["failed", "stale", "superseded"].includes(controller.visibleState)
            ? "assertive"
            : "polite"
        }
        className={styles.status}
        role={
          ["failed", "stale", "superseded"].includes(controller.visibleState) ? "alert" : "status"
        }
      >
        {controller.statusMessage}
      </div>

      {needsClarification && session?.clarificationQuestion ? (
        <form className={styles.card} onSubmit={clarify}>
          <h3>{resolveLocalizedText(session.clarificationQuestion, locale, primaryLocale)}</h3>
          <label htmlFor="design-clarification">{text.clarification}</label>
          <textarea
            disabled={controller.controlsDisabled}
            id="design-clarification"
            onChange={(event) => controller.setClarificationAnswer(event.target.value)}
            ref={clarificationRef}
            required
            rows={3}
            value={controller.clarificationAnswer}
          />
          <div className={styles.actions}>
            <button
              disabled={controller.controlsDisabled || !controller.clarificationAnswer.trim()}
              type="submit"
            >
              {text.continue}
            </button>
            <button
              disabled={controller.controlsDisabled}
              onClick={controller.cancelSession}
              type="button"
            >
              {text.cancel}
            </button>
          </div>
        </form>
      ) : null}

      {controller.previewActive && proposal && session ? (
        <section
          aria-label="Design proposal"
          className={styles.card}
          data-proposal-id={proposal.id}
        >
          <p className={styles.eyebrow}>{applicationFailed ? text.applyFailed : text.ready}</p>
          <h3 ref={proposalHeadingRef} tabIndex={-1}>
            {resolveLocalizedText(proposal.summary, locale, primaryLocale)}
          </h3>
          <p className={styles.previewNotice}>{text.preview}</p>
          <dl className={styles.reviewFacts}>
            <div>
              <dt>{text.affectedPage}</dt>
              <dd>{pageTitle}</dd>
            </div>
            <div>
              <dt>{text.affected}</dt>
              <dd>{scope}</dd>
            </div>
            <div>
              <dt>{text.operationCount}</dt>
              <dd>{proposal.operations.length}</dd>
            </div>
          </dl>
          <div>
            <strong>{proposalDetailsHeading[locale]}</strong>
            <ol aria-label={proposalDetailsHeading[locale]} className={styles.changeDetails}>
              {changeDetails.items.map((detail) => (
                <li key={detail.sectionId ?? `page-${proposal.originalPage.id}`}>
                  <strong>{detail.title}</strong>
                  <span>{detail.summary}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <strong>{text.assumptions}</strong>
            {session.assumptions.length > 0 ? (
              <ul>
                {session.assumptions.map((assumption, index) => (
                  <li key={index}>{resolveLocalizedText(assumption, locale, primaryLocale)}</li>
                ))}
              </ul>
            ) : (
              <p>{text.noAssumptions}</p>
            )}
          </div>
          <div>
            <strong>{text.warnings}</strong>
            <p>
              {applicationFailed && session.failure
                ? resolveLocalizedText(session.failure.message, locale, primaryLocale)
                : text.noWarnings}
            </p>
            {applicationFailed ? <p>{text.retryGuidance}</p> : null}
          </div>
          <p className={styles.boundary}>{text.unsaved}</p>
          <div className={styles.actions}>
            <button
              aria-label={
                accepting ? text.accepting : applicationFailed ? text.retryAccept : text.accept
              }
              disabled={controller.controlsDisabled || !changeDetails.complete}
              onClick={controller.acceptProposal}
              type="button"
            >
              {accepting ? text.accepting : applicationFailed ? text.retryAccept : text.accept}
            </button>
            {!applicationFailed ? (
              <button
                disabled={controller.controlsDisabled}
                onClick={controller.regenerateProposal}
                type="button"
              >
                {text.regenerate}
              </button>
            ) : null}
            <button
              disabled={controller.controlsDisabled}
              onClick={controller.rejectProposal}
              type="button"
            >
              {text.reject}
            </button>
            <button
              disabled={controller.controlsDisabled}
              onClick={controller.cancelSession}
              type="button"
            >
              {text.cancel}
            </button>
          </div>
          {!applicationFailed ? (
            <form className={styles.form} onSubmit={revise}>
              <label htmlFor="design-revision">{text.revision}</label>
              <textarea
                disabled={controller.controlsDisabled}
                id="design-revision"
                onChange={(event) => controller.setRevision(event.target.value)}
                required
                rows={3}
                value={controller.revision}
              />
              <button
                disabled={controller.controlsDisabled || !controller.revision.trim()}
                type="submit"
              >
                {text.revise}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {session && ["failed", "stale", "superseded"].includes(session.state) && !proposal ? (
        <section aria-label={text.unavailable} className={styles.card}>
          <h3>{text.unavailable}</h3>
          <p>
            {session.state === "stale"
              ? text.staleGuidance
              : session.state === "superseded"
                ? text.supersededGuidance
                : text.unavailableGuidance}
          </p>
        </section>
      ) : null}

      {session &&
      ["accepted", "rejected", "closed", "failed", "stale", "superseded"].includes(
        session.state,
      ) ? (
        <button
          className={styles.startOver}
          disabled={controller.controlsDisabled}
          onClick={controller.restartSession}
          type="button"
        >
          {text.startOver}
        </button>
      ) : null}
    </aside>
  );
}
