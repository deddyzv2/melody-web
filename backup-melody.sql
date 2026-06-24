


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



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."characters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "role" "text",
    "personality" "text",
    "visual_notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "position_x" double precision,
    "position_y" double precision
);


ALTER TABLE "public"."characters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comic_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comic_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comic_panels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comic_page_id" "uuid" NOT NULL,
    "panel_number" integer DEFAULT 1 NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comic_panels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fragment_characters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fragment_id" "uuid" NOT NULL,
    "character_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fragment_characters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fragment_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_fragment_id" "uuid" NOT NULL,
    "to_fragment_id" "uuid" NOT NULL,
    "label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fragment_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbox_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text",
    "linked_to" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."inbox_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."progress_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "note" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."progress_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_a" "uuid",
    "character_b" "uuid",
    "relation_type" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "label_offset_x" double precision DEFAULT 0,
    "label_offset_y" double precision DEFAULT 0
);


ALTER TABLE "public"."relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "story_chapters_type_check" CHECK (("type" = ANY (ARRAY['full'::"text", 'ringkasan'::"text"])))
);


ALTER TABLE "public"."story_chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_fragments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "content" "text",
    "order_index" bigint,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "route_name" "text" DEFAULT 'Rute Utama'::"text" NOT NULL,
    "position_x" double precision DEFAULT 120 NOT NULL,
    "position_y" double precision DEFAULT 120 NOT NULL
);


ALTER TABLE "public"."story_fragments" OWNER TO "postgres";


ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comic_pages"
    ADD CONSTRAINT "comic_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comic_panels"
    ADD CONSTRAINT "comic_panels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fragment_characters"
    ADD CONSTRAINT "fragment_characters_fragment_id_character_id_key" UNIQUE ("fragment_id", "character_id");



ALTER TABLE ONLY "public"."fragment_characters"
    ADD CONSTRAINT "fragment_characters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fragment_connections"
    ADD CONSTRAINT "fragment_connections_from_fragment_id_to_fragment_id_key" UNIQUE ("from_fragment_id", "to_fragment_id");



ALTER TABLE ONLY "public"."fragment_connections"
    ADD CONSTRAINT "fragment_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbox_items"
    ADD CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."progress_log"
    ADD CONSTRAINT "progress_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_chapters"
    ADD CONSTRAINT "story_chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_fragments"
    ADD CONSTRAINT "story_fragments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comic_panels"
    ADD CONSTRAINT "comic_panels_comic_page_id_fkey" FOREIGN KEY ("comic_page_id") REFERENCES "public"."comic_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fragment_characters"
    ADD CONSTRAINT "fragment_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fragment_characters"
    ADD CONSTRAINT "fragment_characters_fragment_id_fkey" FOREIGN KEY ("fragment_id") REFERENCES "public"."story_fragments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fragment_connections"
    ADD CONSTRAINT "fragment_connections_from_fragment_id_fkey" FOREIGN KEY ("from_fragment_id") REFERENCES "public"."story_fragments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fragment_connections"
    ADD CONSTRAINT "fragment_connections_to_fragment_id_fkey" FOREIGN KEY ("to_fragment_id") REFERENCES "public"."story_fragments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_character_a_fkey" FOREIGN KEY ("character_a") REFERENCES "public"."characters"("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_character_b_fkey" FOREIGN KEY ("character_b") REFERENCES "public"."characters"("id");



CREATE POLICY "allow all" ON "public"."comic_pages" USING (true) WITH CHECK (true);



CREATE POLICY "allow all" ON "public"."comic_panels" USING (true) WITH CHECK (true);



CREATE POLICY "allow all" ON "public"."fragment_characters" USING (true) WITH CHECK (true);



CREATE POLICY "allow all" ON "public"."fragment_connections" USING (true) WITH CHECK (true);



CREATE POLICY "allow all" ON "public"."story_chapters" USING (true) WITH CHECK (true);



CREATE POLICY "allow all for now" ON "public"."characters" USING (true) WITH CHECK (true);



CREATE POLICY "allow all for now" ON "public"."inbox_items" USING (true) WITH CHECK (true);



CREATE POLICY "allow all for now" ON "public"."progress_log" USING (true) WITH CHECK (true);



CREATE POLICY "allow all for now" ON "public"."relationships" USING (true) WITH CHECK (true);



CREATE POLICY "allow all for now" ON "public"."story_fragments" USING (true) WITH CHECK (true);



ALTER TABLE "public"."characters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comic_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comic_panels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fragment_characters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fragment_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbox_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."progress_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_fragments" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT ALL ON TABLE "public"."characters" TO "anon";
GRANT ALL ON TABLE "public"."characters" TO "authenticated";
GRANT ALL ON TABLE "public"."characters" TO "service_role";



GRANT ALL ON TABLE "public"."comic_pages" TO "anon";
GRANT ALL ON TABLE "public"."comic_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."comic_pages" TO "service_role";



GRANT ALL ON TABLE "public"."comic_panels" TO "anon";
GRANT ALL ON TABLE "public"."comic_panels" TO "authenticated";
GRANT ALL ON TABLE "public"."comic_panels" TO "service_role";



GRANT ALL ON TABLE "public"."fragment_characters" TO "anon";
GRANT ALL ON TABLE "public"."fragment_characters" TO "authenticated";
GRANT ALL ON TABLE "public"."fragment_characters" TO "service_role";



GRANT ALL ON TABLE "public"."fragment_connections" TO "anon";
GRANT ALL ON TABLE "public"."fragment_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."fragment_connections" TO "service_role";



GRANT ALL ON TABLE "public"."inbox_items" TO "anon";
GRANT ALL ON TABLE "public"."inbox_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inbox_items" TO "service_role";



GRANT ALL ON TABLE "public"."progress_log" TO "anon";
GRANT ALL ON TABLE "public"."progress_log" TO "authenticated";
GRANT ALL ON TABLE "public"."progress_log" TO "service_role";



GRANT ALL ON TABLE "public"."relationships" TO "anon";
GRANT ALL ON TABLE "public"."relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."relationships" TO "service_role";



GRANT ALL ON TABLE "public"."story_chapters" TO "anon";
GRANT ALL ON TABLE "public"."story_chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."story_chapters" TO "service_role";



GRANT ALL ON TABLE "public"."story_fragments" TO "anon";
GRANT ALL ON TABLE "public"."story_fragments" TO "authenticated";
GRANT ALL ON TABLE "public"."story_fragments" TO "service_role";









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































