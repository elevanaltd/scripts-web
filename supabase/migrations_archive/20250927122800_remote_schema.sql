drop policy "projects_admin_all" on "public"."projects";

drop policy "projects_client_select" on "public"."projects";

drop policy "Users can manage components" on "public"."script_components";

drop policy "script_components_admin_all" on "public"."script_components";

drop policy "script_components_client_select" on "public"."script_components";

drop policy "Script access through videos" on "public"."scripts";

drop policy "Users can manage scripts" on "public"."scripts";

drop policy "scripts_admin_all" on "public"."scripts";

drop policy "scripts_client_select" on "public"."scripts";

drop policy "user_clients_own_read" on "public"."user_clients";

drop policy "Enable users to view their own data only" on "public"."user_profiles";

drop policy "Users can insert own profile" on "public"."user_profiles";

drop policy "Users can read all profiles" on "public"."user_profiles";

drop policy "Users can update own profile" on "public"."user_profiles";

drop policy "users_read_own_profile" on "public"."user_profiles";

drop policy "users_update_own_profile" on "public"."user_profiles";

drop policy "Authenticated users can read videos" on "public"."videos";

drop policy "Video access through projects" on "public"."videos";

drop policy "videos_admin_all" on "public"."videos";

drop policy "videos_client_select" on "public"."videos";

drop policy "user_clients_admin_all" on "public"."user_clients";

alter table "public"."videos" drop constraint "videos_project_id_fkey";

alter table "public"."projects" add column "project_phase" text;

alter table "public"."sync_metadata" enable row level security;

alter table "public"."videos" drop column "project_id";

alter table "public"."videos" add column "eav_code" text;

CREATE INDEX idx_videos_eav_code ON public.videos USING btree (eav_code);

alter table "public"."videos" add constraint "videos_eav_code_fkey" FOREIGN KEY (eav_code) REFERENCES projects(eav_code) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."videos" validate constraint "videos_eav_code_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1
$function$
;

create or replace view "public"."debug_user_access" as  SELECT auth.uid() AS user_id,
    get_user_role() AS user_role,
    ( SELECT array_agg(user_clients.client_filter) AS array_agg
           FROM user_clients
          WHERE (user_clients.user_id = auth.uid())) AS client_filters,
    ( SELECT count(*) AS count
           FROM projects
          WHERE ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])) OR ((get_user_role() = 'client'::text) AND (projects.client_filter IN ( SELECT user_clients.client_filter
                   FROM user_clients
                  WHERE (user_clients.user_id = auth.uid())))))) AS accessible_projects,
    ( SELECT count(*) AS count
           FROM videos v
          WHERE ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])) OR (EXISTS ( SELECT 1
                   FROM projects p
                  WHERE ((p.eav_code = v.eav_code) AND (p.client_filter IN ( SELECT user_clients.client_filter
                           FROM user_clients
                          WHERE (user_clients.user_id = auth.uid())))))))) AS accessible_videos;


create policy "projects_admin_employee_all"
on "public"."projects"
as permissive
for all
to authenticated
using ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])))
with check ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


create policy "projects_client_read"
on "public"."projects"
as permissive
for select
to authenticated
using (((get_user_role() = 'client'::text) AND (client_filter IN ( SELECT user_clients.client_filter
   FROM user_clients
  WHERE (user_clients.user_id = auth.uid())))));


create policy "components_admin_employee_all"
on "public"."script_components"
as permissive
for all
to authenticated
using ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])))
with check ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


create policy "components_client_read"
on "public"."script_components"
as permissive
for select
to authenticated
using (((get_user_role() = 'client'::text) AND (EXISTS ( SELECT 1
   FROM ((scripts s
     JOIN videos v ON ((v.id = s.video_id)))
     JOIN projects p ON ((p.eav_code = v.eav_code)))
  WHERE ((s.id = script_components.script_id) AND (p.client_filter IN ( SELECT user_clients.client_filter
           FROM user_clients
          WHERE (user_clients.user_id = auth.uid()))))))));


create policy "scripts_admin_employee_all"
on "public"."scripts"
as permissive
for all
to authenticated
using ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])))
with check ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


create policy "scripts_authenticated_select"
on "public"."scripts"
as permissive
for select
to authenticated
using (true);


create policy "scripts_client_read"
on "public"."scripts"
as permissive
for select
to authenticated
using (((get_user_role() = 'client'::text) AND (EXISTS ( SELECT 1
   FROM (videos v
     JOIN projects p ON ((p.eav_code = v.eav_code)))
  WHERE ((v.id = scripts.video_id) AND (p.client_filter IN ( SELECT user_clients.client_filter
           FROM user_clients
          WHERE (user_clients.user_id = auth.uid()))))))));


create policy "sync_metadata_admin_employee"
on "public"."sync_metadata"
as permissive
for all
to authenticated
using ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])))
with check ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


create policy "user_clients_read_own"
on "public"."user_clients"
as permissive
for select
to authenticated
using ((user_id = auth.uid()));


create policy "profiles_admin_read_all"
on "public"."user_profiles"
as permissive
for select
to authenticated
using ((get_user_role() = 'admin'::text));


create policy "profiles_read_own"
on "public"."user_profiles"
as permissive
for select
to authenticated
using ((id = auth.uid()));


create policy "profiles_update_own"
on "public"."user_profiles"
as permissive
for update
to authenticated
using ((id = auth.uid()))
with check ((id = auth.uid()));


create policy "videos_admin_employee_all"
on "public"."videos"
as permissive
for all
to authenticated
using ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])))
with check ((get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


create policy "videos_client_read"
on "public"."videos"
as permissive
for select
to authenticated
using (((get_user_role() = 'client'::text) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.eav_code = videos.eav_code) AND (p.client_filter IN ( SELECT user_clients.client_filter
           FROM user_clients
          WHERE (user_clients.user_id = auth.uid()))))))));


create policy "user_clients_admin_all"
on "public"."user_clients"
as permissive
for all
to authenticated
using ((get_user_role() = 'admin'::text))
with check ((get_user_role() = 'admin'::text));











