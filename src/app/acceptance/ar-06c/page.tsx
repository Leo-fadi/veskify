import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

const enabled =
  process.env.NODE_ENV === "development" &&
  process.env.VESKIFY_RUNTIME_MODE === "standalone" &&
  process.env.VESKIFY_AR06C_ACCEPTANCE === "1";

export const metadata = { robots: { index: false, follow: false } };

export default async function Ar06cAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string; locale?: string }>;
}) {
  if (!enabled) notFound();
  noStore();
  const query = await searchParams;
  if (Object.keys(query).some((key) => key !== "case" && key !== "locale")) notFound();
  const layout = query.case === "offset" || query.case === "stack" ? query.case : undefined;
  const locale =
    query.locale === "fi" ? "fi" : query.locale === "en" || !query.locale ? "en" : undefined;
  if (!layout || !locale) notFound();
  if (process.env.NODE_ENV === "development") {
    const { Ar06cComposedDraftProof } =
      await import("@/integrations/puck/ar-06c-composed-draft-proof");
    return <Ar06cComposedDraftProof layout={layout} locale={locale} />;
  }
  notFound();
}
