-- Final assessments use the validated initial question bank as their source
-- until a dedicated final bank is introduced.
INSERT INTO "education"."questions" (
  "skill_id",
  "difficulty_id",
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
  "marks",
  "is_active",
  "created_at",
  "assessment_type"
)
SELECT
  initial_question."skill_id",
  initial_question."difficulty_id",
  initial_question."question_text",
  initial_question."option_a",
  initial_question."option_b",
  initial_question."option_c",
  initial_question."option_d",
  initial_question."correct_option",
  initial_question."marks",
  initial_question."is_active",
  initial_question."created_at",
  'FINAL'
FROM "education"."questions" AS initial_question
WHERE initial_question."assessment_type" = 'INITIAL'
  AND NOT EXISTS (
    SELECT 1
    FROM "education"."questions" AS final_question
    WHERE final_question."assessment_type" = 'FINAL'
      AND final_question."skill_id" = initial_question."skill_id"
      AND final_question."question_text" = initial_question."question_text"
  );
