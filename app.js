
/* =========================================================
   NeuroFit – Merged Single-File App (Supabase + Fallback)
   - Prefers Supabase + Postgres (auth, logs, plans, friends)
   - Falls back to localStorage if supabase is unavailable
   - Includes backend plan generator (Render) integration
   - Works with existing HTML templates (ids used below)
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
   Backend plan generator (Render API)
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

/* -----------------------------
   Helpers
----------------------------- */
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
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]);
}
function startOfWeek(d=new Date()){
  const x = new Date(d);
  const day = (x.getDay()+6)%7; // Monday
  x.setHours(0,0,0,0); x.setDate(x.getDate()-day);
  return x;
}
function weekOfISO(d=new Date()){ return startOfWeek(d).toISOString().slice(0,10); }

/* =========================================================
   DATA ACCESS LAYER – Supabase first, localStorage fallback
   - Public API: db.session, db.user, db.register, db.login, db.logout
                  db.getSettings, db.setSettings
                  db.addLog, db.deleteLog, db.listLogs
                  db.weekStats, db.progress
                  db.savePlan, db.loadPlan
                  db.friendsFeed, db.pushActivity
   ========================================================= */
const hasSupabase = typeof window !== 'undefined' && !!window.supabase;

const store = {
  USERS_KEY: "users",
  CURRENT_USER_KEY: "currentUser",
  LOGS_KEY: "neurofit.logs",
  SETTINGS_KEY: "neurofit.settings",
  PLAN_KEY: "neurofit.workoutPlan",
  getUsers(){ return JSON.parse(localStorage.getItem(this.USERS_KEY) || "{}"); },
  setUsers(u){ localStorage.setItem(this.USERS_KEY, JSON.stringify(u)); },
  getCurrentUser(){ const r = localStorage.getItem(this.CURRENT_USER_KEY); return r ? JSON.parse(r) : null; },
  setCurrentUser(u){ localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(u)); },
  clearCurrentUser(){ localStorage.removeItem(this.CURRENT_USER_KEY); },
  getLogs(){ return JSON.parse(localStorage.getItem(this.LOGS_KEY) || "[]"); },
  setLogs(arr){ localStorage.setItem(this.LOGS_KEY, JSON.stringify(arr)); },
  getSettings(){ return JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || "{}"); },
  setSettings(obj){ localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(obj)); },
  getPlan(){ return JSON.parse(localStorage.getItem(this.PLAN_KEY) || "null"); },
  setPlan(obj){ localStorage.setItem(this.PLAN_KEY, JSON.stringify(obj)); }
};

