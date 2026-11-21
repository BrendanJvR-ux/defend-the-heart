#!/usr/bin/env bash
# Build the game and publish dist/ to the gh-pages branch (served by GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
npm run build
touch dist/.nojekyll
tmp=$(mktemp -d)
git worktree add --force --detach "$tmp" >/dev/null
(
  cd "$tmp"
  git checkout --orphan gh-pages-tmp >/dev/null 2>&1
  git rm -rf --quiet . >/dev/null 2>&1 || true
  cp -R "$OLDPWD/dist/." .
  git add -A
  git commit --quiet -m "Deploy $(git -C "$OLDPWD" rev-parse --short HEAD)"
  git push --force --quiet origin HEAD:gh-pages
)
git worktree remove --force "$tmp"
git branch -D gh-pages-tmp >/dev/null 2>&1 || true
echo "Deployed to gh-pages."
