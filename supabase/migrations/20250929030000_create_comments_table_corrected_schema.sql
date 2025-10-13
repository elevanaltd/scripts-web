-- ============================================================================
-- COMMENTS TABLE MIGRATION - Corrected Schema
-- ============================================================================
-- Date: 2025-09-29
-- Purpose: Create Google Docs-style commenting system per ADR-003
-- Critical-Engineer: consulted for schema and security validation
-- Implements corrected schema addressing critical issues:
-- 1. Removed highlighted_text (brittle anchoring)
-- 2. Fixed CASCADE behavior for threading
-- 3. Proper RLS policy inheritance
-- ============================================================================

-- Create comments table with corrected schema
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Text anchoring (position-based only - client fetches text at render time)
    start_position INTEGER NOT NULL CHECK (start_position >= 0),
    end_position INTEGER NOT NULL CHECK (end_position >= start_position),

    -- Comment content
    content TEXT NOT NULL CHECK (length(content) > 0),

    -- Threading (SET NULL to preserve replies when parent deleted)
    parent_comment_id UUID REFERENCES public.comments(id) ON DELETE SET NULL,

    -- Resolution status
    resolved_at TIMESTAMPTZ NULL,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Performance indexes per Critical-Engineer recommendations
CREATE INDEX IF NOT EXISTS idx_comments_script_id ON public.comments(script_id);
CREATE INDEX IF NOT EXISTS idx_comments_position ON public.comments(script_id, start_position);
CREATE INDEX IF NOT EXISTS idx_comments_thread ON public.comments(parent_comment_id);

-- Optimized partial index for unresolved comments (most common query)
CREATE INDEX IF NOT EXISTS idx_comments_unresolved ON public.comments(script_id)
WHERE resolved_at IS NULL;

-- Index for resolved comments (less common but still needed)
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON public.comments(script_id, resolved_at)
WHERE resolved_at IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Comments inherit script access permissions via RLS
-- Admin: full access, Client: read-only for their projects

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Admin users: full access to all comments
CREATE POLICY "comments_admin_full_access" ON public.comments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
);

-- Client users: read comments from scripts in their assigned projects
CREATE POLICY "comments_client_read" ON public.comments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
    AND EXISTS (
        SELECT 1
        FROM public.scripts s
        JOIN public.videos v ON v.id = s.video_id
        JOIN public.projects p ON p.eav_code = v.eav_code
        JOIN public.user_clients uc ON uc.client_filter = p.client_filter
        WHERE s.id = comments.script_id
        AND uc.user_id = auth.uid()
    )
);

-- Employee users: full access like admins (for internal team)
CREATE POLICY "comments_employee_full_access" ON public.comments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'employee'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'employee'
    )
);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users (RLS policies control actual access)
GRANT ALL ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;