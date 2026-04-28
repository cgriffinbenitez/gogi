


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






CREATE TYPE "public"."assignment_status" AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE "public"."assignment_status" OWNER TO "postgres";


CREATE TYPE "public"."scaffold_level" AS ENUM (
    'high',
    'medium',
    'low'
);


ALTER TYPE "public"."scaffold_level" OWNER TO "postgres";


CREATE TYPE "public"."submission_status" AS ENUM (
    'not_started',
    'in_progress',
    'submitted',
    'graded'
);


ALTER TYPE "public"."submission_status" OWNER TO "postgres";


CREATE TYPE "public"."task_type" AS ENUM (
    'theme',
    'evidence',
    'reasoning'
);


ALTER TYPE "public"."task_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'student',
    'teacher',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_teach_phase"("p_session_id" "uuid", "p_phase" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE sessions
  SET teach_phase_completed = array_append(
    COALESCE(teach_phase_completed, ARRAY[]::text[]),
    p_phase
  )
  WHERE id = p_session_id
    AND NOT (p_phase = ANY(COALESCE(teach_phase_completed, ARRAY[]::text[])));
END;
$$;


ALTER FUNCTION "public"."append_teach_phase"("p_session_id" "uuid", "p_phase" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."array_append_unique"("arr" "text"[], "val" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT array_agg(DISTINCT elem)
  FROM unnest(arr || ARRAY[val]) AS elem
$$;


ALTER FUNCTION "public"."array_append_unique"("arr" "text"[], "val" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_session_last_active"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.last_active_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bump_session_last_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_student_self_registration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Allow service-role operations (admin creating teachers) to pass through
  -- Block any attempt to self-register as teacher or admin
  IF NEW.role IN ('teacher', 'admin') THEN
    -- Check if this is being called from a privileged context
    -- auth.uid() is NULL during service-role inserts (migration/admin API)
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Self-registration is only available for students. Teacher and admin accounts must be created by a school administrator.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_student_self_registration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT COALESCE(
        (auth.jwt() ->> 'role'),
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
        'student'
    )
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment"("x" integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$ SELECT x + 1 $$;


ALTER FUNCTION "public"."increment"("x" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT public.get_my_role() = 'admin'
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_teacher_or_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT public.get_my_role() IN ('teacher', 'admin')
$$;


ALTER FUNCTION "public"."is_teacher_or_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_exit_diagnostic_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.phase = 'exit_diagnostic' AND NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    UPDATE students
    SET exit_diagnostic_complete = true
    WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_exit_diagnostic_complete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_reading_profile_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE students
  SET reading_profile_complete = true
  WHERE id = NEW.student_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_reading_profile_complete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_standard_mastered"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF array_length(NEW.gaps_addressed, 1) IS NOT NULL
     AND array_length(NEW.gaps_identified, 1) IS NOT NULL
     AND array_length(NEW.gaps_addressed, 1) = array_length(NEW.gaps_identified, 1)
     AND NEW.mastered_at IS NULL THEN
    NEW.mastered_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_standard_mastered"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cognitive_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "administered_at" timestamp with time zone DEFAULT "now"(),
    "administered_by" "text" DEFAULT 'self'::"text",
    "working_memory_r1" integer,
    "working_memory_r2" integer,
    "working_memory_r3" integer,
    "working_memory_score" numeric,
    "inferencing_score" numeric,
    "vocab_breadth_score" numeric,
    "syntax_score" numeric,
    "overall_risk" "text",
    "raw_responses" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "vocab_contamination_signal" boolean
);


ALTER TABLE "public"."cognitive_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inferencing_strategies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "strategy_code" "text",
    "strategy_name" "text",
    "opening_line" "text",
    "guiding_question_1" "text",
    "guiding_question_2" "text",
    "guiding_question_3" "text",
    "hint_text" "text",
    "explanation_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inferencing_strategies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervention_passages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classification" "text" NOT NULL,
    "paragraph_text" "text" NOT NULL,
    "word_count" integer NOT NULL,
    "source" "text" DEFAULT 'gutenberg'::"text" NOT NULL,
    "source_title" "text",
    "source_author" "text",
    "source_year" integer,
    "source_gutenberg_id" integer,
    "canonical_answer" "text",
    "distractors" "text"[],
    "keyword_flags" "text"[],
    "difficulty_tier" integer,
    "approved" boolean DEFAULT false NOT NULL,
    "reviewed_at" timestamp without time zone,
    "reviewed_by" "uuid",
    "rejection_reason" "text",
    "paragraph_hash" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "target_signal" "text",
    "item_patterns_supported" "text"[],
    "supporting_evidence" "jsonb",
    "non_supporting_evidence" "jsonb",
    "dominant_concept" "text",
    "plausible_distractors" "text"[],
    "craft_features" "jsonb",
    "discrimination_item_type" "text",
    "intervention_tier" integer,
    "tier_rationale" "text",
    "pipeline_version" "text" DEFAULT 'v2'::"text",
    "q5_flag_5e_compatible" boolean DEFAULT false,
    "paragraph_count" integer DEFAULT 1,
    "approval_status" "text" DEFAULT 'pending_review'::"text",
    "question_generated" boolean DEFAULT false,
    "tagger_tier" integer,
    CONSTRAINT "intervention_passages_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending_review'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "intervention_passages_difficulty_tier_check" CHECK (("difficulty_tier" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "intervention_passages_intervention_tier_check" CHECK ((("intervention_tier" >= 1) AND ("intervention_tier" <= 4)))
);


ALTER TABLE "public"."intervention_passages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."intervention_passages"."question_generated" IS 'Set to TRUE by promotePassagesToQuestions.ts after a row is successfully inserted into the questions table from this passage.';



CREATE TABLE IF NOT EXISTS "public"."passage_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "standard_id" "uuid",
    "passage_title" "text",
    "chunk_number" integer,
    "chunk_text" "text",
    "rung_type" "text",
    "question_stem" "text",
    "option_a_text" "text",
    "option_a_class" "text",
    "option_a_strategy" "text",
    "option_b_text" "text",
    "option_b_class" "text",
    "option_b_strategy" "text",
    "option_c_text" "text",
    "option_c_class" "text",
    "option_c_strategy" "text",
    "option_d_text" "text",
    "option_d_class" "text",
    "option_d_strategy" "text",
    "correct_option" "text",
    "rationale" "text",
    "approved" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."passage_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "standard_id" "uuid",
    "content" "text" NOT NULL,
    "cognitive_skill_targeted" "text" NOT NULL,
    "difficulty_level" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text",
    "author" "text",
    "pub_year" "text",
    "keyword_flags" "jsonb" DEFAULT '[]'::"jsonb",
    "option_a_text" "text",
    "option_b_text" "text",
    "option_c_text" "text",
    "option_d_text" "text",
    "option_a_class" "text",
    "option_b_class" "text",
    "option_c_class" "text",
    "option_d_class" "text",
    "correct_option" "text",
    "approved" boolean DEFAULT false,
    "rationale" "text",
    "flagged" boolean DEFAULT false,
    "option_a_strategy" "text",
    "option_b_strategy" "text",
    "option_c_strategy" "text",
    "option_d_strategy" "text",
    "pipeline_source" "text" DEFAULT 'legacy'::"text",
    "source_classification" "text",
    CONSTRAINT "questions_pipeline_source_check" CHECK (("pipeline_source" = ANY (ARRAY['legacy'::"text", 'v3_promoted'::"text"])))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."questions"."pipeline_source" IS 'Provenance marker. ''legacy'' = pre-v3 pipeline. ''v3_promoted'' = inserted by promotePassagesToQuestions.ts from intervention_passages. Orthogonal to approved/flagged.';



COMMENT ON COLUMN "public"."questions"."source_classification" IS 'For v3_promoted rows: the GOGI primitive classification code from the source passage (e.g. ''tone_misreading'', ''inferencing''). NULL for legacy rows.';



CREATE TABLE IF NOT EXISTS "public"."reassess_passages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "standard_id" "uuid",
    "passage_text" "text" NOT NULL,
    "questions" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reassess_passages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "question_id" "uuid",
    "student_id" "uuid",
    "standard_id" "uuid",
    "cognitive_skill_targeted" "text" NOT NULL,
    "diagnostic_classification" "text",
    "intervention_type" "text",
    "intervention_content" "text",
    "student_response" "text" NOT NULL,
    "mastery_achieved" boolean DEFAULT false,
    "attempt_number" integer DEFAULT 1,
    "ai_feedback" "text",
    "teacher_override" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "time_on_step_seconds" integer,
    "time_on_question_seconds" integer,
    "scaffolds_used" boolean,
    "hint_viewed" boolean,
    "scaffold_level" "text"
);


ALTER TABLE "public"."responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schema_interventions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "student_id" "uuid",
    "standard_id" "uuid",
    "question_id" "uuid",
    "schema_mode" "text" NOT NULL,
    "trigger_reason" "text",
    "demand_score" numeric,
    "generated_payload" "jsonb" NOT NULL,
    "model_version" "text",
    "delivered_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schema_interventions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schema_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schema_intervention_id" "uuid",
    "student_id" "uuid",
    "student_response" "text" NOT NULL,
    "response_quality_score" integer DEFAULT 0,
    "readiness_score" integer DEFAULT 0,
    "misconception_detected" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schema_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "standard_id" "uuid",
    "phase" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "mastery_achieved" boolean DEFAULT false,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "time_spent_seconds" integer,
    "dominant_classification" "text",
    "diagnostic_question_id" "uuid",
    "session_number" integer DEFAULT 1,
    "diagnostic_question_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "classification_confidence" numeric,
    "needs_teacher_review" boolean DEFAULT false,
    "override_source" "text",
    "gap_classifications" "text"[] DEFAULT '{}'::"text"[],
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "teach_phase_completed" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."standard_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "standard_id" "uuid",
    "sessions_passed" integer DEFAULT 0,
    "sessions_attempted" integer DEFAULT 0,
    "current_status" "text" DEFAULT 'not_started'::"text",
    "last_session_at" timestamp with time zone,
    "mastered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "failed_turns" integer DEFAULT 0,
    "reclassification_count" integer DEFAULT 0,
    "previous_classification" "text",
    "teacher_flag" boolean DEFAULT false,
    "teacher_flag_reason" "text",
    "seen_passage_titles" "text"[] DEFAULT '{}'::"text"[],
    "gaps_identified" "text"[] DEFAULT '{}'::"text"[],
    "gaps_addressed" "text"[] DEFAULT '{}'::"text"[],
    "current_gap" "text"
);


