import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ARCHIVE_TIMESTAMP = new Date("2000-01-01T00:00:00Z");
const EXPORTER_VERSION = "1.1.0";
const PORTRAIT_WIDTH = 9360;
const LANDSCAPE_WIDTH = 12960;
const HYPERLINK_RELATIONSHIP_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const stripInlineMarkdown = (value) =>
  value
    .replaceAll(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replaceAll(/\*\*([^*]+)\*\*/g, "$1")
    .replaceAll(/\*([^*]+)\*/g, "$1")
    .replaceAll(/`([^`]+)`/g, "$1")
    .trim();

const runXml = (text, { bold = false, italic = false, code = false, link = false } = {}) => {
  const preserved = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  const font = code ? "Consolas" : "Calibri";
  const properties = [
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`,
    bold ? "<w:b/><w:bCs/>" : "",
    italic ? "<w:i/><w:iCs/>" : "",
    code ? '<w:sz w:val="19"/><w:szCs w:val="19"/>' : "",
    link ? '<w:color w:val="2E74B5"/><w:u w:val="single"/>' : "",
  ].join("");
  return `<w:r><w:rPr>${properties}</w:rPr><w:t${preserved}>${escapeXml(text)}</w:t></w:r>`;
};

export const isSafeHyperlinkTarget = (target) => {
  if (/^https:\/\//i.test(target)) {
    try {
      return new URL(target).protocol === "https:";
    } catch {
      return false;
    }
  }
  return (
    !target.startsWith("/") &&
    !target.startsWith("#") &&
    !target.includes("\\") &&
    ![...target].some((character) => character.charCodeAt(0) < 32) &&
    !/^[a-z][a-z0-9+.-]*:/i.test(target)
  );
};

export const createHyperlinkRegistry = () => {
  const identifiersByTarget = new Map();
  const relationships = [];

  return {
    register(target) {
      const existing = identifiersByTarget.get(target);
      if (existing) return existing;
      const id = `rIdHyperlink${relationships.length + 1}`;
      identifiersByTarget.set(target, id);
      relationships.push({ id, target });
      return id;
    },
    entries() {
      return relationships.map((relationship) => ({ ...relationship }));
    },
    xml() {
      return relationships
        .map(
          ({ id, target }) =>
            `<Relationship Id="${id}" Type="${HYPERLINK_RELATIONSHIP_TYPE}" Target="${escapeXml(target)}" TargetMode="External"/>`,
        )
        .join("");
    },
  };
};

export const extractMarkdownLinks = (markdown) =>
  [...markdown.matchAll(/\[([^\]]+)]\(([^)]+)\)/g)].map((match) => ({
    label: stripInlineMarkdown(match[1]),
    target: match[2].trim(),
  }));

export const inlineXml = (text, hyperlinks) => {
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  const output = [];
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    if (match.index > cursor) output.push(runXml(text.slice(cursor, match.index)));
    const token = match[0];
    if (token.startsWith("**")) {
      output.push(runXml(token.slice(2, -2), { bold: true }));
    } else if (token.startsWith("`")) {
      output.push(runXml(token.slice(1, -1), { code: true }));
    } else if (token.startsWith("[")) {
      const labelEnd = token.indexOf("](");
      const label = stripInlineMarkdown(token.slice(1, labelEnd));
      const target = token.slice(labelEnd + 2, -1).trim();
      if (hyperlinks && isSafeHyperlinkTarget(target)) {
        const relationshipId = hyperlinks.register(target);
        output.push(
          `<w:hyperlink r:id="${relationshipId}" w:history="1">${runXml(label, { link: true })}</w:hyperlink>`,
        );
      } else {
        output.push(runXml(`${label} (${target})`));
      }
    } else {
      output.push(runXml(token.slice(1, -1), { italic: true }));
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) output.push(runXml(text.slice(cursor)));
  return output.join("");
};

