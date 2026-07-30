import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const qualityScript = fileURLToPath(
  new URL("./check-quality.mjs", import.meta.url)
);

const run = (cwd: string, command: string, args: string[]) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`
    );
  }
  return result.stdout.trim();
};

const commitFile = (repository: string, name: string) => {
  writeFileSync(join(repository, name), `export const value = "${name}";\n`);
  run(repository, "git", ["add", name]);
  run(repository, "git", ["commit", "-m", `add ${name}`]);
  return run(repository, "git", ["rev-parse", "HEAD"]);
};

afterEach(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
  temporaryDirectories.length = 0;
});

describe("changed-file quality range", () => {
  it("checks every commit included in a multi-commit push", () => {
    const repository = mkdtempSync(join(tmpdir(), "openstarter-quality-"));
    temporaryDirectories.push(repository);
    run(repository, "git", ["init", "--initial-branch=main"]);
    run(repository, "git", ["config", "user.email", "test@example.com"]);
    run(repository, "git", ["config", "user.name", "Test User"]);

    const before = commitFile(repository, "first.js");
    commitFile(repository, "second.js");
    commitFile(repository, "third.js");

    const binaryDirectory = join(repository, "bin");
    run(repository, "mkdir", [binaryDirectory]);
    const captureFile = join(repository, "ultracite-args.txt");
    writeFileSync(captureFile, "");
    const fakeUltracite = join(binaryDirectory, "ultracite");
    writeFileSync(
      fakeUltracite,
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${captureFile}"\n`
    );
    chmodSync(fakeUltracite, 0o755);

    const result = spawnSync(process.execPath, [qualityScript], {
      cwd: repository,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binaryDirectory}:${process.env.PATH ?? ""}`,
        ULTRACITE_BASE_SHA: before,
      },
    });

    expect(result.status).toBe(0);
    const checkedFiles = readFileSync(captureFile, "utf8");
    expect(checkedFiles).toContain("second.js");
    expect(checkedFiles).toContain("third.js");
  });

  it("checks files that differ from the adoption baseline on first push", () => {
    const repository = mkdtempSync(join(tmpdir(), "openstarter-quality-"));
    temporaryDirectories.push(repository);
    run(repository, "git", ["init", "--initial-branch=main"]);
    run(repository, "git", ["config", "user.email", "test@example.com"]);
    run(repository, "git", ["config", "user.name", "Test User"]);

    commitFile(repository, "first.js");
    const firstHash = createHash("sha256")
      .update(readFileSync(join(repository, "first.js")))
      .digest("hex");
    writeFileSync(
      join(repository, ".ultracite-baseline.json"),
      `${JSON.stringify({ "first.js": firstHash }, null, 2)}\n`
    );
    run(repository, "git", ["add", ".ultracite-baseline.json"]);
    run(repository, "git", ["commit", "-m", "add quality baseline"]);
    commitFile(repository, "second.js");

    const binaryDirectory = join(repository, "bin");
    run(repository, "mkdir", [binaryDirectory]);
    const captureFile = join(repository, "ultracite-args.txt");
    writeFileSync(captureFile, "");
    const fakeUltracite = join(binaryDirectory, "ultracite");
    writeFileSync(
      fakeUltracite,
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${captureFile}"\n`
    );
    chmodSync(fakeUltracite, 0o755);

    const result = spawnSync(process.execPath, [qualityScript], {
      cwd: repository,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binaryDirectory}:${process.env.PATH ?? ""}`,
        ULTRACITE_BASE_SHA: "0000000000000000000000000000000000000000",
      },
    });

    expect(result.status).toBe(0);
    const checkedFiles = readFileSync(captureFile, "utf8");
    expect(checkedFiles).not.toContain("first.js");
    expect(checkedFiles).toContain("second.js");
  });
});