ALTER TABLE "public"."standard_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."standards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "cognitive_domain" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."standards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid",
    "full_name" "text" NOT NULL,
    "grade_level" integer DEFAULT 9,
    "fast_pm1_score" integer,
    "fast_pm2_score" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "reading_profile_complete" boolean DEFAULT false,
    "fast_pm1" integer,
    "fast_pm2" integer,
    "fast_target" integer,
    "teacher_notes" "text",
    "consent_on_file" boolean DEFAULT false NOT NULL,
    "consent_signed_date" "date",
    "consent_signed_by" "text",
    "assent_on_file" boolean DEFAULT false NOT NULL,
    "assent_signed_date" "date",
    "cohort_group" "text",
    "exit_diagnostic_complete" boolean DEFAULT false NOT NULL,
    CONSTRAINT "students_cohort_group_check" CHECK ((("cohort_group" = ANY (ARRAY['A'::"text", 'B'::"text"])) OR ("cohort_group" IS NULL)))
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "school" "text",
    "district" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "is_admin" boolean DEFAULT false
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vocab_cache" (
    "word" "text" NOT NULL,
    "part_of_speech" "text",
    "definition" "text",
    "example" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vocab_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vocab_readiness" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "standard_id" "uuid",
    "coverage_score" numeric,
    "words_known" integer,
    "words_maybe" integer,
    "words_unknown" integer,
    "word_results" "jsonb",
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vocab_readiness" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cognitive_profiles"
    ADD CONSTRAINT "cognitive_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inferencing_strategies"
    ADD CONSTRAINT "inferencing_strategies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inferencing_strategies"
    ADD CONSTRAINT "inferencing_strategies_strategy_code_key" UNIQUE ("strategy_code");



