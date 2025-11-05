/* =========================================================
   NeuroFit – Single-file client app (Supabase + SPA)
   Assumes window.supabase is already created in index.html
   ========================================================= */

/* -----------------------------
   Workout plan engine (static)
----------------------------- */
const EXERCISES = [
  {id:'squat', name:'Back Squat', muscle:'legs', type:'compound', equip:['barbell','rack']},
  {id:'fsquat', name:'Front Squat', muscle:'legs', type:'compound', equip:['barbell','rack']},
  {id:'goblet', name:'Goblet Squat', muscle:'legs', type:'compound', equip:['dumbbell','kettlebell']},
  {id:'legpress', name:'Leg Press', muscle:'legs', type:'compound', equip:['machine']},
  {id:'rdl', name:'Romanian Deadlift', muscle:'posterior', type:'compound', equip:['barbell','dumbbell']},
  {id:'dl', name:'Deadlift', muscle:'posterior', type:'compound', equip:['barbell']},
  {id:'hipthrust', name:'Hip Thrust', muscle:'glutes', type:'compound', equip:['barbell','bench']},
  {id:'bench', name:'Barbell Bench Press', muscle:'chest', type:'compound', equip:['barbell','bench']},
  {id:'dbbench', name:'DB Bench Press', muscle:'chest', type:'compound', equip:['dumbbell','bench']},
  {id:'pushup', name:'Push-up', muscle:'chest', type:'compound', equip:['bodyweight']},
  {id:'ohp', name:'Overhead Press', muscle:'shoulders', type:'compound', equip:['barbell']},
  {id:'dbohp', name:'DB Shoulder Press', muscle:'shoulders', type:'compound', equip:['dumbbell']},
  {id:'row', name:'Barbell Row', muscle:'back', type:'compound', equip:['barbell']},
  {id:'dbrow', name:'DB Row', muscle:'back', type:'compound', equip:['dumbbell','bench']},
  {id:'latpulldown', name:'Lat Pulldown', muscle:'back', type:'compound', equip:['machine','cable']},
  {id:'pulldown', name:'Assisted Pull-up / Pull-down', muscle:'back', type:'compound', equip:['machine']},
  {id:'pullup', name:'Pull-up', muscle:'back', type:'compound', equip:['bodyweight','bar']},
  {id:'curl', name:'Bicep Curl', muscle:'biceps', type:'accessory', equip:['dumbbell','barbell','cable']},
  {id:'tric', name:'Triceps Pushdown', muscle:'triceps', type:'accessory', equip:['cable']},
  {id:'skull', name:'Skullcrusher', muscle:'triceps', type:'accessory', equip:['barbell','dumbbell','bench']},
  {id:'latraise', name:'Lateral Raise', muscle:'shoulders', type:'accessory', equip:['dumbbell','cable']},
  {id:'fly', name:'Chest Fly', muscle:'chest', type:'accessory', equip:['dumbbell','cable','machine']},
  {id:'legcurl', name:'Leg Curl', muscle:'posterior', type:'accessory', equip:['machine']},
  {id:'legext', name:'Leg Extension', muscle:'quads', type:'accessory', equip:['machine']},
  {id:'calf', name:'Calf Raise', muscle:'calves', type:'accessory', equip:['machine','smith','bodyweight']},
  {id:'coreplank', name:'Plank', muscle:'core', type:'core', equip:['bodyweight']},
  {id:'corecable', name:'Cable Crunch', muscle:'core', type:'core', equip:['cable']},
  {id:'hanging', name:'Hanging Knee Raise', muscle:'core', type:'core', equip:['bar']},
];
const EQUIPMENT = ['barbell','dumbbell','machine','cable','kettlebell','bench','rack','smith','bodyweight','bar'];

