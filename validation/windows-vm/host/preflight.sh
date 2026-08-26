#!/usr/bin/env bash

set -euo pipefail

LIBVIRT_URI="${LIBVIRT_URI:-qemu:///system}"
VM_NAME="${VM_NAME:-}"
failures=0

check_command() {
  local command_name="$1"
  if command -v "$command_name" >/dev/null 2>&1; then
    printf 'PASS command %-16s %s\n' "$command_name" "$(command -v "$command_name")"
  else
    printf 'FAIL command %-16s missing\n' "$command_name"
    failures=$((failures + 1))
  fi
}

printf 'Windows VM validation host preflight\n'
printf 'libvirt URI: %s\n' "$LIBVIRT_URI"
printf 'VM name: %s\n\n' "${VM_NAME:-<not supplied>}"

for command_name in virsh virt-manager qemu-system-x86_64 swtpm lsusb; do
  check_command "$command_name"
done

if [[ -r /dev/kvm ]]; then
  printf 'PASS KVM device readable: /dev/kvm\n'
else
  printf 'FAIL KVM device is missing or unreadable: /dev/kvm\n'
  failures=$((failures + 1))
fi

if lsusb -d 5239:0001 2>/dev/null | grep -q .; then
  printf 'PASS USB device 5239:0001 present on host\n'
  lsusb -d 5239:0001
else
  printf 'FAIL USB device 5239:0001 absent on host\n'
  failures=$((failures + 1))
fi

if command -v virsh >/dev/null 2>&1; then
  if virsh --connect "$LIBVIRT_URI" uri >/dev/null 2>&1; then
    printf 'PASS libvirt connection %s\n' "$LIBVIRT_URI"
  else
    printf 'FAIL cannot connect to libvirt URI %s\n' "$LIBVIRT_URI"
    failures=$((failures + 1))
  fi

  if [[ -n "$VM_NAME" ]]; then
    if virsh --connect "$LIBVIRT_URI" dominfo "$VM_NAME" >/dev/null 2>&1; then
      printf 'PASS VM exists: %s\n' "$VM_NAME"
      xml=$(virsh --connect "$LIBVIRT_URI" dumpxml "$VM_NAME")
      grep -q "firmware='efi'" <<<"$xml" && printf 'PASS VM requests EFI firmware\n' || {
        printf 'WARN could not confirm firmware=efi in domain XML\n'
      }
      grep -q "backend type='emulator' version='2.0'" <<<"$xml" &&
        printf 'PASS VM contains emulated TPM 2.0\n' || printf 'WARN could not confirm emulated TPM 2.0\n'
    else
      printf 'FAIL VM not found: %s\n' "$VM_NAME"
      failures=$((failures + 1))
    fi
  fi
fi

printf '\nResult: %s failure(s)\n' "$failures"
(( failures == 0 ))
