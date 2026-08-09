import { z } from "zod";
import {
  validateRegisteredSnapshot,
  veskifyComponentCapabilityManifest,
} from "@/components/registry";
import type { CatalogueDisplayModel } from "@/domain/catalogue";
import {
  applyCommercialSharedFrame,
  canonicalStorefrontContentFingerprint,
  canonicalValueFingerprint,
  commercialSharedFrameProfileIdSchema,
  getCommercialSharedFrameProfile,
  resolveCommercialSharedFrameProfile,
  validateCommercialSharedFrameSnapshot,
  type CommercialSharedFrameProfileId,
  type StorefrontSnapshot,
} from "@/domain/storefront";

export const commercialSharedFrameSelectionSchema = z
  .object({
    profileId: commercialSharedFrameProfileIdSchema,
    profileVersion: z.literal("1.0.0"),
    authorityFingerprint: z.string().trim().min(1),
  })
  .strict();

export type CommercialSharedFrameSelection = z.infer<typeof commercialSharedFrameSelectionSchema>;

export const commercialSharedFrameProposalSchema = z
  .object({
    kind: z.literal("select-commercial-shared-frame"),
    sourceSnapshotId: z.string().trim().min(1),
    sourceSnapshotRevision: z.number().int().nonnegative(),
    sourceSnapshotFingerprint: z.string().trim().min(1),
    selection: commercialSharedFrameSelectionSchema,
  })
  .strict();

export type CommercialSharedFrameProposal = z.infer<typeof commercialSharedFrameProposalSchema>;

export class CommercialSharedFrameProposalError extends Error {
  readonly code = "stale-source-snapshot";

  constructor() {
    super("The commercial shared-frame proposal does not target the exact current snapshot.");
    this.name = "CommercialSharedFrameProposalError";
  }
}

export type CommercialSharedFrameCompilation = Readonly<{
  selection: CommercialSharedFrameSelection;
  snapshot: StorefrontSnapshot;
  fingerprint: string;
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

export function currentCommercialSharedFrameSelection(
  profileId: CommercialSharedFrameProfileId,
): CommercialSharedFrameSelection {
  const profile = getCommercialSharedFrameProfile(profileId);
  return deepFreeze({
    profileId: profile.id,
    profileVersion: profile.version,
    authorityFingerprint: profile.authorityFingerprint,
  });
}

export function createCommercialSharedFrameProposal(
  snapshot: StorefrontSnapshot,
  profileId: CommercialSharedFrameProfileId,
): CommercialSharedFrameProposal {
  return deepFreeze(
    commercialSharedFrameProposalSchema.parse({
      kind: "select-commercial-shared-frame",
      sourceSnapshotId: snapshot.id,
      sourceSnapshotRevision: snapshot.revision,
      sourceSnapshotFingerprint: canonicalStorefrontContentFingerprint(snapshot),
      selection: currentCommercialSharedFrameSelection(profileId),
    }),
  );
}

export function compileCommercialSharedFrameProposal(
  input: Readonly<{
    snapshot: StorefrontSnapshot;
    catalogue: CatalogueDisplayModel;
    proposal: unknown;
  }>,
): CommercialSharedFrameCompilation {
  const proposal = commercialSharedFrameProposalSchema.parse(input.proposal);
  if (
    proposal.sourceSnapshotId !== input.snapshot.id ||
    proposal.sourceSnapshotRevision !== input.snapshot.revision ||
    proposal.sourceSnapshotFingerprint !== canonicalStorefrontContentFingerprint(input.snapshot)
  ) {
    throw new CommercialSharedFrameProposalError();
  }
  return compileCommercialSharedFrameSelection({
    snapshot: input.snapshot,
    catalogue: input.catalogue,
    selection: proposal.selection,
  });
}

export function compileCommercialSharedFrameSelection(
  input: Readonly<{
    snapshot: StorefrontSnapshot;
    catalogue: CatalogueDisplayModel;
    selection: unknown;
  }>,
): CommercialSharedFrameCompilation {
  const selection = commercialSharedFrameSelectionSchema.parse(input.selection);
  resolveCommercialSharedFrameProfile(selection);
  const headerCapability = veskifyComponentCapabilityManifest.requireCommercialReadyVariant({
    componentType: "header",
    variant: getCommercialSharedFrameProfile(selection.profileId).headerVariant,
    expectedAnatomyIdentity: "header.commercialSharedFrameAnatomy",
    expectedAnatomyVersion: { major: 1, minor: 0, patch: 0 },
    requireMeaningful: true,
  });
  const footerCapability = veskifyComponentCapabilityManifest.requireCommercialReadyVariant({
    componentType: "footer",
    variant: getCommercialSharedFrameProfile(selection.profileId).footerVariant,
    expectedAnatomyIdentity: "footer.commercialSharedFrameAnatomy",
    expectedAnatomyVersion: { major: 1, minor: 0, patch: 0 },
    requireMeaningful: true,
  });
  const snapshot = applyCommercialSharedFrame(input.snapshot, selection.profileId);
  validateCommercialSharedFrameSnapshot(snapshot);
  validateRegisteredSnapshot(snapshot, input.catalogue, "en", "en");
  const fingerprint = `commercial-shared-frame-${canonicalValueFingerprint({
    selection,
    snapshot,
    headerCapability: headerCapability.component.fingerprint,
    footerCapability: footerCapability.component.fingerprint,
  })}`;
  return deepFreeze({ selection, snapshot, fingerprint });
}
