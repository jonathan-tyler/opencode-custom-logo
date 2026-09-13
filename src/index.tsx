import type { TuiPluginModule } from "@opencode-ai/plugin/tui"

type CustomLogoOptions = {
  logo?: unknown
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
    const logo = (options as CustomLogoOptions | undefined)?.logo
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
