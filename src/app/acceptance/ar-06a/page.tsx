import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

const enabled =
  process.env.NODE_ENV !== "production" &&
  process.env.VESKIFY_RUNTIME_MODE === "standalone" &&
  process.env.VESKIFY_AR06A_ACCEPTANCE === "1";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function Ar06aAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string; locale?: string }>;
}) {
  if (!enabled) notFound();
  noStore();
  const query = await searchParams;
  if (Object.keys(query).some((key) => key !== "case" && key !== "locale")) notFound();
  const layout =
    query.case === "offset"
      ? "offset"
      : query.case === "stack" || !query.case
        ? "stack"
        : undefined;
  const locale =
    query.locale === "fi" ? "fi" : query.locale === "en" || !query.locale ? "en" : undefined;
  if (!layout || !locale) notFound();
  if (process.env.NODE_ENV !== "production") {
    const { Ar06aComposedTemplatePreview } = await import("@/data/demo/ar-06a-composed-template");
    return <Ar06aComposedTemplatePreview layout={layout} locale={locale} />;
  }
  notFound();
}
