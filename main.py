"""
NeuroFit Backend API (FastAPI + Supabase)
----------------------------------------
Purpose:
- Generates personalized workout plans.
- Optionally saves the plan in Supabase.
- Connects directly to Supabase for weekly_plans table.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import date, timedelta, datetime
import os
from supabase import create_client, Client

# -----------------------------
#  Supabase Setup
# -----------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY")
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------
#  FastAPI Init
# -----------------------------
app = FastAPI(title="NeuroFit Backend", version="1.0.0")

# -----------------------------
#  Data Models
# -----------------------------
FitnessLevel = Literal["Beginner", "Intermediate", "Advanced"]
PrimaryGoal = Literal["Recomp/General", "Strength", "Hypertrophy", "Endurance"]

class PlanRequest(BaseModel):
    user_id: Optional[str] = None
    fitness_level: FitnessLevel
    days_per_week: int
    primary_goal: PrimaryGoal
    available_equipment: List[str]
    rpe_last_week: Optional[int] = 7
    completed_90_sets: Optional[bool] = True
    save: Optional[bool] = False

# -----------------------------
#  Exercise Database
# -----------------------------
SPLITS = {
    2: ["Full Body A", "Full Body B"],
    3: ["Push", "Pull", "Legs"],
    4: ["Upper", "Lower", "Push", "Pull"],
    5: ["Push", "Pull", "Legs", "Upper", "Lower"],
    6: ["Push", "Pull", "Legs", "Upper", "Lower", "Full"],
}

EXERCISE_LIBRARY = {
    "barbell": ["Back Squat", "Deadlift", "Bench Press", "Overhead Press", "Barbell Row"],
    "dumbbell": ["DB Bench Press", "DB Row", "DB Shoulder Press", "DB Curl", "DB Lunge"],
    "machine": ["Leg Press", "Cable Row", "Chest Press Machine", "Lat Pulldown", "Pec Deck"],
    "bodyweight": ["Push-ups", "Pull-ups", "Plank", "Dips", "Air Squats"],
    "kettlebell": ["KB Swing", "Goblet Squat", "KB Clean", "KB Press"],
}

GOAL_SCHEMES = {
    "Strength": {"reps": 5, "sets": 5},
    "Hypertrophy": {"reps": 8, "sets": 3},
    "Recomp/General": {"reps": 10, "sets": 3},
    "Endurance": {"reps": 15, "sets": 2},
}

LEVEL_ADJUST = {
    "Beginner": {"multiplier": 0.9, "exercise_cap": 5},
    "Intermediate": {"multiplier": 1.0, "exercise_cap": 6},
    "Advanced": {"multiplier": 1.2, "exercise_cap": 7},
}

# -----------------------------
#  Helper Functions
# -----------------------------
def start_of_week(today: Optional[date] = None):
    today = today or date.today()
    monday = today - timedelta(days=today.weekday())
    return monday

def choose_intensity_factor(rpe: int, completed: bool):
    if rpe <= 7 and completed:
        return 1.05
    elif rpe >= 9 or not completed:
        return 0.90
    else:
        return 1.00

def flatten_equipment(equipment: List[str]):
    pool = []
    for eq in equipment:
        pool += EXERCISE_LIBRARY.get(eq, [])
    return list(dict.fromkeys(pool)) or ["Push-ups", "Squats", "Plank"]

# -----------------------------
#  Core Logic
# -----------------------------
def generate_plan(level: FitnessLevel, days: int, goal: PrimaryGoal, equipment: List[str], rpe: int, completed: bool):
    intensity = choose_intensity_factor(rpe, completed)
    pool = flatten_equipment(equipment)
    split_list = SPLITS.get(days, ["Full Body"])
    scheme = GOAL_SCHEMES[goal]
    adjust = LEVEL_ADJUST[level]

    plan = []
    for i, split in enumerate(split_list):
        chosen = pool[i * 2 : i * 2 + adjust["exercise_cap"]]
        day_plan = {
            "day": i + 1,
            "split": split,
            "workouts": [
                {
                    "exercise": ex,
                    "sets": int(scheme["sets"] * adjust["multiplier"]),
                    "reps": scheme["reps"],
                    "intensity_%": round(100 * intensity),
                }
                for ex in chosen
            ],
        }
        plan.append(day_plan)
    return plan

# -----------------------------
#  API Routes
# -----------------------------
@app.get("/")
def root():
    return {"status": "✅ NeuroFit backend is running."}

@app.post("/generate-plan")
def create_plan(req: PlanRequest):
    try:
        plan = generate_plan(
            req.fitness_level, req.days_per_week, req.primary_goal,
            req.available_equipment, req.rpe_last_week, req.completed_90_sets
        )
        week_of = start_of_week().isoformat()

        result = {
            "week_of": week_of,
            "fitness_level": req.fitness_level,
            "days_per_week": req.days_per_week,
            "goal": req.primary_goal,
            "equipment": req.available_equipment,
            "plan": plan
        }

        # Optionally save to Supabase
        if req.save and supabase and req.user_id:
            data = {
                "user_id": req.user_id,
                "week_of": week_of,
                "level": req.fitness_level,
                "days": req.days_per_week,
                "goal": req.primary_goal,
                "equipment": req.available_equipment,
                "plan": plan,
                "created_at": datetime.utcnow().isoformat(),
            }
            supabase.table("weekly_plans").upsert(data, on_conflict="user_id,week_of").execute()
            result["saved"] = True
        else:
            result["saved"] = False

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
