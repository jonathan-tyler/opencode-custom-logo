# OpenCode Custom Logo

A TUI plugin that replaces OpenCode's interactive home-screen logo with a
configured multiline string.

## Install

Place this package at
`$XDG_CONFIG_HOME/opencode/plugins/opencode-custom-logo`, or at
`~/.config/opencode/plugins/opencode-custom-logo` when `XDG_CONFIG_HOME` is not
set. From that directory, install its runtime dependencies:

```sh
npx pnpm@10.17.1 install --prod --frozen-lockfile
```

The package exposes its OpenCode TUI entry point as `./tui`.

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
        "logo": "first line\nsecond line\nthird line"
      }
    ]
  ]
}
```

The configuration key is `logo` in this plugin's options object. Its string
value preserves character order and line breaks. Terminal control characters
other than line breaks are displayed as printable escapes, such as `\t` and
`\u001b`, so ANSI sequences are not interpreted.

Remove the plugin entry, or omit its `logo` option, to retain OpenCode's stock
home logo.

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
