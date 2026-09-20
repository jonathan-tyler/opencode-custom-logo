import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { parseAnsiStyledLogo } from "../src/index.js"

test("parses standard foreground color without changing surrounding text", () => {
  assert.deepEqual(parseAnsiStyledLogo("plain \u001b[31mred\u001b[39m plain"), [
    { text: "plain ", style: {} },
    { text: "red", style: { foreground: { type: "indexed", value: 1 } } },
    { text: " plain", style: {} },
  ])
})

test("parses standard, bright, indexed, and RGB foreground and background colors", () => {
  assert.deepEqual(
    parseAnsiStyledLogo(
      "\u001b[30mblack\u001b[97mbright white\u001b[39mdefault" +
        "\u001b[40mblack bg\u001b[107mbright white bg\u001b[49mdefault bg" +
        "\u001b[38;5;120mindexed fg\u001b[48;5;136mindexed bg" +
        "\u001b[38;2;12;34;56mRGB fg\u001b[48;2;65;43;21mRGB bg",
    ),
    [
      { text: "black", style: { foreground: { type: "indexed", value: 0 } } },
      { text: "bright white", style: { foreground: { type: "indexed", value: 15 } } },
      { text: "default", style: {} },
      { text: "black bg", style: { background: { type: "indexed", value: 0 } } },
      { text: "bright white bg", style: { background: { type: "indexed", value: 15 } } },
      { text: "default bg", style: {} },
      { text: "indexed fg", style: { foreground: { type: "indexed", value: 120 } } },
      {
        text: "indexed bg",
        style: {
          foreground: { type: "indexed", value: 120 },
          background: { type: "indexed", value: 136 },
        },
      },
      {
        text: "RGB fg",
        style: {
          foreground: { type: "rgb", red: 12, green: 34, blue: 56 },
          background: { type: "indexed", value: 136 },
        },
      },
      {
        text: "RGB bg",
        style: {
          foreground: { type: "rgb", red: 12, green: 34, blue: 56 },
          background: { type: "rgb", red: 65, green: 43, blue: 21 },
        },
      },
    ],
  )
})

test("parses attributes, individual resets, reset-all, and combined adjacent SGR", () => {
  assert.deepEqual(
    parseAnsiStyledLogo(
      "\u001b[1;2;3;4;9;31mstyled\u001b[22mweight reset\u001b[23;24;29mattrs reset" +
        "\u001b[44m\u001b[93mcombined\u001b[0mplain",
    ),
    [
      {
        text: "styled",
        style: {
          foreground: { type: "indexed", value: 1 },
          bold: true,
          dim: true,
          italic: true,
          underline: true,
          strikethrough: true,
        },
      },
      {
        text: "weight reset",
        style: {
          foreground: { type: "indexed", value: 1 },
          italic: true,
          underline: true,
          strikethrough: true,
        },
      },
      { text: "attrs reset", style: { foreground: { type: "indexed", value: 1 } } },
      {
        text: "combined",
        style: {
          foreground: { type: "indexed", value: 11 },
          background: { type: "indexed", value: 4 },
        },
      },
      { text: "plain", style: {} },
    ],
  )
})

test("preserves Unicode and exact line breaks while carrying style across them", () => {
  assert.deepEqual(parseAnsiStyledLogo("\u001b[32m╭─ λ ─╮\r\nline two\n\u001b[0m"), [
    {
      text: "╭─ λ ─╮\r\nline two\n",
      style: { foreground: { type: "indexed", value: 2 } },
    },
  ])
})

test("renders malformed, out-of-range, unsupported, incomplete, and non-SGR controls visibly", () => {
  const cases = [
    "\u001b[38;5;256m",
    "\u001b[48;2;0;1;999m",
    "\u001b[38;5m",
    "\u001b[38;2;1;2m",
    "\u001b[5m",
    "\u001b[m",
    "\u001b[31",
    "\u001b[2J",
    "\u001b]8;;https://example.com\u0007link\u001b]8;;\u0007",
    "\u009b31m",
  ]

  for (const input of cases) {
    const runs = parseAnsiStyledLogo(input)
    assert.equal(runs.map((run) => run.text).join(""), escapeControls(input))
    assert.deepEqual(runs.map((run) => run.style), [{}])
  }
})

test("rejects a whole SGR sequence without partially applying supported parameters", () => {
  assert.deepEqual(parseAnsiStyledLogo("before\u001b[1;31;5mafter"), [
    { text: "before\\u001b[1;31;5mafter", style: {} },
  ])
})

test("bundled example preserves its five rows and resets each exact RGB gradient color", async () => {
  const example = await readFile(new URL("../examples/custom-logo.txt", import.meta.url), "utf8")
  assert.equal(
    example.replace(/\u001b\[[0-9;]+m/gu, ""),
    "                      ▄\n" +
      "  ▄▄▄  ▄▄▄ ▄▄  ▄▄▄   ██    ▄▄▄  ▄ ▄▄ ▄▄▄\n" +
      "▄██ ▀█  ██ █  ▀██▄  ▀██▀  ██ ██  ██ ██ ██\n" +
      "███     ██ █    ▀██  ██   ██ ██  ██ ██ ██\n" +
      " ▀█▄▄▀  ▀█▄▀▄ ▀▄▄█▀  ▀█▄▀ ▀█▄█▀ ▄██ ██ ██▄\n",
  )
  assert.deepEqual(
    parseAnsiStyledLogo(example).map((run) => ({ text: run.text, color: run.style.foreground })),
    [
      {
        text: "                      ▄",
        color: { type: "rgb", red: 37, green: 45, blue: 37 },
      },
      { text: "\n", color: undefined },
      {
        text: "  ▄▄▄  ▄▄▄ ▄▄  ▄▄▄   ██    ▄▄▄  ▄ ▄▄ ▄▄▄",
        color: { type: "rgb", red: 37, green: 45, blue: 37 },
      },
      { text: "\n", color: undefined },
      {
        text: "▄██ ▀█  ██ █  ▀██▄  ▀██▀  ██ ██  ██ ██ ██",
        color: { type: "rgb", red: 31, green: 37, blue: 31 },
      },
      { text: "\n", color: undefined },
      {
        text: "███     ██ █    ▀██  ██   ██ ██  ██ ██ ██",
        color: { type: "rgb", red: 24, green: 30, blue: 24 },
      },
      { text: "\n", color: undefined },
      {
        text: " ▀█▄▄▀  ▀█▄▀▄ ▀▄▄█▀  ▀█▄▀ ▀█▄█▀ ▄██ ██ ██▄",
        color: { type: "rgb", red: 18, green: 22, blue: 18 },
      },
      { text: "\n", color: undefined },
    ],
  )
})

function escapeControls(value: string): string {
  return value.replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu, (character) => {
    if (character === "\t") return "\\t"
    return `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`
  })
}