const db = hasSupabase ? ({
  // ---------- AUTH (Supabase) ----------
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

  // ---------- SETTINGS ----------
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

  // ---------- LOGS ----------
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

  // ---------- DASHBOARD ----------
  async weekStats({ startISO, endISO }){
    const { data, error } = await supabase.from('workout_logs')
      .select('date,sets,reps,weight')
      .gte('date', startISO).lte('date', endISO);
    if (error) throw error;
    const days = new Set(); let volume = 0;
    for (const r of data){ days.add(r.date); volume += r.sets*r.reps*r.weight; }
    return { workouts: days.size, volume };
  },

  // ---------- PROGRESS (view / materialized view optional) ----------
  async progress(){
    const { data, error } = await supabase
      .from('exercise_stats')
      .select('exercise_name,total_volume,max_weight,last_date')
      .order('total_volume', { ascending:false });
    if (error) return null;
    return data;
  },

  // ---------- PLANS ----------
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

  // ---------- SOCIAL / ACTIVITY ----------
  async friendsFeed({ limit=5, offset=0 } = {}){
    const { data, error } = await supabase
      .from('friends_activity')
      .select('*')
      .order('created_at', { ascending:false })
      .range(offset, offset+limit-1);
    if (error) return [];
    return data;
  },
  async pushActivity(message){
    const u = await this.user(); if (!u) return;
    await supabase.from('activity_feed').insert({ user_id: u.id, message });
  }
}) : ({
  // ---------- AUTH (local fallback) ----------
  async session(){ return store.getCurrentUser() ? { user: store.getCurrentUser() } : null; },
  async user(){ return store.getCurrentUser(); },
  async register({ username, email, password }){
    const users = store.getUsers();
    if (users[email]) throw new Error('User already exists');
    users[email] = { username, password };
    store.setUsers(users);
    return { email, user_metadata:{ username } };
  },
  async login({ email, password }){
    const users = store.getUsers();
    const u = users[email];
    if (!u || u.password !== password) throw new Error('Invalid email or password');
    store.setCurrentUser({ id: email, email, user_metadata:{ username: u.username } });
    return { email, user_metadata:{ username: u.username } };
  },
  async logout(){ store.clearCurrentUser(); },

  // ---------- SETTINGS ----------
  async getSettings(){
    const s = store.getSettings();
    return { units: s.units || 'lbs', weeklyGoal: s.weeklyGoal ?? 3 };
  },
  async setSettings({ units, weeklyGoal }){
    const s = store.getSettings();
    store.setSettings({ ...s, units, weeklyGoal });
  },

  // ---------- LOGS ----------
  async addLog({ date, exercise, sets, reps, weight, notes, visibility='private' }){
    const logs = store.getLogs();
    logs.unshift({ id: crypto.randomUUID(), date, exercise_name: exercise, sets, reps, weight, notes, visibility, created_at: Date.now() });
    store.setLogs(logs);
  },
  async deleteLog(id){
    const logs = store.getLogs().filter(l => l.id !== id);
    store.setLogs(logs);
  },
  async listLogs({ onDate, text, sort='newest' } = {}){
    let list = store.getLogs().slice();
    if (onDate) list = list.filter(l => l.date === onDate);
    if (text)   list = list.filter(l => (l.exercise_name||'').toLowerCase().includes(String(text).toLowerCase()));
    if (sort==='oldest') list.sort((a,b)=> (a.date > b.date?1:-1));
    if (sort==='volume') list.sort((a,b)=> ((b.sets*b.reps*b.weight) - (a.sets*a.reps*a.weight)));
    return list;
  },

  // ---------- DASHBOARD ----------
  async weekStats({ startISO, endISO }){
    const logs = store.getLogs();
    const inRange = logs.filter(l => (l.date >= startISO && l.date <= endISO));
    const days = new Set(inRange.map(r => r.date));
    let volume = 0; inRange.forEach(r => { volume += (r.sets||0)*(r.reps||0)*(r.weight||0); });
    return { workouts: days.size, volume };
  },

  // ---------- PROGRESS (derived) ----------
  async progress(){
    const logs = store.getLogs();
    const by = {};
    logs.forEach(l => {
      if (!by[l.exercise_name]) by[l.exercise_name] = { max:0, total:0, last:null };
      by[l.exercise_name].max = Math.max(by[l.exercise_name].max, l.weight||0);
      by[l.exercise_name].total += (l.sets||0)*(l.reps||0)*(l.weight||0);
      by[l.exercise_name].last = l.date;
    });
    return Object.entries(by).map(([exercise_name, v]) => ({
      exercise_name, max_weight:v.max, total_volume:v.total, last_date:v.last
    }));
  },

  // ---------- PLANS ----------
  async savePlan({ weekOfISO, meta, plan }){
    const obj = { week_of: weekOfISO, meta, plan };
    store.setPlan(obj);
  },
  async loadPlan(weekOfISO){
    const p = store.getPlan();
    return (p && p.week_of === weekOfISO) ? p : null;
  },

  // ---------- SOCIAL / ACTIVITY ----------
  async friendsFeed(){ return []; },
  async pushActivity(){ /* no-op in fallback */ }
});

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
  if (logoutBtn && settingsBtn){
    if (authed){ logoutBtn.classList.remove("hidden"); settingsBtn.classList.remove("hidden"); }
    else { logoutBtn.classList.add("hidden"); settingsBtn.classList.add("hidden"); }
  }
  const shell = $("#shell"); const sidebar = $("#sidebar");
  if (shell) shell.style.display = authed ? "grid" : "block";
  if (sidebar) sidebar.style.display = authed ? "block" : "none";
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
      if (typeof Notify !== 'undefined') Notify.success("Welcome back!", "Let's make progress today.");
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
  const meterFill = meter?.querySelector?.(".meter-fill");

  on(pw, "input", () => {
    const s = scorePassword(pw.value);
    if (meter) meter.className = `meter strength-${Math.max(1,s)}`;
    if (meterFill) meterFill.style.width = `${(s/4)*100}%`;
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
      msg.textContent = hasSupabase
        ? "Registration successful. Check your email to confirm, then log in."
        : "Registration successful. You can log in now.";
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
  const username = u?.user_metadata?.username || u?.username || "Athlete";
  mount("home-template", { username });

  const weekStart = startOfWeek(new Date());
  const startISO = weekStart.toISOString().slice(0,10);
  const end = new Date(weekStart); end.setDate(end.getDate()+6);
  const endISO = end.toISOString().slice(0,10);

  try {
    const stats = await db.weekStats({ startISO, endISO });
    $("#statWorkouts").textContent = String(stats.workouts);
    $("#statVolume").textContent   = (stats.volume||0).toLocaleString();
  } catch {
    $("#statWorkouts").textContent = "0";
    $("#statVolume").textContent   = "0";
  }

  const list = $("#activityList");
  if (list){
    list.innerHTML = "";
    const feed = await db.friendsFeed({ limit:5 }).catch(()=>[]);
    feed.forEach(l => {
      const li = document.createElement("li");
      // Keep generic to support both backends
      const msg = l.message || `${l.date||''} • ${l.exercise_name||''} • ${l.sets||''}x${l.reps||''} @ ${l.weight||''}`;
      li.textContent = msg.trim();
      list.appendChild(li);
    });
  }
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
      visibility: 'friends' // simple default; wire to a select if present
    };
    if (!payload.exercise || !payload.sets || !payload.reps){
      err.textContent = "Please fill sets, reps, and exercise."; return;
    }
    try {
      await db.addLog(payload);
      const details = `${payload.exercise}: ${payload.sets}×${payload.reps} @ ${payload.weight||0}`;
      if (typeof Notify !== 'undefined') Notify.success(Notify?.praise?.() || "Saved", details, 4500);
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
        <td>${escapeHTML(l.exercise_name || l.exercise || "")}</td>
        <td>${l.sets||''}</td>
        <td>${l.reps||''}</td>
        <td>${l.weight||''}</td>
        <td>${vol||0}</td>
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
  [fDate, fText, fSort].forEach(el => el && el.addEventListener("input", reflow));
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
    // fallback already handled inside db.progress for fallback mode
    stats = [];
  }
  list.innerHTML = stats.length
    ? stats.map(s=> `<li><strong>${escapeHTML(s.exercise_name)}</strong> — max ${s.max_weight||0}, volume ${Number(s.total_volume||0).toLocaleString()}, last ${s.last_date||'-'}</li>`).join("")
    : `<li class="helper">Log some workouts to see progress.</li>`;
}

