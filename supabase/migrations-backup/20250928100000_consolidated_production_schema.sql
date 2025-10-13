-- ============================================================================
-- EAV ORCHESTRATOR CONSOLIDATED PRODUCTION SCHEMA
-- ============================================================================
-- Consolidation Date: 2025-09-28
-- Production Database: zbxvjyrbkycbfhwmmnmy
-- Data Snapshot: 467 rows across 7 tables
--
-- This migration represents the complete production schema as of 2025-09-28
-- Consolidates 14 previous migrations into a single baseline for new environments
--
-- CRITICAL: This migration should NEVER be run on the production database
-- Production already has this schema. This is for new environments only.
-- ============================================================================

-- Critical-Engineer: consulted for Database schema evolution strategy
-- Implemented Safe Consolidation Protocol to avoid production schema changes

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Projects table - EAV project hierarchy
CREATE TABLE IF NOT EXISTS public.projects (
    id text PRIMARY KEY,
    title text NOT NULL,
    due_date date,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    eav_code text UNIQUE,
    client_filter text,
    project_phase text,
    CONSTRAINT projects_eav_code_check CHECK (length(eav_code) <= 6 AND eav_code ~ '^EAV[0-9]{1,3}$'::text)
);

-- Videos table - Video production items
CREATE TABLE IF NOT EXISTS public.videos (
    id text PRIMARY KEY,
    title text NOT NULL,
    main_stream_status text,
    vo_stream_status text,
    production_type text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    eav_code text,
    CONSTRAINT videos_eav_code_fkey FOREIGN KEY (eav_code) REFERENCES public.projects(eav_code) ON UPDATE CASCADE ON DELETE SET NULL
);

-- Scripts table - Script content with YJS state
CREATE TABLE IF NOT EXISTS public.scripts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id text,
    yjs_state bytea,
    plain_text text,
    component_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT scripts_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE
);

-- Script Components table - Individual paragraph components
CREATE TABLE IF NOT EXISTS public.script_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id uuid,
    component_number integer NOT NULL,
    content text NOT NULL,
    word_count integer,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT script_components_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.scripts(id) ON DELETE CASCADE,
    CONSTRAINT script_components_script_id_component_number_key UNIQUE (script_id, component_number)
);

-- User Profiles table - User management with roles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    display_name text,
    role text DEFAULT ''::text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT user_profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'client'::text]))
);

-- User Clients table - Client access control mapping
CREATE TABLE IF NOT EXISTS public.user_clients (
    user_id uuid NOT NULL,
    client_filter text NOT NULL,
    granted_at timestamptz DEFAULT now(),
    granted_by uuid,
    PRIMARY KEY (user_id, client_filter),
    CONSTRAINT user_clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
    CONSTRAINT user_clients_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_client_filter ON public.projects USING btree (client_filter);

-- Videos indexes
CREATE INDEX IF NOT EXISTS idx_videos_eav_code ON public.videos USING btree (eav_code);

-- Scripts indexes
CREATE INDEX IF NOT EXISTS idx_scripts_video_id ON public.scripts USING btree (video_id);

-- User Profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id_role ON public.user_profiles USING btree (id, role);

-- User Clients indexes
CREATE INDEX IF NOT EXISTS idx_user_clients_user_id ON public.user_clients USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_filter ON public.user_clients USING btree (client_filter);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1
$$;

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Function to ensure user profile on signup
CREATE OR REPLACE FUNCTION public.ensure_user_profile_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'admin'  -- Default to admin for development
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
    role = COALESCE(user_profiles.role, 'admin');  -- Only set if not already set

  RETURN NEW;
END;
$$;

-- Function to save script with components atomically
CREATE OR REPLACE FUNCTION public.save_script_with_components(
    p_script_id uuid,
    p_yjs_state bytea,
    p_plain_text text,
    p_components jsonb
)
RETURNS TABLE(id uuid, video_id text, yjs_state bytea, plain_text text, component_count integer, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_component_count INTEGER;
BEGIN
    -- Calculate component count
    v_component_count := COALESCE(jsonb_array_length(p_components), 0);

    -- Update the main script table
    UPDATE scripts
    SET
        yjs_state = p_yjs_state,
        plain_text = p_plain_text,
        component_count = v_component_count,
        updated_at = NOW()
    WHERE id = p_script_id;

    -- Delete old components (in transaction)
    DELETE FROM script_components WHERE script_id = p_script_id;

    -- Insert new components if any exist
    IF v_component_count > 0 THEN
        INSERT INTO script_components (script_id, component_number, content, word_count)
        SELECT
            p_script_id,
            (comp->>'number')::INTEGER,
            comp->>'content',
            (comp->>'wordCount')::INTEGER
        FROM jsonb_array_elements(p_components) AS comp;
    END IF;

    -- Return the updated script record
    RETURN QUERY SELECT * FROM scripts WHERE id = p_script_id;
END;
$$;

-- Debug function for client access troubleshooting
CREATE OR REPLACE FUNCTION public.debug_client_access(user_uuid uuid)
RETURNS TABLE(role text, client_filters text[], accessible_projects json)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH user_info AS (
    SELECT role FROM user_profiles WHERE id = user_uuid
  ),
  user_filters AS (
    SELECT array_agg(client_filter) as filters
    FROM user_clients
    WHERE user_id = user_uuid
  ),
  matching AS (
    SELECT json_agg(
      json_build_object(
        'id', p.id,
        'title', p.title,
        'client_filter', p.client_filter
      )
    ) as projects
    FROM projects p
    WHERE p.client_filter IN (
      SELECT client_filter FROM user_clients WHERE user_id = user_uuid
    )
  )
  SELECT
    (SELECT role FROM user_info),
    (SELECT filters FROM user_filters),
    (SELECT projects FROM matching);
$$;

-- Function to check client access (for debugging)
CREATE OR REPLACE FUNCTION public.check_client_access()
RETURNS TABLE(current_user_id uuid, current_user_role text, client_filters text[], can_see_user_clients boolean, can_see_projects boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    auth.uid() as current_user_id,
    (SELECT role FROM user_profiles WHERE id = auth.uid()) as current_user_role,
    ARRAY(SELECT client_filter FROM user_clients WHERE user_id = auth.uid()) as client_filters,
    EXISTS(SELECT 1 FROM user_clients WHERE user_id = auth.uid()) as can_see_user_clients,
    EXISTS(
      SELECT 1 FROM projects p
      WHERE p.client_filter IN (
        SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
      )
    ) as can_see_projects;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_clients ENABLE ROW LEVEL SECURITY;
-- Commented out: sync_metadata table doesn't exist
-- ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

-- Projects RLS Policies
CREATE POLICY "projects_admin_full_access" ON public.projects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "projects_admin_employee_all" ON public.projects
    FOR ALL USING (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))
    WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]));

