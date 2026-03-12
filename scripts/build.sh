#!/usr/bin/env bash
set -euo pipefail

ENTRY="src/index.ts"
OUTDIR="dist"

TARGETS=(
  bun-linux-x64
  bun-linux-arm64
  bun-darwin-x64
  bun-darwin-arm64
)

rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"

for target in "${TARGETS[@]}"; do
  # bun-linux-x64 -> jup-linux-x64
  outfile="${OUTDIR}/jup-${target#bun-}"
  echo "Building $outfile..."
  bun build "$ENTRY" --compile --target="$target" --outfile="$outfile"
done

echo "Done. Binaries:"
ls -lh "$OUTDIR"/jup-*