const LEVEL_PARAMS = {
  beginner:    { setsMain:3, setsAcc:2, repMain:[8,10], repAcc:[10,15], restMain:120, restAcc:60 },
  intermediate:{ setsMain:4, setsAcc:3, repMain:[6,8],  repAcc:[8,12],  restMain:150, restAcc:75 },
  advanced:    { setsMain:5, setsAcc:3, repMain:[4,6],  repAcc:[6,10],  restMain:180, restAcc:90 },
};
const GOAL_TWEAKS = {
  strength:    { repMainDelta:-2, repAccDelta:-2, restBoost:1.2 },
  hypertrophy: { repMainDelta:+2, repAccDelta:+2, restBoost:0.9 },
  endurance:   { repMainDelta:+4, repAccDelta:+4, restBoost:0.8 },
  recomp:      { repMainDelta: 0, repAccDelta: 0, restBoost:1.0 },
};
const SPLITS = {
  2: [ ['full'], ['full'] ],
  3: [ ['push'], ['pull'], ['legs'] ],
  4: [ ['upper'], ['lower'], ['upper'], ['lower'] ],
  5: [ ['upper'], ['lower'], ['push'], ['pull'], ['full'] ],
  6: [ ['push'], ['pull'], ['legs'], ['upper'], ['lower'], ['full'] ],
};
const BLUEPRINT = {
  full:  { main:['squat/goblet/legpress','bench/dbbench/pushup','row/dbrow/latpulldown/pullup'], acc:['rdl/hipthrust','latraise/fly','curl/tric','coreplank/corecable/hanging'] },
  upper: { main:['bench/dbbench/pushup','row/latpulldown/pullup','ohp/dbohp'], acc:['latraise/fly','curl','tric','coreplank/corecable/hanging'] },
  lower: { main:['squat/goblet/legpress','rdl/dl/hipthrust'], acc:['legext','legcurl','calf','coreplank'] },
  push:  { main:['bench/dbbench/pushup','ohp/dbohp'], acc:['fly','tric','latraise','coreplank'] },
  pull:  { main:['row/dbrow/latpulldown/pullup','rdl/dl'], acc:['curl','legcurl','coreplank/corecable/hanging'] },
  legs:  { main:['squat/goblet/legpress','rdl/hipthrust/dl'], acc:['legext','legcurl','calf','coreplank'] }
};

/* -----------------------------
   Backend fetch (Render API)
----------------------------- */
const BACKEND_URL = "https://neurofit-gx49.onrender.com/generate-plan";
const MAP_LEVEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const MAP_GOAL  = { strength: "Strength", hypertrophy: "Hypertrophy", endurance: "Endurance", recomp: "Recomp/General" };

async function fetchPlanFromBackend(meta) {
  const u = await db.user();
  const payload = {
    user_id: u?.id || null,
    fitness_level: MAP_LEVEL[meta.level] || "Intermediate",
    days_per_week: Number(meta.days) || 3,
    primary_goal: MAP_GOAL[meta.goal] || "Recomp/General",
    available_equipment: Array.isArray(meta.equipment) ? meta.equipment : [],
    rpe_last_week: Number(meta.rpe) || 7,
    completed_90_sets: meta.adherence === "yes",
    save: true
  };
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const t = await res.text().catch(()=>res.statusText);
    throw new Error(`Backend error ${res.status}: ${t}`);
  }
  return res.json();
}

const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const withinEquip = (ex, avail) => ex.equip.some(e => avail.has(e));
const repRange = (base, delta) => [Math.max(3, base[0]+delta), Math.max(4, base[1]+delta)];
const fmtRange = ([a,b]) => `${a}–${b}`;

function progressionAdjust(levelParams, adherence, rpe){
  const p = {...levelParams};
  if (adherence==='yes' && rpe<=7) p.setsMain += 1;
  if (adherence==='no' || rpe>=9){
    p.setsMain = Math.max(2, p.setsMain-1);
    p.setsAcc  = Math.max(1, p.setsAcc-1);
  }
  return p;
}
function resolveSlot(slot, avail){
  const options = slot.split('/').map(id=>EXERCISES.find(e=>e.id===id)).filter(Boolean);
  const fit = options.filter(e=>withinEquip(e, avail));
  return (fit.length ? pick(fit) : pick(options));
}
function generatePlan({level='beginner', days=3, goal='recomp', equipment=[], adherence='yes', rpe=7, week=1}){
  days = Math.min(6, Math.max(2, Number(days)||3));
  const split = SPLITS[days] || SPLITS[3];
  const base = LEVEL_PARAMS[level] || LEVEL_PARAMS.beginner;
  const g = GOAL_TWEAKS[goal] || GOAL_TWEAKS.recomp;
  const repMain = repRange(base.repMain, g.repMainDelta);
  const repAcc  = repRange(base.repAcc,  g.repAccDelta);
  const tweaked = { ...base, restMain: Math.round(base.restMain*g.restBoost), restAcc: Math.round(base.restAcc*g.restBoost) };
  const prog = progressionAdjust(tweaked, adherence, rpe);
  const avail = new Set(equipment);

  const daysOut = [];
  split.forEach((focusArr, i) => {
    const focus = focusArr[0];
    const bp = BLUEPRINT[focus];
    const mains = bp.main.map(s => resolveSlot(s, avail));
    const accs  = bp.acc.slice().sort(()=>Math.random()-0.5).slice(0,3).map(s => resolveSlot(s, avail));
    const dayName = `${['Mon','Tue','Wed','Thu','Fri','Sat'][i%6] || 'Day'} – ${focus.toUpperCase()}`;
    daysOut.push({
      name: dayName,
      focus,
      main: mains.map(x=>({ id:x.id, name:x.name, sets:prog.setsMain, reps:repMain, rest:prog.restMain })),
      accessories: accs.map(x=>({ id:x.id, name:x.name, sets:prog.setsAcc, reps:repAcc, rest:prog.restAcc })),
      note: week%4===0 ? 'Deload week: leave 3–4 RIR and reduce weight ~10–15%.' : 'Leave 1–2 RIR. Increase next week if top sets ≤7 RPE.'
    });
  });
  return { meta:{ level, days, goal, week, adherence, rpe }, plan: daysOut };
}

