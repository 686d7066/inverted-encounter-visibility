import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function parseVersionSegments(version: string): number[] {
  const core = version.split("-", 1)[0];
  const segments = core.split(".").map((segment) => Number.parseInt(segment, 10));

  if (segments.length === 0 || segments.some((segment) => Number.isNaN(segment))) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return segments;
}

function compareVersions(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

const baseSha = process.argv[2];
if (!baseSha) {
  throw new Error("Missing pull request base SHA argument.");
}

const scriptPath = ".github/workflows/get-version.ts";
const headVersion = run("node", ["--experimental-strip-types", scriptPath]);

const tempDirectory = mkdtempSync(join(tmpdir(), "inverted-encounter-visibility-base-"));
const baseModuleJsonPath = join(tempDirectory, "module.json");

try {
  const baseModuleJson = run("git", ["show", `${baseSha}:src/module.json`]);
  writeFileSync(baseModuleJsonPath, baseModuleJson, "utf8");

  const baseVersion = run("node", ["--experimental-strip-types", scriptPath, baseModuleJsonPath]);

  console.log(`Base version: ${baseVersion}`);
  console.log(`Head version: ${headVersion}`);

  if (compareVersions(parseVersionSegments(headVersion), parseVersionSegments(baseVersion)) <= 0) {
    throw new Error("src/module.json version must be increased for this PR.");
  }
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
