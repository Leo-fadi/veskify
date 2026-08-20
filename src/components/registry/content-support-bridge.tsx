import {
  componentInstanceV2Schema,
  type ComponentInstanceV2,
  type ComponentProjectionContext,
} from "@/domain/component-platform";
import {
  canonicalValueString,
  type ApprovedAssetPlacementOperation,
  type ApprovedAssetPresentation,
  type ContentSupportFactDocument,
  type PageModel,
  type SectionInstance,
} from "@/domain/storefront";
import { resolveLocalizedText } from "@/domain/shared";
import {
  HomepageEditorialSection,
  HomepagePromotionSection,
} from "@/components/storefront/homepage-commerce";
import {
  resolveResponsiveExecutionAuthority,
  responsiveExecutionDataAttributes,
} from "@/components/storefront/responsive-execution";
import {
  defineComponent,
  resolveStorefrontNavigationPath,
  type ComponentDefinition,
  type StorefrontRenderContext,
} from "./contract";
import {
  contentSupportContentSchema,
  contentSupportDefaultContent,
  contentSupportDefaultProps,
  contentSupportDefinition,
  contentSupportPropsSchema,
  contentSupportStyleOverridesSchema,
  contentSupportVariantSchema,
  type ContentSupportProps,
  type ContentSupportStyleOverrides,
} from "./content-support";
import { homepageEditorialDefinition, homepagePromotionDefinition } from "./homepage-commerce";
import { veskifyComponentRegistryV2 } from "./v2-registry";
import styles from "@/components/storefront/content-support.module.css";

export const contentSupportBridgeComponentNames = ["contentSupport"] as const;
export type ContentSupportBridgeComponent = (typeof contentSupportBridgeComponentNames)[number];

const variants = contentSupportVariantSchema.options;
const firstVariant = variants[0];
if (!firstVariant) throw new Error("Content/support requires registered variants.");

export const contentSupportBridgeVariants = [firstVariant, ...variants.slice(1)] as const;
export const contentSupportBridgeDefaults = {
  contentSupport: {
    content: contentSupportDefaultContent,
    props: contentSupportDefaultProps,
  },
} as const;

function supportedDocument(
  context: StorefrontRenderContext,
  documentId: string,
): ContentSupportFactDocument {
  const document = context.contentSupportFactDocuments?.find((entry) => entry.id === documentId);
  if (!document)
    throw new Error("Content/support rendering requires a current approved fact document.");
  const currentEvidence = context.evidenceReferences ?? [];
  if (
    !currentEvidence.some(
      (reference) => canonicalValueString(reference) === canonicalValueString(document.evidence),
    )
  ) {
    throw new Error("Content/support fact evidence is not current for this render context.");
  }
  assertDocumentLocales(document, context.enabledLocales);
  return document;
}

function assertDocumentLocales(
  document: ContentSupportFactDocument,
  enabledLocales: readonly string[],
): void {
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.some((key) => enabledLocales.includes(key))) {
      enabledLocales.forEach((locale) => {
        if (typeof record[locale] !== "string" || record[locale].trim().length === 0) {
          throw new Error(
            `Approved content/support facts do not provide the enabled ${locale} locale.`,
          );
        }
      });
      return;
    }
    Object.values(record).forEach(visit);
  };
  visit(document.payload);
}

type ResolvedContentSupportMedia = Readonly<{
  placement: ApprovedAssetPlacementOperation;
  presentation: ApprovedAssetPresentation;
}>;

type ResolvedCampaignAction = Readonly<{
  label: NonNullable<NonNullable<ContentSupportFactDocument["payload"]["campaign"]>["actionLabel"]>;
  navigationId: string;
  path: string;
  revision: string;
}>;

function resolvedContentSupportMedia(
  sectionId: string,
  placements: readonly ApprovedAssetPlacementOperation[],
  presentations: readonly ApprovedAssetPresentation[],
): ResolvedContentSupportMedia | null {
  const relevantPlacements = placements.filter(
    (placement) =>
      placement.componentId === sectionId && placement.componentType === "contentSupport",
  );
  if (relevantPlacements.length === 0) {
    if (presentations.length > 0) {
      throw new Error("Content/support asset presentation requires one exact approved placement.");
    }
    return null;
  }
  if (relevantPlacements.length !== 1) {
    throw new Error("Content/support rendering requires at most one approved editorial asset.");
  }
  const placement = relevantPlacements[0];
  if (
    !placement ||
    placement.assetSlotId !== "contentSupportMedia" ||
    placement.role !== "editorialImage"
  ) {
    throw new Error("Content/support media is incompatible with registered asset authority.");
  }
  const matchingPresentations = presentations.filter(
    (presentation) => presentation.assetId === placement.assetId,
  );
  const presentation = matchingPresentations[0];
  if (
    matchingPresentations.length !== 1 ||
    !presentation ||
    presentation.asset.id !== placement.assetId ||
    presentation.role !== placement.role ||
    presentation.revision !== placement.assetRevision ||
    presentation.materialFingerprint !== placement.materialFingerprint
  ) {
    throw new Error("Content/support media has no exact current presentation authority.");
  }
  return { placement, presentation };
}

