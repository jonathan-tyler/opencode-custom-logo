import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const temporaryRoot = await mkdtemp(join(tmpdir(), "opencode-custom-logo-build-check-"))

try {
  const generatedDirectory = join(temporaryRoot, "dist")
  await execFileAsync(
    process.execPath,
    [
      join(repositoryRoot, "script/build.mjs"),
      "--out-dir",
      generatedDirectory,
    ],
    { cwd: repositoryRoot },
  )

  const committedDirectory = join(repositoryRoot, "dist")
  const generatedFiles = await filesBelow(generatedDirectory)
  const committedFiles = await filesBelow(committedDirectory)
  assert.deepEqual(committedFiles, generatedFiles, "committed artifact inventory is stale")
  for (const path of generatedFiles) {
    assert.deepEqual(
      await readFile(join(committedDirectory, path)),
      await readFile(join(generatedDirectory, path)),
      `committed artifact is stale: dist/${path}`,
    )
  }

  const manifest = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"))
  assert.equal(manifest.exports?.["./tui"], "./dist/index.js")
  for (const preparationTrigger of [
    "build",
    "preinstall",
    "install",
    "postinstall",
    "prepack",
    "prepare",
  ]) {
    assert.equal(
      manifest.scripts?.[preparationTrigger],
      undefined,
      `Git package must not require ${preparationTrigger}`,
    )
  }

  const artifact = await readFile(join(committedDirectory, "index.js"), "utf8")
  assert.match(
    artifact,
    /from "opentui:runtime-module:%40opentui%2Fsolid%2Fjsx-runtime"/u,
    "the artifact must bind JSX to OpenCode's host OpenTUI and Solid runtime",
  )

  const archive = join(temporaryRoot, "package.tgz")
  const { stdout } = await execFileAsync("pnpm", ["pack", "--json", "--out", archive], {
    cwd: repositoryRoot,
  })
  const packageFiles = JSON.parse(stdout).files.map(({ path }) => path).sort()
  assert.deepEqual(packageFiles, [
    "README.md",
    "dist/ansi.d.ts",
    "dist/ansi.js",
    "dist/index.d.ts",
    "dist/index.js",
    "package.json",
  ])

  console.log(`Artifact files: ${committedFiles.map((path) => `dist/${path}`).join(", ")}`)
  console.log(`Package files: ${packageFiles.join(", ")}`)
  console.log("Runtime binding: OpenCode host @opentui/solid/jsx-runtime virtual module")
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

async function filesBelow(directory) {
  return (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(directory.length + 1))
    .sort()
}
