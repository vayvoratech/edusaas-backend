-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "education";

-- CreateEnum
CREATE TYPE "education"."community_post_status" AS ENUM ('Draft', 'Published', 'Archived', 'Flagged');

-- CreateEnum
CREATE TYPE "education"."community_post_type" AS ENUM ('Discussion', 'Question', 'Course', 'Announcement', 'Job', 'Internship', 'Project', 'Achievement', 'Event');

-- CreateEnum
CREATE TYPE "education"."community_reaction_type" AS ENUM ('Like', 'Celebrate', 'Support', 'Insightful');

-- CreateEnum
CREATE TYPE "education"."community_visibility" AS ENUM ('Public', 'Students', 'Educators', 'Employers', 'Admins');

-- CreateTable
CREATE TABLE "education"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "last_login" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domain_role_id" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "education"."profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "career_goal" TEXT,
    "institution" TEXT,
    "company" TEXT,
    "preferences" JSONB,
    "initial_assessment_completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "answers" JSONB,
    "date_taken" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "career_goal" TEXT,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "total_marks" INTEGER,
    "obtained_marks" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."gap_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "readiness_score" DOUBLE PRECISION NOT NULL,
    "missing_skills" TEXT[],
    "recommendations" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gap_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "provider" VARCHAR(255),
    "category" VARCHAR(255),
    "difficulty" VARCHAR(50),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "educator_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "completion_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enrolled_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employer_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "requirements" TEXT,
    "required_skills" TEXT[],
    "status" VARCHAR(50) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'submitted',
    "skill_match" DOUBLE PRECISION,
    "applied_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "read_status" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan_type" VARCHAR(100) NOT NULL,
    "start_date" TIMESTAMP(6) NOT NULL,
    "end_date" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "generated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exported_at" TIMESTAMP(6),
    "format" VARCHAR(50),
    "payload" JSONB,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" VARCHAR(100) NOT NULL DEFAULT 'system',
    "key" VARCHAR(255) NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."lessons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "video_url" TEXT,
    "duration" INTEGER,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."quizzes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "questions" JSONB NOT NULL,
    "passing_score" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "instructions" TEXT,
    "submission_link" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "watched_duration" INTEGER NOT NULL DEFAULT 0,
    "quiz_score" INTEGER,
    "assignment_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "completion_flag" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "certificate_code" VARCHAR(255) NOT NULL,
    "issued_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."achievements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "badge_name" VARCHAR(255) NOT NULL,
    "milestone" TEXT,
    "certificate_id" UUID,
    "earned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "due_date" TIMESTAMP(6),
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "educator_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "audience" VARCHAR(100) NOT NULL DEFAULT 'all',
    "scheduled_at" TIMESTAMP(6),
    "attachment" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."auth_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(6),

    CONSTRAINT "auth_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."domain_roles" (
    "domain_role_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "domain_name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_roles_pkey" PRIMARY KEY ("domain_role_id")
);

-- CreateTable
CREATE TABLE "education"."skills" (
    "skill_id" SERIAL NOT NULL,
    "skill_name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50),
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("skill_id")
);

-- CreateTable
CREATE TABLE "education"."domain_required_skills" (
    "domain_required_skill_id" SERIAL NOT NULL,
    "domain_role_id" UUID NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "required_level" SMALLINT NOT NULL,

    CONSTRAINT "domain_required_skills_pkey" PRIMARY KEY ("domain_required_skill_id")
);

-- CreateTable
CREATE TABLE "education"."difficulty_levels" (
    "difficulty_id" SERIAL NOT NULL,
    "difficulty_name" VARCHAR(20) NOT NULL,
    "difficulty_order" INTEGER NOT NULL,

    CONSTRAINT "difficulty_levels_pkey" PRIMARY KEY ("difficulty_id")
);

