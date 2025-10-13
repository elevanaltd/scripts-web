-- Consolidated Production Schema Migration
-- Generated: 2025-10-13
-- Source: Production database zbxvjyrbkycbfhwmmnmy
-- Purpose: Clean baseline for local test database matching production

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_jsonschema";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "moddatetime";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- Create enum for script workflow status
CREATE TYPE public.script_workflow_status AS ENUM (
    'pend_start',
    'draft',
    'in_review',
    'rework',
    'approved',
    'reuse'
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id text PRIMARY KEY,
    title text NOT NULL,
    due_date date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    eav_code text NOT NULL UNIQUE CHECK (length(eav_code) <= 6 AND eav_code ~ '^EAV[0-9]{1,3}$'),
    client_filter text,
    project_phase text,
    final_invoice_sent timestamptz
);

-- Videos table
CREATE TABLE IF NOT EXISTS public.videos (
    id text PRIMARY KEY,
    title text NOT NULL,
    main_stream_status text,
    vo_stream_status text,
    production_type text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    eav_code text REFERENCES public.projects(eav_code)
);

-- Scripts table
CREATE TABLE IF NOT EXISTS public.scripts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id text UNIQUE REFERENCES public.videos(id) ON DELETE CASCADE,
    yjs_state bytea,
    plain_text text,
    component_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse']))
);

-- Script components table
CREATE TABLE IF NOT EXISTS public.script_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id uuid REFERENCES public.scripts(id) ON DELETE CASCADE,
    component_number integer NOT NULL,
    content text NOT NULL,
    word_count integer,
    created_at timestamptz DEFAULT now()
);

-- User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    display_name text,
    role text DEFAULT '' CHECK (role = ANY (ARRAY['admin', 'client', 'employee'])),
    created_at timestamptz DEFAULT now()
);

-- User clients table
CREATE TABLE IF NOT EXISTS public.user_clients (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    client_filter text NOT NULL,
    granted_at timestamptz DEFAULT now(),
    granted_by uuid REFERENCES auth.users(id),
    PRIMARY KEY (user_id, client_filter)
);

-- Comments table
CREATE TABLE IF NOT EXISTS public.comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    start_position integer NOT NULL CHECK (start_position >= 0),
    end_position integer NOT NULL,
    content text NOT NULL CHECK (length(content) > 0),
    parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    highlighted_text text DEFAULT '',
    deleted boolean DEFAULT false
);

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_resource text,
    details jsonb,
    status text NOT NULL CHECK (status = ANY (ARRAY['allowed', 'denied', 'error'])),
    created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_eav_code ON public.videos(eav_code);
