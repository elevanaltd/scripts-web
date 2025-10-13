drop policy "Admin and employee write access" on "public"."projects";

drop policy "Authenticated users can read projects" on "public"."projects";

drop policy "Client project access" on "public"."projects";

create table "public"."user_clients" (
    "user_id" uuid not null,
    "client_filter" text not null,
    "granted_at" timestamp with time zone default now(),
    "granted_by" uuid
);


alter table "public"."user_profiles" drop column "client_filter";

alter table "public"."user_profiles" alter column "role" set default ''::text;

CREATE UNIQUE INDEX user_clients_pkey ON public.user_clients USING btree (user_id, client_filter);

alter table "public"."user_clients" add constraint "user_clients_pkey" PRIMARY KEY using index "user_clients_pkey";

alter table "public"."user_clients" add constraint "user_clients_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES auth.users(id) not valid;

alter table "public"."user_clients" validate constraint "user_clients_granted_by_fkey";

alter table "public"."user_clients" add constraint "user_clients_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."user_clients" validate constraint "user_clients_user_id_fkey";

alter table "public"."user_profiles" add constraint "user_profiles_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'client'::text]))) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_role_check";

grant delete on table "public"."user_clients" to "anon";

grant insert on table "public"."user_clients" to "anon";

grant references on table "public"."user_clients" to "anon";

grant select on table "public"."user_clients" to "anon";

grant trigger on table "public"."user_clients" to "anon";

grant truncate on table "public"."user_clients" to "anon";

grant update on table "public"."user_clients" to "anon";

grant delete on table "public"."user_clients" to "authenticated";

grant insert on table "public"."user_clients" to "authenticated";

grant references on table "public"."user_clients" to "authenticated";

grant select on table "public"."user_clients" to "authenticated";

grant trigger on table "public"."user_clients" to "authenticated";

grant truncate on table "public"."user_clients" to "authenticated";

grant update on table "public"."user_clients" to "authenticated";

grant delete on table "public"."user_clients" to "service_role";

grant insert on table "public"."user_clients" to "service_role";

grant references on table "public"."user_clients" to "service_role";

grant select on table "public"."user_clients" to "service_role";

grant trigger on table "public"."user_clients" to "service_role";

grant truncate on table "public"."user_clients" to "service_role";

grant update on table "public"."user_clients" to "service_role";

create policy "admin_full_access"
on "public"."projects"
as permissive
for all
to authenticated
using (((auth.jwt() ->> 'role'::text) = 'admin'::text))
with check (((auth.jwt() ->> 'role'::text) = 'admin'::text));


create policy "client_read_only"
on "public"."projects"
as permissive
for select
to authenticated
using ((((auth.jwt() ->> 'role'::text) = 'client'::text) AND (client_filter IN ( SELECT user_clients.client_filter
   FROM user_clients
  WHERE (user_clients.user_id = auth.uid())))));


create policy "admin_full_access"
on "public"."scripts"
as permissive
for all
to authenticated
using (((auth.jwt() ->> 'role'::text) = 'admin'::text))
with check (((auth.jwt() ->> 'role'::text) = 'admin'::text));


create policy "client_read_only"
on "public"."scripts"
as permissive
for select
to authenticated
using ((((auth.jwt() ->> 'role'::text) = 'client'::text) AND (EXISTS ( SELECT 1
   FROM (videos v
     JOIN projects p ON ((p.id = v.project_id)))
  WHERE ((v.id = scripts.video_id) AND (p.client_filter IN ( SELECT user_clients.client_filter
           FROM user_clients
          WHERE (user_clients.user_id = auth.uid()))))))));


create policy "admin_full_access"
on "public"."videos"
as permissive
for all
to authenticated
using (((auth.jwt() ->> 'role'::text) = 'admin'::text))
with check (((auth.jwt() ->> 'role'::text) = 'admin'::text));


create policy "client_read_only"
on "public"."videos"
as permissive
for select
to authenticated
using ((((auth.jwt() ->> 'role'::text) = 'client'::text) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = videos.project_id) AND (p.client_filter IN ( SELECT user_clients.client_filter
           FROM user_clients
          WHERE (user_clients.user_id = auth.uid()))))))));