/* -----------------------------
   Tiny DOM/utility helpers
----------------------------- */
const $  = (sel, root=document) => root.querySelector(sel);
const on = (el, evt, cb) => el && el.addEventListener(evt, cb);
function mount(templateId, data = {}){
  const tpl = document.getElementById(templateId);
  const clone = tpl.content.cloneNode(true);
  Object.keys(data).forEach(k => {
    const el = clone.querySelector(`[data-${k}]`);
    if (el) el.textContent = data[k];
  });
  const app = document.getElementById("app");
  app.innerHTML = "";
  app.appendChild(clone);
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function scorePassword(pw){
  let s=0; if(pw.length>=8) s++; if(/[A-Z]/.test(pw)) s++; if (/[a-z]/.test(pw)&&/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s,4);
}
function validateRegister({ username, email, password }){
  const errors = {};
  if (!username || username.trim().length < 3) errors.username = "Username must be at least 3 characters.";
  if (!emailRegex.test(email)) errors.email = "Enter a valid email address.";
  if (scorePassword(password) < 3) errors.password = "Use 8+ chars with upper/lowercase, a number, and a symbol.";
  return { ok: Object.keys(errors).length === 0, errors };
}
function validateLogin({ email, password }){
  const errors = {};
  if (!emailRegex.test(email)) errors.email = "Invalid email.";
  if (!password) errors.password = "Password is required.";
  return { ok: Object.keys(errors).length === 0, errors };
}
function escapeHTML(str){
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function startOfWeek(d=new Date()){
  const x = new Date(d);
  const day = (x.getDay()+6)%7; // Monday
  x.setHours(0,0,0,0); x.setDate(x.getDate()-day);
  return x;
}
function weekOfISO(d=new Date()){ return startOfWeek(d).toISOString().slice(0,10); }

/* -----------------------------
   Supabase data access layer
----------------------------- */
const db = {
  // AUTH
  async session(){ return (await supabase.auth.getSession()).data.session || null; },
  async user(){ return (await supabase.auth.getUser()).data.user || null; },
  async register({ username, email, password }){
    const { data, error } = await supabase.auth.signUp({ email, password, options:{ data:{ username } }});
    if (error) throw error;
    const uid = data.user.id;
    const { error: pErr } = await supabase.from('profiles').insert({ id: uid, username, units:'lbs', weekly_goal:3 });
    if (pErr) throw pErr;
    return data.user;
  },
  async login({ email, password }){
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },
  async logout(){ await supabase.auth.signOut(); },

  // SETTINGS
  async getSettings(){
    const u = await this.user(); if (!u) return { units:'lbs', weeklyGoal:3 };
    const { data } = await supabase.from('profiles').select('units, weekly_goal').eq('id', u.id).single();
    return { units: data?.units || 'lbs', weeklyGoal: data?.weekly_goal ?? 3 };
  },
  async setSettings({ units, weeklyGoal }){
    const u = await this.user(); if (!u) throw new Error('Not authed');
    const { error } = await supabase.from('profiles').update({ units, weekly_goal: weeklyGoal }).eq('id', u.id);
    if (error) throw error;
  },

  // LOGS
  async addLog({ date, exercise, sets, reps, weight, notes, visibility='private' }){
    const u = await this.user(); if (!u) throw new Error('Not authed');
    const payload = { user_id: u.id, date, exercise_name: exercise, sets, reps, weight, notes, visibility };
    const { error } = await supabase.from('workout_logs').insert(payload);
    if (error) throw error;
    await this.pushActivity(`Logged ${exercise} (${sets}×${reps} @ ${weight})`);
  },
  async deleteLog(id){
    const u = await this.user(); if (!u) throw new Error('Not authed');
    const { error } = await supabase.from('workout_logs').delete().eq('id', id).eq('user_id', u.id);
    if (error) throw error;
  },
  async listLogs({ onDate, text, sort='newest', limit=200, offset=0 } = {}){
    let q = supabase.from('workout_logs')
      .select('id,date,exercise_name,sets,reps,weight,notes,volume,created_at,visibility')
      .order('date', { ascending:false })
      .order('created_at', { ascending:false });
    if (onDate) q = q.eq('date', onDate);
    if (text)   q = q.ilike('exercise_name', `%${text}%`);
    if (sort==='volume') q = q.order('volume', { ascending:false });
    if (sort==='oldest') q = q.order('date', { ascending:true });
    const { data, error } = await q.range(offset, offset+limit-1);
    if (error) throw error;
    return data;
  },

  // DASHBOARD
  async weekStats({ startISO, endISO }){
    const { data, error } = await supabase.from('workout_logs')
      .select('date,sets,reps,weight')
      .gte('date', startISO).lte('date', endISO);
    if (error) throw error;
    const days = new Set(); let volume = 0;
    for (const r of data){ days.add(r.date); volume += r.sets*r.reps*r.weight; }
    return { workouts: days.size, volume };
  },

  // PROGRESS (optional view)
  async progress(){
    const { data, error } = await supabase
      .from('exercise_stats')
      .select('exercise_name,total_volume,max_weight,last_date')
      .order('total_volume', { ascending:false });
    if (error) return null;
    return data;
  },

  // PLANS
  async savePlan({ weekOfISO, meta, plan }){
    const u = await this.user(); if (!u) throw new Error('Not authed');
    const { error } = await supabase.from('weekly_plans').upsert({
      user_id: u.id, week_of: weekOfISO,
      level: meta.level, days: meta.days, goal: meta.goal,
      progression: (meta.rpe<=7 && meta.adherence==='yes') ? 1 : (meta.rpe>=9 ? -1 : 0),
      equipment: meta.equipment || [], plan
    }, { onConflict: 'user_id,week_of' });
    if (error) throw error;
  },
  async loadPlan(weekOfISO){
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('plan, level, days, goal, progression, equipment, week_of, created_at')
      .eq('week_of', weekOfISO).maybeSingle();
    if (error) throw error;
    return data;
  },

  // SOCIAL (min)
  async friendsFeed({ limit=5, offset=0 } = {}){
    const { data, error } = await supabase
      .from('friends_activity')
      .select('*')
      .order('created_at', { ascending:false })
      .range(offset, offset+limit-1);
    if (error) return [];
    return data;
  },

  // ACTIVITY
  async pushActivity(message){
    const u = await this.user(); if (!u) return;
    await supabase.from('activity_feed').insert({ user_id: u.id, message });
  }
};

/* -----------------------------
   Auth helpers & router
----------------------------- */
async function isAuthed(){ return !!(await db.session()); }
async function guard(){ if (!(await isAuthed())){ location.hash = "#/login"; return false; } return true; }

const routes = {
  "#/login": renderLogin,
  "#/register": renderRegister,
  "#/home": renderHome,
  "#/workouts/log": renderWorkoutLog,
  "#/workouts/diagram": renderBodyDiagram,
  "#/workouts/history": renderHistory,
  "#/progress": renderProgress,
  "#/settings": renderSettings,
  "#/generatePlan": renderGeneratePlan
};

function updateActiveNav(routeKey){
  document.querySelectorAll(".sidebar-link").forEach(a => {
    a.classList.toggle("active", a.getAttribute("href") === routeKey);
  });
}

async function updateChrome(){
  const authed = !!(await db.session());
  const logoutBtn = $("#logoutBtn");
  const settingsBtn = $("#settingsBtn");
  if (authed){ logoutBtn.classList.remove("hidden"); settingsBtn.classList.remove("hidden"); }
  else { logoutBtn.classList.add("hidden"); settingsBtn.classList.add("hidden"); }
  $("#shell").style.display = authed ? "grid" : "block";
  $("#sidebar").style.display = authed ? "block" : "none";
}

async function render(){
  const hash = location.hash || "#/login";
  const routeKey = hash.split("?")[0];
  const publicRoutes = ["#/login", "#/register"];
  const isPublic = publicRoutes.includes(routeKey);
  if (!isPublic && !(await isAuthed())){ location.hash = "#/login"; return; }
  const handler = routes[routeKey] || renderHome;
  await handler();
  await updateChrome();
  updateActiveNav(routeKey);
}

window.addEventListener("hashchange", () => render());
window.addEventListener("load", async () => {
  if (!location.hash){
    location.hash = (await isAuthed()) ? "#/home" : "#/login";
  }
  render();
});

/* -----------------------------
   Renderers
----------------------------- */
function renderLogin(){
  document.body.classList.add("auth");
  mount("login-template");
  $("#sidebar")?.classList.remove("open");

  const form = $("#loginForm");
  const msg  = $("#loginMsg");

  on(form, "submit", async (e) => {
    e.preventDefault();
    const payload = { email: $("#loginEmail").value.trim().toLowerCase(), password: $("#loginPassword").value };
    const v = validateLogin(payload);
    $("#loginEmailErr").textContent = v.errors.email || "";
    $("#loginPasswordErr").textContent = v.errors.password || "";
    if (!v.ok) return;

    try {
      await db.login(payload);
      msg.className = "alert success";
      msg.textContent = "Login successful. Redirecting…";
      Notify.success("Welcome back!", "Let's make progress today.");
      document.body.classList.remove("auth");
      setTimeout(() => (location.hash = "#/home"), 200);
    } catch (err){
      msg.className = "alert error";
      msg.textContent = err.message || "Invalid email or password.";
    }
  });
}

function renderRegister(){
  document.body.classList.add("auth");
  mount("register-template");
  $("#sidebar")?.classList.remove("open");

  const form = $("#regForm");
  const msg  = $("#regMsg");
  const pw   = $("#regPassword");
  const meter = $("#pwMeter");
  const meterFill = meter.querySelector(".meter-fill");

  on(pw, "input", () => {
    const s = scorePassword(pw.value);
    meter.className = `meter strength-${Math.max(1,s)}`;
    meterFill.style.width = `${(s/4)*100}%`;
  });

  on(form, "submit", async (e) => {
    e.preventDefault();
    const payload = { username: $("#regUsername").value, email: $("#regEmail").value.trim().toLowerCase(), password: pw.value };
    const v = validateRegister(payload);
    $("#regUsernameErr").textContent = v.errors.username || "";
    $("#regEmailErr").textContent = v.errors.email || "";
    $("#regPasswordErr").textContent = v.errors.password || "";
    if (!v.ok) return;

    try {
      await db.register(payload);
      msg.className = "alert success";
      msg.textContent = "Registration successful. Check your email to confirm, then log in.";
      setTimeout(() => (location.hash = "#/login"), 800);
    } catch (err){
      msg.className = "alert error";
      msg.textContent = err.message || "Registration failed.";
    }
  });
}

async function renderHome(){
  if (!await guard()) return;
  document.body.classList.remove("auth");

  const u = await db.user();
  const username = u?.user_metadata?.username || "Athlete";
  mount("home-template", { username });

  const weekStart = startOfWeek(new Date());
  const startISO = weekStart.toISOString().slice(0,10);
  const end = new Date(weekStart); end.setDate(end.getDate()+6);
  const endISO = end.toISOString().slice(0,10);

  try {
    const stats = await db.weekStats({ startISO, endISO });
    $("#statWorkouts").textContent = String(stats.workouts);
    $("#statVolume").textContent   = stats.volume.toLocaleString();
  } catch {
    $("#statWorkouts").textContent = "0";
    $("#statVolume").textContent   = "0";
  }

  const list = $("#activityList");
  list.innerHTML = "";
  const feed = await db.friendsFeed({ limit:5 }).catch(()=>[]);
  feed.forEach(l => {
    const li = document.createElement("li");
    li.textContent = `${l.date} • ${l.exercise_name} • ${l.sets}x${l.reps} @ ${l.weight}`;
    list.appendChild(li);
  });
}

async function renderWorkoutLog(){
  if (!await guard()) return;
  document.body.classList.remove("auth");
  mount("workout-log-template");
  $("#sidebar")?.classList.remove("open");

  const form = $("#workoutForm");
  const err  = $("#woErr");
  const ok   = $("#woOK");
  const today = new Date().toISOString().slice(0,10);
  $("#woDate").value = today;

  on(form, "submit", async (e) => {
    e.preventDefault();
    err.textContent = ""; ok.textContent = "";

    const payload = {
      date: $("#woDate").value || today,
      exercise: $("#woExercise").value.trim(),
      sets: +$("#woSets").value,
      reps: +$("#woReps").value,
      weight: +$("#woWeight").value,
      notes: ($("#woNotes")?.value || "").trim(),
      visibility: 'friends' // change to a select in UI if you like
    };
    if (!payload.exercise || !payload.sets || !payload.reps){
      err.textContent = "Please fill sets, reps, and exercise."; return;
    }
    try {
      await db.addLog(payload);
      const details = `${payload.exercise}: ${payload.sets}×${payload.reps} @ ${payload.weight}`;
      Notify.success(Notify.praise(), details, 4500);
      ok.textContent = "Workout saved!";
      form.reset();
      $("#woDate").value = today;
    } catch (e){
      err.textContent = e.message || "Failed to save log.";
    }
  });
}

function renderBodyDiagram(){
  (async () => { if (!await guard()) return; })(); // guard async
  document.body.classList.remove("auth");
  mount("body-diagram-template");
  const contentArea = $("#app");
  contentArea?.classList.add("full-width");

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'videoModal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalTitle">Exercise Video</h3>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <iframe id="modalVideo" class="modal-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>`;
  document.body.appendChild(modal);

  const toggleBtn = $("#toggleViewBtn");
  const front = $("#frontView");
  const back  = $("#backView");
  on(toggleBtn, "click", () => {
    const isFront = front.style.display !== "none";
    front.style.display = isFront ? "none" : "block";
    back.style.display  = isFront ? "block" : "none";
    toggleBtn.textContent = isFront ? "Show Front View" : "Show Back View";
  });

  const exercises = {
    chest: [
      {name:"Bench Press", img:"images/chest/Bench-Press.jpg", url:"https://www.youtube.com/embed/hWbUlkb5Ms4"},
      {name:"Dumbbell Chest Flies", img:"images/chest/Dumbbell-Chest-Flies.jpg", url:""},
      {name:"Dumbbell Chest Press", img:"images/chest/Dumbbell-Chest-Press.jpg", url:""},
    ],
    biceps: [
      {name:"Alternating Dumbbell Curls", img:"images/biceps/Alternating-Dumbbell-Curls.jpg", url:""},
      {name:"Barbell Curls", img:"images/biceps/Barbell-Curls.jpg", url:""},
    ],
    abs: [
      {name:"Plank", img:"images/abs/Plank.jpg", url:""},
      {name:"Leg Raises", img:"images/abs/Leg-Raises.jpg", url:""},
    ],
    quads: ["Squats","Lunges"],
    traps: ["Shrugs","Rack Pulls"],
    delts: ["Overhead Press","Lateral Raises"],
    lats:  ["Pull-Ups","Lat Pulldown"],
    glutes:["Hip Thrusts","Glute Bridge"],
    hams:  ["Deadlifts","Leg Curls"]
  };
  const muscleMap = { 'quadsL':'quads','quadsR':'quads','deltsL':'delts','deltsR':'delts','hamsL':'hams','hamsR':'hams','biceps2':'biceps' };

  function showMuscle(id, label){
    const info = $("#muscleInfo");
    const name = $("#muscleName");
    const gallery = $("#muscleExercises");
    if (!info || !name || !gallery) return;

    name.textContent = label;
    gallery.innerHTML = "";
    const group = exercises[id] || [];
    group.forEach(ex => {
      if (typeof ex === "string"){
        const li = document.createElement("li"); li.textContent = ex; gallery.appendChild(li); return;
      }
      const card = document.createElement("div");
      card.className = "workout-card";
      card.innerHTML = `<img src="${ex.img}" alt="${ex.name}" style="border:2px solid var(--border);" /><h4>${ex.name}</h4>`;
      on(card, "click", () => {
        $("#modalTitle").textContent = ex.name;
        $("#modalVideo").src = ex.url;
        modal.classList.add("show");
      });
      gallery.appendChild(card);
    });
    info.style.display = "block";
  }
  function closeModal(){
    modal.classList.remove('show');
    $("#modalVideo").src = '';
  }
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  Object.keys(exercises).forEach(id => {
    const el = document.getElementById(id);
    if (el){ el.style.cursor="pointer"; el.addEventListener("click", ()=> showMuscle(id, id.replace(/L|R|2/,'').toUpperCase())); }
  });
  Object.entries(muscleMap).forEach(([svgId, group]) => {
    const el = document.getElementById(svgId);
    if (el){ el.style.cursor="pointer"; el.addEventListener("click", ()=> showMuscle(group, group.toUpperCase())); }
  });
}

async function renderHistory(){
  if (!await guard()) return;
  document.body.classList.remove("auth");
  mount("history-template");
  $("#sidebar")?.classList.remove("open");

  const tbody = $("#historyBody");
  const fDate = $("#filterDate");
  const fText = $("#filterText");
  const fSort = $("#filterSort");

  async function reflow(){
    const logs = await db.listLogs({
      onDate: fDate.value || null,
      text: fText.value.trim(),
      sort: fSort.value
    });
    tbody.innerHTML = "";
    logs.forEach(l => {
      const vol = (l.sets||0)*(l.reps||0)*(l.weight||0);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${l.date}</td>
        <td>${escapeHTML(l.exercise_name)}</td>
        <td>${l.sets}</td>
        <td>${l.reps}</td>
        <td>${l.weight}</td>
        <td>${vol}</td>
        <td>${escapeHTML(l.notes || "")}</td>
        <td><button class="btn btn-outline" data-del="${l.id}">Delete</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await db.deleteLog(btn.getAttribute("data-del"));
        reflow();
      });
    });
  }
  [fDate, fText, fSort].forEach(el => el.addEventListener("input", reflow));
  reflow();
}

