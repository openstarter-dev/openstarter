import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const QUALITY_BASELINE_PATH = ".ultracite-baseline.json";

const getFileHash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

const loadQualityBaseline = () => {
  if (!existsSync(QUALITY_BASELINE_PATH)) {
    return new Map();
  }
  const parsed = JSON.parse(readFileSync(QUALITY_BASELINE_PATH, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid Ultracite baseline format");
  }
  const baseline = new Map();
  for (const [path, hash] of Object.entries(parsed)) {
    if (typeof hash !== "string") {
      throw new Error(`Invalid Ultracite baseline hash for ${path}`);
    }
    baseline.set(path, hash);
  }
  return baseline;
};
const ZERO_SHA_PATTERN = /^0+$/u;

const runGit = (args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`
    );
  }
  return result.stdout.trim();
};

const gitRefExists = (reference) =>
  spawnSync("git", ["rev-parse", "--verify", reference], {
    encoding: "utf8",
  }).status === 0;

const addLines = (target, value) => {
  for (const line of value.split("\n")) {
    const path = line.trim();
    if (path) {
      target.add(path);
    }
  }
};

const pushBase = process.env.ULTRACITE_BASE_SHA;
const isInitialPush = Boolean(pushBase && ZERO_SHA_PATTERN.test(pushBase));

const getCommittedRange = () => {
  if (isInitialPush) {
    return null;
  }

  if (pushBase) {
    if (!gitRefExists(pushBase)) {
      throw new Error(`ULTRACITE_BASE_SHA is unavailable: ${pushBase}`);
    }
    return `${pushBase}..HEAD`;
  }

  const pullRequestBase = process.env.GITHUB_BASE_REF;
  if (pullRequestBase) {
    const remoteBase = `origin/${pullRequestBase}`;
    if (!gitRefExists(remoteBase)) {
      throw new Error(`Pull request base is unavailable: ${remoteBase}`);
    }
    return `${runGit(["merge-base", "HEAD", remoteBase])}..HEAD`;
  }

  const configuredBase = process.env.ULTRACITE_BASE_REF;
  const localBase =
    configuredBase || (gitRefExists("main") ? "main" : "origin/main");
  if (gitRefExists(localBase)) {
    return `${runGit(["merge-base", "HEAD", localBase])}..HEAD`;
  }

  return gitRefExists("HEAD^") ? "HEAD^..HEAD" : null;
};

const changedFiles = new Set();
if (isInitialPush) {
  addLines(changedFiles, runGit(["ls-tree", "-r", "--name-only", "HEAD"]));
}

const committedRange = getCommittedRange();
if (committedRange) {
  addLines(
    changedFiles,
    runGit(["diff", "--name-only", "--diff-filter=ACMR", committedRange])
  );
}

addLines(
  changedFiles,
  runGit(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"])
);
addLines(changedFiles, runGit(["ls-files", "--others", "--exclude-standard"]));

const supportedExtension = /\.(?:cjs|css|js|json|jsonc|jsx|mjs|ts|tsx)$/u;
const qualityBaseline = isInitialPush ? loadQualityBaseline() : new Map();
const files = [...changedFiles]
  .filter((path) => supportedExtension.test(path) && existsSync(path))
  .filter((path) => !path.endsWith(".gen.ts"))
  .filter(
    (path) => !isInitialPush || qualityBaseline.get(path) !== getFileHash(path)
  )
  .sort();

if (files.length === 0) {
  process.stdout.write("No changed files require Ultracite checks.\n");
} else {
  process.stdout.write(`Ultracite checking ${files.length} changed files.\n`);
  const command = process.platform === "win32" ? "ultracite.cmd" : "ultracite";
  const result = spawnSync(command, ["check", ...files], { stdio: "inherit" });

  if (result.error) {
    throw new Error(`Unable to run Ultracite: ${result.error.message}`);
  }

  process.exitCode = result.status ?? 1;
}
