const CONTROL_CHARACTER = /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu;
export function escapeControlCharacters(text) {
    return text.replace(CONTROL_CHARACTER, (character) => {
        if (character === "\t")
            return "\\t";
        return `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`;
    });
}
export function parseAnsiStyledLogo(logo) {
    const runs = [];
    let style = {};
    let text = "";
    const flush = () => {
        if (text.length === 0)
            return;
        runs.push({ text, style: { ...style } });
        text = "";
    };
    for (let position = 0; position < logo.length;) {
        if (logo[position] !== "\u001b") {
            text += escapeControlCharacters(logo[position]);
            position += 1;
            continue;
        }
        const sequence = readEscapeSequence(logo, position);
        const nextStyle = sequence.sgrParameters
            ? applySgrParameters(style, sequence.sgrParameters)
            : undefined;
        if (nextStyle) {
            flush();
            style = nextStyle;
        }
        else {
            text += escapeControlCharacters(sequence.text);
        }
        position += sequence.text.length;
    }
    flush();
    return runs;
}
function readEscapeSequence(input, start) {
    if (input[start + 1] !== "[")
        return { text: input[start] };
    for (let position = start + 2; position < input.length; position += 1) {
        const codePoint = input.codePointAt(position);
        if (codePoint < 0x40 || codePoint > 0x7e)
            continue;
        const text = input.slice(start, position + 1);
        const parameterText = input.slice(start + 2, position);
        if (input[position] !== "m" || !/^\d+(?:;\d+)*$/u.test(parameterText))
            return { text };
        return { text, sgrParameters: parameterText.split(";").map(Number) };
    }
    return { text: input.slice(start) };
}
function applySgrParameters(current, parameters) {
    let style = { ...current };
    for (let position = 0; position < parameters.length; position += 1) {
        const parameter = parameters[position];
        if (parameter === 0) {
            style = {};
        }
        else if (parameter === 1) {
            style.bold = true;
        }
        else if (parameter === 2) {
            style.dim = true;
        }
        else if (parameter === 3) {
            style.italic = true;
        }
        else if (parameter === 4) {
            style.underline = true;
        }
        else if (parameter === 9) {
            style.strikethrough = true;
        }
        else if (parameter === 22) {
            delete style.bold;
            delete style.dim;
        }
        else if (parameter === 23) {
            delete style.italic;
        }
        else if (parameter === 24) {
            delete style.underline;
        }
        else if (parameter === 29) {
            delete style.strikethrough;
        }
        else if (parameter >= 30 && parameter <= 37) {
            style.foreground = { type: "indexed", value: parameter - 30 };
        }
        else if (parameter >= 90 && parameter <= 97) {
            style.foreground = { type: "indexed", value: parameter - 90 + 8 };
        }
        else if (parameter === 39) {
            delete style.foreground;
        }
        else if (parameter >= 40 && parameter <= 47) {
            style.background = { type: "indexed", value: parameter - 40 };
        }
        else if (parameter >= 100 && parameter <= 107) {
            style.background = { type: "indexed", value: parameter - 100 + 8 };
        }
        else if (parameter === 49) {
            delete style.background;
        }
        else if (parameter === 38 || parameter === 48) {
            const color = readExtendedColor(parameters, position + 1);
            if (!color)
                return;
            if (parameter === 38)
                style.foreground = color.value;
            else
                style.background = color.value;
            position = color.lastPosition;
        }
        else {
            return;
        }
    }
    return style;
}
function readExtendedColor(parameters, position) {
    const mode = parameters[position];
    if (mode === 5) {
        const value = parameters[position + 1];
        if (!isByte(value))
            return;
        return { value: { type: "indexed", value }, lastPosition: position + 1 };
    }
    if (mode === 2) {
        const red = parameters[position + 1];
        const green = parameters[position + 2];
        const blue = parameters[position + 3];
        if (!isByte(red) || !isByte(green) || !isByte(blue))
            return;
        return { value: { type: "rgb", red, green, blue }, lastPosition: position + 3 };
    }
}
function isByte(value) {
    return value !== undefined && Number.isInteger(value) && value >= 0 && value <= 255;
}
