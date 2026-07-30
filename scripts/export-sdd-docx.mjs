import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(repositoryRoot, "docs", "VESKIFY_SDD.md");
const templatePath = join(repositoryRoot, "docs", "VESKIFY_SDD_v1.2.docx");
const outputPath = join(repositoryRoot, "docs", "VESKIFY_SDD_v1.2.1.docx");
const markdown = readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
const sourceHash = createHash("sha256").update(markdown).digest("hex");
const stagingDirectory = mkdtempSync(join(tmpdir(), "veskify-sdd-docx-"));
const archivePath = `${stagingDirectory}.docx`;

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const paragraphXml = markdown
  .split("\n")
  .map((line) => {
    if (line.length === 0) return "<w:p/>";
    const preserved = /^\s|\s$/.test(line) ? ' xml:space="preserve"' : "";
    return `<w:p><w:pPr/><w:r><w:rPr><w:rFonts w:ascii="Helvetica Light" w:hAnsi="Helvetica Light" w:cs="Helvetica Light"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t${preserved}>${escapeXml(line)}</w:t></w:r></w:p>`;
  })
  .join("");

const files = {
  "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>VESKIFY Software Design Specification v1.2.1</dc:title>
  <dc:creator>Vesko Oy</dc:creator>
  <dc:description>Synchronized human-readable export of docs/VESKIFY_SDD.md</dc:description>
  <cp:revision>1</cp:revision>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-07-30T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-07-30T00:00:00Z</dcterms:modified>
</cp:coreProperties>`,
  "docProps/custom.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="SourcePath"><vt:lpwstr>docs/VESKIFY_SDD.md</vt:lpwstr></property>
  <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="SourceSha256"><vt:lpwstr>${sourceHash}</vt:lpwstr></property>
</Properties>`,
  "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphXml}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body>
</w:document>`,
};

try {
  execFileSync("/usr/bin/unzip", ["-q", templatePath, "-d", stagingDirectory]);
  const contentTypesPath = join(stagingDirectory, "[Content_Types].xml");
  const relationshipsPath = join(stagingDirectory, "_rels", ".rels");
  const contentTypes = readFileSync(contentTypesPath, "utf8").replace(
    "</Types>",
    '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>',
  );
  const relationships = readFileSync(relationshipsPath, "utf8").replace(
    "</Relationships>",
    '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>',
  );
  writeFileSync(contentTypesPath, contentTypes);
  writeFileSync(relationshipsPath, relationships);

  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = join(stagingDirectory, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
  }

  execFileSync("/usr/bin/zip", ["-q", "-X", "-r", archivePath, "."], {
    cwd: stagingDirectory,
  });
  cpSync(archivePath, outputPath);
  process.stdout.write(`Exported ${outputPath}\nSource SHA-256: ${sourceHash}\n`);
} finally {
  rmSync(stagingDirectory, { recursive: true, force: true });
  rmSync(archivePath, { force: true });
}
