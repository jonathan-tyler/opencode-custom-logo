import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

test("renders file-backed and inline logos as complete escaped literals", async (context) => {
  const configDirectory = await mkdtemp(join(tmpdir(), "opencode-custom-logo-test-"))
  context.after(() => rm(configDirectory, { recursive: true, force: true }))
  await writeFile(
    join(configDirectory, "logo.md"),
    "# literal Markdown\nfirst\n\u001b[31msecond\u001b[0m\n",
  )

  const mockOptions = {
    exports: {
      Fragment: Symbol("Fragment"),
      jsx: (type: unknown, properties: unknown) => ({ type, properties }),
      jsxs: (type: unknown, properties: unknown) => ({ type, properties }),
    },
  } as unknown as Parameters<typeof context.mock.module>[1]
  context.mock.module("@opentui/solid/jsx-runtime", mockOptions)

  const { default: plugin } = await import("../src/index.js")
  let registered: {
    slots: { home_logo: () => unknown }
  } | undefined
  const api = {
    state: {
      path: {
        config: configDirectory,
      },
    },
    slots: {
      register(value: typeof registered) {
        registered = value
        return "test-registration"
      },
    },
  }

  await plugin.tui(api as never, { logoFile: "logo.md" })

  assert.deepEqual(registered?.slots.home_logo(), {
    type: "text",
    properties: {
      children: "# literal Markdown\nfirst\n\\u001b[31msecond\\u001b[0m\n",
    },
  })

  await plugin.tui(api as never, { logo: "inline\n\u001b[31msecond\u001b[0m" })
  assert.deepEqual(registered?.slots.home_logo(), {
    type: "text",
    properties: {
      children: "inline\n\\u001b[31msecond\\u001b[0m",
    },
  })
})
