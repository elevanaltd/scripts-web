# Database Migrations

This directory contains SQL migrations for the EAV Scripts Web application database schema.

## Migration Naming Convention

Migrations follow the pattern: `YYYYMMDDHHMMSS_descriptive_name.sql`

Example: `20251021120000_restrict_cascade_delete.sql`

## Applying Migrations

**PREFERRED:** Use Supabase MCP tools (automatic authentication, reliable):

```typescript
await mcp__supabase__apply_migration({
  project_id: "zbxvjyrbkycbfhwmmnmy",
  name: "descriptive_migration_name",
  query: "CREATE TABLE ..."
});
```

**AVOID:** Supabase CLI `db push` (frequent connection errors)

## Recent Migrations

### TD-006 Remediation: Governed Hard-Delete Pathway (Option C Architecture)

**Date:** 2025-10-21
**Approvals:** principal-engineer (Option C strategy), critical-engineer (pending re-validation)

#### Migration 1: `20251021120000_restrict_cascade_delete.sql`
- Changed `comments.parent_comment_id` FK from `ON DELETE CASCADE` to `ON DELETE RESTRICT`
- **Purpose:** Prevents accidental hard cascades (data loss prevention)
- **Impact:** Raw DELETE of parent comments with children now blocked

#### Migration 2: `20251021120001_create_hard_delete_audit_log.sql`
- Created `hard_delete_audit_log` table
- **Purpose:** Audit trail for compliance operations (GDPR, data retention)
- **Columns:** operator_id, operator_email, root_comment_id, descendant_count, script_id, reason, timestamps
- **RLS:** Admin-only read access

#### Migration 3: `20251021120002_create_governed_hard_delete.sql`
- Created `hard_delete_comment_tree(p_comment_id, p_reason)` security-definer function
- **Purpose:** Governed pathway for hard deletion (GDPR compliance)
- **Requirements:**
  1. Admin role required (`user_profiles.role = 'admin'`)
  2. Comment must be soft-deleted first (`deleted = true`)
  3. All operations logged to audit table
- **Safety:** Enforces soft-delete precondition, handles FK RESTRICT correctly (children before parents)

## Governed Hard-Delete Pathway Usage

### Standard Workflow (Admin Only)

```sql
-- Step 1: Soft-delete comment tree (sets deleted=true)
SELECT cascade_soft_delete_comments(ARRAY['<comment-uuid>']::uuid[]);

-- Step 2: Hard-delete with audit trail (physical deletion)
SELECT hard_delete_comment_tree(
  '<comment-uuid>'::uuid,
  'GDPR data purge request #12345'  -- Reason (optional, recommended)
);
```

### Safety Features

1. **FK RESTRICT Constraint:** Blocks accidental raw DELETE operations
   ```sql
   -- This will FAIL with FK violation error:
   DELETE FROM comments WHERE id = '<parent-with-children>';
   ```

2. **Soft-Delete Precondition:** Must soft-delete before hard-delete
   ```sql
   -- This will FAIL with precondition error:
   SELECT hard_delete_comment_tree('<active-comment-uuid>');
   ```

3. **Admin-Only Access:** Function checks role internally
   ```sql
   -- Client users will get "Admin role required" error
   ```

4. **Audit Trail:** All operations logged (success and failure)
   ```sql
   -- Query audit log (admin only):
   SELECT * FROM hard_delete_audit_log
   WHERE deleted_at > now() - interval '30 days'
   ORDER BY deleted_at DESC;
   ```

### Return Value

Success:
```json
{
  "success": true,
  "comment_id": "...",
  "descendants_deleted": 3,
  "operator_id": "...",
  "operator_email": "admin@example.com",
  "reason": "GDPR data purge request #12345"
}
```

### Error Handling

Function raises exceptions for:
- **Authentication required:** No active session
- **Admin role required:** User not admin
- **Comment not found:** Invalid comment_id
- **Must be soft-deleted:** Comment.deleted = false (use `cascade_soft_delete_comments` first)
- **FK violations:** (Handled internally by deleting children before parents)

## Schema Cache Refresh

**Note:** After applying migrations, Supabase PostgREST may require schema cache refresh:

```sql
-- Force schema cache reload (may take 1-3 minutes):
NOTIFY pgrst, 'reload schema';
```

Alternatively, restart the Supabase project in dashboard for immediate effect.

## Rollback Procedures

Each migration includes rollback SQL in comments. To revert:

```sql
-- Migration 3 rollback:
DROP FUNCTION IF EXISTS hard_delete_comment_tree CASCADE;

-- Migration 2 rollback:
DROP TABLE IF EXISTS hard_delete_audit_log CASCADE;

-- Migration 1 rollback:
ALTER TABLE comments DROP CONSTRAINT comments_parent_comment_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_parent_comment_id_fkey
  FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE;
```

**WARNING:** Rollback of Migration 1 restores dual cascade architecture (data loss risk). Only rollback if absolutely necessary and with critical-engineer approval.

## References

- **Architecture Decision:** `coordination/docs/ADR-TBD-GOVERNED-HARD-DELETE.md` (to be created)
- **Task:** TD-006 (critical-engineer NO-GO remediation)
- **Approval:** principal-engineer Option C approval (6-month HIGH viability)
- **Test Suite:** `src/lib/hard-delete-governance.test.ts`
