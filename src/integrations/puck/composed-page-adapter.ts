import type { Data } from "@puckeditor/core";
import {
  validateComposedStorefrontSnapshot,
  type StorefrontCompositionAuthorityResolver,
} from "@/application/storefront-templates/bind-storefront-composition";
import { compilePageBlueprintComposition } from "@/application/storefront-templates/compile-page-blueprint-composition";
import { getComponentDefinition, validateRegisteredSnapshot } from "@/components/registry";
import {
  createComposedStorefrontPageRenderer,
  type ComposedStorefrontPageRenderer,
} from "@/components/storefront/composed-storefront-page";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import { canonicalStorefrontContentFingerprint } from "@/domain/storefront/canonical-storefront";
import type { Locale } from "@/domain/shared";
import type { ContentSupportFactDocument } from "@/domain/storefront/content-support-facts";
import type { PageFactEvidenceReference } from "@/domain/storefront/page-fact-evidence";

export type ComposedPuckSessionInput = Readonly<{
  snapshot: unknown;
  pageId: string;
  catalogue: CatalogueDisplayModel;
  activeLocale: Locale;
  primaryLocale: Locale;
  enabledLocales: readonly Locale[];
  resolveAuthority: StorefrontCompositionAuthorityResolver;
  evidenceReferences?: readonly PageFactEvidenceReference[];
  contentSupportFactDocuments?: readonly ContentSupportFactDocument[];
}>;

type Item = Readonly<{ type: string; props: Record<string, unknown> }>;
type Identity = Readonly<{
  snapshotId: string;
  projectId: string;
  pageId: string;
  locale: Locale;
  contentFingerprint: string;
  compositionFingerprint: string;
  revision: number;
  epoch: number;
}>;

type IssuedIdentity = Identity & Readonly<{ token: object }>;

function fail(reason: string): never {
  throw new Error(`Composed Puck editor rejected: ${reason}.`);
}

function freeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value as Record<string, unknown>).forEach((entry) => freeze(entry, seen));
  return Object.freeze(value);
}

function frozenCopy<T>(value: T): T {
  return freeze(structuredClone(value));
}

export function composedRegionSlotName(regionId: string): string {
  return `region_${regionId.replace(/[^a-z0-9]+/giu, "_")}`;
}

function localizedValue(value: unknown, locale: Locale, primaryLocale: Locale): string {
  if (!value || typeof value !== "object") return "";
  const text = value as Record<string, unknown>;
  const active = text[locale];
  if (typeof active === "string") return active;
  const primary = text[primaryLocale];
  return typeof primary === "string" ? primary : "";
}

function editableFieldNames(
  component: string,
  content?: Record<string, unknown>,
  activeLocale?: Locale,
  primaryLocale?: Locale,
): readonly string[] {
  return Object.entries(getComponentDefinition(component).editorFields)
    .filter(
      ([, metadata]) =>
        metadata.source === "content" &&
        metadata.localized === true &&
        (metadata.control === "text" || metadata.control === "textarea"),
    )
    .map(([name]) => name)
    .filter((name) => {
      if (!content || !activeLocale || !primaryLocale) return true;
      const value = content[name];
      if (!value || typeof value !== "object") return false;
      const localized = value as Record<string, unknown>;
      return (
        typeof localized[activeLocale] === "string" || typeof localized[primaryLocale] === "string"
      );
    });
}

function legacyProjection(input: unknown) {
  const snapshot = structuredClone(input) as Record<string, unknown>;
  delete snapshot.compositionExtensionVersion;
  if (!Array.isArray(snapshot.pages)) fail("invalid snapshot pages");
  snapshot.pages = snapshot.pages.map((page) => {
    if (!page || typeof page !== "object") fail("invalid snapshot page");
    const { composition: _composition, ...legacy } = page as Record<string, unknown>;
    void _composition;
    return legacy;
  });
  return snapshot;
}

