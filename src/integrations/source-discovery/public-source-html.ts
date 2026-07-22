export type PublicHtmlAssetCandidate = Readonly<{
  url: string;
  kind: "open-graph-image" | "favicon" | "logo";
  extractionLocation: string;
}>;

export type PublicHtmlExtraction = Readonly<{
  title: string | null;
  metaDescription: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  openGraphSiteName: string | null;
  declaredLanguage: string | null;
  canonicalUrl: string | null;
  themeColour: string | null;
  brandNameCandidates: readonly string[];
  marketingCopyCandidates: readonly string[];
  assets: readonly PublicHtmlAssetCandidate[];
  hasRecognizedHtml: boolean;
}>;

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function cleanText(value: string | undefined, maxLength = 500): string | null {
  if (!value) return null;
  const cleaned = decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function attributes(tag: string): Record<string, string> {
  const values: Record<string, string> = {};
  const expression = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(expression)) {
    const name = match[1]?.toLowerCase();
    if (!name || name.startsWith("<")) continue;
    values[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return values;
}

function tags(html: string, name: string): Array<Record<string, string>> {
  const expression = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return [...html.matchAll(expression)].map((match) => attributes(match[0]));
}

function metaContent(
  metas: readonly Record<string, string>[],
  attribute: "name" | "property",
  value: string,
): string | null {
  const match = metas.find((meta) => meta[attribute]?.toLowerCase() === value.toLowerCase());
  return cleanText(match?.content);
}

function unique(values: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function visibleTextCandidates(html: string, tagName: "h1" | "h2" | "p"): string[] {
  const expression = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "gi");
  return [...html.matchAll(expression)]
    .map((match) => cleanText(match[1]))
    .filter((value): value is string => value !== null);
}

export function extractPublicHtml(htmlInput: string): PublicHtmlExtraction {
  const html = htmlInput
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const metas = tags(html, "meta");
  const links = tags(html, "link");
  const images = tags(html, "img");
  const htmlAttributes = tags(html, "html")[0] ?? {};
  const title = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const metaDescription = metaContent(metas, "name", "description");
  const openGraphTitle = metaContent(metas, "property", "og:title");
  const openGraphDescription = metaContent(metas, "property", "og:description");
  const openGraphSiteName = metaContent(metas, "property", "og:site_name");
  const openGraphImage = metaContent(metas, "property", "og:image");
  const themeColour = metaContent(metas, "name", "theme-color");
  const canonicalUrl =
    links.find((link) => link.rel?.toLowerCase().split(/\s+/).includes("canonical"))?.href ?? null;
  const firstHeading = visibleTextCandidates(html, "h1")[0] ?? null;
  const brandNameCandidates = unique([openGraphSiteName, firstHeading]);
  const marketingCopyCandidates = unique([
    metaDescription,
    openGraphDescription,
    ...visibleTextCandidates(html, "h1"),
    ...visibleTextCandidates(html, "h2"),
    ...visibleTextCandidates(html, "p").slice(0, 3),
  ]).slice(0, 8);
  const assets: PublicHtmlAssetCandidate[] = [];
  if (openGraphImage) {
    assets.push({
      url: openGraphImage,
      kind: "open-graph-image",
      extractionLocation: "head meta[property=og:image]",
    });
  }
  for (const link of links) {
    const rel = link.rel?.toLowerCase().split(/\s+/) ?? [];
    if (!link.href || (!rel.includes("icon") && !rel.includes("logo"))) continue;
    assets.push({
      url: link.href,
      kind: rel.includes("logo") ? "logo" : "favicon",
      extractionLocation: `head link[rel=${rel.join(" ")}]`,
    });
  }
  for (const image of images) {
    const identity = `${image.id ?? ""} ${image.class ?? ""} ${image.alt ?? ""}`.toLowerCase();
    if (!image.src || !identity.includes("logo")) continue;
    assets.push({
      url: image.src,
      kind: "logo",
      extractionLocation: "body img[logo-candidate]",
    });
  }

  return {
    title,
    metaDescription,
    openGraphTitle,
    openGraphDescription,
    openGraphSiteName,
    declaredLanguage: cleanText(htmlAttributes.lang, 35),
    canonicalUrl,
    themeColour,
    brandNameCandidates,
    marketingCopyCandidates,
    assets,
    hasRecognizedHtml:
      /<(?:html|head|body|title|meta|link|h1|h2|p|img)\b/i.test(html) && html.trim().length > 0,
  };
}
