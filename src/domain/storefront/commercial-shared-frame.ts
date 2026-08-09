import { z } from "zod";
import { canonicalValueFingerprint } from "./canonical-storefront";
import { storefrontSnapshotSchema, type StorefrontSnapshot } from "./storefront";

export const COMMERCIAL_SHARED_FRAME_AUTHORITY_VERSION = "1.0.0" as const;

export const commercialSharedFrameProfileIds = [
  "editorial-masthead",
  "commerce-utility",
  "centered-minimal",
  "compact-technical",
] as const;
export const commercialSharedFrameProfileIdSchema = z.enum(commercialSharedFrameProfileIds);
export const mobileNavigationModeSchema = z.enum([
  "drawer",
  "stacked-disclosure",
  "compact-overlay",
]);
export const footerCompositionSchema = z.enum([
  "brand-editorial",
  "service-navigation",
  "navigation-columns",
  "compact-commerce-legal",
]);

export type CommercialSharedFrameProfileId = z.infer<typeof commercialSharedFrameProfileIdSchema>;
export type MobileNavigationMode = z.infer<typeof mobileNavigationModeSchema>;
export type FooterComposition = z.infer<typeof footerCompositionSchema>;

export type CommercialSharedFrameProfile = Readonly<{
  id: CommercialSharedFrameProfileId;
  version: typeof COMMERCIAL_SHARED_FRAME_AUTHORITY_VERSION;
  title: string;
  desktopComposition:
    "brand-led-masthead" | "utility-led-grid" | "centered-brand-stack" | "compact-navigation-rail";
  headerVariant: "editorial" | "split" | "centered" | "compact";
  footerVariant: "editorial" | "expanded" | "columns" | "compact";
  mobileNavigationMode: MobileNavigationMode;
  footerComposition: FooterComposition;
  serviceStrip: "canonical-footer-navigation" | "none";
  searchPlacement: "primary" | "utility" | "overlay" | "compact";
  semanticRegions: readonly (
    | "service"
    | "brand"
    | "primaryNavigation"
    | "utilityNavigation"
    | "search"
    | "cart"
    | "locale"
    | "mobileNavigation"
    | "footerNavigation"
  )[];
  responsiveTransformationIds: readonly string[];
  authorityFingerprint: string;
}>;

type ProfileInput = Omit<CommercialSharedFrameProfile, "version" | "authorityFingerprint">;

function profile(input: ProfileInput): CommercialSharedFrameProfile {
  const versioned = { ...input, version: COMMERCIAL_SHARED_FRAME_AUTHORITY_VERSION };
  return Object.freeze({
    ...versioned,
    semanticRegions: Object.freeze([...versioned.semanticRegions]),
    responsiveTransformationIds: Object.freeze([...versioned.responsiveTransformationIds]),
    authorityFingerprint: `shared-frame-${canonicalValueFingerprint(versioned)}`,
  });
}

export const commercialSharedFrameProfiles: readonly CommercialSharedFrameProfile[] = Object.freeze(
  [
    profile({
      id: "editorial-masthead",
      title: "Editorial masthead",
      desktopComposition: "brand-led-masthead",
      headerVariant: "editorial",
      footerVariant: "editorial",
      mobileNavigationMode: "drawer",
      footerComposition: "brand-editorial",
      serviceStrip: "canonical-footer-navigation",
      searchPlacement: "overlay",
      semanticRegions: [
        "service",
        "brand",
        "primaryNavigation",
        "search",
        "cart",
        "locale",
        "mobileNavigation",
        "footerNavigation",
      ],
      responsiveTransformationIds: ["editorial-to-drawer", "editorial-footer-stack"],
    }),
    profile({
      id: "commerce-utility",
      title: "Commerce utility-led",
      desktopComposition: "utility-led-grid",
      headerVariant: "split",
      footerVariant: "expanded",
      mobileNavigationMode: "stacked-disclosure",
      footerComposition: "service-navigation",
      serviceStrip: "canonical-footer-navigation",
      searchPlacement: "primary",
      semanticRegions: [
        "service",
        "brand",
        "primaryNavigation",
        "utilityNavigation",
        "search",
        "cart",
        "locale",
        "mobileNavigation",
        "footerNavigation",
      ],
      responsiveTransformationIds: ["utility-to-disclosure", "service-footer-stack"],
    }),
    profile({
      id: "centered-minimal",
      title: "Centered minimal brand",
      desktopComposition: "centered-brand-stack",
      headerVariant: "centered",
      footerVariant: "columns",
      mobileNavigationMode: "compact-overlay",
      footerComposition: "navigation-columns",
      serviceStrip: "none",
      searchPlacement: "utility",
      semanticRegions: [
        "brand",
        "primaryNavigation",
        "search",
        "cart",
        "locale",
        "mobileNavigation",
        "footerNavigation",
      ],
      responsiveTransformationIds: ["centered-to-overlay", "column-footer-stack"],
    }),
    profile({
      id: "compact-technical",
      title: "Compact technical navigation",
      desktopComposition: "compact-navigation-rail",
      headerVariant: "compact",
      footerVariant: "compact",
      mobileNavigationMode: "drawer",
      footerComposition: "compact-commerce-legal",
      serviceStrip: "none",
      searchPlacement: "compact",
      semanticRegions: [
        "brand",
        "primaryNavigation",
        "utilityNavigation",
        "search",
        "cart",
        "locale",
        "mobileNavigation",
        "footerNavigation",
      ],
      responsiveTransformationIds: ["technical-to-drawer", "compact-footer-wrap"],
    }),
  ],
);

const profilesById = new Map(commercialSharedFrameProfiles.map((entry) => [entry.id, entry]));

