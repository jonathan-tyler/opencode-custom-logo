# OpenCode Logo Plugin

An OpenCode plugin for replacing the terminal logo with either characters
supplied through an environment file or an image rendered with the Kitty
graphics protocol.

## Planned Configuration

- Character mode reads the logo text and styling options from environment
  variables loaded from a user-provided `.env` file.
- Kitty mode reads an image path and emits Kitty graphics protocol escape
  sequences when the terminal advertises support.
- The plugin falls back to character mode when Kitty graphics are unavailable.

The implementation targets the OpenCode `v0.9.6` plugin API. See the sibling
`../opencode-v0.9.6` checkout for reference-only source.
