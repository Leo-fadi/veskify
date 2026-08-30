import { existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { fail } from "./errors.js";
import { stableJsonText } from "./json.js";

export const emitReport = (report, outputPath) => {
  const serialized = stableJsonText(report);
  if (!outputPath) {
    process.stdout.write(serialized);
    return;
  }
  const absolute = path.resolve(outputPath);
  const directory = path.dirname(absolute);
  mkdirSync(directory, { recursive: true });
  if (existsSync(absolute) && lstatSync(absolute).isSymbolicLink()) {
    fail("output-symlink", "Refusing to replace a symbolic-link output path.");
  }
  const temporary = path.join(directory, `.${path.basename(absolute)}.${process.pid}.tmp`);
  try {
    writeFileSync(temporary, serialized, { flag: "wx", mode: 0o600 });
    renameSync(temporary, absolute);
  } finally {
    rmSync(temporary, { force: true });
  }
};
