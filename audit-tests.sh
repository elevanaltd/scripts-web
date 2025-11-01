#!/bin/bash

# Simple test audit: Check if implementation exists for each test file

echo "| Test File | Implementation | Status | Notes |"
echo "|-----------|----------------|--------|-------|"

# Find all test files
find ./src -type f \( -name "*.test.ts" -o -name "*.test.tsx" \) | grep -v node_modules | sort | while read test_file; do
    # Get the base directory and filename
    dir=$(dirname "$test_file")
    base=$(basename "$test_file")

    # Remove .test from filename to get implementation name
    # Handle various patterns:
    # - File.test.tsx -> File.tsx
    # - File.aspect.test.tsx -> File.tsx (aspect tests)
    # - File-feature.test.tsx -> File-feature.tsx or File.tsx

    if [[ $base =~ ^(.+)\.(cache|realtime|reconnection|connection-state|error-handling|race-condition|lifecycle|component-extraction|lock-integration|paste-handler|script-status|security|comments|user-isolation)\.test\.(ts|tsx)$ ]]; then
        # Aspect test - look for base implementation
        impl_base="${BASH_REMATCH[1]}"
        ext="${BASH_REMATCH[3]}"
        impl_file="$dir/$impl_base.$ext"
    elif [[ $base =~ ^(.+)\.test\.(ts|tsx)$ ]]; then
        # Regular test
        impl_base="${BASH_REMATCH[1]}"
        ext="${BASH_REMATCH[2]}"
        impl_file="$dir/$impl_base.$ext"
    else
        impl_file=""
    fi

    # Check if implementation exists
    if [ -f "$impl_file" ]; then
        impl_status="✅"
        impl_name=$(basename "$impl_file")
    else
        impl_status="❌"
        impl_name="No implementation"
    fi

    # Show relative path from src/
    test_rel="${test_file#./src/}"

    echo "| $test_rel | $impl_status $impl_name | TBD | TBD |"
done
