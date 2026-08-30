// @vitest-environment node

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  GovernanceError,
  buildImplementationIdentity,
  sha256Hex,
} from "../../scripts/lib/task-governance/index.js";
import { describe, expect, it } from "vitest";

const run = (root: string, args: string[]) => {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
};

const write = (root: string, path: string, value: string | Buffer) => {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
};

const createRepository = () => {
  const root = mkdtempSync(join(tmpdir(), "devx-01b-git-"));
  run(root, ["init", "-q", "-b", "main"]);
  run(root, ["config", "user.email", "governance@example.invalid"]);
  run(root, ["config", "user.name", "Governance Test"]);
  write(root, "docs/staged.txt", "base staged\n");
  write(root, "docs/unstaged.txt", "base unstaged\n");
  write(root, "docs/delete.txt", "delete me\n");
  write(root, "docs/rename.txt", "rename me\n");
  write(root, "docs/executable.sh", "#!/bin/sh\nexit 0\n");
  run(root, ["add", "."]);
  run(root, ["commit", "-qm", "base"]);
  const baseCommit = run(root, ["rev-parse", "HEAD"]);
  run(root, ["remote", "add", "origin", root]);
  run(root, ["switch", "-qc", "task"]);
  return { root, baseCommit };
};

const contractFor = (root: string, baseCommit: string) => ({
  repository: { root, canonicalRemote: "origin", baseBranch: "main" },
  branch: "task",
  baseCommit,
  allowedPaths: ["docs/**", "assets/**", "links/**", "src/**"],
  ownedPaths: ["src/**"],
  forbiddenPaths: ["docs/forbidden/**"],
  externalCallPolicy: { secretFilesAllowed: [] },
  scopeBudget: {
    targetMaxNetProductionLines: 1000,
    targetMaxProductionFiles: 8,
    hardMaxNetProductionLines: 1500,
    hardMaxProductionFiles: 12,
    generatedFileExclusions: [],
    hardLimitException: null,
  },
});

type GitContract = ReturnType<typeof contractFor>;

