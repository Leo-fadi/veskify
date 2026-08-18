import type { CSSProperties } from "react";
import Image from "next/image";
import {
  responsiveImageBreakpoints,
  type ResponsiveImageAuthority,
  type ResponsiveImageBreakpoint,
  type ResponsiveImageTreatment,
} from "@/domain/asset-presentation";
import { safeExternalUrlSchema, type AssetRef } from "@/domain/shared";
import { resolveResponsiveImage } from "@/application/responsive-image-authority";
import styles from "./responsive-storefront-image.module.css";

type ArtStyle = CSSProperties & Record<`--art-${string}`, string>;

export type StorefrontImageLoadingRole = "primary" | "content" | "merchandising" | "thumbnail";

const loadingAuthority: Readonly<
  Record<
    StorefrontImageLoadingRole,
    Readonly<{
      loading: "eager" | "lazy";
      fetchPriority: "high" | "low" | "auto";
      decoding: "async";
      sizes: string;
    }>
  >
> = {
  primary: {
    loading: "eager",
    fetchPriority: "high",
    decoding: "async",
    sizes: "100vw",
  },
  content: {
    loading: "lazy",
    fetchPriority: "auto",
    decoding: "async",
    sizes: "(max-width: 767px) 100vw, (max-width: 1439px) 75vw, 64rem",
  },
  merchandising: {
    loading: "lazy",
    fetchPriority: "auto",
    decoding: "async",
    sizes: "(max-width: 767px) 100vw, (max-width: 1023px) 50vw, (max-width: 1439px) 33vw, 25vw",
  },
  thumbnail: {
    loading: "lazy",
    fetchPriority: "low",
    decoding: "async",
    sizes: "6rem",
  },
};

const media: Readonly<Record<ResponsiveImageBreakpoint, string>> = {
  mobile: "(max-width: 767px)",
  tablet: "(min-width: 768px) and (max-width: 1023px)",
  desktop: "(min-width: 1024px) and (max-width: 1439px)",
  wide: "(min-width: 1440px)",
};
const ratio: Readonly<Record<ResponsiveImageTreatment["ratio"], string>> = {
  natural: "auto",
  square: "1 / 1",
  portrait: "4 / 5",
  landscape: "4 / 3",
  wide: "16 / 9",
};
const overlayBackground: Readonly<Record<ResponsiveImageTreatment["overlay"], string>> = {
  none: "transparent",
  subtle: "rgb(0 0 0 / 12%)",
  contrast: "rgb(0 0 0 / 42%)",
  gradient: "linear-gradient(180deg, transparent 25%, rgb(0 0 0 / 52%))",
};

function treatmentStyle(prefix: string, treatment: ResponsiveImageTreatment): ArtStyle {
  const rect = treatment.crop.rect;
  return {
    [`--art-${prefix}-fit`]: rect
      ? "fill"
      : treatment.crop.mode === "natural"
        ? "contain"
        : treatment.crop.mode === "editorial"
          ? "cover"
          : treatment.crop.mode,
    [`--art-${prefix}-position`]: `${treatment.focalPoint.x * 100}% ${treatment.focalPoint.y * 100}%`,
    [`--art-${prefix}-crop-left`]: rect ? `${(-rect.x / rect.width) * 100}%` : "0%",
    [`--art-${prefix}-crop-top`]: rect ? `${(-rect.y / rect.height) * 100}%` : "0%",
    [`--art-${prefix}-crop-width`]: rect ? `${100 / rect.width}%` : "100%",
    [`--art-${prefix}-crop-height`]: rect ? `${100 / rect.height}%` : "100%",
    [`--art-${prefix}-ratio`]: ratio[treatment.ratio],
    [`--art-${prefix}-overlay-background`]: overlayBackground[treatment.overlay],
  };
}

