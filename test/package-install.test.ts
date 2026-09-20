import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const opencode = new URL("../node_modules/opencode-ai/bin/opencode.exe", import.meta.url).pathname

async function commit(repository: string): Promise<string> {
  await execFileAsync("git", ["init", "--quiet", repository])
  await execFileAsync("git", ["-C", repository, "config", "user.name", "Package Check"])
  await execFileAsync("git", [
    "-C",
    repository,
    "config",
    "user.email",
    "package-check@example.invalid",
  ])
  await execFileAsync("git", ["-C", repository, "add", "."])
  await execFileAsync("git", ["-C", repository, "commit", "--quiet", "-m", "fixture"])
  const { stdout } = await execFileAsync("git", ["-C", repository, "rev-parse", "HEAD"])
  return stdout.trim()
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

test(
  "OpenCode installs a local Git package dependency before importing its TUI entry point",
  { timeout: 45_000 },
  async (context) => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "opencode git package check "))
    context.after(() => rm(temporaryRoot, { recursive: true, force: true }))
    const dependencyRepository = join(temporaryRoot, "production dependency")
    const pluginRepository = join(temporaryRoot, "plugin repository")
    const home = join(temporaryRoot, "home with spaces")
    const configHome = join(temporaryRoot, "config with spaces")
    const cacheHome = join(temporaryRoot, "cache with spaces")
    const dataHome = join(temporaryRoot, "data with spaces")
    const stateHome = join(temporaryRoot, "state with spaces")
    const shims = join(temporaryRoot, "forbidden command shims")
    const forbiddenLog = join(temporaryRoot, "forbidden commands.log")
    const importMarker = join(temporaryRoot, "entry imported.log")

    await mkdir(dependencyRepository, { recursive: true })
    await writeFile(
      join(dependencyRepository, "package.json"),
      JSON.stringify({ name: "fixture-production-dependency", version: "1.0.0", type: "module" }),
    )
    await writeFile(join(dependencyRepository, "index.js"), 'export default "dependency-ready"\n')
    const dependencyRevision = await commit(dependencyRepository)

    await mkdir(pluginRepository, { recursive: true })
    await writeFile(
      join(pluginRepository, "package.json"),
      JSON.stringify({
        name: "opencode-package-install-fixture",
        version: "1.0.0",
        type: "module",
        exports: { "./tui": "./tui.js" },
        dependencies: {
          "fixture-production-dependency":
            `git+file://${dependencyRepository}#${dependencyRevision}`,
        },
      }),
    )
    await writeFile(
      join(pluginRepository, "tui.js"),
      `import dependency from "fixture-production-dependency"
import { appendFileSync } from "node:fs"

appendFileSync(process.env.IMPORT_MARKER, dependency + "\\n")
export default { tui: async () => undefined }
`,
    )
    const pluginRevision = await commit(pluginRepository)
    const pluginSpec = `git+file://${pluginRepository}#${pluginRevision}`

    await mkdir(shims, { recursive: true })
    for (const command of ["node", "npm", "npx", "pnpm", "bun"]) {
      const shim = join(shims, command)
      await writeFile(
        shim,
        `#!/bin/sh
printf '%s\\n' "$0 $*" >>"$FORBIDDEN_COMMAND_LOG"
exit 97
`,
      )
      await chmod(shim, 0o755)
    }

    const environment = {
      ...process.env,
      FORBIDDEN_COMMAND_LOG: forbiddenLog,
      HOME: home,
      IMPORT_MARKER: importMarker,
      PATH: `${shims}:${process.env.PATH}`,
      XDG_CACHE_HOME: cacheHome,
      XDG_CONFIG_HOME: configHome,
      XDG_DATA_HOME: dataHome,
      XDG_STATE_HOME: stateHome,
    }
    assert.equal(await exists(join(configHome, "opencode")), false)
    assert.equal(await exists(join(cacheHome, "opencode")), false)
    const version = (await execFileAsync(opencode, ["--version"], { env: environment })).stdout.trim()
    assert.equal(version, "1.18.0")

    await execFileAsync(opencode, ["plugin", pluginSpec, "--global"], {
      cwd: temporaryRoot,
      env: environment,
      timeout: 30_000,
    })

    assert.equal(
      await exists(importMarker),
      false,
      "the package command imported the TUI entry point",
    )
    const configuration = JSON.parse(
      await readFile(join(configHome, "opencode", "tui.json"), "utf8"),
    ) as { plugin: string[] }
    assert.deepEqual(configuration.plugin, [pluginSpec])
    const installForbiddenCommands = (await exists(forbiddenLog))
      ? await readFile(forbiddenLog, "utf8")
      : ""
    assert.equal(
      installForbiddenCommands,
      "",
      "package installation invoked an external Node.js package manager",
    )

    const tui = spawn(opencode, [], {
      cwd: temporaryRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    tui.stdout.on("data", (chunk) => (output += chunk.toString()))
    tui.stderr.on("data", (chunk) => (output += chunk.toString()))
    context.after(() => tui.kill("SIGKILL"))

    const deadline = Date.now() + 15_000
    while (!(await exists(importMarker)) && Date.now() < deadline && tui.exitCode === null) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    tui.kill("SIGTERM")

    assert.equal(await exists(importMarker), true, `TUI entry point was not imported:\n${output}`)
    assert.equal(await readFile(importMarker, "utf8"), "dependency-ready\n")
  },
)
