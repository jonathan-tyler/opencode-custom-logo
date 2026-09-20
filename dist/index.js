import { jsx as _jsx } from "opentui:runtime-module:%40opentui%2Fsolid%2Fjsx-runtime";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { parseAnsiStyledLogo, } from "./ansi.js";
export { escapeControlCharacters, parseAnsiStyledLogo } from "./ansi.js";
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
];
const plugin = {
    id: "opencode-custom-logo",
    async tui(api, options) {
        const customLogoOptions = options;
        const hasLogo = customLogoOptions !== undefined && Object.hasOwn(customLogoOptions, "logo");
        const hasLogoFile = customLogoOptions !== undefined && Object.hasOwn(customLogoOptions, "logoFile");
        if (hasLogo && hasLogoFile) {
            throw new Error("Cannot configure both logo and logoFile");
        }
        if (hasLogoFile && typeof customLogoOptions.logoFile !== "string") {
            throw new TypeError("logoFile must be a string");
        }
        if (typeof customLogoOptions?.logoFile === "string" && isAbsolute(customLogoOptions.logoFile)) {
            throw new Error("logoFile must be a relative path");
        }
        let logo = customLogoOptions?.logo;
        if (typeof customLogoOptions?.logoFile === "string") {
            try {
                const content = await readFile(resolve(api.state.path.config, customLogoOptions.logoFile));
                logo = new TextDecoder("utf-8", { fatal: true }).decode(content);
            }
            catch (error) {
                const detail = error instanceof Error ? `: ${error.message}` : "";
                throw new Error(`Failed to load logoFile "${customLogoOptions.logoFile}"${detail}`, {
                    cause: error,
                });
            }
        }
        if (typeof logo !== "string")
            return;
        const runs = parseAnsiStyledLogo(logo);
        api.slots.register({
            slots: {
                home_logo: () => (_jsx("text", { children: runs.map((run) => (_jsx("span", { style: textStyle(run.style), children: run.text }))) })),
            },
        });
    },
};
export default plugin;
function textStyle(style) {
    const properties = {};
    if (style.foreground)
        properties.fg = toOpenTuiColor(style.foreground);
    if (style.background)
        properties.bg = toOpenTuiColor(style.background);
    if (style.bold)
        properties.bold = true;
    if (style.dim)
        properties.dim = true;
    if (style.italic)
        properties.italic = true;
    if (style.underline)
        properties.underline = true;
    if (style.strikethrough)
        properties.strikethrough = true;
    return properties;
}
function toOpenTuiColor(color) {
    if (color.type === "rgb")
        return rgbToHex(color.red, color.green, color.blue);
    const index = color.value;
    if (index < ANSI_BASE_COLORS.length) {
        const [red, green, blue] = ANSI_BASE_COLORS[index];
        return rgbToHex(red, green, blue);
    }
    if (index >= 232) {
        const value = 8 + (index - 232) * 10;
        return rgbToHex(value, value, value);
    }
    const cubeIndex = index - 16;
    const levels = [0, 95, 135, 175, 215, 255];
    return rgbToHex(levels[Math.floor(cubeIndex / 36)], levels[Math.floor((cubeIndex % 36) / 6)], levels[cubeIndex % 6]);
}
function rgbToHex(red, green, blue) {
    return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
