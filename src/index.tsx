import { readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"

import type { TuiPluginModule } from "@opencode-ai/plugin/tui"

import {
  escapeControlCharacters,
  parseAnsiStyledLogo,
  type AnsiColor,
  type AnsiStyle,
} from "./ansi.js"

export { escapeControlCharacters, parseAnsiStyledLogo } from "./ansi.js"

type CustomLogoOptions = {
  logo?: unknown
  logoFile?: unknown
}

const TEXT_ATTRIBUTES = {
  bold: 1 << 0,
  dim: 1 << 1,
  italic: 1 << 2,
  underline: 1 << 3,
  strikethrough: 1 << 7,
} as const

const ANSI_BASE_COLORS = [
  [0, 0, 0],
  [128, 0, 0],
  [0, 128, 0],
  [128, 128, 0],
  [0, 0, 128],
  [128, 0, 128],
  [0, 128, 128],
  [192, 192, 192],
  [128, 128, 128],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [0, 0, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
] as const

const plugin = {
  id: "opencode-custom-logo",
  async tui(api, options) {
    const customLogoOptions = options as CustomLogoOptions | undefined
    const hasLogo = customLogoOptions !== undefined && Object.hasOwn(customLogoOptions, "logo")
    const hasLogoFile =
      customLogoOptions !== undefined && Object.hasOwn(customLogoOptions, "logoFile")
    if (hasLogo && hasLogoFile) {
      throw new Error("Cannot configure both logo and logoFile")
    }
    if (hasLogoFile && typeof customLogoOptions.logoFile !== "string") {
      throw new TypeError("logoFile must be a string")
    }
    if (typeof customLogoOptions?.logoFile === "string" && isAbsolute(customLogoOptions.logoFile)) {
      throw new Error("logoFile must be a relative path")
    }

    let logo = customLogoOptions?.logo
    if (typeof customLogoOptions?.logoFile === "string") {
      try {
        const content = await readFile(resolve(api.state.path.config, customLogoOptions.logoFile))
        logo = new TextDecoder("utf-8", { fatal: true }).decode(content)
      } catch (error) {
        const detail = error instanceof Error ? `: ${error.message}` : ""
        throw new Error(`Failed to load logoFile "${customLogoOptions.logoFile}"${detail}`, {
          cause: error,
        })
      }
    }
    if (typeof logo !== "string") return

    const runs = parseAnsiStyledLogo(logo)
    api.slots.register({
      slots: {
        home_logo: () => (
          <text>
            {runs.map((run) => (
              <span {...textProperties(run.style)}>{run.text}</span>
            ))}
          </text>
        ),
      },
    })
  },
} satisfies TuiPluginModule

export default plugin

function textProperties(style: AnsiStyle): {
  fg?: string
  bg?: string
  attributes?: number
} {
  const properties: { fg?: string; bg?: string; attributes?: number } = {}
  if (style.foreground) properties.fg = toOpenTuiColor(style.foreground)
  if (style.background) properties.bg = toOpenTuiColor(style.background)

  let attributes = 0
  if (style.bold) attributes |= TEXT_ATTRIBUTES.bold
  if (style.dim) attributes |= TEXT_ATTRIBUTES.dim
  if (style.italic) attributes |= TEXT_ATTRIBUTES.italic
  if (style.underline) attributes |= TEXT_ATTRIBUTES.underline
  if (style.strikethrough) attributes |= TEXT_ATTRIBUTES.strikethrough
  if (attributes !== 0) properties.attributes = attributes
  return properties
}

function toOpenTuiColor(color: AnsiColor): string {
  if (color.type === "rgb") return rgbToHex(color.red, color.green, color.blue)
  const index = color.value
  if (index < ANSI_BASE_COLORS.length) {
    const [red, green, blue] = ANSI_BASE_COLORS[index]!
    return rgbToHex(red, green, blue)
  }
  if (index >= 232) {
    const value = 8 + (index - 232) * 10
    return rgbToHex(value, value, value)
  }

  const cubeIndex = index - 16
  const levels = [0, 95, 135, 175, 215, 255] as const
  return rgbToHex(
    levels[Math.floor(cubeIndex / 36)]!,
    levels[Math.floor((cubeIndex % 36) / 6)]!,
    levels[cubeIndex % 6]!,
  )
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`
}
