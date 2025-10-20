-- D1.3 Performance Benchmark Queries
-- Purpose: Validate <50ms query latency with 500 components
-- Gate Requirement: D1.3 from 002-UNIVERSAL-EAV_SYSTEM-CHECKLIST.md line 74
--
-- Instructions:
--   1. Provision test dataset via MCP SQL (see coordination/reports/005-REPORT-D1-3-PERFORMANCE-BENCHMARKS.md "Seeding Commands" section)
--      Optional: Use seed-components.ts once service-role environment variable is configured
--   2. Replace <script-id> placeholders with actual script IDs from seeding output
--   3. Execute each query via Supabase MCP or SQL editor
--   4. Record EXPLAIN ANALYZE output (planning time + execution time)
--
-- Target: All queries <50ms
-- ========================================================================

-- ========================================================================
-- Benchmark 1: Component Retrieval (Editor Load)
-- Use Case: TipTap editor initialization - fetch all components for editing
-- Expected Performance: <15ms (most common operation)
-- ========================================================================

EXPLAIN ANALYZE
SELECT
  id,
  script_id,
  component_number,
  content,
  word_count,
  created_at
FROM script_components
WHERE script_id = '<script-id>'
ORDER BY component_number;

-- Expected output:
-- Planning Time: ~0.1-0.2 ms
-- Execution Time: <15 ms
-- Index Used: idx_script_components_script_id (confirm in query plan)
-- Rows Returned: 50 components


-- ========================================================================
-- Benchmark 2: Component Count Aggregation (Dashboard Query)
-- Use Case: Project dashboard - show script summaries with component counts
-- Expected Performance: <30ms
-- ========================================================================

EXPLAIN ANALYZE
SELECT
  s.id,
  s.status,
  s.plain_text,
  s.component_count,
  s.created_at,
  s.updated_at,
  COUNT(sc.id) as actual_component_count,
  SUM(sc.word_count) as total_words
FROM scripts s
LEFT JOIN script_components sc ON s.id = sc.script_id
WHERE s.video_id LIKE 'd13-perf-test-video%'
GROUP BY s.id, s.status, s.plain_text, s.component_count, s.created_at, s.updated_at
ORDER BY s.created_at DESC;

-- Expected output:
-- Planning Time: ~0.1-0.2 ms
-- Execution Time: <30 ms
-- Join Strategy: Hash Join or Nested Loop (acceptable for 10 scripts)
-- Rows Returned: 10 scripts with aggregated component counts


-- ========================================================================
-- Benchmark 3: Full-Text Search Across Components (Worst Case)
-- Use Case: Global component search - find components containing search term
-- Expected Performance: <50ms (acceptable for infrequent operation)
-- ========================================================================

EXPLAIN ANALYZE
SELECT
  sc.id,
  sc.script_id,
  sc.component_number,
  sc.content,
  s.plain_text as script_title,
  v.title as video_title
FROM script_components sc
JOIN scripts s ON sc.script_id = s.id
JOIN videos v ON s.video_id = v.id
WHERE sc.content ILIKE '%performance%'
AND v.id LIKE 'd13-perf-test-video%'
ORDER BY sc.component_number
LIMIT 100;

-- Expected output:
-- Planning Time: ~0.1-0.2 ms
-- Execution Time: <50 ms (worst case - full table scan with ILIKE)
-- Scan Type: Sequential or Bitmap Heap Scan
-- Rows Returned: ~23 matching components (assuming "performance" appears in ~5% of content)
--
-- NOTE: If this query exceeds 50ms at scale, mitigation strategy:
--   1. Add GIN index on script_components.content using pg_trgm extension
--   2. Implement pagination (already has LIMIT 100)
--   3. Consider full-text search (tsvector/tsquery) for production


-- ========================================================================
-- Additional Query: Verify Data Integrity
-- Use Case: Confirm seeding created expected dataset
-- Not a performance benchmark - for validation only
-- ========================================================================

SELECT
  'Total Scripts' as metric,
  COUNT(*)::text as value
FROM scripts
WHERE video_id LIKE 'd13-perf-test-video%'

UNION ALL

SELECT
  'Total Components' as metric,
  COUNT(*)::text as value
FROM script_components sc
JOIN scripts s ON sc.script_id = s.id
WHERE s.video_id LIKE 'd13-perf-test-video%'

UNION ALL

SELECT
  'Avg Components/Script' as metric,
  ROUND(AVG(component_count), 2)::text as value
FROM scripts
WHERE video_id LIKE 'd13-perf-test-video%'

UNION ALL

SELECT
  'Total Words' as metric,
  SUM(sc.word_count)::text as value
FROM script_components sc
JOIN scripts s ON sc.script_id = s.id
WHERE s.video_id LIKE 'd13-perf-test-video%';

-- Expected results:
-- Total Scripts: 10
-- Total Components: 500
-- Avg Components/Script: 50.00
-- Total Words: 14000 (28 words × 500 components)


-- ========================================================================
-- Performance Analysis Notes
-- ========================================================================
--
-- KEY METRICS TO RECORD:
-- 1. Planning Time (should be <0.2ms for all queries)
-- 2. Execution Time (target <50ms, ideally <30ms for Q1-Q2)
-- 3. Index Usage (confirm indexes are being used)
-- 4. Rows Returned vs Rows Scanned (efficiency ratio)
--
-- SCALING PROJECTIONS:
-- Current: 500 components across 10 scripts
-- Production estimate: 2,000-5,000 components (per North Star risk R4)
--
-- Q1 scales linearly with script size (not total dataset) - should remain <20ms
-- Q2 scales with number of scripts - may approach 50-60ms at 100+ scripts
-- Q3 scales with total dataset - may need optimization (GIN index) at 5,000+ components
--
-- MITIGATION STRATEGIES (if needed):
-- 1. Materialized view for dashboard aggregations (Q2)
-- 2. GIN index with pg_trgm for full-text search (Q3)
-- 3. Cursor-based pagination for large result sets
-- 4. Consider partitioning if dataset exceeds 100,000 components
--
-- ========================================================================
