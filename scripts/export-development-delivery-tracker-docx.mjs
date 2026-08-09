import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { exportMarkdownDocx } from "./markdown-docx-export.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

exportMarkdownDocx({
  sourcePath: join(repositoryRoot, "docs", "VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md"),
  sourceRelativePath: "docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  outputPath: join(repositoryRoot, "docs", "VESKIFY_DEVELOPMENT_DELIVERY_TRACKER_v1.3.0.docx"),
  title: "Veskify Development Delivery Tracker",
  subtitle: "Version 1.3.0",
  coverLines: [
    "Delivery status baseline: 9 August 2026, P10B-06, P10B-07 and P10B-08",
    "Overall product status: Partial",
    "Active phase: P10B Commercial Storefront Generation System v1 (Partial)",
    "Authoritative source: docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  ],
  footerLabel: "Veskify Delivery Tracker v1.3.0",
  layout: "tracker",
  checkMode: process.argv.includes("--check"),
});
