-- ============================================================================
-- AUDIT LOG TABLE FOR SECURITY EVENTS
-- ============================================================================
-- Date: 2025-10-07
-- Purpose: Track security-sensitive operations and authorization failures
--
-- Critical-Engineer: consulted for Security vulnerability assessment
-- Recommendation: Audit trail is non-negotiable for privileged operations.
-- Logs auth.uid(), target resource, timestamp for all attempts (success/failure).
-- ============================================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_resource text,
    details jsonb,
    status text NOT NULL CHECK (status IN ('allowed', 'denied', 'error')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_status ON public.audit_log(status);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Add documentation
COMMENT ON TABLE public.audit_log IS
'Security audit trail for tracking privileged operations and authorization failures.
Records user_id, action type, target resource, status (allowed/denied/error), and timestamp.';

COMMENT ON COLUMN public.audit_log.user_id IS 'User who attempted the action (NULL if user deleted)';
COMMENT ON COLUMN public.audit_log.action IS 'Action attempted (e.g., save_script, update_status, delete_comment)';
COMMENT ON COLUMN public.audit_log.target_resource IS 'Resource identifier (e.g., script_id, comment_id)';
COMMENT ON COLUMN public.audit_log.details IS 'Additional context (role, reason, error message, etc.)';
COMMENT ON COLUMN public.audit_log.status IS 'Outcome: allowed (success), denied (authorization failure), error (system failure)';

-- RLS Policies: Only admins can read audit logs
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admin users can read all audit logs
CREATE POLICY "audit_log_admin_read" ON public.audit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = (SELECT auth.uid())
            AND user_profiles.role = 'admin'
        )
    );

-- System (SECURITY DEFINER functions) can insert audit logs
-- No user-facing INSERT policy - only functions can write to audit log
GRANT INSERT ON public.audit_log TO authenticated;

-- Prevent manual updates/deletes (audit logs are immutable)
-- Only allow SELECT and INSERT, no UPDATE or DELETE
REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_log FROM anon;