function projectionFor(
  context: StorefrontRenderContext,
  media: ResolvedContentSupportMedia | null = null,
): ComponentProjectionContext {
  const documents = context.contentSupportFactDocuments ?? [];
  const revision = `catalogue-${context.catalogue.id}`;
  return {
    products: [],
    collections: [],
    assets: media
      ? [
          {
            assetId: media.presentation.assetId,
            role: media.presentation.role,
            ...(media.presentation.asset.alt === undefined
              ? { decorative: media.presentation.asset.decorative }
              : {
                  alt: media.presentation.asset.alt,
                  decorative: media.presentation.asset.decorative,
                }),
            provenance: {
              kind: media.placement.sourceProvenanceKind ?? "sourceDiscovered",
              sourceId: media.placement.sourceReferenceId,
            },
            approvalStatus: "approved",
            usageRights:
              media.placement.sourceProvenanceKind === "merchantProvided"
                ? "merchantOwned"
                : "unknown",
            responsiveCrops: [],
            ...(media.presentation.artDirection
              ? { artDirection: media.presentation.artDirection }
              : {}),
            revision: media.presentation.revision,
          },
        ]
      : [],
    navigation: [...context.navigation.primary, ...context.navigation.footer].map((item) => ({
      navigationId: item.id,
      revision,
    })),
    projectBrandContexts: [
      { projectId: `project_${context.catalogue.id}`, brandSystemRefs: [], revision },
    ],
    localizedContents: documents.map((document) => ({
      contentId: document.id,
      locales: [...context.enabledLocales],
      revision: document.fingerprint,
    })),
    evidenceReferences: [...(context.evidenceReferences ?? [])],
  };
}

function instanceFor(
  sectionId: string,
  variant: string,
  content: unknown,
  props: unknown,
  styleOverrides: SectionInstance["styleOverrides"],
  approvedAssetPlacements: readonly ApprovedAssetPlacementOperation[],
  approvedAssetPresentations: readonly ApprovedAssetPresentation[],
  context: StorefrontRenderContext,
): Readonly<{
  instance: ComponentInstanceV2;
  props: ContentSupportProps;
  styleOverrides: ContentSupportStyleOverrides;
  media: ResolvedContentSupportMedia | null;
  campaignAction: ResolvedCampaignAction | null;
}> {
  const parsedContent = contentSupportContentSchema.parse(content);
  const document = supportedDocument(context, parsedContent.factDocumentId);
  const campaignAction = resolvedCampaignAction(document, context);
  const media = resolvedContentSupportMedia(
    sectionId,
    approvedAssetPlacements,
    approvedAssetPresentations,
  );
  const parsedStyleOverrides = contentSupportStyleOverridesSchema.parse({
    surface: styleOverrides?.surface ?? "default",
  });
  const instance = componentInstanceV2Schema.parse({
    id: sectionId,
    component: "contentSupport",
    componentVersion: contentSupportDefinition.version,
    variant,
    content: parsedContent,
    props: contentSupportPropsSchema.parse(props),
    styleOverrides: parsedStyleOverrides,
    bindings: [
      {
        slotId: "supportFacts",
        source: "localizedContent",
        contentId: document.id,
        locale: context.activeLocale,
        fallbackLocale: context.primaryLocale,
        revision: document.fingerprint,
      },
      ...(campaignAction
        ? [
            {
              slotId: "campaignAction" as const,
              source: "navigation" as const,
              navigationId: campaignAction.navigationId,
              revision: campaignAction.revision,
            },
          ]
        : []),
    ],
    assetAssignments: media
      ? [
          {
            slotId: "contentSupportMedia",
            assetId: media.placement.assetId,
            role: media.placement.role,
          },
        ]
      : [],
  });
  return {
    instance: veskifyComponentRegistryV2.validateInstanceConformance(
      instance,
      projectionFor(context, media),
    ),
    props: contentSupportPropsSchema.parse(instance.props),
    styleOverrides: parsedStyleOverrides,
    media,
    campaignAction,
  };
}

function reusableSurface(
  surface: ContentSupportStyleOverrides["surface"],
): "plain" | "soft" | "contrast" {
  if (surface === "secondary") return "soft";
  if (surface === "primary" || surface === "accent") return "contrast";
  return "plain";
}

function text(value: Record<string, string>, context: StorefrontRenderContext) {
  return resolveLocalizedText(value, context.activeLocale, context.primaryLocale);
}

function resolvedCampaignAction(
  document: ContentSupportFactDocument,
  context: StorefrontRenderContext,
): ResolvedCampaignAction | null {
  const label = document.payload.campaign?.actionLabel;
  if (!label) return null;
  const revision = `catalogue-${context.catalogue.id}`;
  const matches = [...context.navigation.primary, ...context.navigation.footer].flatMap((item) => {
    if (canonicalValueString(item.label) !== canonicalValueString(label)) return [];
    const path = resolveStorefrontNavigationPath(context, {
      type: "navigateToApprovedAction",
      navigationId: item.id,
    });
    return path ? [{ label, navigationId: item.id, path, revision }] : [];
  });
  return matches.length === 1 ? matches[0] : null;
}

