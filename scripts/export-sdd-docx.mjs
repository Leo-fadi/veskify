import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { exportMarkdownDocx } from "./markdown-docx-export.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

exportMarkdownDocx({
  sourcePath: join(repositoryRoot, "docs", "VESKIFY_SDD.md"),
  sourceRelativePath: "docs/VESKIFY_SDD.md",
  outputPath: join(repositoryRoot, "docs", "VESKIFY_SDD_v1.3.0.docx"),
  title: "Veskify Software Design Document",
  subtitle: "Version 1.3.0",
  coverLines: [
    "Verified baseline: 7 August 2026",
    "Current main after merged PR #170",
    "Merchant product: Vesko Storefront Studio | Controlled engine: Veskify",
    "Authoritative source: docs/VESKIFY_SDD.md",
  ],
  footerLabel: "Veskify SDD v1.3.0",
  layout: "portrait",
  checkMode: process.argv.includes("--check"),
});
