import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))

// Resolve isolated output without allowing generated files to replace the repository root.
const outputArgument = process.argv.indexOf("--out-dir")
if (outputArgument !== -1) {
  assert.ok(process.argv[outputArgument + 1], "--out-dir requires a path")
}
const outputDirectory = resolve(
  outputArgument === -1 ? repositoryRoot : process.cwd(),
  outputArgument === -1 ? "dist" : (process.argv[outputArgument + 1] ?? ""),
)
assert.notEqual(outputDirectory, repositoryRoot, "refusing to emit over the repository root")

// Rebuild the artifact from source in a clean output directory.
await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })
await execFileAsync(
  process.execPath,
  [
    resolve(repositoryRoot, "node_modules/typescript/bin/tsc"),
    "--project",
    resolve(repositoryRoot, "tsconfig.build.json"),
    "--outDir",
    outputDirectory,
  ],
  { cwd: repositoryRoot },
)

// Bind emitted JSX to OpenCode's host runtime instead of a package-local renderer.
const entrypoint = resolve(outputDirectory, "index.js")
const emitted = await readFile(entrypoint, "utf8")
const jsxRuntime = 'from "@opentui/solid/jsx-runtime"'
assert.equal(emitted.split(jsxRuntime).length - 1, 1, "expected one emitted JSX runtime import")
await writeFile(
  entrypoint,
  emitted.replace(
    jsxRuntime,
    'from "opentui:runtime-module:%40opentui%2Fsolid%2Fjsx-runtime"',
  ),
)
