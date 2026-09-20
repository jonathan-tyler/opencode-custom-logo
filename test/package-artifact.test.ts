import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

type PackageManifest = {
  exports?: Record<string, unknown>
}

test("the package exports a committed JavaScript TUI artifact", async () => {
  const manifestPath = new URL("../package.json", import.meta.url)
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PackageManifest
  const tuiExport = manifest.exports?.["./tui"]

  if (typeof tuiExport !== "string") assert.fail("./tui must be a string export")
  assert.match(tuiExport, /^\.\/dist\/[^/]+\.js$/u)
  assert.doesNotMatch(tuiExport, /\.[cm]?tsx?$/u)

  const artifact = await readFile(new URL(`..${tuiExport.slice(1)}`, import.meta.url), "utf8")
  assert.match(
    artifact,
    /from "opentui:runtime-module:%40opentui%2Fsolid%2Fjsx-runtime"/u,
  )
})
