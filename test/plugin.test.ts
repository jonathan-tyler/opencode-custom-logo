import assert from "node:assert/strict"
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