ALTER TABLE ONLY "public"."intervention_passages"
    ADD CONSTRAINT "intervention_passages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."passage_chunks"
    ADD CONSTRAINT "passage_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reassess_passages"
    ADD CONSTRAINT "reassess_passages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reassess_passages"
    ADD CONSTRAINT "reassess_passages_student_id_standard_id_key" UNIQUE ("student_id", "standard_id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_interventions"
    ADD CONSTRAINT "schema_interventions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_responses"
    ADD CONSTRAINT "schema_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."standard_progress"
    ADD CONSTRAINT "standard_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."standard_progress"
    ADD CONSTRAINT "standard_progress_student_id_standard_id_key" UNIQUE ("student_id", "standard_id");



ALTER TABLE ONLY "public"."standards"
    ADD CONSTRAINT "standards_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."standards"
    ADD CONSTRAINT "standards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vocab_cache"
    ADD CONSTRAINT "vocab_cache_pkey" PRIMARY KEY ("word");



ALTER TABLE ONLY "public"."vocab_readiness"
    ADD CONSTRAINT "vocab_readiness_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vocab_readiness"
    ADD CONSTRAINT "vocab_readiness_student_id_standard_id_key" UNIQUE ("student_id", "standard_id");



CREATE INDEX "idx_passages_promotion_queue" ON "public"."intervention_passages" USING "btree" ("created_at") WHERE (("approval_status" = 'approved'::"text") AND ("pipeline_version" = ANY (ARRAY['v3'::"text", 'v4'::"text"])) AND ("question_generated" IS NOT TRUE));



CREATE INDEX "idx_passages_tier_class" ON "public"."intervention_passages" USING "btree" ("classification", "intervention_tier", "approved") WHERE ("approved" = true);



CREATE INDEX "idx_questions_source" ON "public"."questions" USING "btree" ("pipeline_source", "approved", "flagged");



CREATE INDEX "intervention_passages_approved_idx" ON "public"."intervention_passages" USING "btree" ("approved");



CREATE INDEX "intervention_passages_classification_idx" ON "public"."intervention_passages" USING "btree" ("classification");



CREATE UNIQUE INDEX "intervention_passages_source_gutenberg_id_paragraph_hash_idx" ON "public"."intervention_passages" USING "btree" ("source_gutenberg_id", "paragraph_hash");



CREATE OR REPLACE TRIGGER "trg_bump_session_last_active" BEFORE UPDATE OF "phase", "completed_at", "mastery_achieved", "time_spent_seconds", "dominant_classification", "teach_phase_completed" ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."bump_session_last_active"();



CREATE OR REPLACE TRIGGER "trg_mark_exit_diagnostic_complete" AFTER UPDATE OF "completed_at" ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."mark_exit_diagnostic_complete"();



CREATE OR REPLACE TRIGGER "trg_mark_reading_profile_complete" AFTER INSERT ON "public"."cognitive_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."mark_reading_profile_complete"();



CREATE OR REPLACE TRIGGER "trg_mark_standard_mastered" BEFORE UPDATE OF "gaps_addressed" ON "public"."standard_progress" FOR EACH ROW EXECUTE FUNCTION "public"."mark_standard_mastered"();



ALTER TABLE ONLY "public"."cognitive_profiles"
    ADD CONSTRAINT "cognitive_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."passage_chunks"
    ADD CONSTRAINT "passage_chunks_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reassess_passages"
    ADD CONSTRAINT "reassess_passages_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id");



