DROP INDEX IF EXISTS "education"."mini_project_submissions_assignment_id_student_id_key";

CREATE UNIQUE INDEX "uq_mini_project_submission_student_assignment"
ON "education"."mini_project_submissions"
("assignment_id", "student_id", "attempt_number");
