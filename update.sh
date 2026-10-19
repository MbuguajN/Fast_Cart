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

# 6. Detect and restart systemd service
log_info "Restarting systemd service..."

detect_service() {
    if [ -n "${FAST_CART_SERVICE:-}" ]; then
        echo "$FAST_CART_SERVICE"
        return 0
    fi

    # Check common Fastpanel systemd naming patterns
    local candidates=(
        "app.myhappyhour.co.ke.service"
        "fastuser-app.myhappyhour.co.ke.service"
        "app.myhappyhour.co.ke"
        "fastuser-app.myhappyhour.co.ke"
        "fast-cart.service"
        "fastcart.service"
    )

    for s in "${candidates[@]}"; do
        if systemctl list-unit-files "$s" 2>/dev/null | grep -q "$s"; then
            echo "$s"
            return 0
        fi
    done

    # Fallback: search systemctl list-unit-files for myhappyhour
    local found
    found=$(systemctl list-unit-files 2>/dev/null | grep -E "app\.myhappyhour\.co\.ke|myhappyhour" | awk '{print $1}' | head -n 1 || true)
    if [ -n "$found" ]; then
        echo "$found"
        return 0
    fi

    return 1
}

SERVICE_NAME=$(detect_service || true)

if [ -n "$SERVICE_NAME" ]; then
    log_info "Found service: ${SERVICE_NAME}. Restarting..."
    if command -v sudo >/dev/null 2>&1; then
        sudo systemctl restart "$SERVICE_NAME"
    else
        systemctl restart "$SERVICE_NAME"
    fi
    log_success "Service ${SERVICE_NAME} restart triggered."
else
    log_warn "Could not auto-detect Fastpanel systemd service name."
    log_warn "If needed, specify it with: FAST_CART_SERVICE=<name> ./update.sh"
    log_warn "Manual restart command: sudo systemctl restart <service-name>"
fi

# 7. Health verification
log_info "Verifying service on port ${PORT}..."
HEALTHY=0
for i in {1..15}; do
    if curl -s -f -o /dev/null "http://127.0.0.1:${PORT}/" || curl -s -f -o /dev/null "http://127.0.0.1:${PORT}/api/products" 2>/dev/null; then
        HEALTHY=1
        break
    fi
    sleep 1
done

if [ "$HEALTHY" -eq 1 ]; then
    log_success "Server is up and responding on port ${PORT}!"
else
    log_warn "Server did not respond on port ${PORT} within 15 seconds."
    if [ -n "${SERVICE_NAME:-}" ]; then
        log_warn "Check status with: systemctl status ${SERVICE_NAME}"
    fi
fi

log_success "Update routine completed!"