CREATE POLICY "projects_client_read" ON public.projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'client'
        ) AND EXISTS (
            SELECT 1 FROM user_clients
            WHERE user_id = auth.uid() AND client_filter = projects.client_filter
        )
    );

-- Videos RLS Policies
CREATE POLICY "videos_admin_full_access" ON public.videos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "videos_admin_employee_all" ON public.videos
    FOR ALL USING (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))
    WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]));

CREATE POLICY "videos_client_read" ON public.videos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'client'
        ) AND EXISTS (
            SELECT 1 FROM projects p
            JOIN user_clients uc ON uc.client_filter = p.client_filter
            WHERE p.eav_code = videos.eav_code AND uc.user_id = auth.uid()
        )
    );

-- Scripts RLS Policies
CREATE POLICY "scripts_admin_full_access" ON public.scripts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "scripts_admin_employee_all" ON public.scripts
    FOR ALL USING (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))
    WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]));

CREATE POLICY "scripts_authenticated_select" ON public.scripts
    FOR SELECT USING (true);

CREATE POLICY "scripts_client_read" ON public.scripts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'client'
        ) AND EXISTS (
            SELECT 1 FROM videos v
            JOIN projects p ON p.eav_code = v.eav_code
            JOIN user_clients uc ON uc.client_filter = p.client_filter
            WHERE v.id = scripts.video_id AND uc.user_id = auth.uid()
        )
    );

-- Script Components RLS Policies
CREATE POLICY "components_admin_employee_all" ON public.script_components
    FOR ALL USING (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))
    WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]));

CREATE POLICY "components_client_read" ON public.script_components
    FOR SELECT USING (
        get_user_role() = 'client' AND EXISTS (
            SELECT 1 FROM scripts s
            JOIN videos v ON v.id = s.video_id
            JOIN projects p ON p.eav_code = v.eav_code
            WHERE s.id = script_components.script_id
            AND p.client_filter IN (
                SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
            )
        )
    );

-- User Profiles RLS Policies
CREATE POLICY "profiles_read_own" ON public.user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.user_profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_read_all" ON public.user_profiles
    FOR SELECT USING (get_user_role() = 'admin');

-- User Clients RLS Policies
CREATE POLICY "user_clients_read_own" ON public.user_clients
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_clients_admin_all" ON public.user_clients
    FOR ALL USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

-- Sync Metadata RLS Policies
-- Commented out: sync_metadata policy (table doesn't exist)
-- CREATE POLICY "sync_metadata_admin_employee" ON public.sync_metadata
--     FOR ALL USING (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))
--     WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Commented out: sync_metadata trigger (table doesn't exist)
-- CREATE TRIGGER update_sync_metadata_updated_at
--     BEFORE UPDATE ON public.sync_metadata
--     FOR EACH ROW
--     EXECUTE FUNCTION public.update_updated_at_column();

-- User profile creation trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_user_profile_on_signup();

-- Note: Other tables (projects, videos, scripts) do NOT have update triggers in production

-- ============================================================================
-- INITIALIZATION DATA
-- ============================================================================

-- Commented out: sync_metadata seed data (table doesn't exist)
-- INSERT INTO public.sync_metadata (id, status)
-- VALUES ('singleton', 'idle')
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SCHEMA CONSOLIDATION COMPLETE
-- ============================================================================
-- This consolidated migration replaces the following 14 migrations:
-- 20250926011650_remote_schema.sql
-- 20250926023218_remote_schema.sql
-- 20250926025738_remote_commit.sql
-- 20250926034500_fix_rls_policies.sql
-- 20250926035000_fix_rls_recursion.sql
-- 20250926040000_fix_client_select_policy.sql
-- 20250926041000_fix_user_clients_visibility.sql
-- 20250926101007_remote.sql
-- 20250927122800_remote_schema.sql
-- 20250927130000_fix_rls_auth_v2.sql
-- 20250928020000_ensure_admin_role.sql
-- 20250928021500_fix_admin_role_properly.sql
-- 20250928040000_remove_auto_admin_trigger.sql
-- 20250928041000_secure_rls_policies.sql
--
-- Total original migrations: 14
-- New consolidated migrations: 1
-- Reduction: 92.8%
-- ============================================================================