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

# If package.json was modified locally on the server (e.g. adding -p 3061),
# discard local edit so the repository's updated package.json applies cleanly without git pull merge conflict.
if [ -f package.json ] && ! git diff --quiet package.json 2>/dev/null; then
    log_info "Resetting local package.json edits so repository version applies cleanly..."
    git checkout package.json || true
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

# 6. Service Restart (Fastpanel uses underscore naming: app_myhappyhour_co_ke)
detect_service() {
    if [ -n "${FAST_CART_SERVICE:-}" ]; then
        echo "$FAST_CART_SERVICE"
        return 0
    fi

    # Fastpanel converts domain dots to underscores in systemd unit names
    local candidates=(
        "app_myhappyhour_co_ke.service"
        "app_myhappyhour_co_ke"
        "fastuser-app_myhappyhour_co_ke.service"
        "fastuser-app_myhappyhour_co_ke"
        "fastuser_app_myhappyhour_co_ke.service"
        "fastuser_app_myhappyhour_co_ke"
        "app.myhappyhour.co.ke.service"
        "fast-cart.service"
    )

    for s in "${candidates[@]}"; do
        if systemctl list-unit-files "$s" 2>/dev/null | grep -q "$s"; then
            echo "$s"
            return 0
        fi
    done

    # Fallback search in systemctl for app_myhappyhour or myhappyhour
    local found
    found=$(systemctl list-unit-files 2>/dev/null | grep -E "app_myhappyhour|myhappyhour" | awk '{print $1}' | head -n 1 || true)
    if [ -n "$found" ]; then
        echo "$found"
        return 0
    fi

    return 1
}

SERVICE_NAME=$(detect_service || true)

if [ -n "$SERVICE_NAME" ]; then
    log_info "Detected Fastpanel systemd service: ${SERVICE_NAME}"
    log_info "Restarting ${SERVICE_NAME}..."
    if command -v sudo >/dev/null 2>&1; then
        sudo systemctl restart "$SERVICE_NAME" || log_warn "Could not restart automatically. Run: sudo systemctl restart ${SERVICE_NAME}"
    else
        systemctl restart "$SERVICE_NAME" || log_warn "Could not restart automatically. Run: systemctl restart ${SERVICE_NAME}"
    fi
    log_success "Service ${SERVICE_NAME} restart command issued."
else
    log_info "To restart the service manually:"
    log_info "  sudo systemctl restart app_myhappyhour_co_ke"
    log_info "  (or restart Node.js inside the Fastpanel web panel)"
fi

log_success "Update routine completed!"

    for s in "${candidates[@]}"; do
        if systemctl list-unit-files "$s" 2>/dev/null | grep -q "$s"; then
            echo "$s"
            return 0
        fi
    done

    # Fallback search in systemctl for app_myhappyhour or myhappyhour
    local found
    found=$(systemctl list-unit-files 2>/dev/null | grep -E "app_myhappyhour|myhappyhour" | awk '{print $1}' | head -n 1 || true)
    if [ -n "$found" ]; then
        echo "$found"
        return 0
    fi

    return 1
}

SERVICE_NAME=$(detect_service || true)

if [ -n "$SERVICE_NAME" ]; then
    log_info "Detected Fastpanel systemd service: ${SERVICE_NAME}"
    log_info "Restarting ${SERVICE_NAME}..."
    if command -v sudo >/dev/null 2>&1; then
        sudo systemctl restart "$SERVICE_NAME" || log_warn "Could not restart automatically. Run: sudo systemctl restart ${SERVICE_NAME}"
    else
        systemctl restart "$SERVICE_NAME" || log_warn "Could not restart automatically. Run: systemctl restart ${SERVICE_NAME}"
    fi
    log_success "Service ${SERVICE_NAME} restart command issued."
else
    log_info "To restart the service manually:"
    log_info "  sudo systemctl restart app_myhappyhour_co_ke"
    log_info "  (or restart Node.js inside the Fastpanel web panel)"
fi

log_success "Update routine completed!"

