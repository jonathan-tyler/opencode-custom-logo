#!/usr/bin/env bash

set -euo pipefail

readonly mode="${1:-}"
readonly logo_file="${2:-}"
readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly repository_root="$(git -C "${script_dir}" rev-parse --show-toplevel)"
readonly expected_root="/workspaces/$(basename -- "${repository_root}")"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

if [[ ! -f /run/.containerenv && ! -f /.dockerenv ]]; then
  fail "run this harness inside the repository Dev Container"
fi

if [[ "${repository_root}" != "${expected_root}" ]]; then
  fail "expected the Dev Container repository at ${expected_root}, found ${repository_root}"
fi

readonly head_revision="$(git -C "${repository_root}" rev-parse HEAD)"
printf 'Repository HEAD: %s\n' "${head_revision}"

if [[ -n "$(git -C "${repository_root}" status --porcelain --untracked-files=no)" ]]; then
  fail "tracked repository changes exist; commit or restore them before running the harness"
fi

case "${mode}" in
  configured)
    [[ $# -eq 2 ]] || fail "usage: $0 configured <logo-file>"
    [[ -f "${logo_file}" && -r "${logo_file}" ]] || fail "logo file must be a readable regular file: ${logo_file}"
    ;;
  unconfigured)
    [[ $# -eq 1 ]] || fail "usage: $0 unconfigured"
    ;;
  *)
    fail "mode must be configured or unconfigured"
    ;;
esac

temporary_root=""
cleanup() {
  if [[ -n "${temporary_root}" && -d "${temporary_root}" ]]; then
    rm -rf -- "${temporary_root}"
    printf 'Removed isolated temporary state: %s\n' "${temporary_root}"
  fi
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/opencode-custom-logo-tui.XXXXXX")"
readonly temporary_root
readonly isolated_home="${temporary_root}/home"
readonly xdg_config_home="${temporary_root}/config"
readonly xdg_data_home="${temporary_root}/data"
readonly xdg_cache_home="${temporary_root}/cache"
readonly xdg_state_home="${temporary_root}/state"
readonly opencode_config_dir="${xdg_config_home}/opencode"
readonly plugin_dir="${opencode_config_dir}/plugins/opencode-custom-logo"
readonly tui_config="${opencode_config_dir}/tui.json"

mkdir -p \
  "${isolated_home}" \
  "${xdg_data_home}" \
  "${xdg_cache_home}" \
  "${xdg_state_home}" \
  "${plugin_dir}"

cp -- "${repository_root}/package.json" "${repository_root}/pnpm-lock.yaml" "${plugin_dir}/"
cp -R -- "${repository_root}/src" "${plugin_dir}/src"

if [[ "${mode}" == "configured" ]]; then
  node - "${logo_file}" "${tui_config}" <<'NODE'
import { readFileSync, writeFileSync } from "node:fs"

const [, , logoPath, configPath] = process.argv
const logo = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(logoPath))
const config = {
  $schema: "https://opencode.ai/tui.json",
  plugin: [["./plugins/opencode-custom-logo", { logo }]],
}
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
NODE
  readonly expected_observation="the custom logo is readable with literal controls and preserved line order, and the stock logo is absent"
else
  cat >"${tui_config}" <<'JSON'
{
  "$schema": "https://opencode.ai/tui.json"
}
JSON
  readonly expected_observation="the stock OpenCode logo is visible"
fi

export HOME="${isolated_home}"
export XDG_CONFIG_HOME="${xdg_config_home}"
export XDG_DATA_HOME="${xdg_data_home}"
export XDG_CACHE_HOME="${xdg_cache_home}"
export XDG_STATE_HOME="${xdg_state_home}"
export OPENCODE_DISABLE_AUTOUPDATE=1
export OPENCODE_DISABLE_MODELS_FETCH=1
export OPENCODE_DISABLE_PROJECT_CONFIG=1

printf '\nMode: %s\n' "${mode}"
printf 'Isolated config: %s\n' "${xdg_config_home}"
printf 'Isolated data: %s\n' "${xdg_data_home}"
printf 'Isolated cache: %s\n' "${xdg_cache_home}"
printf 'Isolated state: %s\n' "${xdg_state_home}"
printf 'Plugin copy: %s\n' "${plugin_dir}"
printf 'Expected observation: %s.\n' "${expected_observation}"
printf 'Cleanup: all harness-created state under %s will be removed when OpenCode exits.\n\n' "${temporary_root}"

(
  cd -- "${plugin_dir}"
  npx pnpm@10.17.1 install --prod --frozen-lockfile
)

cd -- "${repository_root}"
pnpm exec opencode "${repository_root}"