async function renderProgress(){
  if (!await guard()) return;
  document.body.classList.remove("auth");
  mount("progress-template");
  $("#sidebar")?.classList.remove("open");

  const list = $("#progressList");
  let stats = await db.progress();
  if (!stats){
    const logs = await db.listLogs();
    const by = {};
    logs.forEach(l => {
      if (!by[l.exercise_name]) by[l.exercise_name] = { max:0, sessions:0, total:0 };
      by[l.exercise_name].max = Math.max(by[l.exercise_name].max, l.weight||0);
      by[l.exercise_name].sessions += 1;
      by[l.exercise_name].total += (l.sets||0)*(l.reps||0)*(l.weight||0);
    });
    const entries = Object.entries(by);
    list.innerHTML = entries.length
      ? entries.map(([name,v]) => `<li><strong>${escapeHTML(name)}</strong> — max ${v.max}, sessions ${v.sessions}, volume ${v.total.toLocaleString()}</li>`).join("")
      : `<li class="helper">Log some workouts to see progress.</li>`;
  } else {
    list.innerHTML = stats.length
      ? stats.map(s=> `<li><strong>${escapeHTML(s.exercise_name)}</strong> — max ${s.max_weight}, volume ${Number(s.total_volume).toLocaleString()}, last ${s.last_date}</li>`).join("")
      : `<li class="helper">Log some workouts to see progress.</li>`;
  }
}

