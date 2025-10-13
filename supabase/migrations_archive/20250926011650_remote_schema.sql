


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    INSERT INTO public.user_profiles (id, email, role, display_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
  EXCEPTION
    WHEN unique_violation THEN
      -- User already exists (shouldn't happen but be safe)
      RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."scripts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "text",
    "yjs_state" "bytea",
    "plain_text" "text",
    "component_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scripts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "bytea", "p_plain_text" "text", "p_components" "jsonb") RETURNS TABLE("like" "public"."scripts")
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "bytea", "p_plain_text" "text", "p_components" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "eav_code" "text" NOT NULL,
    "client_filter" "text",
    CONSTRAINT "projects_eav_code_check" CHECK ((("length"("eav_code") <= 6) AND ("eav_code" ~ '^EAV[0-9]{1,3}$'::"text")))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."eav_code" IS 'EAV code from Project';



CREATE OR REPLACE VIEW "public"."available_clients" AS
 SELECT DISTINCT "client_filter" AS "name"
   FROM "public"."projects"
  WHERE ("client_filter" IS NOT NULL)
  ORDER BY "client_filter";


ALTER VIEW "public"."available_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."script_components" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "script_id" "uuid",
    "component_number" integer NOT NULL,
    "content" "text" NOT NULL,
    "word_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."script_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_metadata" (
    "id" "text" DEFAULT 'singleton'::"text" NOT NULL,
    "status" "text" DEFAULT 'idle'::"text",
    "last_sync_started_at" timestamp with time zone,
    "last_sync_completed_at" timestamp with time zone,
    "last_error" "text",
    "sync_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sync_metadata_singleton_check" CHECK (("id" = 'singleton'::"text")),
    CONSTRAINT "sync_metadata_status_check" CHECK (("status" = ANY (ARRAY['idle'::"text", 'running'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."sync_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "role" "text" DEFAULT 'viewer'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_filter" "text"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."videos" (
    "id" "text" NOT NULL,
    "project_id" "text",
    "title" "text" NOT NULL,
    "main_stream_status" "text",
    "vo_stream_status" "text",
    "production_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."videos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_eav_code_key" UNIQUE ("eav_code");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_script_id_component_number_key" UNIQUE ("script_id", "component_number");



ALTER TABLE ONLY "public"."scripts"
    ADD CONSTRAINT "scripts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_metadata"
    ADD CONSTRAINT "sync_metadata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "update_sync_metadata_updated_at" BEFORE UPDATE ON "public"."sync_metadata" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scripts"
    ADD CONSTRAINT "scripts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



CREATE POLICY "Admin and employee write access" ON "public"."projects" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'employee'::"text"]))) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



CREATE POLICY "Authenticated users can read projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read videos" ON "public"."videos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Client project access" ON "public"."projects" FOR SELECT TO "authenticated" USING (
CASE
    WHEN (("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text") THEN true
    WHEN (("auth"."jwt"() ->> 'role'::"text") = 'employee'::"text") THEN true
    WHEN (("auth"."jwt"() ->> 'role'::"text") = 'client'::"text") THEN ("client_filter" = ANY ("string_to_array"(("auth"."jwt"() ->> 'client_filter'::"text"), ','::"text")))
    ELSE false
END);



CREATE POLICY "Enable users to view their own data only" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Script access through videos" ON "public"."scripts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."videos"
  WHERE ("videos"."id" = "scripts"."video_id"))));



CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage components" ON "public"."script_components" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can manage scripts" ON "public"."scripts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can read all profiles" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Video access through projects" ON "public"."videos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE ("projects"."id" = "videos"."project_id"))));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."script_components" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scripts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."scripts" TO "anon";
GRANT ALL ON TABLE "public"."scripts" TO "authenticated";
GRANT ALL ON TABLE "public"."scripts" TO "service_role";



GRANT ALL ON FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "bytea", "p_plain_text" "text", "p_components" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "bytea", "p_plain_text" "text", "p_components" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "bytea", "p_plain_text" "text", "p_components" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."available_clients" TO "anon";
GRANT ALL ON TABLE "public"."available_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."available_clients" TO "service_role";



GRANT ALL ON TABLE "public"."script_components" TO "anon";
GRANT ALL ON TABLE "public"."script_components" TO "authenticated";
GRANT ALL ON TABLE "public"."script_components" TO "service_role";



GRANT ALL ON TABLE "public"."sync_metadata" TO "anon";
GRANT ALL ON TABLE "public"."sync_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."videos" TO "anon";
GRANT ALL ON TABLE "public"."videos" TO "authenticated";
GRANT ALL ON TABLE "public"."videos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


