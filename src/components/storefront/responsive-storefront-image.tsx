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
  return {
    [`--art-${prefix}-fit`]:
      treatment.crop.mode === "natural"
        ? "contain"
        : treatment.crop.mode === "editorial"
          ? "cover"
          : treatment.crop.mode,
    [`--art-${prefix}-position`]: `${treatment.focalPoint.x * 100}% ${treatment.focalPoint.y * 100}%`,
    [`--art-${prefix}-ratio`]: ratio[treatment.ratio],
    [`--art-${prefix}-overlay-background`]: overlayBackground[treatment.overlay],
  };
}

export function ResponsiveStorefrontImage({
  asset,
  authority,
  alt,
  className,
}: {
  asset: AssetRef;
  authority?: ResponsiveImageAuthority;
  alt: string;
  className?: string;
}) {
  if (!authority) {
    const external = safeExternalUrlSchema.safeParse(asset.url);
    return external.success ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={alt}
        className={className}
        height={900}
        src={new URL(external.data.trim()).href}
        width={1200}
      />
    ) : (
      <Image alt={alt} className={className} height={900} src={asset.url} width={1200} />
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
  return (
    <span
      className={`${styles.frame}${className ? ` ${className}` : ""}`}
      data-art-direction-contract={authority.contractVersion}
      data-art-direction-fingerprint={authority.fingerprint}
      data-art-direction-source-id={authority.source.assetId}
      style={style}
    >
      <picture className={styles.picture}>
        {[...responsiveImageBreakpoints].reverse().map((breakpoint) => (
          <source
            data-art-breakpoint={breakpoint}
            data-art-crop={resolved[breakpoint].treatment.crop.mode}
            data-art-derivative-id={resolved[breakpoint].derivativeId}
            data-art-focal={`${resolved[breakpoint].treatment.focalPoint.x},${resolved[breakpoint].treatment.focalPoint.y}`}
            data-art-overlay={resolved[breakpoint].treatment.overlay}
            data-art-ratio={resolved[breakpoint].treatment.ratio}
            data-art-selected-breakpoint={resolved[breakpoint].selectedBreakpoint}
            key={breakpoint}
            media={media[breakpoint]}
            srcSet={sourceUrl}
          />
        ))}
        {/* The source URL is immutable authority; CDN derivative URL materialization is deferred. */}
        <img alt={alt} className={styles.image} height={900} src={sourceUrl} width={1200} />
      </picture>
    </span>
  );
}
