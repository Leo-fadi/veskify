"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { resolveLocalizedText, type Locale } from "@/domain/shared";
import { proposalChangeDetails, proposalDetailsHeading } from "./proposal-change-details";
import type { DesignAgentSessionController } from "./use-design-agent-session";
import styles from "./design-agent-panel.module.css";

export const designAgentExamplePrompts = [
  "Make the homepage feel more luxurious.",
  "Make the layout more minimal.",
  "Add a campaign section.",
  "Tee etusivusta ylellisempi.",
  "Tee ulkoasusta pelkistetympi.",
  "Lisää kampanjaosio.",
] as const;

const copy = {
  en: {
    eyebrow: "Design assistant",
    heading: "What would you like to change?",
    intro: "Describe the result you want, then review it on the canvas before applying it.",
    currentPage: "Current page",
    selectedSection: "Selected section",
    noSection: "No section selected — this request will use the page context.",
    request: "Your request",
    create: "Create proposal",
    examples: "Try an example",
    clarification: "Your answer",
    continue: "Continue",
    cancel: "Cancel",
    ready: "Proposal ready",
    preview: "This is only a preview. Your editor page has not changed.",
    affected: "Affected scope",
    pageScope: "This page",
    assumptions: "Assumptions",
    noAssumptions: "No additional assumptions.",
    accept: "Accept and apply",
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
    create: "Luo ehdotus",
    examples: "Kokeile esimerkkiä",
    clarification: "Vastauksesi",
    continue: "Jatka",
    cancel: "Peruuta",
    ready: "Ehdotus valmis",
    preview: "Tämä on vain esikatselu. Muokkaussivu ei ole vielä muuttunut.",
    affected: "Muutoksen laajuus",
    pageScope: "Tämä sivu",
    assumptions: "Oletukset",
    noAssumptions: "Ei lisäoletuksia.",
    accept: "Hyväksy ja käytä",
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
  const clarificationRef = useRef<HTMLTextAreaElement>(null);
  const proposalHeadingRef = useRef<HTMLHeadingElement>(null);
  const busy = ["classifying", "planning", "generating", "revising"].includes(
    controller.visibleState,
  );
  const needsClarification = controller.session?.state === "needsClarification";

  useEffect(() => {
    if (needsClarification) clarificationRef.current?.focus();
  }, [needsClarification]);

  useEffect(() => {
    if (controller.previewActive) proposalHeadingRef.current?.focus();
  }, [controller.previewActive, controller.proposal?.id]);

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

  const proposal = controller.proposal;
  const session = controller.session;
  const changeDetails = proposal
    ? proposalChangeDetails(proposal, locale, primaryLocale)
    : { items: [], representedOperationIndexes: [], complete: false };
  const scope = session?.plan
    ? session.plan.affectedSectionIds.length > 0
      ? `${pageTitle} · ${session.plan.affectedSectionIds.length} ${
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
          disabled={controller.controlsDisabled || controller.previewActive || needsClarification}
          id="design-request"
          onChange={(event) => controller.setRequest(event.target.value)}
          placeholder={designAgentExamplePrompts[0]}
          required
          rows={4}
          value={controller.request}
        />
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
          {designAgentExamplePrompts.map((prompt) => (
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
        aria-live={controller.visibleState === "failed" ? "assertive" : "polite"}
        className={styles.status}
        role={controller.visibleState === "failed" ? "alert" : "status"}
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
          <p className={styles.eyebrow}>{text.ready}</p>
          <h3 ref={proposalHeadingRef} tabIndex={-1}>
            {resolveLocalizedText(proposal.summary, locale, primaryLocale)}
          </h3>
          <p className={styles.previewNotice}>{text.preview}</p>
          <div>
            <strong>{text.affected}</strong>
            <p>{scope}</p>
          </div>
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
          <p className={styles.boundary}>{text.unsaved}</p>
          <div className={styles.actions}>
            <button
              disabled={controller.controlsDisabled || !changeDetails.complete}
              onClick={controller.acceptProposal}
              type="button"
            >
              {text.accept}
            </button>
            <button
              disabled={controller.controlsDisabled}
              onClick={controller.regenerateProposal}
              type="button"
            >
              {text.regenerate}
            </button>
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
        </section>
      ) : null}

      {session && ["accepted", "rejected", "cancelled", "failed"].includes(session.state) ? (
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