async function renderGeneratePlan(){
  if (!await guard()) return;
  document.body.classList.remove("auth");
  mount("generate-plan-template");
  $("#sidebar")?.classList.remove("open");

  const equipRow = $("#equipRow");
  EQUIPMENT.forEach(e => {
    const label = document.createElement('label');
    label.className = 'chip';
    label.innerHTML = `<input type="checkbox" value="${e}"> ${e}`;
    equipRow.appendChild(label);
  });

  function getSelectedEquip(){
    return Array.from(equipRow.querySelectorAll('input:checked')).map(x => x.value);
  }

  async function renderPlanOutput(planData){
    const out = $("#planOutput");
    out.innerHTML = '';

    planData.plan.forEach(day => {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'day-plan';
      const h4 = document.createElement('h4');
      h4.textContent = day.name;
      dayDiv.appendChild(h4);

      const exGrid = document.createElement('div');
      exGrid.className = 'exercise-grid';
      const makeExercise = (e, isMain) => {
        const div = document.createElement('div');
        div.className = 'exercise-item';
        const sets = `${e.sets} × ${fmtRange(e.reps)} reps`;
        div.innerHTML = `
          <strong>${e.name}</strong> ${isMain ? '<span class="badge">Main</span>' : '<span class="badge" style="background:var(--muted)">Accessory</span>'}
          <small>${sets} • Rest ${e.rest}s</small>`;
        return div;
      };
      day.main.forEach(m => exGrid.appendChild(makeExercise(m, true)));
      day.accessories.forEach(a => exGrid.appendChild(makeExercise(a, false)));
      dayDiv.appendChild(exGrid);

      const noteP = document.createElement('p');
      noteP.className = 'plan-note';
      noteP.textContent = day.note;
      dayDiv.appendChild(noteP);

      out.appendChild(dayDiv);
    });

    $("#planWeek").textContent = `Week ${planData.meta.week}`;
    // persist remotely
    await db.savePlan({ weekOfISO: weekOfISO(), meta: planData.meta, plan: planData.plan });
    Notify.success("Workout Plan Generated!", "Your personalized plan is saved.");
  }

  // ✅ backend-first generation with graceful fallback
  on($("#generateBtn"), "click", async () => {
    const meta = {
      level: $("#planLevel").value,
      days: $("#planDays").value,
      goal: $("#planGoal").value,
      equipment: getSelectedEquip(),
      adherence: $("#planAdherence").value,
      rpe: Number($("#planRPE").value) || 7,
      week: 1
    };
    if (meta.equipment.length === 0){
      Notify.info("No Equipment Selected", "Select at least one piece of equipment.");
      return;
    }

    try {
      const api = await fetchPlanFromBackend(meta);
      const planData = {
        meta: { ...meta },
        plan: api.plan.map((d, i) => ({
          name: `Day ${i + 1} – ${String(d.split).toUpperCase()}`,
          focus: String(d.split || "").toLowerCase(),
          // convert backend single reps -> [min,max] to fit your renderer
          main: d.workouts.slice(0, 3).map(w => ({
            id: w.exercise.toLowerCase().replace(/\s+/g, ''),
            name: w.exercise,
            sets: w.sets,
            reps: [w.reps, w.reps],
            rest: w.rest_sec ?? 90
          })),
          accessories: d.workouts.slice(3).map(w => ({
            id: w.exercise.toLowerCase().replace(/\s+/g, ''),
            name: w.exercise,
            sets: w.sets,
            reps: [w.reps, w.reps],
            rest: w.rest_sec ?? 75
          })),
          note: "Leave 1–2 RIR. Adjust load based on RPE."
        }))
      };
      await renderPlanOutput(planData);
    } catch (e) {
      console.warn("Backend unavailable, using local generator:", e.message);
      const localPlan = generatePlan(meta);
      await renderPlanOutput(localPlan);
    }
  });

  // try to load this week's existing plan
  const existing = await db.loadPlan(weekOfISO());
  if (existing?.plan){
    const meta = { level: existing.level, days: existing.days, goal: existing.goal, week: 1, adherence:'yes', rpe:7, equipment: existing.equipment||[] };
    await renderPlanOutput({ meta, plan: existing.plan });
  }
}

