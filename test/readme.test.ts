import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8")

function section(markdown: string, heading: string, nextHeading: string): string {
  const start = markdown.indexOf(heading)
  const end = markdown.indexOf(nextHeading, start + heading.length)
  assert.notEqual(start, -1, `missing ${heading}`)
  assert.notEqual(end, -1, `missing ${nextHeading}`)
  return markdown.slice(start, end)
}

function fencedBlocks(markdown: string, language: string): string[] {
  return [...markdown.matchAll(new RegExp("```" + language + "\\n([\\s\\S]*?)\\n```", "g"))].map(
    ([, body]) => body,
  )
}

test("documents executable package installation commands", async (context) => {
  const installSection = section(readme, "## Install", "## Configure")
  const commands = fencedBlocks(installSection, "sh")
  assert.deepEqual(commands, [
    'opencode plugin "git+https://github.com/jonathan-tyler/' +
      'opencode-custom-logo.git#v0.2.0" --global',
    "chezmoi apply",
  ])

  const temporaryRoot = await mkdtemp(join(tmpdir(), "opencode readme install "))
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }))
  const home = join(temporaryRoot, "home with spaces")
  const configHome = join(temporaryRoot, "config with spaces")
  const cacheHome = join(temporaryRoot, "cache with spaces")
  const shims = join(temporaryRoot, "command shims")
  const capture = join(temporaryRoot, "command capture")
  await mkdir(shims, { recursive: true })

  await writeFile(
    join(shims, "opencode"),
    `#!/bin/sh
set -eu
test "$#" -eq 3
test "$1" = plugin
test "$2" = "git+https://github.com/jonathan-tyler/opencode-custom-logo.git#v0.2.0"
test "$3" = --global
mkdir -p "$XDG_CONFIG_HOME/opencode"
printf '%s\n' installed >"$XDG_CONFIG_HOME/opencode/tui.json"
printf '%s\n' opencode >"$COMMAND_CAPTURE"
`,
  )
  await writeFile(
    join(shims, "chezmoi"),
    `#!/bin/sh
set -eu
test "$#" -eq 1
test "$1" = apply
printf '%s\n' chezmoi >>"$COMMAND_CAPTURE"
`,
  )
  await chmod(join(shims, "opencode"), 0o755)
  await chmod(join(shims, "chezmoi"), 0o755)

  const environment = {
    ...process.env,
    COMMAND_CAPTURE: capture,
    HOME: home,
    PATH: `${shims}:${process.env.PATH}`,
    XDG_CACHE_HOME: cacheHome,
    XDG_CONFIG_HOME: configHome,
  }
  for (const command of commands) {
    await execFileAsync("sh", ["-eu", "-c", command], { env: environment })
  }

  assert.equal(await readFile(capture, "utf8"), "opencode\nchezmoi\n")
  assert.equal(await readFile(join(configHome, "opencode/tui.json"), "utf8"), "installed\n")
})

test("keeps every README JSON example valid", () => {
  const examples = fencedBlocks(readme, "json")
  assert.ok(examples.length > 0)
  for (const example of examples) JSON.parse(example)
})

test("documents a generic default chezmoi source file", () => {
  const installSection = section(readme, "## Install", "## Configure")
  const chezmoiStart = installSection.indexOf("### chezmoi")
  assert.notEqual(chezmoiStart, -1, "missing chezmoi subsection")
  const chezmoi = installSection.slice(chezmoiStart)

  assert.match(chezmoi, /~\/\.local\/share\/chezmoi\/dot_config\/opencode\/tui\.json/)
  assert.match(chezmoi, /~\/\.config\/opencode\/tui\.json/)
  assert.match(
    chezmoi,
    /git\+https:\/\/github\.com\/jonathan-tyler\/opencode-custom-logo\.git#v0\.2\.0/,
  )
  assert.doesNotMatch(
    chezmoi,
    /profile|domain|hostname|operator|agent|external|package\.json|npm|npx|pnpm|bun|private/i,
  )
})