ALTER TABLE ONLY "public"."reassess_passages"
    ADD CONSTRAINT "reassess_passages_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."schema_interventions"
    ADD CONSTRAINT "schema_interventions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id");



ALTER TABLE ONLY "public"."schema_interventions"
    ADD CONSTRAINT "schema_interventions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."schema_interventions"
    ADD CONSTRAINT "schema_interventions_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id");



ALTER TABLE ONLY "public"."schema_interventions"
    ADD CONSTRAINT "schema_interventions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."schema_responses"
    ADD CONSTRAINT "schema_responses_schema_intervention_id_fkey" FOREIGN KEY ("schema_intervention_id") REFERENCES "public"."schema_interventions"("id");



ALTER TABLE ONLY "public"."schema_responses"
    ADD CONSTRAINT "schema_responses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."standard_progress"
    ADD CONSTRAINT "standard_progress_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id");



ALTER TABLE ONLY "public"."standard_progress"
    ADD CONSTRAINT "standard_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vocab_readiness"
    ADD CONSTRAINT "vocab_readiness_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id");



ALTER TABLE ONLY "public"."vocab_readiness"
    ADD CONSTRAINT "vocab_readiness_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



CREATE POLICY "Standards readable by all authenticated" ON "public"."standards" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Students can insert own responses" ON "public"."responses" FOR INSERT WITH CHECK (("auth"."uid"() = ( SELECT "students"."user_id"
   FROM "public"."students"
  WHERE ("students"."id" = "responses"."student_id"))));



