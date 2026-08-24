from copy import deepcopy


class SkillGapEngine:

    def analyze_gap(
        self,
        student_skills: list,
        required_skills: list
    ):

        report = []

        missing_skills = []

        total_student = 0
        total_required = 0

        # Convert student skills to dictionary
        student_map = {}

        for skill in student_skills:

            student_map[skill["skill_id"]] = skill

        # Compare each required skill
        for required in required_skills:

            skill_id = required["skill_id"]

            required_level = required["required_level"]

            skill_name = required["skill_name"]

            student_level = student_map.get(
                skill_id,
                {}
            ).get(
                "skill_level",
                0
            )

            gap = required_level - student_level

            if gap < 0:
                gap = 0

            if gap == 0:
                status = "Ready"
            else:
                status = "Needs Improvement"
                missing_skills.append(skill_name)

            report.append({

                "skill_id": skill_id,

                "skill_name": skill_name,

                "required_level": required_level,

                "student_level": student_level,

                "gap": gap,

                "status": status

            })

            total_student += student_level
            total_required += required_level

        if total_required == 0:

            readiness_score = 0

        else:

            readiness_score = round(

                (total_student / total_required) * 100,

                2

            )

        return {

            "skill_gap": deepcopy(report),

            "readiness_score": readiness_score,

            "missing_skills": deepcopy(missing_skills)

        }