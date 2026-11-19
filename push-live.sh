#!/usr/bin/env bash
set -e

# Navigate to project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# ANSI color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}🚀 Push to Live Deployment Automation${NC}"
echo -e "${CYAN}========================================${NC}"

# Current git branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

# Fetch latest status from remote
echo -e "${CYAN}→ Checking remote status...${NC}"
git fetch origin "$CURRENT_BRANCH" --quiet 2>/dev/null || true

STATUS=$(git status --porcelain)
BEHIND=$(git rev-list --count HEAD..origin/"$CURRENT_BRANCH" 2>/dev/null || echo "0")
AHEAD=$(git rev-list --count origin/"$CURRENT_BRANCH"..HEAD 2>/dev/null || echo "0")

if [ -z "$STATUS" ] && [ "$AHEAD" -eq "0" ]; then
  echo -e "${YELLOW}ℹ Nothing to push. Working tree is clean and up to date with origin/${CURRENT_BRANCH}.${NC}"
  exit 0
fi

# If remote is ahead, safely pull/rebase first
if [ "$BEHIND" -gt "0" ]; then
  echo -e "${YELLOW}Remote is $BEHIND commit(s) ahead. Rebase pulling latest changes...${NC}"
  git pull --rebase origin "$CURRENT_BRANCH"
fi

# Step 1: Pre-push build validation to ensure live production never breaks
echo -e "\n${CYAN}[1/3] Running build verification...${NC}"
if npm run build; then
  echo -e "${GREEN}✓ Build succeeded.${NC}"
else
  echo -e "${RED}✗ Build failed! Aborting push to prevent breaking live production.${NC}"
  exit 1
fi

# Step 2: Stage and commit if there are uncommitted changes
if [ -n "$STATUS" ]; then
  echo -e "\n${CYAN}[2/3] Staging and committing changes...${NC}"
  git add -A

  if [ -n "$1" ]; then
    COMMIT_MSG="$*"
  else
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    COMMIT_MSG="Live update: $TIMESTAMP"
  fi

  git commit -m "$COMMIT_MSG"
  echo -e "${GREEN}✓ Committed: ${COMMIT_MSG}${NC}"
else
  echo -e "\n${YELLOW}[2/3] No unstaged changes; pushing existing commit(s).${NC}"
fi

# Step 3: Push to remote main
echo -e "\n${CYAN}[3/3] Pushing to origin/${CURRENT_BRANCH}...${NC}"
git push origin "$CURRENT_BRANCH"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Changes successfully pushed to origin/${CURRENT_BRANCH}!${NC}"
echo -e "${GREEN}✓ Live deployment (Vercel) automatically triggered.${NC}"
echo -e "${GREEN}========================================${NC}"

