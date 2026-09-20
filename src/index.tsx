import { readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"

import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import { RGBA, TextAttributes } from "@opentui/core"

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
  fg?: RGBA
  bg?: RGBA
  attributes?: number
} {
  const properties: { fg?: RGBA; bg?: RGBA; attributes?: number } = {}
  if (style.foreground) properties.fg = toOpenTuiColor(style.foreground)
  if (style.background) properties.bg = toOpenTuiColor(style.background)

  let attributes = TextAttributes.NONE
  if (style.bold) attributes |= TextAttributes.BOLD
  if (style.dim) attributes |= TextAttributes.DIM
  if (style.italic) attributes |= TextAttributes.ITALIC
  if (style.underline) attributes |= TextAttributes.UNDERLINE
  if (style.strikethrough) attributes |= TextAttributes.STRIKETHROUGH
  if (attributes !== TextAttributes.NONE) properties.attributes = attributes
  return properties
}

function toOpenTuiColor(color: AnsiColor): RGBA {
  if (color.type === "indexed") return RGBA.fromIndex(color.value)
  return RGBA.fromInts(color.red, color.green, color.blue)
}
