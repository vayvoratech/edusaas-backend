from flask import Blueprint, request, jsonify
from services.skill_gap_engine import SkillGapEngine

skill_gap_bp = Blueprint("skill_gap", __name__)

engine = SkillGapEngine()


# ----------------------------------------------------
# Analyze Skill Gap
# ----------------------------------------------------
@skill_gap_bp.route("/analyze", methods=["POST"])
def analyze_gap():

    data = request.get_json()

    if not data:

        return jsonify({
            "success": False,
            "message": "Request body is required."
        }), 400

    if (
        "student_skills" not in data
        or
        "required_skills" not in data
    ):

        return jsonify({
            "success": False,
            "message": "student_skills and required_skills are required."
        }), 400

    result = engine.analyze_gap(

        data["student_skills"],

        data["required_skills"]

    )

    return jsonify({

        "success": True,

        "result": result

    })