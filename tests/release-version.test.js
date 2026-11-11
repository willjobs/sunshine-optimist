import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkReleaseVersion } from "../tools/check-release-version.js";
const directories = [];
afterEach(() =>
  directories.splice(0).forEach((cwd) => rmSync(cwd, { recursive: true, force: true }))
);
const fixture = () => {
  const cwd = mkdtempSync(join(tmpdir(), "release-check-"));
  directories.push(cwd);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  mkdirSync(join(cwd, "scripts"));
  writeFileSync(join(cwd, "sw.js"), 'const CACHE_VERSION = "v1";');
  writeFileSync(join(cwd, "scripts/app.js"), "old");
  git("add", ".");
  git("commit", "-qm", "initial");
  return { cwd, base: git("rev-parse", "HEAD").trim() };
};
describe("release freshness", () => {
  it("rejects changed runtime code without a version bump", () => {
    const options = fixture();
    writeFileSync(join(options.cwd, "scripts/app.js"), "new");
    expect(() => checkReleaseVersion(options)).toThrow("Runtime assets changed");
  });
  it("accepts runtime changes with a new version", () => {
    const options = fixture();
    writeFileSync(join(options.cwd, "scripts/app.js"), "new");
    writeFileSync(join(options.cwd, "sw.js"), 'const CACHE_VERSION = "v2";');
    expect(() => checkReleaseVersion(options)).not.toThrow();
  });
  it("allows documentation and test changes without a release", () => {
    const options = fixture();
    writeFileSync(join(options.cwd, "README.md"), "docs");
    writeFileSync(join(options.cwd, "scripts/app.test.js"), "test");
    execFileSync("git", ["add", "."], { cwd: options.cwd });
    expect(() => checkReleaseVersion(options)).not.toThrow();
  });
  it("fails explicitly if CI does not supply a comparison commit", () => {
    expect(() => checkReleaseVersion({ base: "" })).toThrow("comparison commit");
  });
});
