import { readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"

import type { TuiPluginModule } from "@opencode-ai/plugin/tui"

type CustomLogoOptions = {
  logo?: unknown
  logoFile?: unknown
}

const CONTROL_CHARACTER = /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu

export function escapeControlCharacters(logo: string): string {
  return logo.replace(CONTROL_CHARACTER, (character) => {
    if (character === "\t") return "\\t"
    return `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`
  })
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

    const literalLogo = escapeControlCharacters(logo)
    api.slots.register({
      slots: {
        home_logo: () => <text>{literalLogo}</text>,
      },
    })
  },
} satisfies TuiPluginModule

export default plugin
