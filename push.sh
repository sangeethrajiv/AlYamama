#!/usr/bin/env bash
set -e

# ==============================================================================
# Instant Git Commit & Push to Live
# Fully automated: stages all changes, generates commit message, and pushes.
# Usage:
#   npm run push              (fully automatic instant push)
#   ./push                    (fully automatic instant push)
#   ./push "custom message"   (optional custom message)
#   ./push --dry-run          (simulates without pushing)
# ==============================================================================

# ANSI Color Codes
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Locate git repository root
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "${BASH_SOURCE[0]}")" && pwd))"
cd "$REPO_ROOT"

# Check for --dry-run flag
DRY_RUN=false
if [ "$1" = "--dry-run" ] || [ "$1" = "-n" ]; then
  DRY_RUN=true
  shift
fi

# Detect current active branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo -e "${CYAN}⚡ Instant Push [Branch: ${BOLD}${CURRENT_BRANCH}${NC}${CYAN}]${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}🔍 DRY RUN MODE (no changes will be pushed)${NC}"
fi

# Check for modified, deleted, untracked files
STATUS=$(git status --porcelain)

# Determine commit message (automatic timestamp default, or custom argument if provided)
if [ $# -gt 0 ]; then
  COMMIT_MSG="$*"
else
  TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
  COMMIT_MSG="Live update: $TIMESTAMP"
fi

# 1. Add all changes and commit
if [ -n "$STATUS" ]; then
  if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}→ [Dry-run] Would stage all changes (git add -A)${NC}"
    echo -e "${CYAN}→ [Dry-run] Would commit with message: ${BOLD}\"${COMMIT_MSG}\"${NC}"
  else
    echo -e "${CYAN}→ Staging all changes (git add -A)...${NC}"
    git add -A

    echo -e "${CYAN}→ Committing: ${BOLD}\"${COMMIT_MSG}\"${NC}"
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✓ Committed: ${COMMIT_MSG}${NC}"
  fi
else
  # Check if local branch is ahead of remote
  AHEAD=$(git rev-list --count origin/"$CURRENT_BRANCH"..HEAD 2>/dev/null || echo "0")
  if [ "$AHEAD" -gt 0 ]; then
    echo -e "${YELLOW}ℹ Working tree is clean, but $AHEAD unpushed commit(s) found.${NC}"
  else
    echo -e "${GREEN}✓ Working tree is clean and already up to date with origin/${CURRENT_BRANCH}. Nothing to push.${NC}"
    exit 0
  fi
fi

# 2. Push to remote live
if [ "$DRY_RUN" = true ]; then
  echo -e "${CYAN}→ [Dry-run] Testing push to origin/${CURRENT_BRANCH}...${NC}"
  git push --dry-run origin "$CURRENT_BRANCH"
  echo -e "${GREEN}✓ [Dry-run] Push test completed successfully.${NC}"
else
  echo -e "${CYAN}→ Pushing to origin/${CURRENT_BRANCH}...${NC}"
  if git push origin "$CURRENT_BRANCH"; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Successfully pushed to origin/${CURRENT_BRANCH}!${NC}"
    echo -e "${GREEN}========================================${NC}"
  else
    echo -e "${YELLOW}Standard push failed. Retrying with upstream tracking (-u)...${NC}"
    git push -u origin "$CURRENT_BRANCH"
    echo -e "${GREEN}✓ Successfully pushed with upstream tracking set!${NC}"
  fi
fi