const paragraphXml = (
  content,
  {
    style = "Normal",
    numberId,
    align,
    keepNext = false,
    pageBreak = false,
    quote = false,
    code = false,
  } = {},
  hyperlinks,
) => {
  const properties = [
    `<w:pStyle w:val="${style}"/>`,
    numberId ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numberId}"/></w:numPr>` : "",
    align ? `<w:jc w:val="${align}"/>` : "",
    keepNext ? "<w:keepNext/>" : "",
    quote
      ? '<w:ind w:left="360"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="12" w:color="2E74B5"/></w:pBdr><w:shd w:val="clear" w:fill="F4F6F9"/>'
      : "",
    code ? '<w:shd w:val="clear" w:fill="F4F6F9"/><w:ind w:left="180" w:right="180"/>' : "",
    "<w:widowControl/>",
  ].join("");
  const body = pageBreak
    ? '<w:r><w:br w:type="page"/></w:r>'
    : code
      ? runXml(content, { code: true })
      : inlineXml(content, hyperlinks);
  return `<w:p><w:pPr>${properties}</w:pPr>${body}</w:p>`;
};

const parseTableRow = (line) => {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
};

const isTableDivider = (line) => {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

const isTraceabilityHeaders = (headers) =>
  headers.length === 6 &&
  stripInlineMarkdown(headers[0]) === "ID" &&
  headers.includes("v1.3.0 owner");

const tableWidths = (headers, pageWidth, layout) => {
  if (layout === "tracker" && headers.length === 7) {
    return [520, 1800, 2800, 850, 1500, 2500, 2990];
  }
  if (pageWidth === PORTRAIT_WIDTH && isTraceabilityHeaders(headers)) {
    return [720, 900, 3000, 1300, 1300, 2140];
  }
  if (headers.length === 2) {
    return pageWidth === LANDSCAPE_WIDTH ? [2600, 10360] : [2700, 6660];
  }
  if (headers.length === 3) return [3000, 1300, pageWidth - 4300];
  if (headers.length === 4) return [1000, 1500, 2000, pageWidth - 4500];
  const base = Math.floor(pageWidth / headers.length);
  return headers.map((_, index) =>
    index === headers.length - 1 ? pageWidth - base * (headers.length - 1) : base,
  );
};

const tableCellXml = (content, width, { header, centered, compact, traceability }, hyperlinks) => {
  const paragraphProperties = [
    `<w:pStyle w:val="${header ? "TableHeader" : traceability ? "TraceabilityTableText" : compact ? "CompactTableText" : "TableText"}"/>`,
    centered ? '<w:jc w:val="center"/>' : "",
    "<w:widowControl/>",
  ].join("");
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/>${header ? '<w:shd w:val="clear" w:fill="E8EEF5"/>' : ""}</w:tcPr><w:p><w:pPr>${paragraphProperties}</w:pPr>${inlineXml(content, hyperlinks)}</w:p></w:tc>`;
};

const tableXml = (rows, pageWidth, layout, hyperlinks) => {
  const headers = rows[0];
  const widths = tableWidths(headers, pageWidth, layout);
  const traceability = isTraceabilityHeaders(headers);
  const compact = (layout === "tracker" && headers.length === 7) || traceability;
  const centeredColumns = new Set(
    headers
      .map((header, index) => ({ header: stripInlineMarkdown(header), index }))
      .filter(({ header }) => ["Done", "Status", "Revision", "Date"].includes(header))
      .map(({ index }) => index),
  );
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");
  const body = rows
    .map((row, rowIndex) => {
      const cells = widths
        .map((width, columnIndex) =>
          tableCellXml(
            row[columnIndex] ?? "",
            width,
            {
              header: rowIndex === 0,
              centered: rowIndex === 0 || centeredColumns.has(columnIndex),
              compact,
              traceability,
            },
            hyperlinks,
          ),
        )
        .join("");
      const rowProperties = [
        rowIndex === 0 ? "<w:tblHeader/>" : "",
        rowIndex === 0 || traceability || compact ? "<w:cantSplit/>" : "",
      ].join("");
      return `<w:tr><w:trPr>${rowProperties}</w:trPr>${cells}</w:tr>`;
    })
    .join("");

  return `<w:tbl><w:tblPr><w:tblW w:w="${pageWidth}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C4D2"/><w:left w:val="single" w:sz="4" w:color="B8C4D2"/><w:bottom w:val="single" w:sz="4" w:color="B8C4D2"/><w:right w:val="single" w:sz="4" w:color="B8C4D2"/><w:insideH w:val="single" w:sz="4" w:color="D8E0E8"/><w:insideV w:val="single" w:sz="4" w:color="D8E0E8"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>${paragraphXml("")}`;
};

const isStructuralLine = (lines, index) => {
  const line = lines[index] ?? "";
  if (!line.trim()) return true;
  if (/^#{1,4}\s/.test(line)) return true;
  if (/^```/.test(line)) return true;
  if (/^>\s?/.test(line)) return true;
  if (/^\s*[-*]\s+/.test(line)) return true;
  if (/^\s*\d+\.\s+/.test(line)) return true;
  if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) return true;
  return false;
};

