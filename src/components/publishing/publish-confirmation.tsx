import type { PublishPreparation } from "@/application/publishing";
import type { Locale } from "@/domain/shared";
import { PublishChangeSummary } from "./publish-change-summary";
import { publishingCopy } from "./publish-status";

export function PublishConfirmation({
  preparation,
  locale,
  primaryLocale,
  confirming,
  onConfirm,
  onCancel,
}: {
  preparation: PublishPreparation;
  locale: Locale;
  primaryLocale: Locale;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const text = publishingCopy(locale);
  return (
    <section aria-labelledby="publish-confirmation" className="publish-confirmation">
      <div className="publish-confirmation__intro">
        <h2 id="publish-confirmation">{text.confirmationTitle}</h2>
        <p>{text.confirmationPublishedUntil}</p>
      </div>
      <PublishChangeSummary
        locale={locale}
        primaryLocale={primaryLocale}
        summary={preparation.changeSummary}
      />
      <p className="publish-confirmation__warning">{text.confirmationWarning}</p>
      <div className="publish-confirmation__actions">
        <button disabled={confirming} onClick={onConfirm} type="button">
          {confirming ? text.publishing : text.publishStorefront}
        </button>
        <button disabled={confirming} onClick={onCancel} type="button">
          {text.cancel}
        </button>
      </div>
    </section>
  );
}
