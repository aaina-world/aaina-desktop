// Points every store package at a published release: versions, download links and checksums.
//   node packaging/update.mjs 0.1.3
// Checksums come from GitHub's own record of the release files, so nothing is downloaded. Release notes for Flathub are
// added from CHANGELOG.md. Then commit; the "Store packages" workflow installs each one again before anything is submitted.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) throw new Error("Usage: node packaging/update.mjs <version>, e.g. 0.1.3");
const here = import.meta.dirname;
const release = JSON.parse(execFileSync("gh", ["api", `repos/aaina-world/aaina-desktop/releases/tags/v${version}`], { encoding: "utf8" }));
const sha = (name) => {
  const asset = release.assets.find((a) => a.name === name);
  if (!asset?.digest?.startsWith("sha256:")) throw new Error(`v${version} has no ${name}`);
  return asset.digest.slice("sha256:".length);
};
const date = release.published_at.slice(0, 10);
const edit = (path, fn) => writeFileSync(path, fn(readFileSync(path, "utf8")));

// Flathub
edit(join(here, "flathub/world.aaina.AainaDesktop.yml"), (s) =>
  s
    .replace(/download\/v[\d.]+\/Aaina\.Desktop_[\d.]+_amd64\.deb/, `download/v${version}/Aaina.Desktop_${version}_amd64.deb`)
    .replace(/sha256: [0-9a-f]{64}/, `sha256: ${sha(`Aaina.Desktop_${version}_amd64.deb`)}`),
);
const notes = readFileSync(join(here, "../CHANGELOG.md"), "utf8").split(`## ${version} `)[1]?.split("\n## ")[0] ?? "";
const firstNote = (notes.match(/^- (.+)$/m)?.[1] ?? "Improvements and fixes.").replace(/&/g, "&amp;").replace(/</g, "&lt;");
edit(join(here, "flathub/world.aaina.AainaDesktop.metainfo.xml"), (s) =>
  s.includes(`version="${version}"`)
    ? s
    : s.replace(
        "<releases>",
        `<releases>\n    <release version="${version}" date="${date}">\n      <description><p>${firstNote}</p></description>\n    </release>`,
      ),
);

// winget: one folder per version
const wingetRoot = join(here, "winget/manifests/a/AainaWorld/AainaDesktop");
const previous = readdirSync(wingetRoot)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .at(-1);
if (previous !== version) {
  mkdirSync(join(wingetRoot, version));
  for (const f of readdirSync(join(wingetRoot, previous))) renameSync(join(wingetRoot, previous, f), join(wingetRoot, version, f));
  execFileSync("rmdir", [join(wingetRoot, previous)]);
}
for (const f of readdirSync(join(wingetRoot, version)))
  edit(join(wingetRoot, version, f), (s) =>
    s
      .replaceAll(/PackageVersion: [\d.]+/g, `PackageVersion: ${version}`)
      .replace(/ReleaseDate: [\d-]+/, `ReleaseDate: ${date}`)
      .replace(/download\/v[\d.]+\/Aaina\.Desktop_[\d.]+_x64-setup\.exe/, `download/v${version}/Aaina.Desktop_${version}_x64-setup.exe`)
      .replace(/(x64-setup\.exe\n\s+InstallerSha256: )[0-9A-F]{64}/, `$1${sha(`Aaina.Desktop_${version}_x64-setup.exe`).toUpperCase()}`)
      .replace(/download\/v[\d.]+\/Aaina\.Desktop_[\d.]+_x64_en-US\.msi/, `download/v${version}/Aaina.Desktop_${version}_x64_en-US.msi`)
      .replace(/(en-US\.msi\n\s+InstallerSha256: )[0-9A-F]{64}/, `$1${sha(`Aaina.Desktop_${version}_x64_en-US.msi`).toUpperCase()}`)
      .replace(/releases\/tag\/v[\d.]+/, `releases/tag/v${version}`),
  );

// Homebrew
edit(join(here, "homebrew/Casks/aaina-desktop.rb"), (s) =>
  s
    .replace(/version "[\d.]+"/, `version "${version}"`)
    .replace(/sha256 "[0-9a-f]{64}"/, `sha256 "${sha(`Aaina.Desktop_${version}_universal.dmg`)}"`),
);
console.log(`Store packages now point at v${version}.`);
