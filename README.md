# OpenCode Custom Logo

OpenCode TUI plugin that replaces the home-screen logo with a configured multiline string.

## Install

Clone the repository, change into the checkout, and run the repository-owned
installer:

```sh
git clone https://github.com/jonathan-tyler/opencode-custom-logo
cd opencode-custom-logo
./script/install.sh
```

The script installs the runtime package and its production dependencies at
`$XDG_CONFIG_HOME/opencode/plugins/opencode-custom-logo`. When
`XDG_CONFIG_HOME` is not set, it uses
`$HOME/.config/opencode/plugins/opencode-custom-logo`. It refuses to replace an
existing installation. The installed package exposes its OpenCode TUI entry
point as `./tui`.

## Configure

Add the plugin to `$XDG_CONFIG_HOME/opencode/tui.json`, or to
`~/.config/opencode/tui.json` when `XDG_CONFIG_HOME` is not set:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "./plugins/opencode-custom-logo",
      {
        "logoFile": "logos/home-logo.txt"
      }
    ]
  ]
}
```

`logoFile` is resolved relative to the global OpenCode configuration directory
that contains this `tui.json`. The file must be UTF-8. Its complete contents,
including a final newline, are used as text; Markdown is not rendered.

Both `logoFile` and inline `logo` content interpret this ANSI SGR subset by
default:

- foreground colors `30-37`, `90-97`, `38;5;n`, and `38;2;r;g;b`, with `39`
  resetting the foreground;
- background colors `40-47`, `100-107`, `48;5;n`, and `48;2;r;g;b`, with `49`
  resetting the background;
- bold (`1`), dim (`2`), italic (`3`), underline (`4`), and strikethrough (`9`),
  with resets `22`, `23`, `24`, and `29`; and
- reset-all (`0`).

Indexed values and RGB channels must be between 0 and 255. Malformed,
out-of-range, unsupported, or incomplete SGR and every non-SGR terminal control
are displayed as printable escapes, e.g., `\u001b`, rather than sent to the
terminal renderer. OpenCode Custom Logo v0.1.0 displayed even valid SGR escape
bytes as printable text; valid supported SGR now applies formatting, with no
literal-ESC compatibility switch.

The bundled `examples/custom-logo.txt` demonstrates 24-bit RGB SGR with a reset
on every row. Its five content rows form a green gradient using `#252D25`,
`#252D25`, `#1F251F`, `#181E18`, and `#121612` from top to bottom.

Restart OpenCode or otherwise reinitialize the plugin after changing the file.
The plugin does not watch it for changes.

An inline `logo` string remains available as an alternative:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "./plugins/opencode-custom-logo",
      {
        "logo": "first line\nsecond line\nthird line"
      }
    ]
  ]
}
```

Remove the plugin entry, or omit both `logoFile` and `logo`, to retain OpenCode's
stock home logo.

## Limitations

The plugin does not change the startup splash or logos in CLI help and error
output.

## Develop

Run these commands from the repository root on a host with the Dev Container
CLI and Podman installed:

```sh
devcontainer up --workspace-folder . --docker-path podman
devcontainer exec --workspace-folder . --docker-path podman pnpm test
devcontainer exec --workspace-folder . --docker-path podman pnpm typecheck
```

Dependency installation runs automatically during container creation. If the
post-create setup fails, rerun the frozen install manually:

```sh
devcontainer exec --workspace-folder . --docker-path podman pnpm install --frozen-lockfile
```

Inside the Dev Container, launch the bundled example with:

```sh
just tui-configured
```

To use another logo file or launch the unconfigured harness, run:

```sh
just tui-configured <logo-file>
just tui-unconfigured
```

The configured recipe copies the bundled example or supplied override into
temporary configuration and passes its relative path as `logoFile`, so the
runtime plugin reads it directly.
Both recipes copy the plugin into temporary, isolated OpenCode configuration,
install its production dependencies, and remove that temporary state when
OpenCode exits. They do not read or modify the user's normal OpenCode
configuration or data.
