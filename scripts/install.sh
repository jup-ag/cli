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

info "Downloading $URL..."
curl -fsSL "$URL" -o "/tmp/${BINARY}"
chmod +x "/tmp/${BINARY}"

if [ -w "$INSTALL_DIR" ]; then
  mv "/tmp/${BINARY}" "${INSTALL_DIR}/${BINARY}"
else
  info "Elevated permissions required to install to $INSTALL_DIR"
  sudo mv "/tmp/${BINARY}" "${INSTALL_DIR}/${BINARY}"
fi

info "Installed $BINARY to ${INSTALL_DIR}/${BINARY}"
