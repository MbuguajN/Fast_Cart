#!/usr/bin/env bash
# ==============================================================================
# Fast Cart / Happy Hour Production Update Script
#
# Pulls latest updates from 'chrisupdates', installs dependencies,
# runs Postgres migrations, builds Next.js, and restarts the systemd service.
#
# Default production path: /var/www/fastuser/data/www/app.myhappyhour.co.ke/Fast_Cart
# Service Port: 3061
# ==============================================================================

set -euo pipefail

BRANCH="${GIT_BRANCH:-chrisupdates}"
REMOTE="${GIT_REMOTE:-origin}"
PORT="${APP_PORT:-3061}"
DEFAULT_PROD_PATH="/var/www/fastuser/data/www/app.myhappyhour.co.ke/Fast_Cart"

# Colors for terminal output
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}${BOLD}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}${BOLD}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}${BOLD}[ERROR]${NC} $1" >&2
}

# 1. Determine working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$DEFAULT_PROD_PATH" ]; then
    APP_DIR="$DEFAULT_PROD_PATH"
else
    APP_DIR="$SCRIPT_DIR"
fi

log_info "Fast Cart directory: ${APP_DIR}"
cd "$APP_DIR"

# 2. Check git status and pull from branch
log_info "Fetching and updating from ${REMOTE}/${BRANCH}..."
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log_error "Not a git repository at ${APP_DIR}"
    exit 1
fi

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "$BRANCH" ]; then
    log_info "Switching branch from ${current_branch} to ${BRANCH}..."
    git checkout "$BRANCH"
fi

git fetch "$REMOTE" "$BRANCH"
git pull "$REMOTE" "$BRANCH"
log_success "Git repository updated to commit $(git rev-parse --short HEAD)"

# 3. Install dependencies
log_info "Installing dependencies (npm install)..."
npm install
log_success "Dependencies up to date."

# 4. Run database migrations
log_info "Running database migrations (npm run migrate)..."
if ! npm run migrate; then
    log_error "Database migration failed! Aborting update to avoid downtime."
    exit 1
fi
log_success "Database migrations completed successfully."

# 5. Build Next.js application
log_info "Building Next.js application (npm run build)..."
if ! npm run build; then
    log_error "Next.js build failed! Aborting service restart."
    exit 1
fi
log_success "Next.js build completed."

log_success "Update routine completed! Ready for manual service restart."

