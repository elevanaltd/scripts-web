# Migration Drift Analysis Report

## Remote Migrations (Production Database)
Total: 17 migrations applied

```
20250928100000          - (no name)
20251003091547          - add_final_invoice_sent_to_projects
20251003095146          - add_comment_cleanup_trigger
20251003104231          - fix_comment_cleanup_null_comparison
20251006040022          - rls_initplan_optimization
20251006040056          - rls_policy_consolidation
20251006040114          - fix_ambiguous_column_reference
20251006040127          - fix_refresh_security
20251006040142          - fix_get_comment_descendants_column
20251006040157          - verify_security_hardening
20251006105807          - fix_null_role_bypass
20251007123028          - fix_cleanup_trigger_use_deleted_boolean
20251007123320          - restore_hard_delete_for_project_cleanup
20251008025813          - add_scripts_updated_at_trigger
20251008071622          - hub_hybrid_schema_v2
20251010034305          - consolidate_comments_rls_policies
20251011021102          - add_workflow_status_pend_start_reuse
```

## Local Migrations (Repository Files)
Total: 26 migration files

```
20250928100000_consolidated_production_schema.sql
20250929030000_create_comments_table_corrected_schema.sql
20250929040000_fix_comments_rls_client_insert.sql
20250929150000_add_missing_comments_fields.sql
20250929170000_add_cascade_delete_functions.sql
20250929180000_fix_client_comment_permissions.sql
20250929200000_optimize_comments_rls_performance.sql
20250929210000_fix_user_accessible_scripts_view.sql
20250930010000_fix_admin_rls_update_delete.sql
20251001170000_fix_comments_user_profiles_relationship.sql
20251003000000_add_final_invoice_sent_to_projects.sql
20251003120000_add_comment_cleanup_trigger.sql
20251003140000_create_comments_with_users_view.sql
20251006000000_security_hardening.sql
20251007000000_phase_2_9_database_hardening.sql
20251007010000_add_script_status_field.sql
20251007020000_add_secure_status_update_rpc.sql
20251007030000_create_audit_log_table.sql
20251007040000_fix_save_script_authorization.sql
20251007050000_fix_null_role_bypass.sql
20251007060000_fix_client_comment_deletion.sql
20251007070000_fix_client_comment_select_policy.sql
20251007071000_add_client_comment_update_policy.sql
20251008020000_add_scripts_updated_at_trigger.sql
20251008030000_add_employee_to_user_accessible_scripts.sql
20251011010000_fix_script_status_validation.sql
```

## Drift Analysis

### Discrepancies Found:

1. **Migration Count Mismatch**:
   - Remote: 17 migrations
   - Local: 26 migrations
   - Difference: 9 extra migrations locally

2. **Timestamp Format Differences**:
   - Remote uses shorter timestamps (e.g., `20251003091547`)
   - Local uses rounded timestamps (e.g., `20251003000000`)

3. **Migration Consolidation Issues**:
   - Many local migrations (Sept 29-30) were likely consolidated or skipped remotely
   - Remote has fewer, more consolidated migrations

4. **Missing Remote Migrations**:
   - `20251008071622 - hub_hybrid_schema_v2` exists remotely but not locally
   - `20251010034305 - consolidate_comments_rls_policies` exists remotely but not locally
   - `20251011021102 - add_workflow_status_pend_start_reuse` exists remotely but not locally

5. **Migration Application Pattern**:
   - Remote appears to have applied migrations through Dashboard/MCP selectively
   - Local has all migrations from old repository migration (Oct 13)

## Root Cause
The migration history diverged because:
1. Production database was managed via Supabase Dashboard/MCP tools
2. Some migrations were consolidated or applied differently
3. New migrations were added directly to production without local files
4. The October 13 multi-repo migration brought old migration files that weren't all applied to production

## Impact
- `supabase db reset` fails due to mismatched schema expectations
- Local test database cannot replicate production structure
- Risk of applying duplicate or conflicting migrations