CREATE POLICY "Students can insert own sessions" ON "public"."sessions" FOR INSERT WITH CHECK (("auth"."uid"() = ( SELECT "students"."user_id"
   FROM "public"."students"
  WHERE ("students"."id" = "sessions"."student_id"))));



CREATE POLICY "Students can read own sessions" ON "public"."sessions" FOR SELECT USING (("auth"."uid"() = ( SELECT "students"."user_id"
   FROM "public"."students"
  WHERE ("students"."id" = "sessions"."student_id"))));



CREATE POLICY "Students can see own record" ON "public"."students" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Students can update own sessions" ON "public"."sessions" FOR UPDATE USING (("auth"."uid"() = ( SELECT "students"."user_id"
   FROM "public"."students"
  WHERE ("students"."id" = "sessions"."student_id"))));



CREATE POLICY "Teachers see own data" ON "public"."users" USING (("auth"."uid"() = "id"));



CREATE POLICY "Teachers see own questions" ON "public"."questions" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Teachers see own responses" ON "public"."responses" USING (("auth"."uid"() = ( SELECT "students"."teacher_id"
   FROM "public"."students"
  WHERE ("students"."id" = "responses"."student_id"))));



CREATE POLICY "Teachers see own sessions" ON "public"."sessions" USING (("auth"."uid"() = ( SELECT "students"."teacher_id"
   FROM "public"."students"
  WHERE ("students"."id" = "sessions"."student_id"))));



CREATE POLICY "Teachers see own students" ON "public"."students" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "authenticated_read_approved" ON "public"."intervention_passages" FOR SELECT TO "authenticated" USING (("approved" = true));



ALTER TABLE "public"."cognitive_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervention_passages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schema_interventions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schema_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."standard_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."standards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "students insert own responses" ON "public"."responses" FOR INSERT TO "authenticated" WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



CREATE POLICY "students manage own profile" ON "public"."cognitive_profiles" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