const markdownBodyXml = (markdown, { layout, pageWidth, hyperlinks }) => {
  const lines = markdown.split("\n");
  const output = [];
  let index = 0;
  let title = "Document";
  let activeNumberId;
  let nextNumberId = 2;

  if (lines[0]?.startsWith("# ")) {
    title = stripInlineMarkdown(lines[0].slice(2));
    index = 1;
  }

  while (index < lines.length && !lines[index].trim()) index += 1;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      activeNumberId = undefined;
      index += 1;
      continue;
    }

    const heading = /^(#{2,4})\s+(.+)$/.exec(line);
    if (heading) {
      activeNumberId = undefined;
      const level = heading[1].length - 1;
      output.push(
        paragraphXml(
          stripInlineMarkdown(heading[2]),
          {
            style: `Heading${Math.min(level, 3)}`,
            keepNext: true,
          },
          hyperlinks,
        ),
      );
      index += 1;
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      activeNumberId = undefined;
      const rows = [parseTableRow(line)];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      const rowsPerChunk =
        isTraceabilityHeaders(rows[0]) && rows.length > 17
          ? 6
          : layout === "tracker" && rows[0].length === 7 && rows.length > 12
            ? 9
            : undefined;
      if (rowsPerChunk) {
        const dataRows = rows.slice(1);
        for (let offset = 0; offset < dataRows.length; offset += rowsPerChunk) {
          if (offset > 0) output.push(paragraphXml("", { pageBreak: true }, hyperlinks));
          output.push(
            tableXml(
              [rows[0], ...dataRows.slice(offset, offset + rowsPerChunk)],
              pageWidth,
              layout,
              hyperlinks,
            ),
          );
        }
      } else {
        output.push(tableXml(rows, pageWidth, layout, hyperlinks));
      }
      continue;
    }

    if (/^```/.test(line)) {
      activeNumberId = undefined;
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        output.push(
          paragraphXml(lines[index] || " ", { style: "CodeBlock", code: true }, hyperlinks),
        );
        index += 1;
      }
      index += 1;
      output.push(paragraphXml("", {}, hyperlinks));
      continue;
    }

    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      activeNumberId = undefined;
      index += 1;
      const parts = [bullet[1]];
      while (index < lines.length && !isStructuralLine(lines, index)) {
        parts.push(lines[index].trim());
        index += 1;
      }
      output.push(paragraphXml(parts.join(" "), { numberId: 1 }, hyperlinks));
      continue;
    }

    const numbered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (numbered) {
      activeNumberId ??= nextNumberId++;
      index += 1;
      const parts = [numbered[1]];
      while (index < lines.length && !isStructuralLine(lines, index)) {
        parts.push(lines[index].trim());
        index += 1;
      }
      output.push(paragraphXml(parts.join(" "), { numberId: activeNumberId }, hyperlinks));
      continue;
    }

    if (/^>\s?/.test(line)) {
      activeNumberId = undefined;
      const parts = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        parts.push(lines[index].replace(/^>\s?/, "").trim());
        index += 1;
      }
      output.push(paragraphXml(parts.join(" "), { style: "Quote", quote: true }, hyperlinks));
      continue;
    }

    const parts = [line.trim()];
    activeNumberId = undefined;
    index += 1;
    while (index < lines.length && !isStructuralLine(lines, index)) {
      parts.push(lines[index].trim());
      index += 1;
    }
    output.push(paragraphXml(parts.join(" "), {}, hyperlinks));
  }

  return { title, body: output.join("") };
};

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="17212B"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="120" w:line="300" w:lineRule="auto"/><w:widowControl/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="17212B"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="2200" w:after="180"/><w:jc w:val="center"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="17365D"/><w:sz w:val="58"/><w:szCs w:val="58"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="4B6075"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CoverMeta"><w:name w:val="Cover Metadata"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="40" w:after="40"/><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="607080"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:uiPriority w:val="9"/><w:pPr><w:spacing w:before="360" w:after="200"/><w:keepNext/><w:keepLines/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="2E74B5"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:uiPriority w:val="9"/><w:pPr><w:spacing w:before="280" w:after="140"/><w:keepNext/><w:keepLines/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="2E74B5"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:uiPriority w:val="9"/><w:pPr><w:spacing w:before="200" w:after="100"/><w:keepNext/><w:keepLines/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="1F4D78"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="160" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:i/><w:color w:val="274760"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:next w:val="CodeBlock"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:keepLines/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:color w:val="24384B"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CompactTableText"><w:name w:val="Compact Table Text"/><w:basedOn w:val="TableText"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TraceabilityTableText"><w:name w:val="Traceability Table Text"/><w:basedOn w:val="TableText"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="220" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/><w:basedOn w:val="TableText"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="220" w:lineRule="auto"/><w:keepLines/></w:pPr><w:rPr><w:b/><w:color w:val="17365D"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="Footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="right"/></w:pPr><w:rPr><w:color w:val="6B7785"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="2E74B5"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>`;

const decimalAbstracts = Array.from({ length: 63 }, (_, index) => {
  const id = index + 2;
  return `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:lvl></w:abstractNum>`;
}).join("");

const decimalNumberInstances = Array.from(
  { length: 63 },
  (_, index) => `<w:num w:numId="${index + 2}"><w:abstractNumId w:val="${index + 2}"/></w:num>`,
).join("");

const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:lvl></w:abstractNum>
  ${decimalAbstracts}
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  ${decimalNumberInstances}
</w:numbering>`;

const footerXml = (label, pageWidth) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="D8E0E8"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="${pageWidth}"/></w:tabs></w:pPr>${runXml(label)}${runXml("\tPage ")}<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>${runXml(" of ")}<w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;

const collectArchiveEntries = (directory, prefix = "") =>
  readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const relativePath = prefix ? `${prefix}/${name}` : name;
      const absolutePath = join(directory, name);
      return statSync(absolutePath).isDirectory()
        ? [`${relativePath}/`, ...collectArchiveEntries(absolutePath, relativePath)]
        : [relativePath];
    });

const normalizeArchiveTimestamps = (directory) => {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) normalizeArchiveTimestamps(path);
    utimesSync(path, ARCHIVE_TIMESTAMP, ARCHIVE_TIMESTAMP);
  }
  utimesSync(directory, ARCHIVE_TIMESTAMP, ARCHIVE_TIMESTAMP);
};

const writePackageFile = (root, relativePath, contents) => {
  const destination = join(root, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
};

export const exportMarkdownDocx = ({
  sourcePath,
  sourceRelativePath,
  outputPath,
  title,
  subtitle,
  coverLines,
  footerLabel,
  layout = "portrait",
  checkMode = false,
}) => {
  const markdown = readFileSync(sourcePath, "utf8").replaceAll("\r\n", "\n");
  const sourceHash = createHash("sha256").update(markdown).digest("hex");
  const trackerLayout = layout === "tracker";
  const pageWidth = trackerLayout ? LANDSCAPE_WIDTH : PORTRAIT_WIDTH;
  const hyperlinks = createHyperlinkRegistry();
  const { body } = markdownBodyXml(markdown, { layout, pageWidth, hyperlinks });
  const stagingDirectory = mkdtempSync(join(tmpdir(), "veskify-docx-"));
  const archivePath = `${stagingDirectory}.docx`;

  const cover = [
    paragraphXml(title, { style: "Title", align: "center" }),
    paragraphXml(subtitle, { style: "Subtitle", align: "center" }),
    ...coverLines.map((line) => paragraphXml(line, { style: "CoverMeta", align: "center" })),
    paragraphXml("", { pageBreak: true }),
  ].join("");

  const sectionProperties = trackerLayout
    ? '<w:sectPr><w:footerReference w:type="default" r:id="rId4"/><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
    : '<w:sectPr><w:footerReference w:type="default" r:id="rId4"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';

  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>`,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:subject>${escapeXml(subtitle)}</dc:subject><dc:creator>Vesko Oy</dc:creator><dc:description>Synchronized deterministic export of ${escapeXml(sourceRelativePath)}</dc:description><cp:revision>1</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2026-08-06T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-08-07T00:00:00Z</dcterms:modified></cp:coreProperties>`,
    "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Veskify deterministic documentation exporter</Application><AppVersion>${EXPORTER_VERSION}</AppVersion><Company>Vesko Oy</Company></Properties>`,
    "docProps/custom.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="SourcePath"><vt:lpwstr>${escapeXml(sourceRelativePath)}</vt:lpwstr></property><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="SourceSha256"><vt:lpwstr>${sourceHash}</vt:lpwstr></property><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="4" name="ExporterVersion"><vt:lpwstr>${EXPORTER_VERSION}</vt:lpwstr></property><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="5" name="DesignPreset"><vt:lpwstr>compact_reference_guide${trackerLayout ? "_landscape_checklist_override" : ""}</vt:lpwstr></property></Properties>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${cover}${body}${sectionProperties}</w:body></w:document>`,
    "word/styles.xml": stylesXml,
    "word/numbering.xml": numberingXml,
    "word/settings.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
    "word/footer1.xml": footerXml(footerLabel, pageWidth),
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${hyperlinks.xml()}</Relationships>`,
  };

  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      writePackageFile(stagingDirectory, relativePath, contents);
    }
    normalizeArchiveTimestamps(stagingDirectory);
    const archiveEntries = collectArchiveEntries(stagingDirectory);
    execFileSync("/usr/bin/zip", ["-q", "-X", archivePath, ...archiveEntries], {
      cwd: stagingDirectory,
      env: { ...process.env, TZ: "UTC" },
    });

    if (checkMode) {
      if (!existsSync(outputPath) || !readFileSync(archivePath).equals(readFileSync(outputPath))) {
        process.stderr.write(`${outputPath} does not match the deterministic export\n`);
        process.exitCode = 1;
      } else {
        process.stdout.write(`DOCX content matches deterministic export ${sourceHash}\n`);
      }
    } else {
      mkdirSync(dirname(outputPath), { recursive: true });
      cpSync(archivePath, outputPath);
      process.stdout.write(`Exported ${outputPath}\nSource SHA-256: ${sourceHash}\n`);
    }
  } finally {
    rmSync(stagingDirectory, { recursive: true, force: true });
    rmSync(archivePath, { force: true });
  }
};

export const renderInlineMarkdownForCheck = (markdown) => {
  const hyperlinks = createHyperlinkRegistry();
  return {
    xml: inlineXml(markdown, hyperlinks),
    relationships: hyperlinks.entries(),
    relationshipsXml: hyperlinks.xml(),
  };
};
