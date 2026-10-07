#!/bin/bash
# Verifies every signature of a built pacman repository with only the public key
# committed in the repository, and checks the exact set of published files.
set -euo pipefail

if [[ "$#" -ne 4 ]]; then
  echo "Usage: $0 <repository-directory> <version> <public-key.asc> <key-fingerprint>" >&2
  exit 64
fi

directory="$1"
version="$2"
public_key="$3"
fingerprint="$4"
package_name="streamdeck-deej-$version.pkg.tar.xz"

keyring="$(mktemp -d)"
trap 'rm -rf "$keyring"' EXIT
chmod 700 "$keyring"
gpg --homedir "$keyring" --batch --quiet --import "$public_key"

expected=(
  "$package_name"
  "$package_name.sig"
  streamdeck-deej.db
  streamdeck-deej.db.sig
  streamdeck-deej.files
  streamdeck-deej.files.sig
)
mapfile -t actual < <(find "$directory" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)
mapfile -t expected_sorted < <(printf '%s\n' "${expected[@]}" | LC_ALL=C sort)
if [[ "${actual[*]}" != "${expected_sorted[*]}" ]]; then
  echo "Unexpected repository files: ${actual[*]}" >&2
  exit 1
fi

for file in "$package_name" streamdeck-deej.db streamdeck-deej.files; do
  status="$(gpg --homedir "$keyring" --batch --status-fd 1 --verify \
    "$directory/$file.sig" "$directory/$file" 2>/dev/null)"
  if ! grep -Eq "^\[GNUPG:\] VALIDSIG $fingerprint " <<<"$status"; then
    echo "Invalid or foreign signature on $file" >&2
    exit 1
  fi
done

# The database must list exactly this package version. pacman fetches the
# package signature from "<package>.sig" next to it.
listing="$(tar -xzOf "$directory/streamdeck-deej.db" --wildcards '*/desc')"
grep -Fxq "$package_name" <<<"$listing"
grep -Fxq "$version-1" <<<"$listing"
test "$(grep -c '^%FILENAME%$' <<<"$listing")" -eq 1
echo "Verified pacman repository for streamdeck-deej $version"
