#!/usr/bin/env bash
set -euo pipefail

REMOTE="${1:-github}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build:pages

remote_url="$(git remote get-url "$REMOTE")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp -R dist/public/. "$tmp/"

git -C "$tmp" init -b gh-pages
git -C "$tmp" config user.name "${GIT_AUTHOR_NAME:-GitHub Pages Publisher}"
git -C "$tmp" config user.email "${GIT_AUTHOR_EMAIL:-pages@users.noreply.github.com}"
git -C "$tmp" add -A
git -C "$tmp" commit -m "Deploy GitHub Pages"
git -C "$tmp" remote add origin "$remote_url"
git -C "$tmp" push --force origin gh-pages

echo "Published dist/public to $REMOTE/gh-pages"
