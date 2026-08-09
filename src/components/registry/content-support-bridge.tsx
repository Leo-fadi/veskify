import { componentInstanceV2Schema, type ComponentInstanceV2 } from "@/domain/component-platform";
import {
  canonicalValueString,
  type ContentSupportFactDocument,
  type PageModel,
} from "@/domain/storefront";
import { resolveLocalizedText } from "@/domain/shared";
import {
  HomepageEditorialSection,
  HomepagePromotionSection,
} from "@/components/storefront/homepage-commerce";
import {
  defineComponent,
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
} from "./content-support";
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

function projectionFor(context: StorefrontRenderContext) {
  const documents = context.contentSupportFactDocuments ?? [];
  const revision = `catalogue-${context.catalogue.id}`;
  return {
    products: [],
    collections: [],
    assets: [],
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
  context: StorefrontRenderContext,
): ComponentInstanceV2 {
  const parsedContent = contentSupportContentSchema.parse(content);
  const document = supportedDocument(context, parsedContent.factDocumentId);
  const instance = componentInstanceV2Schema.parse({
    id: sectionId,
    component: "contentSupport",
    componentVersion: contentSupportDefinition.version,
    variant,
    content: parsedContent,
    props: contentSupportPropsSchema.parse(props),
    styleOverrides: contentSupportStyleOverridesSchema.parse({ surface: "plain" }),
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
    assetAssignments: [],
  });
  return veskifyComponentRegistryV2.validateInstanceConformance(instance, projectionFor(context));
}

function text(value: Record<string, string>, context: StorefrontRenderContext) {
  return resolveLocalizedText(value, context.activeLocale, context.primaryLocale);
}

function StorytellingReuse({
  sectionId,
  variant,
  document,
  context,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
}) {
  const story = document.payload.story;
  if (!story) throw new Error("The selected content/support layout requires approved story facts.");
  return (
    <HomepageEditorialSection
      target={context.renderTarget ?? "preview"}
      instance={{
        id: `${sectionId}-p10b07-story`,
        component: "homepageEditorial",
        componentVersion: { major: 2, minor: 0, patch: 0 },
        variant: variant === "aboutProcess" ? "craftProcess" : "brandStory",
        content: { ...story },
        props: {
          mediaPosition: "right",
          textAlignment: "left",
          galleryColumns: 2,
        },
        styleOverrides: { surface: "plain" },
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
  );
}

function CampaignReuse({
  sectionId,
  variant,
  document,
  context,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
}) {
  const campaign = document.payload.campaign;
  if (!campaign) throw new Error("The selected campaign layout requires approved campaign facts.");
  return (
    <HomepagePromotionSection
      target={context.renderTarget ?? "preview"}
      instance={{
        id: `${sectionId}-p10b07-campaign`,
        component: "homepagePromotion",
        componentVersion: { major: 2, minor: 0, patch: 0 },
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
        styleOverrides: { surface: "plain" },
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
  );
}

function ContentSupportReading({
  sectionId,
  variant,
  document,
  context,
}: {
  sectionId: string;
  variant: string;
  document: ContentSupportFactDocument;
  context: StorefrontRenderContext;
}) {
  const payload = document.payload;
  if (["aboutStory", "aboutProcess", "genericEditorial"].includes(variant)) {
    return (
      <StorytellingReuse
        sectionId={sectionId}
        variant={variant}
        document={document}
        context={context}
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
      />
    );
  }
  const blocks = payload.blocks;
  return (
    <section
      aria-labelledby={`${sectionId}-heading`}
      className={styles.section}
      data-component="contentSupport"
      data-evidence-id={document.evidence.authorityId}
      data-page-family={payload.familyId}
      data-render-target={context.renderTarget ?? "preview"}
      data-responsive-layout="governed-content-support"
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
    validateContext: ({ sectionId, variant, content, props, context }) => {
      instanceFor(sectionId, variant, content, props, context);
    },
    renderer: ({ sectionId, variant, content, props, context }) => {
      const instance = instanceFor(sectionId, variant, content, props, context);
      const document = supportedDocument(context, content.factDocumentId);
      return (
        <ContentSupportReading
          sectionId={instance.id}
          variant={variant}
          document={document}
          context={context}
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
