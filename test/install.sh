#!/usr/bin/env bash

set -euo pipefail

readonly repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

temporary_root=""
cleanup() {
  if [[ -n "${temporary_root}" && -d "${temporary_root}" ]]; then
    rm -rf -- "${temporary_root}"
  fi
}
trap cleanup EXIT

temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/opencode custom logo installer.XXXXXX")"
readonly temporary_root
readonly isolated_home="${temporary_root}/home with spaces"
readonly xdg_config_home="${temporary_root}/config with spaces"
readonly shim_dir="${temporary_root}/command shims"
readonly target="${xdg_config_home}/opencode/plugins/opencode-custom-logo"

mkdir -p -- "${isolated_home}" "${shim_dir}"
cat >"${shim_dir}/npx" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == "pnpm@10.17.1 install --prod --frozen-lockfile" ]]
SHIM
chmod +x "${shim_dir}/npx"

HOME="${isolated_home}" \
  XDG_CONFIG_HOME="${xdg_config_home}" \
  PATH="${shim_dir}:${PATH}" \
  "${repository_root}/script/install.sh"

[[ -f "${target}/package.json" ]] || fail "package.json was not installed"
[[ -f "${target}/pnpm-lock.yaml" ]] || fail "pnpm-lock.yaml was not installed"
[[ -f "${target}/src/index.tsx" ]] || fail "runtime source was not installed"
[[ ! -e "${target}/test" ]] || fail "tests were installed"

printf 'PASS: installs runtime files at an XDG path containing spaces\n'

readonly existing_config_home="${temporary_root}/existing config"
readonly existing_target="${existing_config_home}/opencode/plugins/opencode-custom-logo"
readonly refusal_output="${temporary_root}/refusal-output.txt"
mkdir -p -- "${existing_target}"
printf 'do not replace\n' >"${existing_target}/sentinel.txt"

if HOME="${isolated_home}" \
  XDG_CONFIG_HOME="${existing_config_home}" \
  PATH="${shim_dir}:${PATH}" \
  "${repository_root}/script/install.sh" >"${refusal_output}" 2>&1; then
  fail "installer replaced an existing target"
fi

[[ "$(<"${existing_target}/sentinel.txt")" == 'do not replace' ]] || fail "existing target changed"
[[ "$(find "${existing_target}" -mindepth 1 -maxdepth 1 -printf '%f\n')" == 'sentinel.txt' ]] \
  || fail "existing target gained files"
grep -Fq 'installation target already exists' "${refusal_output}" \
  || fail "existing-target error was unclear"

printf 'PASS: refuses an existing target without mutation\n'

readonly failure_config_home="${temporary_root}/failure config"
readonly failure_target="${failure_config_home}/opencode/plugins/opencode-custom-logo"
readonly tui_config="${failure_config_home}/opencode/tui.json"
readonly logo_file="${failure_config_home}/opencode/logo.txt"
mkdir -p -- "$(dirname -- "${tui_config}")"
printf '{"sentinel":"unchanged"}\n' >"${tui_config}"
printf 'unchanged logo\n' >"${logo_file}"
cat >"${shim_dir}/npx" <<'SHIM'
#!/usr/bin/env bash
exit 73
SHIM
chmod +x "${shim_dir}/npx"

if HOME="${isolated_home}" \
  XDG_CONFIG_HOME="${failure_config_home}" \
  PATH="${shim_dir}:${PATH}" \
  "${repository_root}/script/install.sh"; then
  fail "installer succeeded when dependency installation failed"
fi

[[ ! -e "${failure_target}" ]] || fail "partial target remained after dependency failure"
[[ "$(<"${tui_config}")" == '{"sentinel":"unchanged"}' ]] || fail "tui.json changed"
[[ "$(<"${logo_file}")" == 'unchanged logo' ]] || fail "logo file changed"

printf 'PASS: removes a partial target without changing user configuration\n'

readonly fallback_home="${temporary_root}/fallback home with spaces"
readonly fallback_config_home="${fallback_home}/.config"
readonly fallback_target="${fallback_config_home}/opencode/plugins/opencode-custom-logo"
readonly fallback_tui_config="${fallback_config_home}/opencode/tui.json"
readonly fallback_logo_file="${fallback_config_home}/opencode/logo.txt"
mkdir -p -- "$(dirname -- "${fallback_tui_config}")"
printf '{"sentinel":"unchanged"}\n' >"${fallback_tui_config}"
printf 'unchanged logo\n' >"${fallback_logo_file}"

env -u XDG_CONFIG_HOME \
  HOME="${fallback_home}" \
  npm_config_cache="${temporary_root}/npm cache" \
  "${repository_root}/script/install.sh"

readonly top_level_inventory="$(
  find "${fallback_target}" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort
)"
readonly expected_inventory=$'node_modules\npackage.json\npnpm-lock.yaml\nsrc'
[[ "${top_level_inventory}" == "${expected_inventory}" ]] \
  || fail "runtime inventory differed: ${top_level_inventory}"
[[ -f "${fallback_target}/src/index.tsx" ]] || fail "runtime entry point was not installed"
[[ -d "${fallback_target}/node_modules/@opencode-ai/plugin" ]] \
  || fail "@opencode-ai/plugin production dependency was not installed"
[[ -d "${fallback_target}/node_modules/@opentui/solid" ]] \
  || fail "@opentui/solid production dependency was not installed"
[[ ! -e "${fallback_target}/node_modules/tsx" ]] || fail "tsx development dependency was installed"
[[ ! -e "${fallback_target}/node_modules/opencode-ai" ]] \
  || fail "opencode-ai development dependency was installed"
for excluded_path in .devcontainer .git examples script test node_modules/.bin/tsx; do
  [[ ! -e "${fallback_target}/${excluded_path}" ]] || fail "excluded path was installed: ${excluded_path}"
done
[[ "$(<"${fallback_tui_config}")" == '{"sentinel":"unchanged"}' ]] || fail "tui.json changed"
[[ "$(<"${fallback_logo_file}")" == 'unchanged logo' ]] || fail "logo file changed"

printf 'PASS: HOME fallback installs the exact production runtime without changing user configuration\n'
