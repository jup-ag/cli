#!/usr/bin/env bash
set -euo pipefail

PACKAGE="@jup-ag/cli"
BINARY="jup"
REPO="jup-ag/cli"

info() { printf '\033[1;34m%s\033[0m\n' "$*"; }
error() { printf '\033[1;31merror: %s\033[0m\n' "$*" >&2; exit 1; }

# Volta
if command -v volta &>/dev/null; then
  info "Installing $PACKAGE via volta..."
  volta install "$PACKAGE"
  exit 0
fi

# npm
if command -v npm &>/dev/null; then
  info "Installing $PACKAGE via npm..."
  npm install -g "$PACKAGE"
  exit 0
fi

# Binary fallback
info "No package manager found, installing standalone binary..."

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)  os="linux" ;;
  Darwin) os="darwin" ;;
  *)      error "Unsupported OS: $OS" ;;
esac

case "$ARCH" in
  x86_64|amd64)  arch="x64" ;;
  aarch64|arm64) arch="arm64" ;;
  *)             error "Unsupported architecture: $ARCH" ;;
esac

ASSET="${BINARY}-${os}-${arch}"
INSTALL_DIR="${JUP_INSTALL_DIR:-/usr/local/bin}"
URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

CHECKSUM_URL="https://github.com/${REPO}/releases/latest/download/checksums.txt"

TMP_DIR=$(mktemp -d)
TMP_BINARY="${TMP_DIR}/${BINARY}"
TMP_CHECKSUMS="${TMP_DIR}/checksums.txt"
trap 'rm -rf "$TMP_DIR"' EXIT

info "Downloading $URL..."
curl -fsSL "$URL" -o "$TMP_BINARY"
curl -fsSL "$CHECKSUM_URL" -o "$TMP_CHECKSUMS"

info "Verifying checksum..."
EXPECTED=$(grep "$ASSET" "$TMP_CHECKSUMS" | awk '{print $1}') || true
if [ -z "$EXPECTED" ]; then
  error "No checksum found for $ASSET in checksums.txt"
fi
ACTUAL=$(sha256sum "$TMP_BINARY" | awk '{print $1}')
if [ "$EXPECTED" != "$ACTUAL" ]; then
  error "Checksum verification failed. Expected $EXPECTED, got $ACTUAL"
fi

chmod +x "$TMP_BINARY"

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_BINARY" "${INSTALL_DIR}/${BINARY}"
else
  info "Elevated permissions required to install to $INSTALL_DIR"
  sudo mv "$TMP_BINARY" "${INSTALL_DIR}/${BINARY}"
fi

info "Installed $BINARY to ${INSTALL_DIR}/${BINARY}"
