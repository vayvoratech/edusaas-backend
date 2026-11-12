DO $$
BEGIN
  CREATE TYPE "education"."assessment_type" AS ENUM ('INITIAL', 'FINAL', 'PRACTICE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "education"."assessment_type" ADD VALUE IF NOT EXISTS 'PRACTICE';

ALTER TABLE "education"."questions"
ADD COLUMN IF NOT EXISTS "assessment_type" "education"."assessment_type" NOT NULL DEFAULT 'INITIAL';

ALTER TABLE "education"."quiz_sessions"
ADD COLUMN IF NOT EXISTS "assessment_type" "education"."assessment_type" NOT NULL DEFAULT 'INITIAL';

CREATE INDEX IF NOT EXISTS "idx_questions_quiz_lookup"
ON "education"."questions"("skill_id", "assessment_type", "difficulty_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_quiz_sessions_user_assessment_status"
ON "education"."quiz_sessions"("user_id", "assessment_type", "status");
