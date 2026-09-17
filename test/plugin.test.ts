import assert from "node:assert/strict"
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import plugin, { escapeControlCharacters } from "../src/index.js"

test("preserves multiline logo characters, order, and line breaks", () => {
  assert.equal(
    escapeControlCharacters("first line\n╭─ logo ─╮\nlast line"),
    "first line\n╭─ logo ─╮\nlast line",
  )
})

test("preserves CRLF and lone carriage-return line breaks", () => {
  assert.equal(escapeControlCharacters("first\r\nsecond\rthird"), "first\r\nsecond\rthird")
})

test("makes terminal control sequences printable instead of interpreting them", () => {
  assert.equal(
    escapeControlCharacters("\u001b[31mred\u001b[0m\ttab"),
    "\\u001b[31mred\\u001b[0m\\ttab",
  )
})

test("leaves the stock logo registered when no custom logo is configured", async () => {
  let registrations = 0
  const api = {
    slots: {
      register() {
        registrations += 1
        return "test-registration"
      },
    },
  }

  await plugin.tui(api as never, undefined)
  assert.equal(registrations, 0)
})

test("leaves the plugin unconfigured for a non-string inline logo", async () => {
  let registrations = 0
  const api = {
    slots: {
      register() {
        registrations += 1
        return "test-registration"
      },
    },
  }

  await plugin.tui(api as never, { logo: 42 })
  assert.equal(registrations, 0)
})

test("registers one home logo replacement for a configured string", async () => {
  let registered: unknown
  const api = {
    slots: {
      register(value: unknown) {
        registered = value
        return "test-registration"
      },
    },
  }

  await plugin.tui(api as never, { logo: "one\ntwo" })

  assert.deepEqual(Object.keys(registered as object), ["slots"])
  assert.equal(
    typeof (registered as { slots: { home_logo: unknown } }).slots.home_logo,
    "function",
  )
})

test("rejects configuring both inline and file-backed logos without registering a slot", async () => {
  let registrations = 0
  const api = {
    state: {
      path: {
        config: "/does/not/matter",
      },
    },
    slots: {
      register() {
        registrations += 1
        return "test-registration"
      },
    },
  }

  await assert.rejects(
    plugin.tui(api as never, { logo: "inline", logoFile: "logo.txt" }),
    /cannot configure both logo and logoFile/i,
  )
  assert.equal(registrations, 0)
})

test("rejects a non-string logoFile without registering a slot", async () => {
  let registrations = 0
  const api = {
    slots: {
      register() {
        registrations += 1
        return "test-registration"
      },
    },
  }

  await assert.rejects(plugin.tui(api as never, { logoFile: 42 }), /logoFile must be a string/i)
  assert.equal(registrations, 0)
})

test("rejects an absolute logoFile path without registering a slot", async () => {
  let registrations = 0
  const api = {
    slots: {
      register() {
        registrations += 1
        return "test-registration"
      },
    },
  }

  await assert.rejects(
    plugin.tui(api as never, { logoFile: "/tmp/logo.txt" }),
    /logoFile must be a relative path/i,
  )
  assert.equal(registrations, 0)
})

test("reports a missing logoFile without registering a slot", async (context) => {
  const configDirectory = await mkdtemp(join(tmpdir(), "opencode-custom-logo-test-"))
  context.after(() => rm(configDirectory, { recursive: true, force: true }))
  let registrations = 0
  const api = {
    state: {
      path: {
        config: configDirectory,
      },
    },
    slots: {
      register() {
        registrations += 1
        return "test-registration"
      },
    },
  }

  await assert.rejects(
    plugin.tui(api as never, { logoFile: "missing.txt" }),
    /failed to load logoFile "missing\.txt"/i,
  )
  assert.equal(registrations, 0)
})

test("reports an unreadable logoFile without registering a slot", async (context) => {
  const configDirectory = await mkdtemp(join(tmpdir(), "opencode-custom-logo-test-"))
  context.after(() => rm(configDirectory, { recursive: true, force: true }))
  const logoPath = join(configDirectory, "unreadable.txt")
  await writeFile(logoPath, "logo")
  await chmod(logoPath, 0o000)
  let registrations = 0
  const api = {
    state: {
      path: {
        config: configDirectory,
      },
    },
    slots: {
      register() {
        registrations += 1
        return "test-registration"
      },
    },
  }

  await assert.rejects(
    plugin.tui(api as never, { logoFile: "unreadable.txt" }),
    /failed to load logoFile "unreadable\.txt".*EACCES/i,
  )
  assert.equal(registrations, 0)
})

test("reports invalid UTF-8 in logoFile without registering a slot", async (context) => {
  const configDirectory = await mkdtemp(join(tmpdir(), "opencode-custom-logo-test-"))
  context.after(() => rm(configDirectory, { recursive: true, force: true }))
  await writeFile(join(configDirectory, "invalid.txt"), Uint8Array.from([0xc3, 0x28]))
  let registrations = 0
  const api = {
    state: {
      path: {
        config: configDirectory,
      },
    },
    slots: {
      register() {
        registrations += 1
        return "test-registration"
      },
    },
  }

  await assert.rejects(
    plugin.tui(api as never, { logoFile: "invalid.txt" }),
    /failed to load logoFile "invalid\.txt".*not valid for encoding utf-8/i,
  )
  assert.equal(registrations, 0)
})
