# app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date
import os, random
from supabase import create_client, Client

# -----------------------------
# FastAPI + CORS
# -----------------------------
app = FastAPI(title="NeuroFit Backend", version="1.1.0")

# For production, set ALLOWED_ORIGINS env to a comma-separated list of your frontends
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS] if ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Supabase (service role)
# -----------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE")
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env vars.")

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

# -----------------------------
# Models
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
# Simple rules engine (same output shape your UI expects)
# -----------------------------
SPLITS_BY_DAYS = {
    2: ["full", "full"],
    3: ["push", "pull", "legs"],
    4: ["upper", "lower", "upper", "lower"],
    5: ["upper", "lower", "push", "pull", "full"],
    6: ["push", "pull", "legs", "upper", "lower", "full"],
}

CANDIDATES: Dict[str, List[str]] = {
    "push":  ["Bench Press", "DB Bench", "Overhead Press", "Incline Press", "Dips"],
    "pull":  ["Barbell Row", "Lat Pulldown", "Pull-up", "Seated Row", "DB Row"],
    "legs":  ["Back Squat", "Front Squat", "Leg Press", "RDL", "Hip Thrust"],
    "upper": ["Bench Press", "Row", "OHP", "Lat Pulldown", "Incline DB"],
    "lower": ["Back Squat", "RDL", "Leg Press", "Ham Curl", "Calf Raise"],
    "full":  ["Deadlift", "Bench Press", "Row", "Squat", "Pull-up"],
}

LEVEL_PARAMS = {
    "beginner":     dict(sets_main=3, reps_main=10, rest_main=120),
    "intermediate": dict(sets_main=4, reps_main=8,  rest_main=150),
    "advanced":     dict(sets_main=5, reps_main=6,  rest_main=180),
}

GOAL_TWEAK = {
    "strength":        dict(rep_delta=-2, rest_factor=1.2),
    "hypertrophy":     dict(rep_delta=+2, rest_factor=0.9),
    "endurance":       dict(rep_delta=+4, rest_factor=0.8),
    "recomp/general":  dict(rep_delta=0,  rest_factor=1.0),
    "recomp":          dict(rep_delta=0,  rest_factor=1.0),
}

def _norm(s: str) -> str:
    return (s or "").strip().lower()

def build_plan(req: PlanRequest) -> List[DayBlock]:
    lv = _norm(req.fitness_level)
    goal = _norm(req.primary_goal)
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
        k = 4 if "hypertrophy" in goal else 3   # a little more volume for hypertrophy
        picks = random.sample(pool, k=min(k, len(pool)))
        workouts = [WorkoutItem(exercise=p, sets=sets, reps=reps, rest_sec=rest) for p in picks]
        plan.append(DayBlock(day=i, split=block, workouts=workouts))
    return plan

# -----------------------------
# DB helpers (FK-safe insert)
# -----------------------------
def _profile_exists(user_id: str) -> bool:
    try:
        res = sb.table("profiles").select("id").eq("id", user_id).maybe_single().execute()
        return bool(getattr(res, "data", None) and res.data.get("id"))
    except Exception:
        return False

def insert_example_row(user_id: Optional[str], week_of: str, meta: Dict[str, Any], plan: List[DayBlock]) -> Optional[int]:
    """
    Insert one training example into plan_examples.
    If the profile doesn't exist, insert with user_id = null to avoid FK errors.
    """
    try:
        uid_for_insert = user_id if (user_id and _profile_exists(
