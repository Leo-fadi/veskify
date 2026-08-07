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
    "Delivery status baseline: 6 August 2026",
    "Overall product status: Partial",
    "Active phase: P10A grounded orchestration and publishing closure",
    "Authoritative source: docs/VESKIFY_DEVELOPMENT_DELIVERY_TRACKER.md",
  ],
  footerLabel: "Veskify Delivery Tracker v1.3.0",
  layout: "tracker",
  checkMode: process.argv.includes("--check"),
});