function contentSupportSectionAttributes({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
  contributionCount,
  reclassifiedFrom,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
  contributionCount?: number;
  reclassifiedFrom?: string;
}) {
  return {
    ...contentResponsiveAttributes(variant),
    "data-component": "contentSupport",
    "data-evidence-id": document.evidence.authorityId,
    "data-page-family": document.payload.familyId,
    "data-render-target": context.renderTarget ?? "preview",
    "data-responsive-layout": "governed-content-support",
    "data-reading-width": props.readingWidth,
    "data-surface": surface,
    "data-text-alignment": props.textAlignment,
    "data-variant": variant,
    ...(reclassifiedFrom ? { "data-reclassified-from": reclassifiedFrom } : {}),
    ...(contributionCount === undefined
      ? {}
      : {
          "data-content-contribution-count": String(contributionCount),
        }),
    id: sectionId,
  } satisfies Record<string, string>;
}

function contentResponsiveAttributes(variant: string) {
  const anatomy = contentSupportDefinition.commercialAnatomy;
  if (!anatomy) throw new Error("Content/support requires registered responsive anatomy.");
  return responsiveExecutionDataAttributes(resolveResponsiveExecutionAuthority(anatomy, variant));
}

function StorytellingReuse({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
  media,
  editorialVariant,
  openingRegion,
  includeProcessSteps = false,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
  media: ResolvedContentSupportMedia | null;
  editorialVariant: "brandStory" | "craftProcess";
  openingRegion: string;
  includeProcessSteps?: boolean;
}) {
  const story = document.payload.story;
  if (!story) throw new Error("The selected content/support layout requires approved story facts.");
  const additionalBlocks = document.payload.blocks.filter(
    (block) =>
      block.kind !== "paragraph" ||
      canonicalValueString(block.body) !== canonicalValueString(story.body),
  );
  const processSteps = includeProcessSteps ? story.steps : [];
  const contributionCount =
    1 + additionalBlocks.filter(({ kind }) => kind === "paragraph").length + processSteps.length;
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant,
        document,
        context,
        props,
        surface,
        contributionCount,
      })}
    >
      <section
        aria-labelledby={`${sectionId}-heading`}
        className={`${styles.section} ${styles.opening}`}
        data-content-region={openingRegion}
      >
        <div className={styles.reading}>
          <h1 id={`${sectionId}-heading`}>{text(document.payload.title, context)}</h1>
          {document.payload.introduction ? (
            <p className={styles.introduction}>{text(document.payload.introduction, context)}</p>
          ) : null}
        </div>
      </section>
      <HomepageEditorialSection
        target={context.renderTarget ?? "preview"}
        instance={{
          id: `${sectionId}-p10b07-story`,
          component: "homepageEditorial",
          componentVersion: homepageEditorialDefinition.version,
          variant: editorialVariant,
          content: { ...story },
          props: {
            mediaPosition: "right",
            textAlignment: "left",
            galleryColumns: 2,
          },
          styleOverrides: { surface: reusableSurface(surface) },
          bindings: [
            {
              slotId: "presentationContext",
              source: "projectBrandContext",
              projectId: `project_${context.catalogue.id}`,
              revision: `catalogue-${context.catalogue.id}`,
            },
            ...(media
              ? [
                  {
                    slotId: "storyPrimaryAsset" as const,
                    source: "asset" as const,
                    assetId: media.placement.assetId,
                    role: media.placement.role,
                    revision: media.placement.assetRevision,
                  },
                ]
              : []),
          ],
          assetAssignments: media
            ? [
                {
                  slotId: "storyMedia",
                  assetId: media.placement.assetId,
                  role: media.placement.role,
                },
              ]
            : [],
        }}
        projection={projectionFor(context, media)}
        activeLocale={context.activeLocale}
        primaryLocale={context.primaryLocale}
        resolveAssetUrl={(assetId) => {
          if (!media || media.presentation.asset.id !== assetId) {
            throw new Error("Content/support media URL is outside current approved authority.");
          }
          return media.presentation.asset.url;
        }}
        onNavigate={() => undefined}
      />
      {additionalBlocks.length > 0 ? (
        <section
          className={`${styles.section} ${styles.factSequence}`}
          data-content-region="story-facts"
        >
          <div className={`${styles.reading} ${styles.factGrid}`}>
            {additionalBlocks.map((block) =>
              block.kind === "paragraph" ? (
                <article className={styles.article} key={block.id}>
                  {block.heading ? <h2>{text(block.heading, context)}</h2> : null}
                  <p>{text(block.body, context)}</p>
                </article>
              ) : null,
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CampaignActionLink({
  action,
  context,
}: {
  action: ResolvedCampaignAction | null;
  context: StorefrontRenderContext;
}) {
  if (!action) return null;
  return (
    <div className={styles.campaignActions} data-content-region="campaign-action">
      <a
        data-campaign-navigation-id={action.navigationId}
        data-content-support-action="campaign"
        href={action.path}
      >
        {text(action.label, context)}
      </a>
    </div>
  );
}

function CampaignReuse({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
  media,
  action,
  requestedVariant,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
  media: ResolvedContentSupportMedia | null;
  action: ResolvedCampaignAction | null;
  requestedVariant?: string;
}) {
  const campaign = document.payload.campaign;
  if (!campaign) throw new Error("The selected campaign layout requires approved campaign facts.");
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant,
        document,
        context,
        props,
        surface,
        reclassifiedFrom: requestedVariant,
      })}
    >
      <section
        aria-labelledby={`${sectionId}-campaign-heading`}
        className={`${styles.section} ${styles.opening}`}
        data-content-region="campaign-opening"
        data-surface={surface}
      >
        <div className={styles.reading}>
          <h1 id={`${sectionId}-campaign-heading`}>{text(document.payload.title, context)}</h1>
          {document.payload.introduction ? (
            <p className={styles.introduction}>{text(document.payload.introduction, context)}</p>
          ) : null}
        </div>
      </section>
      <HomepagePromotionSection
        target={context.renderTarget ?? "preview"}
        instance={{
          id: `${sectionId}-p10b07-campaign`,
          component: "homepagePromotion",
          componentVersion: homepagePromotionDefinition.version,
          variant:
            variant === "campaignImageLed"
              ? "imageLed"
              : variant === "campaignStory"
                ? "editorial"
                : "split",
          content: {
            heading: campaign.heading,
            description: campaign.description,
          },
          props: {
            mediaPosition: "right",
            actionPresentation: "text",
            textAlignment: "left",
          },
          styleOverrides: { surface: reusableSurface(surface) },
          bindings: [
            {
              slotId: "presentationContext",
              source: "projectBrandContext",
              projectId: `project_${context.catalogue.id}`,
              revision: `catalogue-${context.catalogue.id}`,
            },
            ...(media
              ? [
                  {
                    slotId: "promotionAsset" as const,
                    source: "asset" as const,
                    assetId: media.placement.assetId,
                    role: media.placement.role,
                    revision: media.placement.assetRevision,
                  },
                ]
              : []),
          ],
          assetAssignments: media
            ? [
                {
                  slotId: "promotionMedia",
                  assetId: media.placement.assetId,
                  role: media.placement.role,
                },
              ]
            : [],
        }}
        projection={projectionFor(context, media)}
        activeLocale={context.activeLocale}
        primaryLocale={context.primaryLocale}
        resolveAssetUrl={(assetId) => {
          if (!media || media.presentation.asset.id !== assetId) {
            throw new Error("Campaign media URL is outside current approved authority.");
          }
          return media.presentation.asset.url;
        }}
        onNavigate={() => undefined}
      />
      <CampaignActionLink action={action} context={context} />
    </div>
  );
}

