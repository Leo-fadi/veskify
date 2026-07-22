import { AppShell, Button, Card, Notice } from "@/components/ui";
import { AURUM_NORDIC_PROJECT_ID } from "@/data/seed/identifiers";

const projectId = AURUM_NORDIC_PROJECT_ID;

const journeyCards = [
  {
    href: "/projects/new",
    label: "Set up a storefront",
    description: "Describe your business, brand direction, pages, languages and catalogue plan.",
  },
  {
    href: `/projects/${projectId}/editor`,
    label: "Continue editing storefront",
    description: "Open the Aurum Nordic storefront workspace and continue shaping its draft.",
  },
  {
    href: `/projects/${projectId}`,
    label: "Preview storefront",
    description: "Review the current draft storefront before you save or publish changes.",
  },
] as const;

export default function HomePage() {
  return (
    <AppShell showModuleNav={false}>
      <main aria-labelledby="storefront-studio-heading" className="mx-auto grid max-w-6xl gap-8">
        <section className="grid gap-4 rounded-xl border border-[var(--vesko-app-border)] bg-[var(--vesko-app-surface)] p-6 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--vesko-green-800)]">
            Vesko Storefront Studio
          </p>
          <h1
            className="max-w-3xl text-4xl font-semibold tracking-tight text-[var(--vesko-app-text)] sm:text-5xl"
            id="storefront-studio-heading"
          >
            Shape a storefront you are proud to share.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-[var(--vesko-app-muted)]">
            Use guided setup, the visual editor and the AI design assistant to create a considered
            storefront. Your draft stays separate from the published storefront until you choose to
            publish.
          </p>
          <div>
            <Button href="/projects/new">Start storefront setup</Button>
          </div>
        </section>

        <section aria-labelledby="studio-journeys-heading" className="grid gap-5">
          <div>
            <h2
              className="text-2xl font-semibold text-[var(--vesko-app-text)]"
              id="studio-journeys-heading"
            >
              Storefront Studio
            </h2>
            <p className="mt-2 max-w-2xl text-[var(--vesko-app-muted)]">
              Choose where you want to continue.
            </p>
          </div>
          <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
            {journeyCards.map((journey) => (
              <li key={journey.href}>
                <Card className="flex h-full flex-col p-6">
                  <h3 className="text-xl font-semibold text-[var(--vesko-app-text)]">
                    {journey.label}
                  </h3>
                  <p className="mt-3 flex-1 leading-7 text-[var(--vesko-app-muted)]">
                    {journey.description}
                  </p>
                  <Button className="mt-6" href={journey.href} variant="secondary">
                    {journey.label}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <Notice>
          Draft work is saved separately from the published storefront. Preview, save draft and
          publish are always separate actions.
        </Notice>
      </main>
    </AppShell>
  );
}