async function renderSettings(){
  if (!await guard()) return;
  mount("settings-template");
  const unitsSel = $("#unitsSel");
  const goalInput = $("#weeklyGoal");
  const saveBtn = $("#saveSettings");
  const msg = $("#settingsMsg");

  try{
    const s = await db.getSettings();
    if (unitsSel) unitsSel.value = s.units || 'lbs';
    if (goalInput) goalInput.value = s.weeklyGoal ?? 3;
  } catch {}

  on(saveBtn, "click", async () => {
    try{
      await db.setSettings({ units: unitsSel.value, weeklyGoal: Number(goalInput.value)||3 });
      msg.className = "alert success";
      msg.textContent = "Settings saved.";
    }catch(e){
      msg.className = "alert error";
      msg.textContent = e.message || "Failed to save settings.";
    }
  });
}

async function renderGeneratePlan(){
  if (!await guard()) return;
  mount("generate-template");
  const form = $("#genForm");
  const out = $("#genOut");
  const err = $("#genErr");
  const saveBtn = $("#savePlanBtn");
  const loadBtn = $("#loadPlanBtn");

  on(form, "submit", async (e) => {
    e.preventDefault();
    err.textContent = ""; out.textContent = "";
    const meta = {
      level: $("#level").value,
      days: +$("#days").value,
      goal: $("#goal").value,
      equipment: Array.from(document.querySelectorAll("input[name='equip']:checked")).map(x=>x.value),
      adherence: $("#adherence").value,
      rpe: +$("#rpe").value || 7,
      week: +($("#week").value||1)
    };
    try {
      // Prefer server generator; fallback to local
      let planData;
      try{
        planData = await fetchPlanFromBackend(meta);
      }catch{
        planData = generatePlan(meta);
      }
      out.textContent = JSON.stringify(planData, null, 2);
      saveBtn.disabled = false;
    } catch (e){
      err.textContent = e.message || "Failed to generate plan.";
    }
  });

  on(saveBtn, "click", async () => {
    try{
      const parsed = JSON.parse($("#genOut").textContent || "{}");
      const key = weekOfISO(new Date());
      await db.savePlan({ weekOfISO: key, meta: parsed.meta || {}, plan: parsed.plan || [] });
      if (typeof Notify !== 'undefined') Notify.success("Saved", "Weekly plan saved.", 3000);
    }catch(e){
      alert(e.message || "Failed to save plan");
    }
  });

  on(loadBtn, "click", async () => {
    try{
      const key = weekOfISO(new Date());
      const rec = await db.loadPlan(key);
      out.textContent = rec ? JSON.stringify(rec, null, 2) : "No plan saved for this week.";
    }catch(e){
      alert(e.message || "Failed to load plan");
    }
  });
}

// Expose for console debugging if needed
window.__neurofit = { db, generatePlan, fetchPlanFromBackend, hasSupabase };