function CampaignStoryReuse({
  sectionId,
  document,
  context,
  props,
  surface,
  media,
  action,
}: {
  sectionId: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
  media: ResolvedContentSupportMedia | null;
  action: ResolvedCampaignAction | null;
}) {
  const campaign = document.payload.campaign;
  const story = document.payload.story;
  if (!campaign || !story) {
    throw new Error("Campaign story rendering requires approved campaign and story facts.");
  }
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant: "campaignStory",
        document,
        context,
        props,
        surface,
      })}
      data-content-region="campaign-story"
    >
      <section
        aria-labelledby={`${sectionId}-campaign-heading`}
        className={`${styles.section} ${styles.opening}`}
        data-content-region="campaign-opening"
      >
        <div className={styles.reading}>
          <h1 id={`${sectionId}-campaign-heading`}>{text(document.payload.title, context)}</h1>
          {document.payload.introduction ? (
            <p className={styles.introduction}>{text(document.payload.introduction, context)}</p>
          ) : null}
        </div>
      </section>
      <HomepageEditorialSection
        target={context.renderTarget ?? "preview"}
        instance={{
          id: `${sectionId}-p10b07-campaign-story`,
          component: "homepageEditorial",
          componentVersion: homepageEditorialDefinition.version,
          variant: "brandStory",
          content: { ...story },
          props: { mediaPosition: "right", textAlignment: "left", galleryColumns: 2 },
          styleOverrides: { surface: reusableSurface(surface) },
          bindings: [
            {
              slotId: "presentationContext",
              source: "projectBrandContext",
              projectId: `project_${context.catalogue.id}`,
              revision: `catalogue-${context.catalogue.id}`,
            },
            ...(media
              ? [
                  {
                    slotId: "storyPrimaryAsset" as const,
                    source: "asset" as const,
                    assetId: media.placement.assetId,
                    role: media.placement.role,
                    revision: media.placement.assetRevision,
                  },
                ]
              : []),
          ],
          assetAssignments: media
            ? [
                {
                  slotId: "storyMedia",
                  assetId: media.placement.assetId,
                  role: media.placement.role,
                },
              ]
            : [],
        }}
        projection={projectionFor(context, media)}
        activeLocale={context.activeLocale}
        primaryLocale={context.primaryLocale}
        resolveAssetUrl={(assetId) => {
          if (!media || media.presentation.asset.id !== assetId) {
            throw new Error("Campaign story media URL is outside current approved authority.");
          }
          return media.presentation.asset.url;
        }}
        onNavigate={() => undefined}
      />
      {story.steps.length ? (
        <section
          className={`${styles.section} ${styles.storyProgression}`}
          data-content-region="campaign-progression"
        >
          <ol className={styles.storySteps}>
            {story.steps.map((step) => (
              <li key={step.id} data-content-subregion="campaign-story-step">
                <h2>{text(step.title, context)}</h2>
                <p>{text(step.description, context)}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <aside className={styles.continuation} data-content-region="campaign-proposition">
        <div className={styles.continuationInner}>
          {campaign.eyebrow ? (
            <p className={styles.eyebrow}>{text(campaign.eyebrow, context)}</p>
          ) : null}
          <h2>{text(campaign.heading, context)}</h2>
          <p>{text(campaign.description, context)}</p>
          <CampaignActionLink action={action} context={context} />
        </div>
      </aside>
    </div>
  );
}

function ContactChannelsReuse({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
  mode,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
  mode: "channels" | "directory";
}) {
  const blocks = document.payload.blocks.filter(
    (
      block,
    ): block is Extract<(typeof document.payload.blocks)[number], { kind: "contact-channel" }> =>
      block.kind === "contact-channel",
  );
  const hrefFor = (block: (typeof blocks)[number]) =>
    block.channel === "email"
      ? `mailto:${block.value}`
      : block.channel === "phone"
        ? `tel:${block.value.replace(/[^+0-9]/gu, "")}`
        : undefined;
  const groupLabel = (channel: (typeof blocks)[number]["channel"]) =>
    context.activeLocale === "fi"
      ? channel === "email"
        ? "Sähköposti"
        : channel === "phone"
          ? "Puhelin"
          : "Yhteydenottolomake"
      : channel === "email"
        ? "Email"
        : channel === "phone"
          ? "Phone"
          : "Contact form";
  const groups = ["email", "phone", "contact-form"] as const;
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant,
        document,
        context,
        props,
        surface,
      })}
      data-contact-anatomy={mode}
      data-content-region={mode === "channels" ? "contactChannels" : "contactDirectory"}
    >
      <section
        aria-labelledby={`${sectionId}-heading`}
        className={`${styles.section} ${styles.opening}`}
      >
        <div className={styles.reading}>
          <h1 id={`${sectionId}-heading`}>{text(document.payload.title, context)}</h1>
          {document.payload.introduction ? (
            <p className={styles.introduction}>{text(document.payload.introduction, context)}</p>
          ) : null}
        </div>
      </section>
      {mode === "channels" ? (
        <section
          className={`${styles.section} ${styles.contactChannels}`}
          data-content-region="contact-actions"
        >
          <address className={`${styles.reading} ${styles.channelStack}`}>
            {blocks.map((block) => {
              const href = hrefFor(block);
              const content = (
                <>
                  <span>{text(block.label, context)}</span>
                  <strong>{block.value}</strong>
                </>
              );
              return href ? (
                <a
                  className={styles.channelAction}
                  href={href}
                  key={block.id}
                  data-content-subregion="contact-action"
                >
                  {content}
                </a>
              ) : (
                <div
                  className={styles.channelAction}
                  key={block.id}
                  data-content-subregion="contact-reference"
                >
                  {content}
                </div>
              );
            })}
          </address>
        </section>
      ) : (
        <section
          className={`${styles.section} ${styles.contactDirectory}`}
          data-content-region="contact-directory-groups"
        >
          <div className={`${styles.reading} ${styles.directoryGroups}`}>
            {groups.map((channel) => {
              const entries = blocks.filter((block) => block.channel === channel);
              if (!entries.length) return null;
              return (
                <section
                  className={styles.directoryGroup}
                  key={channel}
                  data-channel-group={channel}
                >
                  <h2>{groupLabel(channel)}</h2>
                  <div className={styles.contactGrid}>
                    {entries.map((block) => {
                      const href = hrefFor(block);
                      return (
                        <article
                          className={`${styles.card} ${styles.contactCard}`}
                          key={block.id}
                          data-content-subregion="directory-entry"
                        >
                          <h3>{text(block.label, context)}</h3>
                          {href ? <a href={href}>{block.value}</a> : <p>{block.value}</p>}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function LocationReuse({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
  contextRegion,
  reclassifiedFrom,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
  contextRegion: string;
  reclassifiedFrom?: string;
}) {
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant,
        document,
        context,
        props,
        surface,
        reclassifiedFrom,
      })}
      data-content-region={contextRegion}
    >
      <section
        aria-labelledby={`${sectionId}-heading`}
        className={`${styles.section} ${styles.opening}`}
      >
        <div className={styles.reading}>
          <h1 id={`${sectionId}-heading`}>{text(document.payload.title, context)}</h1>
          {document.payload.introduction ? (
            <p className={styles.introduction}>{text(document.payload.introduction, context)}</p>
          ) : null}
        </div>
      </section>
      <section
        className={`${styles.section} ${styles.locationList}`}
        data-content-region="location-list"
      >
        <div className={`${styles.reading} ${styles.locationGrid}`}>
          {document.payload.blocks.map((block) =>
            block.kind === "location" ? (
              <article
                className={`${styles.card} ${styles.locationCard}`}
                key={block.id}
                data-content-subregion="location"
              >
                <h2>{text(block.name, context)}</h2>
                <address>
                  {block.addressLines.map((line) => (
                    <span key={text(line, context)}>
                      {text(line, context)}
                      <br />
                    </span>
                  ))}
                </address>
                {block.openingHours.length ? (
                  <ul>
                    {block.openingHours.map((line) => (
                      <li key={text(line, context)}>{text(line, context)}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ) : null,
          )}
        </div>
      </section>
    </div>
  );
}

function FAQReuse({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
  mode,
  reclassifiedFrom,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
  mode: "disclosure" | "guide";
  reclassifiedFrom?: string;
}) {
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant,
        document,
        context,
        props,
        surface,
        reclassifiedFrom,
      })}
      data-content-region={mode === "guide" ? "faq-topic-guide" : "faq-disclosure"}
    >
      <section
        aria-labelledby={`${sectionId}-heading`}
        className={`${styles.section} ${styles.opening}`}
      >
        <div className={styles.reading}>
          <h1 id={`${sectionId}-heading`}>{text(document.payload.title, context)}</h1>
          {document.payload.introduction ? (
            <p className={styles.introduction}>{text(document.payload.introduction, context)}</p>
          ) : null}
        </div>
      </section>
      <section
        className={`${styles.section} ${styles.faqRegion}`}
        data-content-region="faq-content"
      >
        <div className={`${styles.reading} ${styles.faqGrid}`}>
          {document.payload.blocks.map((block) =>
            block.kind === "faq" ? (
              <details
                className={mode === "guide" ? styles.faqGuide : styles.faq}
                key={block.id}
                data-content-subregion="faq-entry"
              >
                <summary>{text(block.question, context)}</summary>
                <p>{text(block.answer, context)}</p>
              </details>
            ) : null,
          )}
        </div>
      </section>
    </div>
  );
}

function PolicyReadingReuse({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
}) {
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant,
        document,
        context,
        props,
        surface,
      })}
      data-content-region="policy-reading"
    >
      <section
        aria-labelledby={`${sectionId}-heading`}
        className={`${styles.section} ${styles.opening}`}
      >
        <div className={styles.reading}>
          <h1 id={`${sectionId}-heading`}>{text(document.payload.title, context)}</h1>
          {document.payload.introduction ? (
            <p className={styles.introduction}>{text(document.payload.introduction, context)}</p>
          ) : null}
        </div>
      </section>
      <section
        className={`${styles.section} ${styles.policyReading}`}
        data-content-region="policy-body"
      >
        <div className={`${styles.reading} ${styles.legalSequence}`}>
          {document.payload.blocks.map((block) =>
            block.kind === "policy-section" ? (
              <article className={styles.article} key={block.id} data-content-subregion="policy">
                <h2>{text(block.heading, context)}</h2>
                <p>{text(block.body, context)}</p>
              </article>
            ) : null,
          )}
        </div>
      </section>
    </div>
  );
}

function ServiceDetailsReuse({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
}) {
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant,
        document,
        context,
        props,
        surface,
      })}
      data-content-region="service-details"
    >
      <section
        aria-labelledby={`${sectionId}-heading`}
        className={`${styles.section} ${styles.opening}`}
      >
        <div className={styles.reading}>
          <h1 id={`${sectionId}-heading`}>{text(document.payload.title, context)}</h1>
          {document.payload.introduction ? (
            <p className={styles.introduction}>{text(document.payload.introduction, context)}</p>
          ) : null}
        </div>
      </section>
      <section
        className={`${styles.section} ${styles.serviceDetails}`}
        data-content-region="service-sections"
      >
        <div className={`${styles.reading} ${styles.serviceGrid}`}>
          {document.payload.blocks.map((block) =>
            block.kind === "policy-section" ? (
              <article
                className={`${styles.card} ${styles.serviceCard}`}
                key={block.id}
                data-content-subregion="service-section"
              >
                <h2>{text(block.heading, context)}</h2>
                <p>{text(block.body, context)}</p>
              </article>
            ) : null,
          )}
        </div>
      </section>
    </div>
  );
}