/**
 * One non-persisted, private canonical edit session. Puck data is a narrow transport;
 * every accepted change is rebuilt from the retained aggregate and revalidated.
 */
export function createComposedPuckSession(input: ComposedPuckSessionInput) {
  const pageId = input.pageId;
  const sourceResolver = input.resolveAuthority;
  const retained = Object.freeze({
    catalogue: frozenCopy(input.catalogue),
    activeLocale: input.activeLocale,
    primaryLocale: input.primaryLocale,
    enabledLocales: frozenCopy([...input.enabledLocales]),
    evidenceReferences: input.evidenceReferences
      ? frozenCopy([...input.evidenceReferences])
      : undefined,
    contentSupportFactDocuments: input.contentSupportFactDocuments
      ? frozenCopy([...input.contentSupportFactDocuments])
      : undefined,
  });
  const ownerAuthorities = new Map<string, ReturnType<StorefrontCompositionAuthorityResolver>>();
  const resolver: StorefrontCompositionAuthorityResolver = (request) => {
    if (!("compositionFingerprint" in request.composition)) fail("uncompiled authority request");
    const key = `${request.owner.kind}:${request.owner.id}`;
    const prior = ownerAuthorities.get(key);
    if (prior) return prior;
    const value = sourceResolver(frozenCopy(request));
    if (!value || typeof value !== "object") fail("invalid authority response");
    // Candidate/capacity are caller-owned data and copied; registered definitions/support
    // retain their exact canonical identities and are never recursively frozen here.
    const accepted = Object.freeze({
      candidate: frozenCopy(value.candidate),
      componentDefinitions: value.componentDefinitions,
      support: value.support,
      requiredAssetRoleCapacityEvidence: frozenCopy(value.requiredAssetRoleCapacityEvidence),
    });
    ownerAuthorities.set(key, accepted);
    return accepted;
  };
  let current = validateComposedStorefrontSnapshot(frozenCopy(input.snapshot), resolver);
  let epoch = 0;

  const pageFor = (snapshot: typeof current) => {
    const page = snapshot.pages.find((entry) => entry.id === pageId);
    if (!page || !("composition" in page) || page.composition.owner.kind !== "static-page")
      fail("missing composed static page");
    return page;
  };
  const identityFor = (snapshot: typeof current, identityEpoch = epoch): Identity => {
    const page = pageFor(snapshot);
    return Object.freeze({
      snapshotId: snapshot.id,
      projectId: snapshot.projectId,
      pageId: page.id,
      locale: retained.activeLocale,
      contentFingerprint: canonicalStorefrontContentFingerprint(snapshot),
      compositionFingerprint: page.composition.compositionFingerprint,
      revision: snapshot.revision,
      epoch: identityEpoch,
    });
  };
  const issue = (snapshot: typeof current, identityEpoch = epoch): IssuedIdentity =>
    Object.freeze({ ...identityFor(snapshot, identityEpoch), token: Object.freeze({}) });
  const rendererFor = (snapshot: typeof current): ComposedStorefrontPageRenderer => {
    // The renderer constructs its own private frozen resolver cache for this exact snapshot.
    return createComposedStorefrontPageRenderer({
      snapshot,
      pageId,
      catalogue: retained.catalogue,
      activeLocale: retained.activeLocale,
      primaryLocale: retained.primaryLocale,
      enabledLocales: retained.enabledLocales,
      resolveAuthority: resolver,
      evidenceReferences: retained.evidenceReferences,
      contentSupportFactDocuments: retained.contentSupportFactDocuments,
    });
  };
  const projectFor = (snapshot: typeof current): Data => {
    const renderer = rendererFor(snapshot);
    const page = pageFor(snapshot);
    const sections = new Map(page.sections.map((section) => [section.id, section]));
    return {
      content: [],
      root: {
        props: Object.fromEntries(
          renderer.regions.map((region) => [
            composedRegionSlotName(region.id),
            region.sections.map((entry) => {
              const section = sections.get(entry.id);
              if (!section) fail("missing projected section");
              return {
                type: entry.component,
                props: {
                  id: entry.id,
                  ...Object.fromEntries(
                    editableFieldNames(
                      entry.component,
                      section.content,
                      retained.activeLocale,
                      retained.primaryLocale,
                    ).map((name) => [
                      name,
                      localizedValue(
                        section.content[name],
                        retained.activeLocale,
                        retained.primaryLocale,
                      ),
                    ]),
                  ),
                },
              };
            }),
          ]),
        ),
      },
    };
  };
  // Constructor validation is complete before this private session is exposed.
  void rendererFor(current);
  void projectFor(current);
  let issued = issue(current);

  const project = (): Data => projectFor(current);
  const assertIdentity = (expected: IssuedIdentity) => {
    if (
      !expected ||
      expected.token !== issued.token ||
      expected.snapshotId !== issued.snapshotId ||
      expected.projectId !== issued.projectId ||
      expected.pageId !== issued.pageId ||
      expected.locale !== issued.locale ||
      expected.contentFingerprint !== issued.contentFingerprint ||
      expected.compositionFingerprint !== issued.compositionFingerprint ||
      expected.revision !== issued.revision ||
      expected.epoch !== issued.epoch
    )
      fail("stale session identity");
  };
  const apply = (data: unknown, expected: IssuedIdentity) => {
    assertIdentity(expected);
    if (!data || typeof data !== "object") fail("invalid editor data");
    const raw = data as { content?: unknown; zones?: unknown; root?: { props?: unknown } };
    if (
      Object.keys(raw).some((key) => !["content", "root", "zones"].includes(key)) ||
      !Array.isArray(raw.content) ||
      raw.content.length
    )
      fail("invalid root-only editor data");
    if (
      !raw.root?.props ||
      typeof raw.root.props !== "object" ||
      Object.keys(raw.root).some((key) => key !== "props")
    )
      fail("missing editor root props");
    const renderer = rendererFor(current);
    const expectedSlots = renderer.regions.map((region) => composedRegionSlotName(region.id));
    const root = raw.root.props as Record<string, unknown>;
    if (
      Object.keys(root).some((key) => !expectedSlots.includes(key)) ||
      expectedSlots.some((key) => !(key in root))
    )
      fail("foreign editor region slot");
    // Installed Puck emits an empty `zones` object for slots held in root props.
    // Nonempty redundant mirrors must match every slot exactly; neither form becomes
    // canonical authority for accepted order or membership.
    if (raw.zones !== undefined) {
      if (!raw.zones || typeof raw.zones !== "object" || Array.isArray(raw.zones))
        fail("invalid Puck zone mirror");
      const zones = raw.zones as Record<string, unknown>;
      const expectedZoneKeys = expectedSlots.map((slot) => `root:${slot}`);
      if (
        Object.keys(zones).length > 0 &&
        (Object.keys(zones).some((key) => !expectedZoneKeys.includes(key)) ||
          expectedZoneKeys.some((key) => !(key in zones)) ||
          expectedSlots.some(
            (slot) => JSON.stringify(zones[`root:${slot}`]) !== JSON.stringify(root[slot]),
          ))
      )
        fail("mismatched Puck zone mirror");
    }
    const next = structuredClone(current);
    const page = pageFor(next);
    const original = pageFor(current);
    const byId = new Map(page.sections.map((section) => [section.id, section]));
    const originalAssignments = new Map(
      original.composition.regionAssignments.map((entry) => [entry.regionId, entry]),
    );
    const regionAssignments = renderer.regions.map((region) => {
      const rawItems = root[composedRegionSlotName(region.id)];
      if (!Array.isArray(rawItems) || rawItems.length !== region.sections.length)
        fail("invalid editor region membership");
      const seen = new Set<string>();
      const units = rawItems.map((rawItem) => {
        if (!rawItem || typeof rawItem !== "object") fail("invalid editor item");
        const item = rawItem as Item;
        if (
          !item.props ||
          typeof item.props !== "object" ||
          typeof item.props.id !== "string" ||
          Object.keys(item).some((key) => key !== "type" && key !== "props")
        )
          fail("invalid editor item identity");
        const expectedSection = region.sections.find((section) => section.id === item.props.id);
        if (!expectedSection || expectedSection.component !== item.type || seen.has(item.props.id))
          fail("foreign, duplicate or cross-region editor item");
        seen.add(item.props.id);
        const section = byId.get(item.props.id);
        if (!section) fail("missing canonical editor section");
        const content = section.content;
        const supportedFields = editableFieldNames(
          item.type,
          content,
          retained.activeLocale,
          retained.primaryLocale,
        );
        const allowed = new Set(["id", ...supportedFields]);
        if (Object.keys(item.props).some((key) => !allowed.has(key)))
          fail("unsupported editor field");
        for (const name of supportedFields) {
          const value = item.props[name];
          if (typeof value !== "string") fail("invalid localized presentation value");
          const previous = content[name];
          // A current-locale fallback may be absent. Exact no-op transport never
          // materializes it; any non-no-op write still requires existing authority.
          if (localizedValue(previous, retained.activeLocale, retained.primaryLocale) === value)
            continue;
          if (!previous || typeof previous !== "object")
            fail("missing localized presentation authority");
          content[name] = {
            ...(previous as Record<string, unknown>),
            [retained.activeLocale]: value,
          };
        }
        return { kind: "section" as const, sectionId: item.props.id };
      });
      if (region.sections.length === 1 && units[0].sectionId !== region.sections[0].id)
        fail("single-unit region reorder");
      const prior = originalAssignments.get(region.id);
      if (!prior) fail("missing original region assignment");
      return { ...prior, units };
    });
    validateRegisteredSnapshot(
      legacyProjection(next),
      retained.catalogue,
      retained.activeLocale,
      retained.primaryLocale,
      retained.enabledLocales,
      retained.evidenceReferences,
      retained.contentSupportFactDocuments,
    );
    const { compositionFingerprint: _fingerprint, ...selection } = original.composition;
    void _fingerprint;
    const authority = resolver({
      owner: original.composition.owner,
      composition: original.composition,
    });
    const { composition: _oldComposition, ...owner } = page;
    void _oldComposition;
    const composition = compilePageBlueprintComposition(
      { ...selection, regionAssignments },
      { ...authority, owner: { kind: "static-page", page: owner } },
    );
    // The compiler returns an immutable accepted representation. The editable aggregate
    // remains a plain transport value and is immediately revalidated below.
    const accepted = validateComposedStorefrontSnapshot(
      {
        ...next,
        pages: next.pages.map((entry) => (entry.id === pageId ? { ...entry, composition } : entry)),
      },
      resolver,
    );
    // Construct every next derived view before publishing it to the session.
    const nextRenderer = rendererFor(accepted);
    const nextData = projectFor(accepted);
    void nextRenderer;
    const unchanged =
      canonicalStorefrontContentFingerprint(accepted) ===
        canonicalStorefrontContentFingerprint(current) &&
      pageFor(accepted).composition.compositionFingerprint ===
        pageFor(current).composition.compositionFingerprint;
    if (unchanged)
      return Object.freeze({
        snapshot: current,
        identity: issued,
        data: projectFor(current),
        changed: false,
      });
    const nextEpoch = epoch + 1;
    const nextIssued = issue(accepted, nextEpoch);
    current = accepted;
    epoch = nextEpoch;
    issued = nextIssued;
    return Object.freeze({ snapshot: current, identity: issued, data: nextData, changed: true });
  };
  return Object.freeze({
    get snapshot() {
      return current;
    },
    get identity() {
      return issued;
    },
    renderer: () => rendererFor(current),
    project,
    apply,
  });
}
