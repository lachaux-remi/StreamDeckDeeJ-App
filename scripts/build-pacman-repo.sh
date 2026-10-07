#!/bin/bash
# Builds the signed "streamdeck-deej" pacman repository for one release package.
# Runs on Arch Linux (repo-add) with the signing key already in GNUPGHOME.
set -euo pipefail

if [[ "$#" -ne 4 ]]; then
  echo "Usage: $0 <package.pkg.tar.xz> <output-directory> <key-fingerprint> <passphrase-file>" >&2
  exit 64
fi

package="$1"
output="$2"
fingerprint="$3"
passphrase_file="$4"
repository='streamdeck-deej'
package_name="$(basename -- "$package")"

[[ "$package_name" =~ ^streamdeck-deej-[0-9]+\.[0-9]+\.[0-9]+\.pkg\.tar\.xz$ ]] || {
  echo "Unexpected package file name: $package_name" >&2
  exit 65
}
[[ "$fingerprint" =~ ^[0-9A-F]{40}$ ]] || {
  echo 'The key fingerprint must be 40 uppercase hexadecimal characters' >&2
  exit 65
}

sign() {
  gpg --batch --yes --pinentry-mode loopback --passphrase-file "$passphrase_file" \
    --local-user "$fingerprint!" --detach-sign --no-armor --output "$1.sig" "$1"
}

mkdir -p "$output"
cp -- "$package" "$output/$package_name"
sign "$output/$package_name"

# The repository is rebuilt from scratch so it only ever lists this release.
# repo-add --verify checks the package signature before adding it.
(cd "$output" && repo-add --verify "$repository.db.tar.gz" "$package_name")

# GitHub release assets cannot be symlinks: publish the databases as plain files.
for database in db files; do
  rm -f "$output/$repository.$database"
  mv "$output/$repository.$database.tar.gz" "$output/$repository.$database"
  sign "$output/$repository.$database"
done
rm -f "$output"/*.old "$output"/*.old.sig