async function renderSettings(){
  if (!await guard()) return;
  document.body.classList.remove("auth");
  mount("settings-template");
  $("#sidebar")?.classList.remove("open");

  const unitsSel = $("#unitsSelect");
  const weeklyGoal = $("#weeklyGoal");
  const saveBtn = $("#saveSettings");
  const clearBtn = $("#clearData");
  const msg = $("#settingsMsg");

  const s = await db.getSettings();
  if (s.units) unitsSel.value = s.units;
  if (s.weeklyGoal) weeklyGoal.value = s.weeklyGoal;

  on(saveBtn, "click", async () => {
    try {
      await db.setSettings({ units: unitsSel.value, weeklyGoal: +weeklyGoal.value || 3 });
      msg.className = "alert success";
      msg.textContent = "Settings saved.";
    } catch (e){
      msg.className = "alert error";
      msg.textContent = e.message || "Failed to save settings.";
    }
  });

  // Clear only local UI cache if you had one. (We do not delete Supabase data here.)
  on(clearBtn, "click", async () => {
    msg.className = "alert";
    msg.textContent = "Local data cleared (no remote delete).";
  });
}

/* -----------------------------
   Top-bar actions
----------------------------- */
on($("#menuToggle"), "click", () => {
  const sb = $("#sidebar");
  const open = sb.classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded", String(open));
});