-- CreateTable
CREATE TABLE "education"."questions" (
    "question_id" SERIAL NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "difficulty_id" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "option_a" TEXT NOT NULL,
    "option_b" TEXT NOT NULL,
    "option_c" TEXT NOT NULL,
    "option_d" TEXT NOT NULL,
    "correct_option" CHAR(1) NOT NULL,
    "marks" INTEGER DEFAULT 1,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "education"."quiz_sessions" (
    "session_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "domain_role_id" UUID NOT NULL,
    "start_time" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMP(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'In Progress',
    "total_questions" INTEGER NOT NULL DEFAULT 50,
    "questions_answered" INTEGER NOT NULL DEFAULT 0,
    "current_skill_id" INTEGER,

    CONSTRAINT "quiz_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "education"."student_answers" (
    "answer_id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "difficulty_id" INTEGER NOT NULL,
    "selected_option" CHAR(1) NOT NULL,
    "correct_option" CHAR(1) NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "marks_awarded" INTEGER NOT NULL DEFAULT 0,
    "answered_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_answers_pkey" PRIMARY KEY ("answer_id")
);

-- CreateTable
CREATE TABLE "education"."student_skill_results" (
    "result_id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "obtained_score" INTEGER NOT NULL,
    "maximum_score" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "skill_level" SMALLINT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_skill_results_pkey" PRIMARY KEY ("result_id")
);

-- CreateTable
CREATE TABLE "education"."quiz_state" (
    "session_id" INTEGER NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "current_difficulty" INTEGER DEFAULT 1,
    "correct_streak" INTEGER DEFAULT 0,
    "wrong_streak" INTEGER DEFAULT 0,
    "questions_answered" INTEGER DEFAULT 0,
    "obtained_score" INTEGER DEFAULT 0,
    "maximum_score" INTEGER DEFAULT 0,
    "state" JSONB,

    CONSTRAINT "quiz_state_pkey" PRIMARY KEY ("session_id","skill_id")
);

-- CreateTable
CREATE TABLE "education"."community_bookmarks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."community_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" TEXT NOT NULL,
    "reactions_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."community_post_tags" (
    "post_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_community_post_tags" PRIMARY KEY ("post_id","tag_id")
);

-- CreateTable
CREATE TABLE "education"."community_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "author_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "post_type" "education"."community_post_type" NOT NULL,
    "status" "education"."community_post_status" NOT NULL DEFAULT 'Published',
    "visibility" "education"."community_visibility" NOT NULL DEFAULT 'Public',
    "media_url" TEXT,
    "metadata" JSONB,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "reactions_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."community_reactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "post_id" UUID,
    "comment_id" UUID,
    "reaction_type" "education"."community_reaction_type" NOT NULL DEFAULT 'Like',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education"."community_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "education"."users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "education"."users"("role_id");

-- CreateIndex
CREATE INDEX "users_domain_role_id_idx" ON "education"."users"("domain_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "education"."roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "education"."permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "education"."profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_assessment_user" ON "education"."assessments"("user_id");

-- CreateIndex
CREATE INDEX "idx_gapreport_user" ON "education"."gap_reports"("user_id");

-- CreateIndex
CREATE INDEX "idx_courses_educator" ON "education"."courses"("educator_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_course" ON "education"."enrollments"("course_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_user" ON "education"."enrollments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment" ON "education"."enrollments"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "idx_jobs_employer" ON "education"."jobs"("employer_id");

-- CreateIndex
CREATE INDEX "idx_application_job" ON "education"."applications"("job_id");

-- CreateIndex
CREATE INDEX "idx_application_student" ON "education"."applications"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_application" ON "education"."applications"("job_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_notification_user" ON "education"."notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_subscription_user" ON "education"."subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_settings" ON "education"."settings"("scope", "key");

-- CreateIndex
CREATE INDEX "idx_lessons_course" ON "education"."lessons"("course_id");

-- CreateIndex
CREATE INDEX "idx_quizzes_lesson" ON "education"."quizzes"("lesson_id");

-- CreateIndex
CREATE INDEX "idx_assignments_lesson" ON "education"."assignments"("lesson_id");

-- CreateIndex
CREATE INDEX "idx_progress_lesson" ON "education"."progress"("lesson_id");

-- CreateIndex
CREATE INDEX "idx_progress_user" ON "education"."progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_progress" ON "education"."progress"("user_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_code_key" ON "education"."certificates"("certificate_code");

-- CreateIndex
CREATE INDEX "idx_certificates_course" ON "education"."certificates"("course_id");

-- CreateIndex
CREATE INDEX "idx_certificates_user" ON "education"."certificates"("user_id");

-- CreateIndex
CREATE INDEX "idx_achievements_certificate" ON "education"."achievements"("certificate_id");

-- CreateIndex
CREATE INDEX "idx_achievements_user" ON "education"."achievements"("user_id");

-- CreateIndex
CREATE INDEX "idx_tasks_course" ON "education"."tasks"("course_id");

-- CreateIndex
CREATE INDEX "idx_tasks_user" ON "education"."tasks"("user_id");

-- CreateIndex
CREATE INDEX "idx_recommendations_course" ON "education"."recommendations"("course_id");

-- CreateIndex
CREATE INDEX "idx_recommendations_user" ON "education"."recommendations"("user_id");

-- CreateIndex
CREATE INDEX "idx_announcements_educator" ON "education"."announcements"("educator_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_auth_otps_user_id" ON "education"."auth_otps"("user_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_expires" ON "education"."refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user" ON "education"."refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "domain_roles_domain_name_key" ON "education"."domain_roles"("domain_name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_skill_name_key" ON "education"."skills"("skill_name");

-- CreateIndex
CREATE UNIQUE INDEX "domain_required_skills_domain_role_id_skill_id_key" ON "education"."domain_required_skills"("domain_role_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "difficulty_levels_difficulty_name_key" ON "education"."difficulty_levels"("difficulty_name");

-- CreateIndex
CREATE UNIQUE INDEX "difficulty_levels_difficulty_order_key" ON "education"."difficulty_levels"("difficulty_order");

-- CreateIndex
CREATE INDEX "idx_quiz_sessions_current_skill" ON "education"."quiz_sessions"("current_skill_id");

-- CreateIndex
CREATE INDEX "idx_quiz_sessions_domain_role" ON "education"."quiz_sessions"("domain_role_id");

-- CreateIndex
CREATE INDEX "idx_quiz_sessions_status" ON "education"."quiz_sessions"("status");

-- CreateIndex
CREATE INDEX "idx_quiz_sessions_user" ON "education"."quiz_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_student_answers_difficulty" ON "education"."student_answers"("difficulty_id");

-- CreateIndex
CREATE INDEX "idx_student_answers_question" ON "education"."student_answers"("question_id");

-- CreateIndex
CREATE INDEX "idx_student_answers_session" ON "education"."student_answers"("session_id");

-- CreateIndex
CREATE INDEX "idx_student_answers_skill" ON "education"."student_answers"("skill_id");

-- CreateIndex
CREATE INDEX "idx_student_skill_results_session" ON "education"."student_skill_results"("session_id");

-- CreateIndex
CREATE INDEX "idx_student_skill_results_skill" ON "education"."student_skill_results"("skill_id");

-- CreateIndex
CREATE INDEX "idx_bookmark_post" ON "education"."community_bookmarks"("post_id");

-- CreateIndex
CREATE INDEX "idx_bookmark_user" ON "education"."community_bookmarks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_bookmark_user_post" ON "education"."community_bookmarks"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "idx_community_comments_author" ON "education"."community_comments"("author_id");

-- CreateIndex
CREATE INDEX "idx_community_comments_created" ON "education"."community_comments"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_community_comments_deleted" ON "education"."community_comments"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_community_comments_parent" ON "education"."community_comments"("parent_id");

-- CreateIndex
CREATE INDEX "idx_community_comments_post" ON "education"."community_comments"("post_id");

-- CreateIndex
CREATE INDEX "idx_post_tags_post" ON "education"."community_post_tags"("post_id");

-- CreateIndex
CREATE INDEX "idx_post_tags_tag" ON "education"."community_post_tags"("tag_id");

-- CreateIndex
CREATE INDEX "idx_community_posts_author" ON "education"."community_posts"("author_id");

-- CreateIndex
CREATE INDEX "idx_community_posts_created_at" ON "education"."community_posts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_community_posts_deleted_at" ON "education"."community_posts"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_community_posts_post_type" ON "education"."community_posts"("post_type");

-- CreateIndex
CREATE INDEX "idx_community_posts_status" ON "education"."community_posts"("status");

-- CreateIndex
CREATE INDEX "idx_community_posts_visibility" ON "education"."community_posts"("visibility");

-- CreateIndex
CREATE INDEX "idx_reaction_comment" ON "education"."community_reactions"("comment_id");

-- CreateIndex
CREATE INDEX "idx_reaction_post" ON "education"."community_reactions"("post_id");

-- CreateIndex
CREATE INDEX "idx_reaction_user" ON "education"."community_reactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_community_tag_name" ON "education"."community_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_community_tag_slug" ON "education"."community_tags"("slug");

-- CreateIndex
CREATE INDEX "idx_community_tags_slug" ON "education"."community_tags"("slug");

-- CreateIndex
CREATE INDEX "idx_community_tags_usage" ON "education"."community_tags"("usage_count" DESC);

-- AddForeignKey
ALTER TABLE "education"."users" ADD CONSTRAINT "fk_users_role" FOREIGN KEY ("role_id") REFERENCES "education"."roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."users" ADD CONSTRAINT "users_domain_role_id_fkey" FOREIGN KEY ("domain_role_id") REFERENCES "education"."domain_roles"("domain_role_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education"."role_permissions" ADD CONSTRAINT "fk_rolepermission_permission" FOREIGN KEY ("permission_id") REFERENCES "education"."permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."role_permissions" ADD CONSTRAINT "fk_rolepermission_role" FOREIGN KEY ("role_id") REFERENCES "education"."roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."profiles" ADD CONSTRAINT "fk_profile_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."assessments" ADD CONSTRAINT "fk_assessment_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."gap_reports" ADD CONSTRAINT "fk_gapreport_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."courses" ADD CONSTRAINT "fk_course_educator" FOREIGN KEY ("educator_id") REFERENCES "education"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."enrollments" ADD CONSTRAINT "fk_enrollment_course" FOREIGN KEY ("course_id") REFERENCES "education"."courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."enrollments" ADD CONSTRAINT "fk_enrollment_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."jobs" ADD CONSTRAINT "fk_job_employer" FOREIGN KEY ("employer_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."applications" ADD CONSTRAINT "fk_application_job" FOREIGN KEY ("job_id") REFERENCES "education"."jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."applications" ADD CONSTRAINT "fk_application_student" FOREIGN KEY ("student_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."notifications" ADD CONSTRAINT "fk_notification_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."subscriptions" ADD CONSTRAINT "fk_subscription_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."lessons" ADD CONSTRAINT "fk_lesson_course" FOREIGN KEY ("course_id") REFERENCES "education"."courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."quizzes" ADD CONSTRAINT "fk_quiz_lesson" FOREIGN KEY ("lesson_id") REFERENCES "education"."lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."assignments" ADD CONSTRAINT "fk_assignment_lesson" FOREIGN KEY ("lesson_id") REFERENCES "education"."lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."progress" ADD CONSTRAINT "fk_progress_lesson" FOREIGN KEY ("lesson_id") REFERENCES "education"."lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."progress" ADD CONSTRAINT "fk_progress_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."certificates" ADD CONSTRAINT "fk_certificate_course" FOREIGN KEY ("course_id") REFERENCES "education"."courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."certificates" ADD CONSTRAINT "fk_certificate_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."achievements" ADD CONSTRAINT "fk_achievement_certificate" FOREIGN KEY ("certificate_id") REFERENCES "education"."certificates"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."achievements" ADD CONSTRAINT "fk_achievement_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."tasks" ADD CONSTRAINT "fk_task_course" FOREIGN KEY ("course_id") REFERENCES "education"."courses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."tasks" ADD CONSTRAINT "fk_task_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."recommendations" ADD CONSTRAINT "fk_recommendation_course" FOREIGN KEY ("course_id") REFERENCES "education"."courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."recommendations" ADD CONSTRAINT "fk_recommendation_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."announcements" ADD CONSTRAINT "fk_announcement_educator" FOREIGN KEY ("educator_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."auth_otps" ADD CONSTRAINT "fk_auth_otps_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."domain_required_skills" ADD CONSTRAINT "fk_domain_role" FOREIGN KEY ("domain_role_id") REFERENCES "education"."domain_roles"("domain_role_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."domain_required_skills" ADD CONSTRAINT "fk_skill" FOREIGN KEY ("skill_id") REFERENCES "education"."skills"("skill_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."questions" ADD CONSTRAINT "questions_difficulty_id_fkey" FOREIGN KEY ("difficulty_id") REFERENCES "education"."difficulty_levels"("difficulty_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."questions" ADD CONSTRAINT "questions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "education"."skills"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."quiz_sessions" ADD CONSTRAINT "quiz_sessions_domain_role_id_fkey" FOREIGN KEY ("domain_role_id") REFERENCES "education"."domain_roles"("domain_role_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."quiz_sessions" ADD CONSTRAINT "quiz_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."student_answers" ADD CONSTRAINT "student_answers_difficulty_id_fkey" FOREIGN KEY ("difficulty_id") REFERENCES "education"."difficulty_levels"("difficulty_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."student_answers" ADD CONSTRAINT "student_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "education"."questions"("question_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."student_answers" ADD CONSTRAINT "student_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "education"."quiz_sessions"("session_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."student_answers" ADD CONSTRAINT "student_answers_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "education"."skills"("skill_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."student_skill_results" ADD CONSTRAINT "student_skill_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "education"."quiz_sessions"("session_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."student_skill_results" ADD CONSTRAINT "student_skill_results_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "education"."skills"("skill_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."quiz_state" ADD CONSTRAINT "quiz_state_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "education"."quiz_sessions"("session_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."quiz_state" ADD CONSTRAINT "quiz_state_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "education"."skills"("skill_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_bookmarks" ADD CONSTRAINT "fk_bookmark_post" FOREIGN KEY ("post_id") REFERENCES "education"."community_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_bookmarks" ADD CONSTRAINT "fk_bookmark_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_comments" ADD CONSTRAINT "fk_comment_author" FOREIGN KEY ("author_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_comments" ADD CONSTRAINT "fk_comment_parent" FOREIGN KEY ("parent_id") REFERENCES "education"."community_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_comments" ADD CONSTRAINT "fk_comment_post" FOREIGN KEY ("post_id") REFERENCES "education"."community_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_post_tags" ADD CONSTRAINT "fk_post_tag_post" FOREIGN KEY ("post_id") REFERENCES "education"."community_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_post_tags" ADD CONSTRAINT "fk_post_tag_tag" FOREIGN KEY ("tag_id") REFERENCES "education"."community_tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_posts" ADD CONSTRAINT "fk_community_post_author" FOREIGN KEY ("author_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_reactions" ADD CONSTRAINT "fk_reaction_comment" FOREIGN KEY ("comment_id") REFERENCES "education"."community_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_reactions" ADD CONSTRAINT "fk_reaction_post" FOREIGN KEY ("post_id") REFERENCES "education"."community_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "education"."community_reactions" ADD CONSTRAINT "fk_reaction_user" FOREIGN KEY ("user_id") REFERENCES "education"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

