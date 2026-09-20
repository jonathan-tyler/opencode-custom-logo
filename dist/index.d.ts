export { escapeControlCharacters, parseAnsiStyledLogo } from "./ansi.js";
declare const plugin: {
    id: string;
    tui(api: import("@opencode-ai/plugin/tui").TuiPluginApi, options: import("@opencode-ai/plugin").PluginOptions | undefined): Promise<void>;
};
export default plugin;