on(document, "click", async (e) => {
  if (e.target && e.target.id === "logoutBtn"){
    await db.logout();
    location.hash = "#/login";
  }
  if (e.target && e.target.id === "settingsBtn"){
    location.hash = "#/settings";
  }
});

/* -----------------------------
   Toast Notifications
----------------------------- */
const Notify = (() => {
  const containerId = "congrats";
  const PRAISE = ["Nice Work!", "Let's Go!", "Consistency is Key.", "Keep It Up!!", "Small Steps Add Up."];
  const icon = (t) => (t === "success" ? "✅" : t === "error" ? "⚠️" : "ℹ️");
  function ensureContainer(){
    let c = document.getElementById(containerId);
    if (!c){
      c = document.createElement("div");
      c.id = containerId;
      c.className = "congrats";
      c.setAttribute("aria-live","polite");
      c.setAttribute("aria-atomic","true");
      document.body.appendChild(c);
    }
    return c;
  }
  function show({title, message="", type="info", duration=3500}){
    const c = ensureContainer();
    const el = document.createElement("div");
    el.className = `congrat congrat-${type}`;
    el.innerHTML = `
      <div class="congrat-icon">${icon(type)}</div>
      <div class="congrat-body">
        <strong>${title}</strong>
        ${message ? `<div class="congrat-msg">${message}</div>` : ""}
      </div>
      <button class="congrat-close" aria-label="Close">&times;</button>`;
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    const remove = () => {
      el.classList.remove("show");
      el.addEventListener("transitionend", () => el.remove(), { once:true });
    };
    const t = setTimeout(remove, duration);
    el.querySelector(".congrat-close").addEventListener("click", () => { clearTimeout(t); remove(); });
  }
  return {
    show,
    success: (t,m,d) => show({ title:t, message:m, type:"success", duration:d }),
    info:    (t,m,d) => show({ title:t, message:m, type:"info",    duration:d }),
    praise:  () => PRAISE[Math.floor(Math.random()*PRAISE.length)]
  };
})();
