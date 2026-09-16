set positional-arguments

# Launch the isolated TUI with a configured custom logo.
tui-configured logo-file:
    ./script/tui-visual-check.sh configured "$1"

# Launch the isolated TUI without the plugin configuration.
tui-unconfigured:
    ./script/tui-visual-check.sh unconfigured
