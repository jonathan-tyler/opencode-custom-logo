import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const opencode = join(repositoryRoot, "node_modules/opencode-ai/bin/opencode.exe")

test(
  "the installed repository package renders inline and file-backed styled home logos",
  { timeout: 120_000 },
  async (context) => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "opencode-package-render-"))
    context.after(() => rm(temporaryRoot, { recursive: true, force: true }))
    const packageRepository = join(temporaryRoot, "package-repository")
    await cp(repositoryRoot, packageRepository, {
      recursive: true,
      filter: (source) => {
        const topLevelEntry = source.slice(repositoryRoot.length + 1).split("/")[0]!
        return ![".git", ".scratch", "node_modules"].includes(topLevelEntry)
      },
    })
    const packageRevision = await commit(packageRepository)
    const packageSpec =
      `opencode-custom-logo@git+${pathToFileURL(packageRepository).href}#${packageRevision}`

    for (const scenario of [
      {
        name: "inline",
        marker: "INLINE_PACKAGE_LOGO",
        options: { logo: styled("INLINE_PACKAGE_LOGO") },
      },
      {
        name: "file",
        marker: "FILE_PACKAGE_LOGO",
        options: { logoFile: "logos/custom logo.txt" },
      },
    ] as const) {
      await context.test(scenario.name, async () => {
        const root = join(temporaryRoot, `${scenario.name} scenario with spaces`)
        const home = join(root, "home with spaces")
        const configHome = join(root, "config with spaces")
        const cacheHome = join(root, "cache with spaces")
        const dataHome = join(root, "data with spaces")
        const stateHome = join(root, "state with spaces")
        const project = join(root, "project with spaces")
        const shims = join(root, "forbidden command shims")
        const forbiddenLog = join(root, "forbidden commands.log")
        await mkdir(home, { recursive: true })
        await mkdir(dataHome, { recursive: true })
        await mkdir(stateHome, { recursive: true })
        await mkdir(project, { recursive: true })
        await mkdir(shims, { recursive: true })
        await writeForbiddenShims(shims)

        const environment = {
          ...process.env,
          COLORTERM: "truecolor",
          FORBIDDEN_COMMAND_LOG: forbiddenLog,
          HOME: home,
          OPENCODE_DISABLE_AUTOUPDATE: "1",
          OPENCODE_DISABLE_MODELS_FETCH: "1",
          OPENCODE_DISABLE_PROJECT_CONFIG: "1",
          PATH: `${shims}:${process.env.PATH}`,
          TERM: "xterm-256color",
          XDG_CACHE_HOME: cacheHome,
          XDG_CONFIG_HOME: configHome,
          XDG_DATA_HOME: dataHome,
          XDG_STATE_HOME: stateHome,
        }
        assert.equal(await exists(configHome), false)
        assert.equal(await exists(cacheHome), false)

        await execFileAsync(opencode, ["plugin", packageSpec, "--global"], {
          cwd: project,
          env: environment,
          timeout: 45_000,
        })

        const installedPackage = await findInstalledPackage(cacheHome)
        assert.match(installedPackage, /[/\\]node_modules[/\\]/u)
        assert.equal(await exists(join(installedPackage, "dist/index.js")), true)
        assert.equal(await exists(join(installedPackage, "src/index.tsx")), false)
        assert.equal(await exists(join(installedPackage, "test")), false)
        const installedManifest = JSON.parse(
          await readFile(join(installedPackage, "package.json"), "utf8"),
        ) as { exports?: Record<string, string>; version?: string }
        assert.equal(installedManifest.version, "0.2.1")
        assert.equal(installedManifest.exports?.["./tui"], "./dist/index.js")
        const runtimePath = createRequire(join(installedPackage, "dist/index.js")).resolve(
          "@opentui/solid/jsx-runtime",
        )
        assert.match(runtimePath, new RegExp(`^${escapeRegex(cacheHome)}`))

        const configDirectory = join(configHome, "opencode")
        if (scenario.name === "file") {
          await mkdir(join(configDirectory, "logos"), { recursive: true })
          await writeFile(join(configDirectory, "logos/custom logo.txt"), styled(scenario.marker))
        }
        await writeFile(
          join(configDirectory, "tui.json"),
          JSON.stringify({ plugin: [[packageSpec, scenario.options]] }),
        )
        const tupleConfiguration = JSON.parse(
          await readFile(join(configDirectory, "tui.json"), "utf8"),
        ) as { plugin: unknown[] }
        assert.deepEqual(tupleConfiguration.plugin, [[packageSpec, scenario.options]])

        await writeForbiddenShim(shims, "git")
        const output = await renderUntil(project, environment, scenario.marker)
        assert.match(
          output,
          new RegExp(scenario.marker),
          `configured home_logo did not render:\n${output}`,
        )
        assert.match(
          output,
          new RegExp(`\\u001b\\[38;2;12;34;56m[\\s\\S]{0,80}${scenario.marker}`),
          `configured home_logo did not render with its RGB style:\n${output}`,
        )
        const forbiddenCommands = (await exists(forbiddenLog))
          ? await readFile(forbiddenLog, "utf8")
          : ""
        assert.equal(
          forbiddenCommands,
          "",
          "warm package load invoked Git or an external package manager",
        )
      })
    }
  },
)

function styled(marker: string): string {
  return `\u001b[38;2;12;34;56;1m${marker}\u001b[0m`
}

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
  return (await execFileAsync("git", ["-C", repository, "rev-parse", "HEAD"])).stdout.trim()
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

async function findInstalledPackage(cacheHome: string): Promise<string> {
  for (const entry of await readdir(cacheHome, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== "package.json") continue
    const path = join(entry.parentPath, entry.name)
    const manifest = JSON.parse(await readFile(path, "utf8")) as { name?: string }
    if (manifest.name === "opencode-custom-logo") return entry.parentPath
  }
  assert.fail(`opencode-custom-logo was not installed beneath ${cacheHome}`)
}

async function writeForbiddenShims(directory: string): Promise<void> {
  for (const command of ["node", "npm", "npx", "pnpm", "bun"]) {
    await writeForbiddenShim(directory, command)
  }
}

async function writeForbiddenShim(directory: string, command: string): Promise<void> {
  const shim = join(directory, command)
  await writeFile(
    shim,
    `#!/bin/sh
printf '%s\\n' "$0 $*" >>"$FORBIDDEN_COMMAND_LOG"
exit 97
`,
  )
  await chmod(shim, 0o755)
}

async function renderUntil(
  project: string,
  environment: NodeJS.ProcessEnv,
  marker: string,
): Promise<string> {
  const terminal = spawn("script", ["--quiet", "--return", "--command", opencode, "/dev/null"], {
    cwd: project,
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
  })
  let output = ""
  terminal.stdout.on("data", (chunk) => (output += chunk.toString()))
  terminal.stderr.on("data", (chunk) => (output += chunk.toString()))

  const deadline = Date.now() + 30_000
  while (!output.includes(marker) && Date.now() < deadline && terminal.exitCode === null) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  terminal.stdin.write("\u0003")
  terminal.stdin.end()
  await Promise.race([
    new Promise<void>((resolve) => terminal.once("close", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ])
  if (terminal.exitCode === null) terminal.kill("SIGKILL")
  return output
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}
