#!/usr/bin/env bash

###############################################################################
# validate-env.sh - Pre-commit environment validation orchestration
#
# Purpose: Shell orchestration for environment validation before git commits
# Strategy: Run Node.js validation + health checks to prevent PR #22 pattern
#
# Usage:
#   ./scripts/validate-env.sh [.env file path]
#   Default: .env
#
# Exit codes:
#   0 - All checks passed
#   1 - Validation failed
#   2 - Script error (Node.js not available, etc.)
#
# Integration: Designed for Husky pre-commit hook
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE="${1:-.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR_SCRIPT="$SCRIPT_DIR/validate-env.mjs"

###############################################################################
# Helper Functions
###############################################################################

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1" >&2
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

###############################################################################
# Pre-flight Checks
###############################################################################

print_header "Pre-commit Environment Validation"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  print_error "Node.js not found"
  echo "  Please install Node.js to run environment validation"
  echo "  https://nodejs.org/"
  exit 2
fi

# Check if validator script exists
if [ ! -f "$VALIDATOR_SCRIPT" ]; then
  print_error "Validator script not found: $VALIDATOR_SCRIPT"
  echo "  Expected location: scripts/validate-env.mjs"
  exit 2
fi

# Check if validator script is executable (Node.js will run it regardless, but nice to check)
if [ ! -r "$VALIDATOR_SCRIPT" ]; then
  print_error "Validator script not readable: $VALIDATOR_SCRIPT"
  echo "  Please check file permissions"
  exit 2
fi

print_success "Pre-flight checks passed"

###############################################################################
# Environment Validation
###############################################################################

echo ""
echo "Validating environment file: $ENV_FILE"
echo ""

# Run Node.js validator
# Captures both stdout and stderr, preserves exit code
if node "$VALIDATOR_SCRIPT" "$ENV_FILE"; then
  print_success "Environment validation passed"
  echo ""
  print_success "All checks passed - ready to commit"
  exit 0
else
  EXIT_CODE=$?
  print_error "Environment validation failed"
  echo ""
  echo "Please fix the issues above before committing."
  echo "Check your .env file against .env.example for reference."
  exit $EXIT_CODE
fi
