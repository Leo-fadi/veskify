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
    navigation: [],
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
}> {
  const parsedContent = contentSupportContentSchema.parse(content);
  const document = supportedDocument(context, parsedContent.factDocumentId);
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
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
  media: ResolvedContentSupportMedia | null;
}) {
  const story = document.payload.story;
  if (!story) throw new Error("The selected content/support layout requires approved story facts.");
  const additionalBlocks = document.payload.blocks.filter(
    (block) =>
      block.kind !== "paragraph" ||
      canonicalValueString(block.body) !== canonicalValueString(story.body),
  );
  const firstCollection = context.catalogue.collections[0];
  const collectionPaths = new Set([
    ...context.pages
      .filter((page) => page.type === "collection")
      .map((page) => context.pagePaths[page.id])
      .filter((path): path is string => path !== undefined),
    ...(context.dynamicCommercePresentation?.routeInventory
      .filter((route) => route.kind === "collection")
      .map((route) => context.pagePaths[route.id])
      .filter((path): path is string => path !== undefined) ?? []),
  ]);
  const approvedCollectionPath = context.navigation.primary
    .map((item) =>
      resolveStorefrontNavigationPath(context, {
        type: "navigateToApprovedAction",
        navigationId: item.id,
      }),
    )
    .find((path) => path !== undefined && collectionPaths.has(path));
  const continuationPath =
    approvedCollectionPath ??
    (firstCollection
      ? resolveStorefrontNavigationPath(context, {
          type: "navigateToCollection",
          collectionId: firstCollection.id,
        })
      : undefined);
  const contributionCount =
    1 +
    additionalBlocks.filter(({ kind }) => kind === "paragraph").length +
    (document.payload.campaign?.actionLabel && continuationPath ? 1 : 0);
  return (
    <div
      {...contentResponsiveAttributes(variant)}
      data-component="contentSupport"
      data-content-contribution-count={contributionCount}
      data-evidence-id={document.evidence.authorityId}
      data-page-family={document.payload.familyId}
      data-render-target={context.renderTarget ?? "preview"}
      data-responsive-layout="governed-content-support"
      data-reading-width={props.readingWidth}
      data-surface={surface}
      data-text-alignment={props.textAlignment}
      data-variant={variant}
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
      <HomepageEditorialSection
        target={context.renderTarget ?? "preview"}
        instance={{
          id: `${sectionId}-p10b07-story`,
          component: "homepageEditorial",
          componentVersion: homepageEditorialDefinition.version,
          variant: variant === "aboutProcess" ? "craftProcess" : "brandStory",
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
        <section className={`${styles.section} ${styles.factSequence}`}>
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
      {document.payload.campaign?.actionLabel && continuationPath ? (
        <aside className={styles.continuation} data-content-region="continuation">
          <div className={styles.continuationInner}>
            {document.payload.campaign.eyebrow ? (
              <p className={styles.eyebrow}>{text(document.payload.campaign.eyebrow, context)}</p>
            ) : null}
            <h2>{text(document.payload.campaign.heading, context)}</h2>
            <p>{text(document.payload.campaign.description, context)}</p>
            <a href={continuationPath}>{text(document.payload.campaign.actionLabel, context)}</a>
          </div>
        </aside>
      ) : null}
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
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
  props: ContentSupportProps;
  surface: ContentSupportStyleOverrides["surface"];
}) {
  const campaign = document.payload.campaign;
  if (!campaign) throw new Error("The selected campaign layout requires approved campaign facts.");
  return (
    <div
      {...contentResponsiveAttributes(variant)}
      data-component="contentSupport"
      data-reading-width={props.readingWidth}
      data-surface={surface}
      data-text-alignment={props.textAlignment}
      data-variant={variant}
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
          ],
          assetAssignments: [],
        }}
        projection={projectionFor(context)}
        activeLocale={context.activeLocale}
        primaryLocale={context.primaryLocale}
        resolveAssetUrl={() => "/seed-assets/placeholder.svg"}
        onNavigate={() => undefined}
      />
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
  if (["aboutStory", "aboutProcess", "genericEditorial"].includes(variant)) {
    return (
      <StorytellingReuse
        sectionId={sectionId}
        variant={variant}
        document={document}
        context={context}
        props={props}
        surface={surface}
        media={media}
      />
    );
  }
  if (["campaignEditorial", "campaignImageLed", "campaignStory"].includes(variant)) {
    return (
      <CampaignReuse
        sectionId={sectionId}
        variant={variant}
        document={document}
        context={context}
        props={props}
        surface={surface}
      />
    );
  }
  const blocks = payload.blocks;
  return (
    <section
      {...contentResponsiveAttributes(variant)}
      aria-labelledby={`${sectionId}-heading`}
      className={styles.section}
      data-component="contentSupport"
      data-evidence-id={document.evidence.authorityId}
      data-page-family={payload.familyId}
      data-render-target={context.renderTarget ?? "preview"}
      data-responsive-layout="governed-content-support"
      data-reading-width={props.readingWidth}
      data-surface={surface}
      data-text-alignment={props.textAlignment}
      data-variant={variant}
    >
      <div className={styles.reading}>
        <h1 id={`${sectionId}-heading`}>{text(payload.title, context)}</h1>
        {payload.introduction ? (
          <p className={styles.introduction}>{text(payload.introduction, context)}</p>
        ) : null}
        {blocks.map((block) => {
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
                <article className={styles.card} key={block.id}>
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
                <article className={styles.card} key={block.id}>
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
    </section>
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
      readOnlyPaths: ["content.factDocumentId", "bindings.supportFacts", "assets.*.provenance"],
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
