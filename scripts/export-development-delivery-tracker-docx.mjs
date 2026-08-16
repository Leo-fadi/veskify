import { execFileSync } from "node:child_process";
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { exportMarkdownDocx } from "./markdown-docx-export.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(repositoryRoot, "docs", "VESKIFY_DEVELOPMENT_DELIVERY_TRACKER_v1.3.0.docx");
const checkMode = process.argv.includes("--check");
const archiveTimestamp = new Date("2000-01-01T00:00:00Z");
const trackerWidths = [520, 1800, 2800, 850, 1500, 2500, 2990];
const readableTrackerWidths = [720, 1700, 2800, 850, 1500, 2500, 2890];
const trackerGridXml = trackerWidths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");
const tablePattern = /<w:tbl>[\s\S]*?<\/w:tbl>/gu;

const trackerTable = (tableXml) => tableXml.includes(trackerGridXml);

const mergeTrackerTableChunks = (documentXml) => {
  let mergedXml = documentXml;
  while (true) {
    const tables = [...mergedXml.matchAll(tablePattern)];
    let merged = false;
    for (let index = 0; index < tables.length - 1; index += 1) {
      const current = tables[index];
      const next = tables[index + 1];
      const currentStart = current.index;
      const currentEnd = currentStart + current[0].length;
      const nextStart = next.index;
      const nextEnd = nextStart + next[0].length;
      const separator = mergedXml.slice(currentEnd, nextStart);
      if (
        !trackerTable(current[0]) ||
        !trackerTable(next[0]) ||
        !separator.includes('<w:br w:type="page"/>')
      ) {
        continue;
      }

      const nextRowsStart = next[0].indexOf("</w:tblGrid>") + "</w:tblGrid>".length;
      const nextRows = next[0].slice(nextRowsStart, -"</w:tbl>".length);
      const repeatedHeaderEnd = nextRows.indexOf("</w:tr>") + "</w:tr>".length;
      if (nextRowsStart < "</w:tblGrid>".length || repeatedHeaderEnd < "</w:tr>".length) {
        throw new Error("The tracker checklist table structure is not mergeable.");
      }
      const combinedTable = current[0].replace(
        /<\/w:tbl>$/u,
        `${nextRows.slice(repeatedHeaderEnd)}</w:tbl>`,
      );
      mergedXml = `${mergedXml.slice(0, currentStart)}${combinedTable}${mergedXml.slice(nextEnd)}`;
      merged = true;
      break;
    }
    if (!merged) return mergedXml;
  }
};

const resizeTrackerTable = (tableXml) => {
  let resized = tableXml.replace(
    trackerGridXml,
    readableTrackerWidths.map((width) => `<w:gridCol w:w="${width}"/>`).join(""),
  );
  resized = resized.replace(/<w:tr>[\s\S]*?<\/w:tr>/gu, (rowXml) => {
    let columnIndex = 0;
    return rowXml.replace(/<w:tc>[\s\S]*?<\/w:tc>/gu, (cellXml) => {
      const width = readableTrackerWidths[columnIndex];
      columnIndex += 1;
      return width === undefined
        ? cellXml
        : cellXml.replace(
            /<w:tcW w:w="\d+" w:type="dxa"\/>/u,
            `<w:tcW w:w="${width}" w:type="dxa"/>`,
          );
    });
  });
  return resized;
};

const patchTrackerDocumentXml = (documentXml) =>
  mergeTrackerTableChunks(documentXml).replace(tablePattern, (tableXml) =>
    trackerTable(tableXml) ? resizeTrackerTable(tableXml) : tableXml,
  );

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

const patchTrackerDocx = (sourceDocx, patchedDocx, workingDirectory) => {
  const expandedDirectory = join(workingDirectory, "expanded");
  mkdirSync(expandedDirectory, { recursive: true });
  execFileSync("/usr/bin/unzip", ["-q", sourceDocx, "-d", expandedDirectory]);
  const documentPath = join(expandedDirectory, "word", "document.xml");
  const documentXml = readFileSync(documentPath, "utf8");
  writeFileSync(documentPath, patchTrackerDocumentXml(documentXml));
  normalizeArchiveTimestamps(expandedDirectory);
  execFileSync(
    "/usr/bin/zip",
    ["-q", "-X", patchedDocx, ...collectArchiveEntries(expandedDirectory)],
    { cwd: expandedDirectory, env: { ...process.env, TZ: "UTC" } },
  );
};

const workingDirectory = mkdtempSync(join(tmpdir(), "veskify-tracker-docx-"));
const rawOutputPath = join(workingDirectory, "raw.docx");
const patchedOutputPath = join(workingDirectory, "patched.docx");

try {
  exportMarkdownDocx({
    sourcePath: join(repositoryRoot, "docs", "VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md"),
    sourceRelativePath: "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
    outputPath: rawOutputPath,
    title: "Veskify Development Delivery Tracker",
    subtitle: "Version 1.3.0",
    coverLines: [
      "Delivery status baseline: 15 August 2026, P10B-16P-06 canonical search query/results adapter",
      "Overall product status: Partial",
      "Active phase: P10B Commercial Storefront Generation System v1 (Partial)",
      "Authoritative source: docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
    ],
    footerLabel: "Veskify Delivery Tracker v1.3.0",
    layout: "tracker",
    checkMode: false,
  });
  patchTrackerDocx(rawOutputPath, patchedOutputPath, workingDirectory);
  if (checkMode) {
    if (
      !existsSync(outputPath) ||
      !readFileSync(patchedOutputPath).equals(readFileSync(outputPath))
    ) {
      process.stderr.write(`${outputPath} does not match the deterministic export\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`DOCX content matches deterministic tracker export\n`);
    }
  } else {
    cpSync(patchedOutputPath, outputPath);
    process.stdout.write(`Exported ${outputPath}\n`);
  }
} finally {
  rmSync(workingDirectory, { recursive: true, force: true });
}