export function ResponsiveStorefrontImage({
  asset,
  responsiveAssets = [],
  authority,
  alt,
  className,
  loadingRole = "content",
}: {
  asset: AssetRef;
  responsiveAssets?: readonly AssetRef[];
  authority?: ResponsiveImageAuthority;
  alt: string;
  className?: string;
  loadingRole?: StorefrontImageLoadingRole;
}) {
  const loading = loadingAuthority[loadingRole];
  if (!authority) {
    const external = safeExternalUrlSchema.safeParse(asset.url);
    return external.success ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={alt}
        className={className}
        data-image-loading-role={loadingRole}
        decoding={loading.decoding}
        fetchPriority={loading.fetchPriority}
        height={900}
        loading={loading.loading}
        sizes={loading.sizes}
        src={new URL(external.data.trim()).href}
        width={1200}
      />
    ) : (
      <Image
        alt={alt}
        className={className}
        data-image-loading-role={loadingRole}
        decoding={loading.decoding}
        fetchPriority={loading.fetchPriority}
        height={900}
        loading={loading.loading}
        sizes={loading.sizes}
        src={asset.url}
        width={1200}
      />
    );
  }
  const resolved = Object.fromEntries(
    responsiveImageBreakpoints.map((breakpoint) => [
      breakpoint,
      resolveResponsiveImage(authority, breakpoint),
    ]),
  ) as Record<ResponsiveImageBreakpoint, ReturnType<typeof resolveResponsiveImage>>;
  const style = responsiveImageBreakpoints.reduce<ArtStyle>(
    (current, breakpoint) => ({
      ...current,
      ...treatmentStyle(breakpoint, resolved[breakpoint].treatment),
    }),
    {},
  );
  const sourceUrl = safeExternalUrlSchema.safeParse(asset.url).success
    ? new URL(asset.url.trim()).href
    : asset.url;
  const responsiveAssetById = new Map(
    responsiveAssets.map((responsiveAsset) => [responsiveAsset.id, responsiveAsset]),
  );
  const urlForSource = (sourceId: string) => {
    const selectedAsset = sourceId === asset.id ? asset : responsiveAssetById.get(sourceId);
    if (!selectedAsset) {
      throw new Error(`Responsive image source ${sourceId} has no approved URL projection.`);
    }
    return safeExternalUrlSchema.safeParse(selectedAsset.url).success
      ? new URL(selectedAsset.url.trim()).href
      : selectedAsset.url;
  };
  return (
    <span
      className={`${styles.frame}${className ? ` ${className}` : ""}`}
      data-art-direction-contract={authority.contractVersion}
      data-art-direction-fingerprint={authority.fingerprint}
      data-art-direction-source-id={authority.source.assetId}
      data-image-loading-role={loadingRole}
      style={style}
    >
      <picture className={styles.picture}>
        {[...responsiveImageBreakpoints].reverse().map((breakpoint) => {
          const sourceChanged = resolved[breakpoint].source.assetId !== authority.source.assetId;
          const treatmentChanged =
            JSON.stringify(resolved[breakpoint].treatment) !==
            JSON.stringify(authority.sourceTreatment);
          return (
            <source
              data-art-breakpoint={breakpoint}
              data-art-crop={resolved[breakpoint].treatment.crop.mode}
              data-art-crop-rect={
                resolved[breakpoint].treatment.crop.rect
                  ? `${resolved[breakpoint].treatment.crop.rect.x},${resolved[breakpoint].treatment.crop.rect.y},${resolved[breakpoint].treatment.crop.rect.width},${resolved[breakpoint].treatment.crop.rect.height}`
                  : undefined
              }
              data-art-derivative-id={resolved[breakpoint].derivativeId}
              data-art-focal={`${resolved[breakpoint].treatment.focalPoint.x},${resolved[breakpoint].treatment.focalPoint.y}`}
              data-art-overlay={resolved[breakpoint].treatment.overlay}
              data-art-ratio={resolved[breakpoint].treatment.ratio}
              data-art-selected-breakpoint={resolved[breakpoint].selectedBreakpoint}
              data-art-source-change={sourceChanged ? "changed" : "same"}
              data-art-source-id={resolved[breakpoint].source.assetId}
              data-art-treatment-change={treatmentChanged ? "changed" : "same"}
              data-art-responsive-result={
                sourceChanged && treatmentChanged
                  ? "source-and-treatment"
                  : sourceChanged
                    ? "source-only"
                    : treatmentChanged
                      ? "treatment-only"
                      : "no-change"
              }
              key={breakpoint}
              media={media[breakpoint]}
              sizes={loading.sizes}
              srcSet={urlForSource(resolved[breakpoint].source.assetId)}
            />
          );
        })}
        {/* Exact approved alternate source URLs are used when present; CDN derivative URLs remain deferred. */}
        <img
          alt={alt}
          className={styles.image}
          data-image-loading-role={loadingRole}
          decoding={loading.decoding}
          fetchPriority={loading.fetchPriority}
          height={900}
          loading={loading.loading}
          sizes={loading.sizes}
          src={sourceUrl}
          width={1200}
        />
      </picture>
    </span>
  );
}