function GenericReadingReuse({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
}) {
  const blocks = document.payload.blocks;
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant,
        document,
        context,
        props,
        surface,
      })}
    >
      <section
        aria-labelledby={`${sectionId}-heading`}
        className={`${styles.section} ${styles.opening}`}
      >
        <div className={styles.reading}>
          <h1 id={`${sectionId}-heading`}>{text(document.payload.title, context)}</h1>
          {document.payload.introduction ? (
            <p className={styles.introduction}>{text(document.payload.introduction, context)}</p>
          ) : null}
        </div>
      </section>
      <section
        className={`${styles.section} ${styles.genericReading}`}
        data-content-region="generic-reading"
      >
        <div className={`${styles.reading} ${styles.readingFlow}`}>
          {blocks.map((block) =>
            block.kind === "paragraph" ? (
              <article className={styles.article} key={block.id} data-content-subregion="paragraph">
                {block.heading ? <h2>{text(block.heading, context)}</h2> : null}
                <p>{text(block.body, context)}</p>
              </article>
            ) : null,
          )}
        </div>
      </section>
    </div>
  );
}

function ContentSupportReading({
  sectionId,
  variant,
  document,
  context,
  props,
  surface,
  media,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
  media: ResolvedContentSupportMedia | null;
}) {
  const payload = document.payload;
  if (variant === "aboutStory") {
    return (
      <StorytellingReuse
        sectionId={sectionId}
        variant={variant}
        editorialVariant="brandStory"
        document={document}
        context={context}
        props={props}
        surface={surface}
        media={media}
        openingRegion="about-story"
      />
    );
  }
  if (variant === "aboutProcess") {
    return (
      <StorytellingReuse
        sectionId={sectionId}
        variant={variant}
        editorialVariant="craftProcess"
        document={document}
        context={context}
        props={props}
        surface={surface}
        media={media}
        openingRegion="about-process"
        includeProcessSteps
      />
    );
  }
  if (variant === "contactChannels" || variant === "contactDirectory") {
    return (
      <ContactChannelsReuse
        sectionId={sectionId}
        variant={variant}
        document={document}
        context={context}
        props={props}
        surface={surface}
        mode={variant === "contactDirectory" ? "directory" : "channels"}
      />
    );
  }
  if (variant === "locationDirectory" || variant === "locationAppointments") {
    const renderedVariant = "locationDirectory";
    return (
      <LocationReuse
        sectionId={sectionId}
        variant={renderedVariant}
        document={document}
        context={context}
        props={props}
        surface={surface}
        contextRegion={renderedVariant}
        reclassifiedFrom={variant === "locationAppointments" ? variant : undefined}
      />
    );
  }
  if (variant === "faqDisclosure" || variant === "faqTopicGuide") {
    return (
      <FAQReuse
        sectionId={sectionId}
        variant="faqDisclosure"
        document={document}
        context={context}
        props={props}
        surface={surface}
        mode="disclosure"
        reclassifiedFrom={variant === "faqTopicGuide" ? variant : undefined}
      />
    );
  }
  if (variant === "serviceDetails") {
    return (
      <ServiceDetailsReuse
        sectionId={sectionId}
        variant={variant}
        document={document}
        context={context}
        props={props}
        surface={surface}
      />
    );
  }
  if (variant === "policyReading") {
    return (
      <PolicyReadingReuse
        sectionId={sectionId}
        variant={variant}
        document={document}
        context={context}
        props={props}
        surface={surface}
      />
    );
  }
  if (variant === "genericReading") {
    return (
      <GenericReadingReuse
        sectionId={sectionId}
        variant={variant}
        document={document}
        context={context}
        props={props}
        surface={surface}
      />
    );
  }
  if (variant === "genericEditorial") {
    return (
      <StorytellingReuse
        sectionId={sectionId}
        variant={variant}
        editorialVariant="brandStory"
        document={document}
        context={context}
        props={props}
        surface={surface}
        media={media}
        openingRegion="generic-editorial"
      />
    );
  }
  if (variant === "campaignStory" && payload.story) {
    return (
      <CampaignStoryReuse
        sectionId={sectionId}
        document={document}
        context={context}
        props={props}
        surface={surface}
        media={media}
        action={resolvedCampaignAction(document, context)}
      />
    );
  }
  if (
    variant === "campaignEditorial" ||
    variant === "campaignImageLed" ||
    variant === "campaignStory"
  ) {
    const effectiveVariant =
      variant === "campaignImageLed" && media ? "campaignImageLed" : "campaignEditorial";
    return (
      <CampaignReuse
        sectionId={sectionId}
        variant={effectiveVariant}
        document={document}
        context={context}
        props={props}
        surface={surface}
        media={media}
        action={resolvedCampaignAction(document, context)}
        requestedVariant={effectiveVariant === variant ? undefined : variant}
      />
    );
  }
  return (
    <div
      {...contentSupportSectionAttributes({
        sectionId,
        variant,
        document,
        context,
        props,
        surface,
      })}
      aria-labelledby={`${sectionId}-heading`}
      className={`${styles.section} ${styles.genericReading}`}
    >
      <div className={styles.reading}>
        <h1 id={`${sectionId}-heading`}>{text(payload.title, context)}</h1>
        {payload.introduction ? (
          <p className={styles.introduction}>{text(payload.introduction, context)}</p>
        ) : null}
        {payload.blocks.map((block) => {
          switch (block.kind) {
            case "paragraph":
              return (
                <article className={styles.article} key={block.id}>
                  {block.heading ? <h2>{text(block.heading, context)}</h2> : null}
                  <p>{text(block.body, context)}</p>
                </article>
              );
            case "contact-channel":
              return (
                <article className={`${styles.card} ${styles.contactCard}`} key={block.id}>
                  <h2>{text(block.label, context)}</h2>
                  {block.channel === "email" ? (
                    <a href={`mailto:${block.value}`}>{block.value}</a>
                  ) : (
                    <p>{block.value}</p>
                  )}
                </article>
              );
            case "location":
              return (
                <article className={`${styles.card} ${styles.locationCard}`} key={block.id}>
                  <h2>{text(block.name, context)}</h2>
                  <address>
                    {block.addressLines.map((line) => (
                      <span key={text(line, context)}>
                        {text(line, context)}
                        <br />
                      </span>
                    ))}
                  </address>
                  {block.openingHours.length ? (
                    <ul>
                      {block.openingHours.map((line) => (
                        <li key={text(line, context)}>{text(line, context)}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            case "faq":
              return (
                <details className={styles.faq} key={block.id}>
                  <summary>{text(block.question, context)}</summary>
                  <p>{text(block.answer, context)}</p>
                </details>
              );
            case "policy-section":
              return (
                <article className={styles.article} key={block.id}>
                  <h2>{text(block.heading, context)}</h2>
                  <p>{text(block.body, context)}</p>
                </article>
              );
          }
        })}
      </div>
    </div>
  );
}

export function validateContentSupportPageDocuments(
  page: PageModel,
  context?: StorefrontRenderContext,
): void {
  if (!context || !page.pageFamily) return;
  for (const section of page.sections.filter(
    (candidate) => candidate.component === "contentSupport",
  )) {
    const content = contentSupportContentSchema.parse(section.content);
    const document = supportedDocument(context, content.factDocumentId);
    if (document.payload.familyId !== page.pageFamily.familyId) {
      throw new Error("A content/support fact document must match its canonical page family.");
    }
    if (
      !page.pageFamily.evidenceReferences.some(
        (reference) => canonicalValueString(reference) === canonicalValueString(document.evidence),
      )
    ) {
      throw new Error("A content/support page must retain its approved fact evidence reference.");
    }
  }
}

export const contentSupportBridgeDefinitions = {
  contentSupport: defineComponent({
    type: "contentSupport",
    label: "Content and support",
    allowedPageTypes: [...contentSupportDefinition.supportedPageTypes],
    variants: contentSupportBridgeVariants,
    defaultVariant: firstVariant,
    contentSchema: contentSupportContentSchema,
    propsSchema: contentSupportPropsSchema,
    defaultContent: contentSupportBridgeDefaults.contentSupport.content,
    defaultProps: contentSupportBridgeDefaults.contentSupport.props,
    editorFields: {},
    protectedFields: {
      readOnlyPaths: [
        "content.factDocumentId",
        "bindings.supportFacts",
        "bindings.campaignAction",
        "assets.*.provenance",
      ],
    },
    validateContext: ({
      sectionId,
      variant,
      content,
      props,
      styleOverrides,
      approvedAssetPlacements,
      approvedAssetPresentations,
      context,
    }) => {
      instanceFor(
        sectionId,
        variant,
        content,
        props,
        styleOverrides,
        approvedAssetPlacements,
        approvedAssetPresentations,
        context,
      );
    },
    renderer: ({
      sectionId,
      variant,
      content,
      props,
      styleOverrides,
      approvedAssetPlacements,
      approvedAssetPresentations,
      context,
    }) => {
      const resolved = instanceFor(
        sectionId,
        variant,
        content,
        props,
        styleOverrides,
        approvedAssetPlacements,
        approvedAssetPresentations,
        context,
      );
      const document = supportedDocument(context, content.factDocumentId);
      return (
        <ContentSupportReading
          sectionId={resolved.instance.id}
          variant={variant}
          document={document}
          context={context}
          props={resolved.props}
          surface={resolved.styleOverrides.surface}
          media={resolved.media}
        />
      );
    },
  }),
} as const satisfies Record<ContentSupportBridgeComponent, ComponentDefinition>;

/** The same registered bridge is used for editor, preview, and published rendering. */
export const contentSupportComponentByTarget = {
  editor: contentSupportBridgeDefinitions.contentSupport.render,
  preview: contentSupportBridgeDefinitions.contentSupport.render,
  published: contentSupportBridgeDefinitions.contentSupport.render,
} as const;
