import {
  P10B18D_ACCEPTANCE_CONTEXTS,
  P10B18D_ACCEPTANCE_LOCALE,
  P10B18D_ACCEPTANCE_PROJECT_ID,
} from "./p10b-18d-live-commercial-acceptance";

export type P10B18DCaptureSurface = Readonly<{
  id: "home" | "collection" | "search" | "simple-pdp" | "configurable-pdp" | "about" | "cart";
  path: string;
  query?: Readonly<Record<string, string>>;
}>;

export const p10b18dCaptureSurfaces: readonly P10B18DCaptureSurface[] = [
  { id: "home", path: `/projects/${P10B18D_ACCEPTANCE_PROJECT_ID}` },
  {
    id: "collection",
    path: `/projects/${P10B18D_ACCEPTANCE_PROJECT_ID}/collections/${P10B18D_ACCEPTANCE_CONTEXTS.collection.collectionSlug}`,
  },
  {
    id: "search",
    path: `/projects/${P10B18D_ACCEPTANCE_PROJECT_ID}/search`,
    query: { q: "ring" },
  },
  {
    id: "simple-pdp",
    path: `/projects/${P10B18D_ACCEPTANCE_PROJECT_ID}/products/${P10B18D_ACCEPTANCE_CONTEXTS.simpleProduct.productSlug}`,
  },
  {
    id: "configurable-pdp",
    path: `/projects/${P10B18D_ACCEPTANCE_PROJECT_ID}/products/${P10B18D_ACCEPTANCE_CONTEXTS.configurableProduct.productSlug}`,
  },
  { id: "about", path: `/projects/${P10B18D_ACCEPTANCE_PROJECT_ID}/pages/about` },
  {
    id: "cart",
    path: `/projects/${P10B18D_ACCEPTANCE_PROJECT_ID}/cart`,
    query: { "p10b-16p-04-utility": "populated" },
  },
] as const;

type PreviewUrlInput = Readonly<{
  baseUrl: string;
  surface: P10B18DCaptureSurface;
}> &
  (Readonly<{ kind: "candidate"; candidateFingerprint: string }> | Readonly<{ kind: "raw-draft" }>);

export function buildP10B18DPreviewUrl(input: PreviewUrlInput): string {
  const url = new URL(input.surface.path, input.baseUrl);
  Object.entries(input.surface.query ?? {}).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  if (input.kind === "candidate") {
    const candidateFingerprint = input.candidateFingerprint.trim();
    if (!candidateFingerprint) {
      throw new Error("P10B-18D candidate preview requires an exact proposal fingerprint.");
    }
    url.searchParams.set("p10b-16p-04-proposal", candidateFingerprint);
  }
  url.searchParams.set("locale", P10B18D_ACCEPTANCE_LOCALE);
  return url.toString();
}

export function p10b18dSafePreviewRouteIdentity(value: string): string {
  const url = new URL(value);
  if (url.username || url.password) {
    throw new Error("P10B-18D preview evidence cannot contain URL credentials.");
  }
  for (const key of url.searchParams.keys()) {
    if (/token|credential|secret|api[-_]?key/i.test(key)) {
      throw new Error("P10B-18D preview evidence cannot contain sensitive query authority.");
    }
  }
  return `${url.pathname}${url.search}`;
}

export function assertP10B18DDistinctPageRoles(controlPage: object, evidencePage: object): void {
  if (controlPage === evidencePage) {
    throw new Error("P10B-18D Studio control and evidence capture pages must be distinct.");
  }
}

export async function runP10B18DCandidateEvidenceSequence(input: {
  persistSafeEvidence: () => Promise<void>;
  captureCandidate: () => Promise<void>;
  assertControlContinuity: () => Promise<void>;
  completeTerminalLifecycle: () => Promise<void>;
}): Promise<void> {
  await input.persistSafeEvidence();
  await input.captureCandidate();
  await input.assertControlContinuity();
  await input.completeTerminalLifecycle();
}
