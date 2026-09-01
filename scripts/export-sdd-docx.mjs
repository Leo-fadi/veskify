import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

import { exportMarkdownDocx } from "./markdown-docx-export.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(repositoryRoot, "docs", "VESKIFY_SDD_v1.3.0.docx");
const checkMode = process.argv.includes("--check");
const archiveTimestamp = new Date("2000-01-01T00:00:00Z");
const traceabilityWidths = [720, 1200, 2900, 1250, 1250, 2040];

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
    utimesSync(path, archiveTimestamp, archiveTimestamp);
  }
  utimesSync(directory, archiveTimestamp, archiveTimestamp);
};

const isTraceabilityTable = (table) =>
  table.includes("Requirement / acceptance meaning") && table.includes("v1.3.0 owner");

const ensureTraceabilityHeaderRepeats = (table) => {
  if (!isTraceabilityTable(table)) return table;

  const headerRow = table.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/)?.[0];
  if (
    !headerRow ||
    !headerRow.includes("Requirement / acceptance meaning") ||
    !headerRow.includes("v1.3.0 owner")
  ) {
    throw new Error("Could not resolve the first header row of an SDD traceability table");
  }

  let repeatingHeaderRow = headerRow;
  if (!repeatingHeaderRow.includes("<w:tblHeader/>")) {
    if (/<w:tblHeader\b/.test(repeatingHeaderRow)) {
      repeatingHeaderRow = repeatingHeaderRow.replace(/<w:tblHeader\b[^>]*\/>/, "<w:tblHeader/>");
    } else if (/<w:trPr\b[^>]*\/>/.test(repeatingHeaderRow)) {
      repeatingHeaderRow = repeatingHeaderRow.replace(
        /<w:trPr\b[^>]*\/>/,
        "<w:trPr><w:tblHeader/></w:trPr>",
      );
    } else if (/<w:trPr\b[^>]*>/.test(repeatingHeaderRow)) {
      repeatingHeaderRow = repeatingHeaderRow.replace(
        /<w:trPr\b[^>]*>/,
        (rowProperties) => `${rowProperties}<w:tblHeader/>`,
      );
    } else {
      repeatingHeaderRow = repeatingHeaderRow.replace(
        /<w:tr\b[^>]*>/,
        (rowStart) => `${rowStart}<w:trPr><w:tblHeader/></w:trPr>`,
      );
    }
  }

  if (!/<w:trPr\b[^>]*>[\s\S]*?<w:tblHeader\/>[\s\S]*?<\/w:trPr>/.test(repeatingHeaderRow)) {
    throw new Error("An SDD traceability header row is not marked to repeat");
  }

  return table.replace(headerRow, repeatingHeaderRow);
};

const resizeTraceabilityTable = (table) => {
  if (!isTraceabilityTable(table)) return table;
  const grid = `<w:tblGrid>${traceabilityWidths
    .map((width) => `<w:gridCol w:w="${width}"/>`)
    .join("")}</w:tblGrid>`;
  const resizedGrid = table.replace(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/, grid);
  return resizedGrid.replace(/<w:tr>[\s\S]*?<\/w:tr>/g, (row) => {
    let columnIndex = 0;
    return row.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (cell) => {
      const width = traceabilityWidths[columnIndex++];
      return cell.replace(
        /<w:tcW w:w="\d+" w:type="dxa"\/>/,
        `<w:tcW w:w="${width}" w:type="dxa"/>`,
      );
    });
  });
};

const splitNfrTraceabilityTable = (documentXml) => {
  let split = false;
  const corrected = documentXml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (table) => {
    if (!table.includes("<w:t>NFR-101</w:t>") || !table.includes("<w:t>NFR-110</w:t>")) {
      return table;
    }
    split = true;
    const rows = table.match(/<w:tr>[\s\S]*?<\/w:tr>/g) ?? [];
    if (rows.length !== 11) {
      throw new Error(
        `Expected the NFR traceability header plus ten rows, received ${rows.length}`,
      );
    }
    const firstRowOffset = table.indexOf(rows[0]);
    const finalRowEnd = table.lastIndexOf(rows.at(-1)) + rows.at(-1).length;
    const prefix = table.slice(0, firstRowOffset);
    const suffix = table.slice(finalRowEnd);
    const spacer = '<w:p><w:pPr><w:pStyle w:val="Normal"/><w:widowControl/></w:pPr></w:p>';
    return `${prefix}${rows.slice(0, 5).join("")}${suffix}${spacer}${prefix}${rows[0]}${rows
      .slice(5)
      .join("")}${suffix}`;
  });
  if (!split) throw new Error("Could not resolve the NFR traceability table");
  return corrected;
};

