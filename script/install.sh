#!/usr/bin/env bash

set -euo pipefail

readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly repository_root="$(cd -- "${script_dir}/.." && pwd)"
readonly config_home="${XDG_CONFIG_HOME:-${HOME}/.config}"
readonly target="${config_home}/opencode/plugins/opencode-custom-logo"

if [[ -e "${target}" || -L "${target}" ]]; then
  printf 'Error: installation target already exists: %s\n' "${target}" >&2
  exit 1
fi

target_created=0
installation_complete=0
cleanup() {
  local exit_code=$?
  trap - EXIT
  if [[ ${target_created} -eq 1 && ${installation_complete} -eq 0 ]]; then
    rm -rf -- "${target}"
  fi
  exit "${exit_code}"
}
trap cleanup EXIT

mkdir -p -- "$(dirname -- "${target}")"
mkdir -- "${target}"
target_created=1
cp -- "${repository_root}/package.json" "${repository_root}/pnpm-lock.yaml" "${target}/"
cp -R -- "${repository_root}/src" "${target}/src"

(
  cd -- "${target}"
  npx pnpm@10.17.1 install --prod --frozen-lockfile
)

installation_complete=1
printf 'Installed opencode-custom-logo at %s\n' "${target}"