CREATE POLICY "students manage own progress" ON "public"."standard_progress" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"())))) WITH CHECK (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



CREATE POLICY "students manage own schema interventions" ON "public"."schema_interventions" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



CREATE POLICY "students manage own schema responses" ON "public"."schema_responses" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



CREATE POLICY "students manage own vocab readiness" ON "public"."vocab_readiness" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



CREATE POLICY "students read own responses" ON "public"."responses" FOR SELECT TO "authenticated" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



CREATE POLICY "teachers read own students profiles" ON "public"."cognitive_profiles" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."teacher_id" = "auth"."uid"()))));



CREATE POLICY "teachers read own students responses" ON "public"."responses" FOR SELECT TO "authenticated" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."teacher_id" IN ( SELECT "users"."id"
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'teacher'::"text")))))));



CREATE POLICY "teachers read own students vocab readiness" ON "public"."vocab_readiness" FOR SELECT USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."teacher_id" = "auth"."uid"()))));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vocab_readiness" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."append_teach_phase"("p_session_id" "uuid", "p_phase" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."append_teach_phase"("p_session_id" "uuid", "p_phase" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_teach_phase"("p_session_id" "uuid", "p_phase" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."array_append_unique"("arr" "text"[], "val" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."array_append_unique"("arr" "text"[], "val" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_append_unique"("arr" "text"[], "val" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_session_last_active"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_session_last_active"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_session_last_active"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_student_self_registration"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_student_self_registration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_student_self_registration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment"("x" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment"("x" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment"("x" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_teacher_or_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_teacher_or_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_teacher_or_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_exit_diagnostic_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_exit_diagnostic_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_exit_diagnostic_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_reading_profile_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_reading_profile_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_reading_profile_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_standard_mastered"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_standard_mastered"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_standard_mastered"() TO "service_role";


















GRANT ALL ON TABLE "public"."cognitive_profiles" TO "anon";
GRANT ALL ON TABLE "public"."cognitive_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."cognitive_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."inferencing_strategies" TO "anon";
GRANT ALL ON TABLE "public"."inferencing_strategies" TO "authenticated";
GRANT ALL ON TABLE "public"."inferencing_strategies" TO "service_role";



GRANT ALL ON TABLE "public"."intervention_passages" TO "anon";
GRANT ALL ON TABLE "public"."intervention_passages" TO "authenticated";
GRANT ALL ON TABLE "public"."intervention_passages" TO "service_role";



GRANT ALL ON TABLE "public"."passage_chunks" TO "anon";
GRANT ALL ON TABLE "public"."passage_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."passage_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."reassess_passages" TO "anon";
GRANT ALL ON TABLE "public"."reassess_passages" TO "authenticated";
GRANT ALL ON TABLE "public"."reassess_passages" TO "service_role";



GRANT ALL ON TABLE "public"."responses" TO "anon";
GRANT ALL ON TABLE "public"."responses" TO "authenticated";
GRANT ALL ON TABLE "public"."responses" TO "service_role";



GRANT ALL ON TABLE "public"."schema_interventions" TO "anon";
GRANT ALL ON TABLE "public"."schema_interventions" TO "authenticated";
GRANT ALL ON TABLE "public"."schema_interventions" TO "service_role";



GRANT ALL ON TABLE "public"."schema_responses" TO "anon";
GRANT ALL ON TABLE "public"."schema_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."schema_responses" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."standard_progress" TO "anon";
GRANT ALL ON TABLE "public"."standard_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."standard_progress" TO "service_role";



GRANT ALL ON TABLE "public"."standards" TO "anon";
GRANT ALL ON TABLE "public"."standards" TO "authenticated";
GRANT ALL ON TABLE "public"."standards" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_cache" TO "anon";
GRANT ALL ON TABLE "public"."vocab_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_cache" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_readiness" TO "anon";
GRANT ALL ON TABLE "public"."vocab_readiness" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_readiness" TO "service_role";









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































