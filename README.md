# OpenCode Custom Logo

OpenCode TUI plugin that replaces the home-screen logo with a configured multiline string.

## Install

Clone the confirmed public repository, inspect the checkout and installer, then
run the repository-owned installer:

```sh
git clone https://github.com/jonathan-tyler/opencode-custom-logo
cd opencode-custom-logo
git status --short --branch
git log --oneline --decorate -5
git ls-files
git show HEAD:script/install.sh
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
including a final newline, are used as literal text; Markdown is not rendered.
Terminal control characters other than line breaks are displayed as printable
escapes, such as `\t` and `\u001b`, so ANSI sequences are not interpreted.

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
just tui-configured examples/custom-logo.txt
```

To use another logo file or launch the unconfigured harness, run:

```sh
just tui-configured <logo-file>
just tui-unconfigured
```

The configured recipe copies the supplied file into temporary configuration and
passes its relative path as `logoFile`, so the runtime plugin reads it directly.
Both recipes copy the plugin into temporary, isolated OpenCode configuration,
install its production dependencies, and remove that temporary state when
OpenCode exits. They do not read or modify the user's normal OpenCode
configuration or data.