CREATE INDEX IF NOT EXISTS idx_scripts_video_id ON public.scripts(video_id);
CREATE INDEX IF NOT EXISTS idx_scripts_status ON public.scripts(status);
CREATE INDEX IF NOT EXISTS idx_script_components_script_id ON public.script_components(script_id);
CREATE INDEX IF NOT EXISTS idx_comments_script_id ON public.comments(script_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_deleted ON public.comments(deleted);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_clients_user_id ON public.user_clients(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER handle_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_videos_updated_at
    BEFORE UPDATE ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_scripts_updated_at
    BEFORE UPDATE ON public.scripts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_comments_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create user accessible scripts view
CREATE OR REPLACE VIEW public.user_accessible_scripts AS
SELECT
    auth.uid() as user_id,
    s.id as script_id,
    CASE
        WHEN up.role = 'admin' THEN 'admin'
        WHEN up.role = 'employee' THEN 'employee'
        WHEN up.role = 'client' AND uc.user_id IS NOT NULL THEN 'client'
        ELSE NULL
    END as access_type
FROM public.scripts s
CROSS JOIN public.user_profiles up
LEFT JOIN public.videos v ON s.video_id = v.id
LEFT JOIN public.projects p ON v.eav_code = p.eav_code
LEFT JOIN public.user_clients uc ON uc.user_id = up.id AND p.client_filter = uc.client_filter
WHERE up.id = auth.uid()
    AND (
        up.role = 'admin'
        OR up.role = 'employee'
        OR (up.role = 'client' AND uc.user_id IS NOT NULL)
    );

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
BEGIN
    RETURN COALESCE((
        SELECT role
        FROM public.user_profiles
        WHERE id = auth.uid()
    ), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Function to save script with components
CREATE OR REPLACE FUNCTION public.save_script_with_components(
    p_script_id uuid,
    p_yjs_state text,
    p_plain_text text,
    p_components jsonb
)
RETURNS SETOF public.scripts AS $$
DECLARE
    v_user_role text;
    v_script_exists boolean;
    v_has_access boolean;
BEGIN
    -- Get user role
    v_user_role := public.get_user_role();

    -- Check if script exists
    SELECT EXISTS (
        SELECT 1 FROM public.scripts WHERE id = p_script_id
    ) INTO v_script_exists;

    -- Check access based on role
    IF v_user_role = 'admin' THEN
        v_has_access := true;
    ELSIF v_user_role = 'employee' THEN
        v_has_access := true;
    ELSIF v_user_role = 'client' THEN
        -- Clients can only view, not save
        v_has_access := false;
    ELSE
        v_has_access := false;
    END IF;

    -- Log the attempt
    INSERT INTO public.audit_log (user_id, action, target_resource, details, status)
    VALUES (
        auth.uid(),
        'save_script',
        p_script_id::text,
        jsonb_build_object(
            'role', v_user_role,
            'script_exists', v_script_exists
        ),
        CASE WHEN v_has_access THEN 'allowed' ELSE 'denied' END
    );

    -- Block if no access
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Unauthorized: % users cannot save scripts', v_user_role
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Update the script
    UPDATE public.scripts
    SET
        yjs_state = decode(p_yjs_state, 'base64'),
        plain_text = p_plain_text,
        component_count = jsonb_array_length(p_components),
        updated_at = now()
    WHERE id = p_script_id;

    -- Delete existing components
    DELETE FROM public.script_components WHERE script_id = p_script_id;

    -- Insert new components
    INSERT INTO public.script_components (script_id, component_number, content, word_count)
    SELECT
        p_script_id,
        (comp->>'component_number')::int,
        comp->>'content',
        (comp->>'word_count')::int
    FROM jsonb_array_elements(p_components) AS comp;

    -- Return the updated script
    RETURN QUERY SELECT * FROM public.scripts WHERE id = p_script_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Function to update script status
CREATE OR REPLACE FUNCTION public.update_script_status(
    p_script_id uuid,
    p_new_status text
)
RETURNS SETOF public.scripts AS $$
DECLARE
    v_user_role text;
    v_old_status text;
    v_has_access boolean;
BEGIN
    -- Get user role
    v_user_role := public.get_user_role();

    -- Get current status
    SELECT status INTO v_old_status
    FROM public.scripts
    WHERE id = p_script_id;

    -- Check access based on role
    IF v_user_role = 'admin' THEN
        v_has_access := true;
    ELSIF v_user_role = 'employee' THEN
        v_has_access := true;
    ELSE
        v_has_access := false;
    END IF;

    -- Log the attempt
    INSERT INTO public.audit_log (user_id, action, target_resource, details, status)
    VALUES (
        auth.uid(),
        'update_script_status',
        p_script_id::text,
        jsonb_build_object(
            'role', v_user_role,
            'old_status', v_old_status,
            'new_status', p_new_status
        ),
        CASE WHEN v_has_access THEN 'allowed' ELSE 'denied' END
    );

    -- Block if no access
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Unauthorized: % users cannot update script status', v_user_role
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Update the status
    UPDATE public.scripts
    SET
        status = p_new_status,
        updated_at = now()
    WHERE id = p_script_id;

    -- Return the updated script
    RETURN QUERY SELECT * FROM public.scripts WHERE id = p_script_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Function to cascade soft delete comments
CREATE OR REPLACE FUNCTION public.cascade_soft_delete_comments(comment_ids uuid[])
RETURNS TABLE(deleted_count integer) AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    -- Soft delete all comments and their descendants
    WITH RECURSIVE comment_tree AS (
        SELECT id FROM public.comments WHERE id = ANY(comment_ids)
        UNION ALL
        SELECT c.id FROM public.comments c
        INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
    )
    UPDATE public.comments
    SET deleted = true, updated_at = now()
    WHERE id IN (SELECT id FROM comment_tree)
    AND deleted = false;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get comment descendants
CREATE OR REPLACE FUNCTION public.get_comment_descendants(parent_id uuid)
RETURNS TABLE(id uuid) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE comment_tree AS (
        SELECT c.id FROM public.comments c WHERE c.parent_comment_id = parent_id
        UNION ALL
        SELECT c.id FROM public.comments c
        INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
    )
    SELECT comment_tree.id FROM comment_tree;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Admin users have full access to projects"
    ON public.projects FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Clients can view their projects"
    ON public.projects FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles up
        JOIN public.user_clients uc ON up.id = uc.user_id
        WHERE up.id = auth.uid()
        AND up.role = 'client'
        AND uc.client_filter = projects.client_filter
    ));

CREATE POLICY "Employees can view all projects"
    ON public.projects FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'employee'
    ));