describe("DEVX-01B complete Git implementation identity", () => {
  it("captures committed, staged, unstaged, untracked, deletion, rename, binary and symlink state deterministically", () => {
    const { root, baseCommit } = createRepository();
    write(root, "docs/committed.txt", "committed\n");
    run(root, ["add", "docs/committed.txt"]);
    run(root, ["commit", "-qm", "committed change"]);
    write(root, "docs/staged.txt", "staged change\n");
    run(root, ["add", "docs/staged.txt"]);
    write(root, "docs/unstaged.txt", "unstaged change\n");
    write(root, "docs/untracked.txt", "untracked\n");
    rmSync(join(root, "docs/delete.txt"));
    run(root, ["mv", "docs/rename.txt", "docs/renamed.txt"]);
    write(root, "assets/binary.bin", Buffer.from([0, 1, 2, 3]));
    mkdirSync(join(root, "links"));
    symlinkSync("../outside-target", join(root, "links", "external"));

    const first = buildImplementationIdentity(contractFor(root, baseCommit));
    const second = buildImplementationIdentity(contractFor(root, baseCommit));

    expect(second.diffFingerprint).toBe(first.diffFingerprint);
    expect(first.result).toBe("PASS");
    expect(first.gitState.committedPaths).toContain("docs/committed.txt");
    expect(first.gitState.stagedPaths).toEqual(
      expect.arrayContaining(["docs/renamed.txt", "docs/staged.txt"]),
    );
    expect(first.gitState.unstagedPaths).toEqual(
      expect.arrayContaining(["docs/delete.txt", "docs/unstaged.txt"]),
    );
    expect(first.gitState.untrackedPaths).toEqual(
      expect.arrayContaining(["assets/binary.bin", "docs/untracked.txt", "links/external"]),
    );
    expect(first.fileStateManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "docs/staged.txt", status: "M" }),
        expect.objectContaining({ path: "docs/unstaged.txt", status: "M" }),
        expect.objectContaining({ path: "docs/untracked.txt", status: "A" }),
        expect.objectContaining({
          path: "docs/delete.txt",
          status: "D",
          currentContentSha256: null,
        }),
        expect.objectContaining({
          path: "docs/renamed.txt",
          previousPath: "docs/rename.txt",
          status: "R",
        }),
        expect.objectContaining({ path: "assets/binary.bin", binary: true }),
        expect.objectContaining({ path: "links/external", fileType: "symbolic-link" }),
      ]),
    );
    expect(first.changedPaths).toEqual([...first.changedPaths].sort());
    expect(first.diffFingerprint).toMatch(/^veskify-implementation-diff-v1_[0-9a-f]{64}$/);
  });

  it("changes the fingerprint for content, mode and changed status", () => {
    const contentRepo = createRepository();
    write(contentRepo.root, "docs/unstaged.txt", "first\n");
    const first = buildImplementationIdentity(
      contractFor(contentRepo.root, contentRepo.baseCommit),
    );
    write(contentRepo.root, "docs/unstaged.txt", "second\n");
    const second = buildImplementationIdentity(
      contractFor(contentRepo.root, contentRepo.baseCommit),
    );
    expect(second.diffFingerprint).not.toBe(first.diffFingerprint);

    chmodSync(join(contentRepo.root, "docs/executable.sh"), 0o755);
    const third = buildImplementationIdentity(
      contractFor(contentRepo.root, contentRepo.baseCommit),
    );
    expect(third.diffFingerprint).not.toBe(second.diffFingerprint);
  });

  it.each(["--assume-unchanged", "--skip-worktree"])(
    "rejects the %s index flag before it can hide a tracked worktree change",
    (flag) => {
      const { root, baseCommit } = createRepository();
      run(root, ["update-index", flag, "docs/unstaged.txt"]);
      write(root, "docs/unstaged.txt", "hidden change\n");
      expect(() => buildImplementationIdentity(contractFor(root, baseCommit))).toThrowError(
        expect.objectContaining({ code: "git-index-hidden-change-flag" }),
      );
    },
  );

  it("identifies and content-binds a POSIX filename containing a literal backslash", () => {
    const { root, baseCommit } = createRepository();
    const relativePath = String.raw`docs/literal\name.txt`;
    write(root, relativePath, "first\n");
    const first = buildImplementationIdentity(contractFor(root, baseCommit));
    expect(first.changedPaths).toContain(relativePath);
    expect(first.fileStateManifest).toContainEqual(
      expect.objectContaining({ path: relativePath, currentContentSha256: sha256Hex("first\n") }),
    );
    write(root, relativePath, "second\n");
    const second = buildImplementationIdentity(contractFor(root, baseCommit));
    expect(second.diffFingerprint).not.toBe(first.diffFingerprint);
  });

  it("keeps the implementation fingerprint stable across process locales", () => {
    const { root, baseCommit } = createRepository();
    write(root, "docs/zeta.txt", "zeta\n");
    write(root, "docs/äiti.txt", "aiti\n");
    const moduleUrl = pathToFileURL(
      join(process.cwd(), "scripts/lib/task-governance/index.js"),
    ).href;
    const value = contractFor(root, baseCommit);
    const source = `import { buildImplementationIdentity } from ${JSON.stringify(
      moduleUrl,
    )}; process.stdout.write(buildImplementationIdentity(${JSON.stringify(
      value,
    )}).diffFingerprint);`;
    const fingerprintFor = (locale: string) => {
      const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
        encoding: "utf8",
        env: { ...process.env, LANG: locale, LC_ALL: locale },
      });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout;
    };
    expect(fingerprintFor("en_US.UTF-8")).toBe(fingerprintFor("sv_SE.UTF-8"));
  });

  it("retains the same fingerprint after the exact worktree is committed", () => {
    const { root, baseCommit } = createRepository();
    write(root, "docs/staged.txt", "verified\n");
    write(root, "docs/new.txt", "new\n");
    const before = buildImplementationIdentity(contractFor(root, baseCommit));
    run(root, ["add", "."]);
    run(root, ["commit", "-qm", "verified implementation"]);
    const after = buildImplementationIdentity(contractFor(root, baseCommit));
    expect(after.diffFingerprint).toBe(before.diffFingerprint);
    expect(after.headCommit).not.toBe(before.headCommit);
  });

  it("counts production additions without deletion offsets", () => {
    const { root, baseCommit } = createRepository();
    write(root, "src/large.ts", `${"line\n".repeat(1501)}`);
    rmSync(join(root, "docs/delete.txt"));
    const identity = buildImplementationIdentity(contractFor(root, baseCommit));
    expect(identity.scopeBudget).toMatchObject({
      result: "FAIL",
      productionFilesChanged: 1,
      productionLineAdditions: 1501,
    });
  });

  it("does not follow a changed symbolic link target", () => {
    const { root, baseCommit } = createRepository();
    const outside = join(dirname(root), `${root.split("/").at(-1)}-secret`);
    writeFileSync(outside, "must not be read");
    mkdirSync(join(root, "links"));
    symlinkSync(outside, join(root, "links", "external"));
    const identity = buildImplementationIdentity(contractFor(root, baseCommit));
    const link = identity.fileStateManifest.find(({ path }) => path === "links/external");
    expect(link).toMatchObject({
      fileType: "symbolic-link",
      currentContentSha256: sha256Hex(Buffer.from(outside)),
    });
    expect(link?.currentContentSha256).not.toBe(sha256Hex(readFileSync(outside)));
  });

  it.each([
    [
      "root mismatch",
      (value: GitContract) => (value.repository.root = join(value.repository.root, "docs")),
      "repository-root-mismatch",
    ],
    ["branch mismatch", (value: GitContract) => (value.branch = "other"), "branch-mismatch"],
    [
      "missing base",
      (value: GitContract) => (value.baseCommit = "9".repeat(40)),
      "base-commit-missing",
    ],
  ])("fails closed for %s", (_label, mutate, code) => {
    const { root, baseCommit } = createRepository();
    write(root, "docs/change.txt", "change\n");
    const value = contractFor(root, baseCommit);
    mutate(value);
    expect(() => buildImplementationIdentity(value)).toThrowError(
      expect.objectContaining({ code }),
    );
  });

  it("fails when the declared base is not an ancestor", () => {
    const first = createRepository();
    run(first.root, ["switch", "-c", "unrelated"]);
    write(first.root, "unrelated.txt", "unrelated\n");
    run(first.root, ["add", "."]);
    run(first.root, ["commit", "-qm", "unrelated base"]);
    const unrelatedBase = run(first.root, ["rev-parse", "HEAD"]);
    run(first.root, ["switch", "task"]);
    const value = contractFor(first.root, unrelatedBase);
    expect(() => buildImplementationIdentity(value)).toThrow(GovernanceError);
  });

  it("rejects an untracked forbidden file", () => {
    const { root, baseCommit } = createRepository();
    write(root, "docs/forbidden/untracked.txt", "forbidden\n");
    const identity = buildImplementationIdentity(contractFor(root, baseCommit));
    expect(identity.pathAuthority).toMatchObject({ result: "FAIL" });
  });

  it("rejects both old and new forbidden rename paths", () => {
    const oldRepo = createRepository();
    write(oldRepo.root, "docs/forbidden/old.txt", "old\n");
    run(oldRepo.root, ["add", "."]);
    run(oldRepo.root, ["commit", "-qm", "forbidden old base"]);
    const oldBase = run(oldRepo.root, ["rev-parse", "HEAD"]);
    run(oldRepo.root, ["mv", "docs/forbidden/old.txt", "docs/new.txt"]);
    expect(
      buildImplementationIdentity(contractFor(oldRepo.root, oldBase)).pathAuthority.result,
    ).toBe("FAIL");

    const newRepo = createRepository();
    mkdirSync(join(newRepo.root, "docs/forbidden"), { recursive: true });
    run(newRepo.root, ["mv", "docs/rename.txt", "docs/forbidden/new.txt"]);
    expect(
      buildImplementationIdentity(contractFor(newRepo.root, newRepo.baseCommit)).pathAuthority
        .result,
    ).toBe("FAIL");
  });

  it("rejects a sensitive changed file before hashing its content", () => {
    const { root, baseCommit } = createRepository();
    write(root, ".env.local", "SECRET=must-not-read\n");
    const value = contractFor(root, baseCommit);
    value.allowedPaths.push(".env.local");
    expect(() => buildImplementationIdentity(value)).toThrowError(
      expect.objectContaining({ code: "sensitive-path-forbidden" }),
    );
  });

  it("rejects an unreadable tracked sensitive change before Git content inspection", () => {
    const { root } = createRepository();
    write(root, ".env.local", "SAFE_DUMMY=base\n");
    run(root, ["add", ".env.local"]);
    run(root, ["commit", "-qm", "tracked sensitive base"]);
    const baseCommit = run(root, ["rev-parse", "HEAD"]);
    write(root, ".env.local", "SAFE_DUMMY=changed\n");
    chmodSync(join(root, ".env.local"), 0o000);
    const value = contractFor(root, baseCommit);
    value.allowedPaths.push(".env.local");
    try {
      expect(() => buildImplementationIdentity(value)).toThrowError(
        expect.objectContaining({ code: "sensitive-path-forbidden" }),
      );
    } finally {
      chmodSync(join(root, ".env.local"), 0o600);
    }
  });

  it("excludes an unchanged tracked sensitive path without reading its content", () => {
    const { root } = createRepository();
    write(root, ".env.example", "SAFE_DUMMY=example\n");
    run(root, ["add", ".env.example"]);
    run(root, ["commit", "-qm", "tracked sensitive example"]);
    const baseCommit = run(root, ["rev-parse", "HEAD"]);
    write(root, "docs/change.txt", "change\n");
    const identity = buildImplementationIdentity(contractFor(root, baseCommit));
    expect(identity.result).toBe("PASS");
    expect(identity.changedPaths).toEqual(["docs/change.txt"]);
  });
});
