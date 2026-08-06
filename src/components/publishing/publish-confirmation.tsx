import Link from "next/link";
import type { PublicPublishPreparation } from "@/application/publishing";
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
  cancelHref,
}: {
  preparation: PublicPublishPreparation;
  locale: Locale;
  primaryLocale: Locale;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  cancelHref: string;
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
        {confirming ? (
          <button disabled type="button">
            {text.cancel}
          </button>
        ) : (
          <Link href={cancelHref} onClick={onCancel}>
            {text.cancel}
          </Link>
        )}
      </div>
    </section>
  );
}
