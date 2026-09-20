export type AnsiColor = {
    type: "indexed";
    value: number;
} | {
    type: "rgb";
    red: number;
    green: number;
    blue: number;
};
export type AnsiStyle = {
    foreground?: AnsiColor;
    background?: AnsiColor;
    bold?: true;
    dim?: true;
    italic?: true;
    underline?: true;
    strikethrough?: true;
};
export type AnsiStyledRun = {
    text: string;
    style: AnsiStyle;
};
export declare function escapeControlCharacters(text: string): string;
export declare function parseAnsiStyledLogo(logo: string): AnsiStyledRun[];
