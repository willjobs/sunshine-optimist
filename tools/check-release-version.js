import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const versionOf = (source) => source.match(/const CACHE_VERSION = "([^"]+)"/)?.[1];
const isRuntimeAsset = (path) =>
  /^(index\.html|sw\.js|styles\.css|favicon\.svg|manifest\.webmanifest|astronomy-engine\/|scripts\/)/.test(
    path
  ) && !/\.test\.js$|^scripts\/git-hooks\//.test(path);

export const checkReleaseVersion = ({ base, cwd = process.cwd() }) => {
  if (!base || !/^[a-f0-9]{7,40}$/i.test(base) || /^0+$/.test(base)) {
    throw new Error("Provide a valid comparison commit via RELEASE_BASE_SHA.");
  }
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  const changed = git("diff", "--name-only", base, "--").trim().split("\n").filter(isRuntimeAsset);
  if (!changed.length) return;
  const previous = versionOf(git("show", `${base}:sw.js`));
  const current = versionOf(readFileSync(resolve(cwd, "sw.js"), "utf8"));
  if (!current || current === previous) {
    throw new Error(
      "Runtime assets changed without a new CACHE_VERSION. Update sw.js and index.html version URLs together."
    );
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkReleaseVersion({ base: process.env.RELEASE_BASE_SHA });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
