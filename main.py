# app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import random
from supabase import create_client, Client

# -----------------------------
# FastAPI + CORS
# -----------------------------
app = FastAPI(title="NeuroFit Backend", version="1.0.0")

# ⚠️ For production, replace "*" with your exact frontends
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS] if ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Supabase client (service role)
# -----------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env vars.")

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

# -----------------------------
# Schemas
# -----------------------------
class PlanRequest(BaseModel):
    user_id: Optional[str] = None
    fitness_level: str = Field(..., description="Beginner | Intermediate | Advanced")
    days_per_week: int = Field(..., ge=2, le=6)
    primary_goal: str = Field(..., description="Strength | Hypertrophy | Endurance | Recomp/General")
    available_equipment: List[str] = Field(default_factory=list)
    rpe_last_week: Optional[int] = 7
    completed_90_sets: Optional[bool] = True
    save: Optional[bool] = True

class WorkoutItem(BaseModel):
    exercise: str
    sets: int
    reps: int
    rest_sec: int

class DayBlock(BaseModel):
    day: int
    split: str
    workouts: List[WorkoutItem]

class PlanResponse(BaseModel):
    example_id: Optional[int] = None
    plan: List[DayBlock]

class Feedback(BaseModel):
    example_id: int
    user_id: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    completed_pct: Optional[int] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = None

# -----------------------------
# Tiny rules engine (demo)
# Produces output that your frontend already expects:
#   [{ day, split, workouts: [{exercise, sets, reps, rest_sec}, ...] }]
# -----------------------------
SPLITS_BY_DAYS = {
    2: ["full", "full"],
    3: ["push", "pull", "legs"],
    4: ["upper", "lower", "upper", "lower"],
    5: ["upper", "lower", "push", "pull", "full"],
    6: ["push", "pull", "legs", "upper", "lower", "full"],
}

CANDIDATES: Dict[str, List[str]] = {
    "push": ["Bench Press", "DB Bench", "Overhead Press", "Incline Press", "Dips"],
    "pull": ["Barbell Row", "Lat Pulldown", "Pull-up", "Seated Row", "DB Row"],
    "legs": ["Back Squat", "Front Squat", "Leg Press", "RDL", "Hip Thrust"],
    "upper": ["Bench Press", "Row", "OHP", "Lat Pulldown", "Incline DB"],
    "lower": ["Back Squat", "RDL", "Leg Press", "Ham Curl", "Calf Raise"],
    "full": ["Deadlift", "Bench Press", "Row", "Squat", "Pull-up"],
}

LEVEL_PARAMS = {
    "beginner":    dict(sets_main=3, reps_main=10, rest_main=120),
    "intermediate":dict(sets_main=4, reps_main=8,  rest_main=150),
    "advanced":    dict(sets_main=5, reps_main=6,  rest_main=180),
}

GOAL_TWEAK = {
    "strength":    dict(rep_delta=-2, rest_factor=1.2),
    "hypertrophy": dict(rep_delta=+2, rest_factor=0.9),
    "endurance":   dict(rep_delta=+4, rest_factor=0.8),
    "recomp/general": dict(rep_delta=0, rest_factor=1.0),
    "recomp":         dict(rep_delta=0, rest_factor=1.0),
}

def normalize(s: str) -> str:
    return s.strip().lower()

def build_plan(req: PlanRequest) -> List[DayBlock]:
    lv = normalize(req.fitness_level)
    goal = normalize(req.primary_goal)
    params = LEVEL_PARAMS.get(lv, LEVEL_PARAMS["intermediate"])
    tweak = GOAL_TWEAK.get(goal, GOAL_TWEAK["recomp/general"])

    sets = params["sets_main"]
    reps = max(4, params["reps_main"] + tweak["rep_delta"])
    rest = max(45, int(params["rest_main"] * tweak["rest_factor"]))

    days = max(2, min(6, req.days_per_week))
    split = SPLITS_BY_DAYS.get(days, SPLITS_BY_DAYS[3])

    plan: List[DayBlock] = []
    for i, block in enumerate(split, start=1):
        pool = CANDIDATES.get(block, CANDIDATES["full"])
        # pick 3-5 exercises depending on goal
        k = 4 if "hypertrophy" in goal else 3
        picks = random.sample(pool, k=min(k, len(pool)))
        workouts = [WorkoutItem(exercise=p, sets=sets, reps=reps, rest_sec=rest) for p in picks]
        plan.append(DayBlock(day=i, split=block, workouts=workouts))
    return plan

# -----------------------------
# DB helpers
# -----------------------------
def insert_example_row(user_id: Optional[str], week_of: str, meta: Dict[str, Any], plan: List[DayBlock]) -> Optional[int]:
    """Insert one training example into plan_examples. Returns new id or None."""
    try:
        payload = {
            "user_id": user_id,
            "week_of": week_of,                           # frontend can pass current monday; we also accept any ISO date
            "level": meta.get("fitness_level"),
            "days_per_week": meta.get("days_per_week"),
            "primary_goal": meta.get("primary_goal"),
            "equipment": meta.get("available_equipment", []),
            "progression": 1 if meta.get("completed_90_sets") and (meta.get("rpe_last_week") or 7) <= 7 else 0,
            "plan": [d.model_dump() for d in plan],       # store exactly what we served
            "source": "api_generate_plan",
        }
        res = sb.table("plan_examples").insert(payload).execute()
        if res.data and len(res.data) > 0:
            return int(res.data[0]["id"])
        return None
    except Exception as e:
        print("insert_example_row failed:", repr(e))
        return None

def insert_feedback_row(fb: Feedback) -> int:
    try:
        res = sb.table("plan_feedback").insert({
            "example_id": fb.example_id,
            "user_id": fb.user_id,
            "rating": fb.rating,
            "completed_pct": fb.completed_pct,
            "notes": fb.notes
        }).execute()
        if res.data and len(res.data) > 0:
            return int(res.data[0]["id"])
        raise RuntimeError("Insert returned no rows")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback insert failed: {e}")

# -----------------------------
# Routes
# -----------------------------
@app.get("/", tags=["health"])
def root():
    return {"status": "✅ NeuroFit backend is running."}

@app.post("/generate-plan", response_model=PlanResponse, tags=["plans"])
def generate_plan(req: PlanRequest):
    """
    Build a weekly plan based on inputs.
    Also logs a dataset row into plan_examples (if save=True).
    Returns plan + example_id for later feedback.
    """
    try:
        plan = build_plan(req)

        example_id = None
        if req.save:
            # Use the app's notion of current week; frontend can pass Monday ISO if you prefer
            # Here we derive an ISO date string (today) that Supabase accepts for week_of
            from datetime import date
            week_of = date.today().isoformat()
            example_id = insert_example_row(
                user_id=req.user_id,
                week_of=week_of,
                meta=req.model_dump(),
                plan=plan
            )
        return PlanResponse(example_id=example_id, plan=plan)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generate plan failed: {e}")

@app.post("/examples/feedback", tags=["feedback"])
def add_feedback(f: Feedback):
    """
    Attach labels to a plan example:
      - rating: 1..5
      - completed_pct: 0..100
      - notes: free text
    """
    fb_id = insert_feedback_row(f)
    return {"ok": True, "feedback_id": fb_id}
