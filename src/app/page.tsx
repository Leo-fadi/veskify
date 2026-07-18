import Link from "next/link";
import { AURUM_NORDIC_PROJECT_ID } from "@/data/seed/identifiers";

const journeyCards = [
  {
    href: "/projects/new",
    label: "Start storefront setup",
    description:
      "Begin guided storefront setup. Your onboarding draft is saved locally and can resume automatically.",
  },
  {
    href: `/projects/${AURUM_NORDIC_PROJECT_ID}/editor`,
    label: "Open visual editor",
    description: "Open the controlled visual editor for the Aurum Nordic demo storefront.",
  },
  {
    href: `/projects/${AURUM_NORDIC_PROJECT_ID}`,
    label: "View storefront preview",
    description: "View the current draft preview of the Aurum Nordic demo storefront.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-8 sm:px-10 sm:py-12 lg:px-12 lg:py-16">
      <header className="rounded-[var(--brand-radius)] border border-[var(--brand-color-border)] bg-[var(--brand-color-surface)] p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-color-primary)]">
          Veskify storefront design demo
        </p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold tracking-tight text-[var(--brand-color-text)] sm:text-5xl">
          Veskify storefront design demo
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--brand-color-muted-text)]">
          Create and shape a storefront with confidence. Choose a working flow below to set up a
          storefront, edit the controlled demo visually, or review its current draft.
        </p>
      </header>

      <section aria-labelledby="merchant-journeys">
        <div className="mb-5">
          <h2
            id="merchant-journeys"
            className="text-2xl font-semibold text-[var(--brand-color-text)]"
          >
            Merchant journeys
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--brand-color-muted-text)]">
            These are the main working entry points for the Veskify demo.
          </p>
        </div>
        <ul className="grid list-none gap-5 p-0 md:grid-cols-3">
          {journeyCards.map((journey) => (
            <li
              key={journey.href}
              className="flex flex-col rounded-[var(--brand-radius)] border border-[var(--brand-color-border)] bg-[var(--brand-color-surface)] p-6 shadow-sm"
            >
              <h3 className="text-xl font-semibold text-[var(--brand-color-text)]">
                {journey.label}
              </h3>
              <p className="mt-3 flex-1 leading-7 text-[var(--brand-color-muted-text)]">
                {journey.description}
              </p>
              <Link
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand-color-primary)] px-5 py-3 text-center text-sm font-semibold text-white transition hover:brightness-110"
                href={journey.href}
              >
                {journey.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="developer-tools"
        className="rounded-[var(--brand-radius)] border border-dashed border-[var(--brand-color-border)] bg-[var(--brand-color-surface)] p-6 sm:p-8"
      >
        <h2 id="developer-tools" className="text-xl font-semibold text-[var(--brand-color-text)]">
          Developer tools
        </h2>
        <p className="mt-2 max-w-2xl text-[var(--brand-color-muted-text)]">
          Compatibility proof for contributors working on the isolated Puck integration. This is
          separate from the normal merchant journey.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--brand-color-primary)] px-5 py-3 text-center text-sm font-semibold text-[var(--brand-color-primary)] underline-offset-4 transition hover:bg-[var(--brand-color-background)] hover:underline"
          href="/puck-proof"
        >
          Open isolated Puck proof
        </Link>
      </section>
    </main>
  );
}
