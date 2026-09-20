import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

type RenderNode = {
  type: unknown
  properties: Record<string, unknown>
}

test("renders file-backed and inline ANSI logos as safe styled runs", async (context) => {
  const configDirectory = await mkdtemp(join(tmpdir(), "opencode-custom-logo-test-"))
  context.after(() => rm(configDirectory, { recursive: true, force: true }))
  const logoPath = join(configDirectory, "logo.txt")
  const styledLogo =
    "\u001b[31;104;1;2;3;4;9mstandard\u001b[0m\n" +
    "\u001b[38;5;120;48;5;136mindexed\u001b[0m\n" +
    "\u001b[38;2;12;34;56;48;2;65;43;21mRGB\u001b[0m\n"
  await writeFile(logoPath, styledLogo)

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
    slots: { home_logo: () => RenderNode }
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

  await plugin.tui(api as never, { logoFile: "logo.txt" })
  const fileRender = summarize(registered?.slots.home_logo())
  assert.deepEqual(fileRender, expectedStyledRender)

  await writeFile(logoPath, "changed\n")
  assert.deepEqual(summarize(registered?.slots.home_logo()), expectedStyledRender)

  await plugin.tui(api as never, { logoFile: "logo.txt" })
  assert.deepEqual(summarize(registered?.slots.home_logo()), {
    type: "text",
    properties: {
      children: [{ type: "span", properties: { style: {}, children: "changed\n" } }],
    },
  })

  await plugin.tui(api as never, { logo: styledLogo })
  assert.deepEqual(summarize(registered?.slots.home_logo()), expectedStyledRender)

  const resetLogo =
    "\u001b[31;44;1;2;3;4;9mstyled\nline\u001b[39;49;22;23;24;29mλ" +
    "\u001b[38;5;0mbase min\u001b[38;5;15mbase max" +
    "\u001b[38;5;16mcube min\u001b[38;5;231mcube max" +
    "\u001b[38;5;232mgray min\u001b[38;5;255mgray max\u001b[38;2;0;255;0mRGB"
  await plugin.tui(api as never, { logo: resetLogo })
  assert.deepEqual(summarize(registered?.slots.home_logo()), {
    type: "text",
    properties: {
      children: [
        {
          type: "span",
          properties: {
            style: {
              fg: "#800000",
              bg: "#000080",
              bold: true,
              dim: true,
              italic: true,
              underline: true,
              strikethrough: true,
            },
            children: "styled\nline",
          },
        },
        { type: "span", properties: { style: {}, children: "λ" } },
        { type: "span", properties: { style: { fg: "#000000" }, children: "base min" } },
        { type: "span", properties: { style: { fg: "#ffffff" }, children: "base max" } },
        { type: "span", properties: { style: { fg: "#000000" }, children: "cube min" } },
        { type: "span", properties: { style: { fg: "#ffffff" }, children: "cube max" } },
        { type: "span", properties: { style: { fg: "#080808" }, children: "gray min" } },
        { type: "span", properties: { style: { fg: "#eeeeee" }, children: "gray max" } },
        { type: "span", properties: { style: { fg: "#00ff00" }, children: "RGB" } },
      ],
    },
  })

  const unsafeLogo =
    "\u001b[5mblink\u001b[38;5;256mrange\u001b[48;2;0;1;999mmalformed" +
    "\u001b[2Jerase\u001b]8;;https://example.com\u0007link"
  await plugin.tui(api as never, { logo: unsafeLogo })
  const safeRender = summarize(registered?.slots.home_logo())
  assert.deepEqual(safeRender, {
    type: "text",
    properties: {
      children: [
        {
          type: "span",
          properties: {
            style: {},
            children:
              "\\u001b[5mblink\\u001b[38;5;256mrange" +
              "\\u001b[48;2;0;1;999mmalformed\\u001b[2Jerase" +
              "\\u001b]8;;https://example.com\\u0007link",
          },
        },
      ],
    },
  })
  assert.doesNotMatch(renderedText(safeRender), /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/u)
})

const expectedStyledRender = {
  type: "text",
  properties: {
    children: [
      {
        type: "span",
        properties: {
          style: {
            fg: "#800000",
            bg: "#0000ff",
            bold: true,
            dim: true,
            italic: true,
            underline: true,
            strikethrough: true,
          },
          children: "standard",
        },
      },
      { type: "span", properties: { style: {}, children: "\n" } },
      {
        type: "span",
        properties: {
          style: { fg: "#87ff87", bg: "#af8700" },
          children: "indexed",
        },
      },
      { type: "span", properties: { style: {}, children: "\n" } },
      {
        type: "span",
        properties: {
          style: { fg: "#0c2238", bg: "#412b15" },
          children: "RGB",
        },
      },
      { type: "span", properties: { style: {}, children: "\n" } },
    ],
  },
}

function summarize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(summarize)
  if (node === null || typeof node !== "object") return node
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, summarize(value)]))
}

function renderedText(node: unknown): string {
  if (typeof node === "string") return node
  if (Array.isArray(node)) return node.map(renderedText).join("")
  if (node === null || typeof node !== "object") return ""
  if (!("properties" in node)) return ""
  const properties = (node as { properties: Record<string, unknown> }).properties
  return renderedText(properties.children)
}