const mergeFirstAcceptanceTraceabilityChunks = (documentXml) => {
  const tables = [...documentXml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)];
  const firstChunk = tables.find(
    ({ 0: table }) => table.includes("<w:t>AC-101</w:t>") && table.includes("<w:t>AC-106</w:t>"),
  );
  const secondChunk = tables.find(
    ({ 0: table }) => table.includes("<w:t>AC-107</w:t>") && table.includes("<w:t>AC-112</w:t>"),
  );
  if (!firstChunk || !secondChunk || firstChunk.index >= secondChunk.index) {
    throw new Error("Could not resolve the AC-101–106 and AC-107–112 traceability chunks");
  }

  const firstTable = firstChunk[0];
  const secondTable = secondChunk[0];
  if (!isTraceabilityTable(firstTable) || !isTraceabilityTable(secondTable)) {
    throw new Error("The first two acceptance chunks are not compatible traceability tables");
  }

  const firstRows = firstTable.match(/<w:tr>[\s\S]*?<\/w:tr>/g) ?? [];
  const secondRows = secondTable.match(/<w:tr>[\s\S]*?<\/w:tr>/g) ?? [];
  if (firstRows.length !== 7 || secondRows.length !== 7 || firstRows[0] !== secondRows[0]) {
    throw new Error("Expected matching headers plus six rows in the first two acceptance chunks");
  }

  const firstRowOffset = firstTable.indexOf(firstRows[0]);
  const firstFinalRowEnd = firstTable.lastIndexOf(firstRows.at(-1)) + firstRows.at(-1).length;
  const secondRowOffset = secondTable.indexOf(secondRows[0]);
  const secondFinalRowEnd = secondTable.lastIndexOf(secondRows.at(-1)) + secondRows.at(-1).length;
  const firstPrefix = firstTable.slice(0, firstRowOffset);
  const firstSuffix = firstTable.slice(firstFinalRowEnd);
  const secondPrefix = secondTable.slice(0, secondRowOffset);
  const secondSuffix = secondTable.slice(secondFinalRowEnd);
  if (firstPrefix !== secondPrefix || firstSuffix !== secondSuffix) {
    throw new Error("The first two acceptance chunks do not share one table structure");
  }

  const firstChunkEnd = firstChunk.index + firstTable.length;
  const interstitial = documentXml.slice(firstChunkEnd, secondChunk.index);
  const pageBreakCount = interstitial.match(/<w:br w:type="page"\/>/g)?.length ?? 0;
  if (
    pageBreakCount !== 1 ||
    interstitial.includes("<w:t>") ||
    !/^(?:<w:p>[\s\S]*?<\/w:p>)+$/.test(interstitial)
  ) {
    throw new Error("Unexpected content between the first two acceptance chunks");
  }

  const mergedTable = `${firstPrefix}${firstRows.join("")}${secondRows
    .slice(1)
    .join("")}${firstSuffix}`;
  const secondChunkEnd = secondChunk.index + secondTable.length;
  return `${documentXml.slice(0, firstChunk.index)}${mergedTable}${documentXml.slice(
    secondChunkEnd,
  )}`;
};

const applySddVisualCorrections = (archivePath, correctedArchivePath) => {
  const stagingDirectory = mkdtempSync(join(tmpdir(), "veskify-sdd-docx-"));
  try {
    execFileSync("/usr/bin/unzip", ["-q", archivePath, "-d", stagingDirectory]);
    const documentPath = join(stagingDirectory, "word", "document.xml");
    const originalDocumentXml = readFileSync(documentPath, "utf8");
    const splitDocumentXml = splitNfrTraceabilityTable(originalDocumentXml);
    const compactedDocumentXml = mergeFirstAcceptanceTraceabilityChunks(splitDocumentXml);
    let traceabilityTableCount = 0;
    const correctedDocumentXml = compactedDocumentXml.replace(
      /<w:tbl>[\s\S]*?<\/w:tbl>/g,
      (table) => {
        if (!isTraceabilityTable(table)) return table;
        traceabilityTableCount += 1;
        return resizeTraceabilityTable(ensureTraceabilityHeaderRepeats(table));
      },
    );
    if (traceabilityTableCount === 0) {
      throw new Error("Could not resolve any SDD traceability tables");
    }
    if (correctedDocumentXml === originalDocumentXml) {
      throw new Error("The SDD DOCX visual corrections made no document changes");
    }
    writeFileSync(documentPath, correctedDocumentXml);
    normalizeArchiveTimestamps(stagingDirectory);
    const archiveEntries = collectArchiveEntries(stagingDirectory);
    execFileSync("/usr/bin/zip", ["-q", "-X", correctedArchivePath, ...archiveEntries], {
      cwd: stagingDirectory,
      env: { ...process.env, TZ: "UTC" },
    });
  } finally {
    rmSync(stagingDirectory, { recursive: true, force: true });
  }
};

const temporaryDirectory = mkdtempSync(join(tmpdir(), "veskify-sdd-export-"));
const rawOutputPath = join(temporaryDirectory, "raw.docx");
const correctedOutputPath = join(temporaryDirectory, "corrected.docx");

try {
  exportMarkdownDocx({
    sourcePath: join(repositoryRoot, "docs", "VESKIFY_SDD.md"),
    sourceRelativePath: "docs/VESKIFY_SDD.md",
    outputPath: rawOutputPath,
    title: "Veskify Software Design Document",
    subtitle: "Version 1.3.0",
    coverLines: [
      "Verified baseline: 1 September 2026",
      "P10B-19A-07 Inactive Family Registry and Candidate Fingerprints Baseline",
      "Merchant product: Vesko Storefront Studio | Controlled engine: Veskify",
      "Authoritative source: docs/VESKIFY_SDD.md",
    ],
    footerLabel: "Veskify SDD v1.3.0",
    layout: "portrait",
  });
  applySddVisualCorrections(rawOutputPath, correctedOutputPath);

  if (checkMode) {
    if (
      !existsSync(outputPath) ||
      !readFileSync(correctedOutputPath).equals(readFileSync(outputPath))
    ) {
      process.stderr.write(`${outputPath} does not match the deterministic export\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write("SDD DOCX content matches deterministic export\n");
    }
  } else {
    cpSync(correctedOutputPath, outputPath);
    process.stdout.write(`Exported corrected ${outputPath}\n`);
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
