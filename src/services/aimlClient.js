// src/services/aimlClient.js

const { aimlServiceUrl, plagiarismBaseUrl } = require("../config/env");
const crypto = require("crypto");

/**
 * Converts a string ID (like a Clerk user_2Q...) into a stable positive Integer
 */
function clerkToInt(clerkId) {
  if (!clerkId) return 1;
  const hash = crypto.createHash("md5").update(String(clerkId)).digest("hex");
  return parseInt(hash.substring(0, 8), 16) & 0x7FFFFFFF;
}

/**
 * Converts a string ID into a stable UUID v4-like format
 */
function clerkToUUID(clerkId) {
  if (!clerkId) return "00000000-0000-0000-0000-000000000000";
  const hash = crypto.createHash("md5").update(String(clerkId)).digest("hex");
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join("-");
}

/**
 * Helper to make requests to the unified AIML FastAPI Service
 */
async function callAIML(endpoint, payload = null, method = "POST", customBaseUrl = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (payload && method !== "GET") {
    options.body = JSON.stringify(payload);
  }

  try {
    const baseUrl = customBaseUrl || aimlServiceUrl;
    const response = await fetch(`${baseUrl}${endpoint}`, options);

    // In case of non-JSON responses from the FastAPI server (e.g. 500 HTML)
    let data;
    try {
      data = await response.json();
    } catch (err) {
      const error = new Error("AI service returned a non-JSON response");
      error.status = 502;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(data.detail || data.message || "AI service failed");
      error.status = response.status;

      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[AIML Client Error] ${endpoint}:`, error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------
// Dropout & Attrition Risk
// ---------------------------------------------------------------------
async function predictDropout(studentData) {
  // studentData schema matches DropoutInput in dropout_api.py
  if (studentData.student_id) studentData.student_id = clerkToInt(studentData.student_id);
  return callAIML("/dropout/predict", studentData, "POST");
}

// ---------------------------------------------------------------------
// Course Recommendations
// ---------------------------------------------------------------------
async function getRecommendations(userId, courseName) {
  // GET /recommendation/recommend?user_id=...&course_name=...
  const queryParams = new URLSearchParams({
    user_id: clerkToUUID(userId),
    course_name: courseName,
  });
  return callAIML(`/recommendation/recommend?${queryParams.toString()}`, null, "GET");
}

// ---------------------------------------------------------------------
// Sentiment Analysis
// ---------------------------------------------------------------------
async function analyzeSentiment(postData) {
  // postData matches SentimentRequest
  if (postData.student_id) postData.student_id = clerkToInt(postData.student_id);
  return callAIML("/sentiment/predict-sentiment", postData, "POST");
}

// ---------------------------------------------------------------------
// Fraud & Integrity Detection
// ---------------------------------------------------------------------
async function predictFraud(fraudData) {
  // fraudData matches FraudRequest schema
  if (fraudData.student_id) fraudData.student_id = clerkToInt(fraudData.student_id);
  return callAIML("/fraud/predict", fraudData, "POST");
}

// ---------------------------------------------------------------------
// Code Plagiarism Detection (Placeholder for external code_plagiarism server)
// ---------------------------------------------------------------------
async function checkCodePlagiarism(payload) {
  // Assuming a separate API endpoint or merged API for code plagiarism
  // payload: { submission_id, user_id, code, language, question_id }
  if (payload.user_id) payload.user_id = clerkToInt(payload.user_id);
  return callAIML("/plagiarism/check", payload, "POST", plagiarismBaseUrl);
}

// ---------------------------------------------------------------------
// Toxicity Detection
// ---------------------------------------------------------------------
async function analyzeToxicity(postData) {
  // postData matches ToxicityRequest
  if (postData.student_id) postData.student_id = clerkToInt(postData.student_id);
  return callAIML("/toxicity/predict", postData, "POST");
}

// Note: Subjective Answer Evaluator has been kept aside per requirements.

module.exports = {
  predictDropout,
  getRecommendations,
  analyzeSentiment,
  analyzeToxicity,
  predictFraud,
  checkCodePlagiarism,
};
