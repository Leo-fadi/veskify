import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { validateRegisteredSnapshot } from "@/components/registry";
import { catalogueDisplayModelSchema } from "@/domain/catalogue";
import { aurumNordicSeed } from "@/data/seed";
import { projectSchema } from "@/domain/project";
import { storefrontSnapshotSchema } from "@/domain/storefront";
import { createAurumNordicProjectRepository } from "@/services/storage";

const root = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.[cm]?[jt]sx?$/.test(entry.name)
        ? [path]
        : [];
  });
}

function fileText(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Phase 0 architecture boundaries", () => {
  it("keeps every @puckeditor/core import under the isolated Puck integration", () => {
    const imports = sourceFiles(join(root, "src")).filter((path) =>
      fileText(path).includes("@puckeditor/core"),
    );

    expect(imports.length).toBeGreaterThan(0);
    expect(imports.map((path) => relative(root, path).split("\\").join("/"))).toEqual(
      expect.arrayContaining([
        "src/integrations/puck/config.tsx",
        "src/integrations/puck/veskify-puck-editor.tsx",
      ]),
    );
    expect(
      imports.every((path) =>
        relative(root, path).split("\\").join("/").startsWith("src/integrations/puck/"),
      ),
    ).toBe(true);
  });

  it("keeps canonical domain and registry modules independent of Puck types and imports", () => {
    const canonicalFiles = [
      ...sourceFiles(join(root, "src/domain")),
      ...sourceFiles(join(root, "src/components/registry")),
    ];

    for (const path of canonicalFiles) {
      expect(fileText(path)).not.toContain("@puckeditor/core");
      expect(fileText(path)).not.toMatch(/from ["']@\/integrations\/puck/);
    }
  });

  it("uses explicit dependency ranges instead of latest", () => {
    const packageJson = JSON.parse(fileText(join(root, "package.json"))) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    for (const version of [
      ...Object.values(packageJson.dependencies),
      ...Object.values(packageJson.devDependencies),
    ]) {
      expect(version).not.toBe("latest");
      expect(version.trim()).not.toBe("");
    }
  });

  it("keeps the validated seed's draft and published snapshots separate", () => {
    expect(projectSchema.parse(aurumNordicSeed.project).draftSnapshotId).not.toBe(
      aurumNordicSeed.project.publishedSnapshotId,
    );
    expect(storefrontSnapshotSchema.parse(aurumNordicSeed.draftSnapshot)).toEqual(
      validateRegisteredSnapshot(aurumNordicSeed.draftSnapshot),
    );
    expect(storefrontSnapshotSchema.parse(aurumNordicSeed.publishedSnapshot)).toEqual(
      validateRegisteredSnapshot(aurumNordicSeed.publishedSnapshot),
    );
    expect(catalogueDisplayModelSchema.parse(aurumNordicSeed.catalogue).products).toHaveLength(6);
  });

  it("preserves protected commerce display data through repository operations", async () => {
    const repository = createAurumNordicProjectRepository();
    const before = aurumNordicSeed.catalogue.products.map(({ id, price, stockStatus }) => ({
      id,
      price,
      stockStatus,
    }));
    const project = await repository.get(aurumNordicSeed.project.id);

    await repository.publish(project.project.id, project.project.revision);
    await repository.restore(project.project.id, project.project.publishedSnapshotId);

    const after = (await repository.get(project.project.id)).catalogue.products.map(
      ({ id, price, stockStatus }) => ({ id, price, stockStatus }),
    );
    expect(after).toEqual(before);
  });
});
