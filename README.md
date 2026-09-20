# OpenCode Custom Logo

OpenCode TUI plugin that replaces the home-screen logo with a configured multiline string.

## Install

The only supported installation command is:

```sh
opencode plugin "git+https://github.com/jonathan-tyler/opencode-custom-logo.git#vX.Y.Z" --global
```

Replace `vX.Y.Z` with the immutable release tag you intend to install.

OpenCode synchronously installs this package and its production dependencies
through its embedded package service before importing the TUI entry point. The
flow requires Git and network access, including registry access for production
dependencies, but does not require a user-accessible `node`, `npm`, `npx`,
`pnpm`, or `bun` command.

OpenCode caches the complete immutable package spec. To update, change the spec
in the global configuration to a new tag or commit. Rerunning the same spec, or
adding `--force`, does not refresh the cached package.

The install command adds a string entry to the global `tui.json`. To configure
`logoFile` or inline `logo`, change that entry to the tuple shown below. Merge
the tuple into existing `tui.json` content instead of replacing unrelated
configuration.

### chezmoi

With chezmoi's default source directory, manage
`~/.local/share/chezmoi/dot_config/opencode/tui.json`; chezmoi maps that source
file to `~/.config/opencode/tui.json`. For example:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "git+https://github.com/jonathan-tyler/opencode-custom-logo.git#vX.Y.Z",
      {
        "logoFile": "logos/home-logo.txt"
      }
    ]
  ]
}
```

Merge this tuple into an existing source file rather than replacing unrelated
configuration, then apply the source state:

```sh
chezmoi apply
```

OpenCode installs the package and its production dependencies when it next loads
the configured immutable spec.

## Configure

Add the plugin to `$XDG_CONFIG_HOME/opencode/tui.json`, or to
`~/.config/opencode/tui.json` when `XDG_CONFIG_HOME` is not set:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "git+https://github.com/jonathan-tyler/opencode-custom-logo.git#vX.Y.Z",
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
terminal renderer.

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
      "git+https://github.com/jonathan-tyler/opencode-custom-logo.git#vX.Y.Z",
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
devcontainer exec --workspace-folder . --docker-path podman pnpm check:build
```

Dependency installation runs automatically during container creation. If the
post-create setup fails, rerun the frozen install manually:

```sh
devcontainer exec --workspace-folder . --docker-path podman pnpm install --frozen-lockfile
```

TypeScript and TSX under `src/` are the editable source. The committed `dist/`
files are the package runtime artifact. Regenerate them with
`pnpm generate:artifact`, then run `pnpm check:build` to prove the output and
packed file inventory are current.

Inside the Dev Container, launch the bundled example with:

```sh
just tui-configured
```

To use another logo file or launch the unconfigured harness, run:

```sh
just tui-configured path/to/logo.txt
just tui-unconfigured
```

The configured recipe copies the bundled example or supplied override into
temporary configuration and passes its relative path as `logoFile`, so the
runtime plugin reads it directly.
Both recipes copy the plugin into temporary, isolated OpenCode configuration,
install its production dependencies, and remove that temporary state when
OpenCode exits. They do not read or modify the user's normal OpenCode
configuration or data.
