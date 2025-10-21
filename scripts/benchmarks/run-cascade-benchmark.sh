#!/bin/bash
set -e

# Load environment variables
if [ -f .env ]; then
  export $(grep "^VITE_SUPABASE" .env | xargs)
fi

# Run benchmark
npx tsx scripts/benchmarks/cascade-delete-benchmark.ts