export const commercialSharedFrameErrorCodes = [
  "unknown-profile",
  "stale-profile",
  "missing-frame-sections",
  "ambiguous-legacy-frame-authority",
  "incompatible-frame-combination",
  "duplicated-page-frame-authority",
] as const;
export type CommercialSharedFrameErrorCode = (typeof commercialSharedFrameErrorCodes)[number];

export class CommercialSharedFrameError extends Error {
  constructor(
    readonly code: CommercialSharedFrameErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommercialSharedFrameError";
  }
}

export function getCommercialSharedFrameProfile(
  id: CommercialSharedFrameProfileId,
): CommercialSharedFrameProfile {
  const resolved = profilesById.get(id);
  if (!resolved) {
    throw new CommercialSharedFrameError("unknown-profile", `Unknown shared-frame profile: ${id}.`);
  }
  return resolved;
}

export function resolveCommercialSharedFrameProfile(input: {
  profileId: string;
  profileVersion: string;
  authorityFingerprint: string;
}): CommercialSharedFrameProfile {
  const parsed = commercialSharedFrameProfileIdSchema.safeParse(input.profileId);
  if (!parsed.success) {
    throw new CommercialSharedFrameError(
      "unknown-profile",
      `Unknown shared-frame profile: ${input.profileId}.`,
    );
  }
  const resolved = getCommercialSharedFrameProfile(parsed.data);
  if (
    input.profileVersion !== resolved.version ||
    input.authorityFingerprint !== resolved.authorityFingerprint
  ) {
    throw new CommercialSharedFrameError(
      "stale-profile",
      `Shared-frame profile ${input.profileId} does not match current executable authority.`,
    );
  }
  return resolved;
}

function canonicalLegacyFrameSection(
  snapshot: StorefrontSnapshot,
  component: "announcementBar" | "header" | "footer",
) {
  const candidates = snapshot.pages
    .flatMap((page) => page.sections)
    .filter((section) => section.component === component);
  const materialCandidates =
    component === "announcementBar" ? candidates.filter((section) => section.visible) : candidates;
  if (materialCandidates.length === 0) return undefined;
  const materialFingerprints = new Set(
    materialCandidates.map((section) =>
      canonicalValueFingerprint({
        component: section.component,
        content: section.content,
        props: section.props,
        styleOverrides: section.styleOverrides,
        approvedAssetPlacements: section.approvedAssetPlacements,
        approvedAssetPresentations: section.approvedAssetPresentations,
      }),
    ),
  );
  if (materialFingerprints.size > 1) {
    throw new CommercialSharedFrameError(
      "ambiguous-legacy-frame-authority",
      `Legacy ${component} sections disagree and cannot be promoted into one canonical shared frame.`,
    );
  }
  return materialCandidates.find((section) => section.visible) ?? materialCandidates[0];
}

export function applyCommercialSharedFrame(
  input: StorefrontSnapshot,
  profileId: CommercialSharedFrameProfileId,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(structuredClone(input));
  const profileAuthority = getCommercialSharedFrameProfile(profileId);
  const header = snapshot.sharedFrame?.header ?? canonicalLegacyFrameSection(snapshot, "header");
  const footer = snapshot.sharedFrame?.footer ?? canonicalLegacyFrameSection(snapshot, "footer");
  const announcement =
    snapshot.sharedFrame?.announcement ?? canonicalLegacyFrameSection(snapshot, "announcementBar");
  if (!header || !footer) {
    throw new CommercialSharedFrameError(
      "missing-frame-sections",
      "Commercial shared-frame materialization requires canonical header and footer source sections.",
    );
  }
  const next = storefrontSnapshotSchema.parse({
    ...snapshot,
    sharedFrame: {
      id:
        snapshot.sharedFrame?.id ??
        `shared_frame_${canonicalValueFingerprint({ projectId: snapshot.projectId }).slice(-24)}`,
      profileId: profileAuthority.id,
      profileVersion: profileAuthority.version,
      authorityFingerprint: profileAuthority.authorityFingerprint,
      header: {
        ...structuredClone(header),
        variant: profileAuthority.headerVariant,
        visible: true,
      },
      footer: {
        ...structuredClone(footer),
        variant: profileAuthority.footerVariant,
        visible: true,
      },
      ...(announcement ? { announcement: structuredClone(announcement) } : {}),
    },
    pages: snapshot.pages.map((page) => ({
      ...structuredClone(page),
      sections: page.sections.filter(
        (section) => !["announcementBar", "header", "footer"].includes(section.component),
      ),
    })),
  });
  return validateCommercialSharedFrameSnapshot(next);
}

export function validateCommercialSharedFrameSnapshot(
  input: StorefrontSnapshot,
): StorefrontSnapshot {
  const snapshot = storefrontSnapshotSchema.parse(input);
  if (!snapshot.sharedFrame) return snapshot;
  const profileAuthority = resolveCommercialSharedFrameProfile(snapshot.sharedFrame);
  if (
    snapshot.sharedFrame.header.variant !== profileAuthority.headerVariant ||
    snapshot.sharedFrame.footer.variant !== profileAuthority.footerVariant
  ) {
    throw new CommercialSharedFrameError(
      "incompatible-frame-combination",
      `Shared-frame profile ${profileAuthority.id} requires ${profileAuthority.headerVariant}/${profileAuthority.footerVariant}.`,
    );
  }
  if (
    snapshot.pages.some((page) =>
      page.sections.some((section) =>
        ["announcementBar", "header", "footer"].includes(section.component),
      ),
    )
  ) {
    throw new CommercialSharedFrameError(
      "duplicated-page-frame-authority",
      "A snapshot-level shared frame cannot coexist with page-local frame authority.",
    );
  }
  return snapshot;
}
