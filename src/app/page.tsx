import Link from "next/link";
import { AURUM_NORDIC_PROJECT_ID } from "@/data/seed/identifiers";

const readinessItems = [
  "Next.js App Router foundation",
  "Strict TypeScript and validation schemas",
  "Accessible shell for Aurum Nordic",
  "Dummy-only commerce boundary",
  "Puck adapter proof route",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-8 sm:px-10 lg:px-12">
      <header className="flex flex-col gap-4 rounded-[var(--brand-radius)] border border-[var(--brand-color-border)] bg-[var(--brand-color-surface)] p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-color-primary)]">
          Veskify foundation
        </p>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-[var(--brand-color-text)] sm:text-5xl">
              Aurum Nordic storefront design demo
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--brand-color-muted-text)]">
              A safe, standalone shell for building a controlled AI storefront design experience
              with English and Finnish content support.
            </p>
          </div>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand-color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            href="#foundation-status"
          >
            Review status
          </a>
        </div>
      </header>

      <section
        aria-labelledby="foundation-status"
        className="rounded-[var(--brand-radius)] border border-[var(--brand-color-border)] bg-[var(--brand-color-surface)] p-6 sm:p-8"
      >
        <h2 id="foundation-status" className="text-2xl font-semibold">
          Batch 1 foundation status
        </h2>
        <p className="mt-3 text-[var(--brand-color-muted-text)]">
          This phase intentionally stops before onboarding, editor, catalogue, publishing, AI, and
          commerce integrations.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {readinessItems.map((item) => (
            <li key={item} className="rounded-xl border border-[var(--brand-color-border)] p-4">
              <span aria-hidden="true" className="mr-2 text-[var(--brand-color-accent)]">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6">
          <Link
            className="font-semibold text-[var(--brand-color-primary)] underline"
            href={`/projects/${AURUM_NORDIC_PROJECT_ID}`}
          >
            Open the Aurum Nordic draft preview
          </Link>
        </p>
        <p className="mt-3">
          <a className="font-semibold text-[var(--brand-color-primary)] underline" href="/puck-proof">
            Open the isolated Puck adapter proof
          </a>
        </p>
      </section>
    </main>
  );
}