-- RLS Policies for videos
CREATE POLICY "Admin users have full access to videos"
    ON public.videos FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Clients can view their videos"
    ON public.videos FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles up
        JOIN public.user_clients uc ON up.id = uc.user_id
        JOIN public.projects p ON p.client_filter = uc.client_filter
        WHERE up.id = auth.uid()
        AND up.role = 'client'
        AND videos.eav_code = p.eav_code
    ));

CREATE POLICY "Employees can view all videos"
    ON public.videos FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'employee'
    ));

-- RLS Policies for scripts
CREATE POLICY "Admin users have full access to scripts"
    ON public.scripts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Clients can view their scripts"
    ON public.scripts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles up
        JOIN public.user_clients uc ON up.id = uc.user_id
        JOIN public.videos v ON v.id = scripts.video_id
        JOIN public.projects p ON p.eav_code = v.eav_code
        WHERE up.id = auth.uid()
        AND up.role = 'client'
        AND p.client_filter = uc.client_filter
    ));

CREATE POLICY "Employees can manage scripts"
    ON public.scripts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'employee'
    ));

-- RLS Policies for script_components
CREATE POLICY "Admin users have full access to components"
    ON public.script_components FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Access based on script access"
    ON public.script_components FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_accessible_scripts
        WHERE script_id = script_components.script_id
        AND user_id = auth.uid()
    ));

CREATE POLICY "Employees can manage components"
    ON public.script_components FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'employee'
    ));

-- RLS Policies for user_profiles
CREATE POLICY "Users can view all profiles"
    ON public.user_profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (id = auth.uid());

-- RLS Policies for user_clients
CREATE POLICY "Admin users can manage user_clients"
    ON public.user_clients FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Users can view their own client assignments"
    ON public.user_clients FOR SELECT
    USING (user_id = auth.uid());

-- RLS Policies for comments
CREATE POLICY "Users can view non-deleted comments on accessible scripts"
    ON public.comments FOR SELECT
    USING (
        deleted = false
        AND EXISTS (
            SELECT 1 FROM public.user_accessible_scripts
            WHERE script_id = comments.script_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create comments on accessible scripts"
    ON public.comments FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.user_accessible_scripts
            WHERE script_id = comments.script_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own comments"
    ON public.comments FOR UPDATE
    USING (user_id = auth.uid() AND deleted = false)
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can soft delete own comments"
    ON public.comments FOR DELETE
    USING (user_id = auth.uid() AND deleted = false);

-- RLS Policies for audit_log
CREATE POLICY "Admin users can view all audit logs"
    ON public.audit_log FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Users can view their own audit logs"
    ON public.audit_log FOR SELECT
    USING (user_id = auth.uid());

-- Hub schema tables (if needed for testing)
CREATE SCHEMA IF NOT EXISTS hub;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;