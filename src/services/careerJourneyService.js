
const repo = require("../data");
const { getAssessmentOverview } = require("./assessmentService");

async function getCareerJourneyEligibility(userId) {
  const student = await repo.users.findById(userId);

  if (!student) {
    const error = new Error("Student not found.");
    error.status = 404;
    throw error;
  }

  const assessmentOverview = await getAssessmentOverview(userId);

  // 1. Initial Quiz AND Coding Assessment must both be completed.
  const initialAssessmentCompleted =
    assessmentOverview?.initialAssessment?.status === "Completed";

  // 2. At least one enrolled course must be fully completed.
  // Replace this with the specifically assigned career course if your
  // application has a dedicated course-assignment relationship.
  const enrollments = await repo.enrollments.listByUser(userId);

  const completedEnrollments = (enrollments || []).filter(
    (enrollment) =>
      Number(enrollment?.completion_percentage ?? 0) >= 100
  );

  const courseCompleted = completedEnrollments.length > 0;

  // 3. Final Quiz must be completed.
  const finalQuizCompleted =
    assessmentOverview?.finalAssessment?.finalQuiz?.status ===
    "Completed";

  // 4. The current mini-project assignment must have an approved
  // latest submission.
  let miniProjectApproved = false;

  if (student.domain_role_id) {
    const assignment = await repo.miniProjects.getCurrentForStudent(
      userId,
      student.domain_role_id
    );

    const latestSubmission = assignment?.submissions?.[0] ?? null;

    miniProjectApproved =
      latestSubmission?.status === "APPROVED";
  }

  // Journey completion excludes certificate issuance because the
  // certificate is issued only AFTER the journey is complete.
  const careerJourneyCompleted =
    initialAssessmentCompleted &&
    courseCompleted &&
    finalQuizCompleted &&
    miniProjectApproved;

  // 5. Certificate check.
  // IMPORTANT: This must query a specifically identified career-completion
  // certificate, not just any existing course certificate.
  const certificates = await repo.certificates.listByUser(userId);

  const careerCertificateObtained =
    Array.isArray(certificates) &&
    certificates.some(
      (certificate) =>
        certificate.certificate_type === "CAREER_COMPLETION"
    );

  const eligibleForJobs =
    careerJourneyCompleted && careerCertificateObtained;

  return {
    initialAssessmentCompleted,
    courseCompleted,
    finalQuizCompleted,
    miniProjectApproved,
    careerJourneyCompleted,
    careerCertificateObtained,
    eligibleForJobs,
  };
}

module.exports = {
  getCareerJourneyEligibility,
};
