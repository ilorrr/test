// ========================================
// WORKOUT PLAN GENERATOR ENGINE
// ========================================
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
  beginner:    { setsMain:3,  setsAcc:2, repMain:[8,10], repAcc:[10,15], restMain:120, restAcc:60 },
  intermediate:{ setsMain:4,  setsAcc:3, repMain:[6,8],  repAcc:[8,12],  restMain:150, restAcc:75 },
  advanced:    { setsMain:5,  setsAcc:3, repMain:[4,6],  repAcc:[6,10],  restMain:180, restAcc:90 },
};

const GOAL_TWEAKS = {
  strength:    { repMainDelta:-2, repAccDelta:-2, restBoost:1.2 },
  hypertrophy: { repMainDelta:+2, repAccDelta:+2, restBoost:0.9 },
  endurance:   { repMainDelta:+4, repAccDelta:+4, restBoost:0.8 },
  recomp:      { repMainDelta:+0, repAccDelta:+0, restBoost:1.0 },
};

function progressionAdjust(levelParams, adherence, rpe){
  const p = {...levelParams};
  if(adherence==='yes' && rpe<=7){ p.setsMain += 1; }
  if(adherence==='no' || rpe>=9){ 
    p.setsMain = Math.max(2, p.setsMain-1);
    p.setsAcc = Math.max(1, p.setsAcc-1);
  }
  return p;
}

const rng = (min,max)=> Math.floor(Math.random()*(max-min+1))+min;
const pick = (arr)=> arr[Math.floor(Math.random()*arr.length)];
function withinEquip(ex, avail){ return ex.equip.some(e => avail.has(e)); }
function repRange(base, delta){ return [Math.max(3, base[0]+delta), Math.max(4, base[1]+delta)]; }
function fmtRange([a,b]){return `${a}–${b}`}

const SPLITS = {
  2: [ ['full'], ['full'] ],
  3: [ ['push'], ['pull'], ['legs'] ],
  4: [ ['upper'], ['lower'], ['upper'], ['lower'] ],
  5: [ ['upper'], ['lower'], ['push'], ['pull'], ['full'] ],
  6: [ ['push'], ['pull'], ['legs'], ['upper'], ['lower'], ['full'] ],
};

const BLUEPRINT = {
  full: {
    main:  ['squat/goblet/legpress', 'bench/dbbench/pushup', 'row/dbrow/latpulldown/pullup'],
    acc:   ['rdl/hipthrust', 'latraise/fly', 'curl/tric', 'coreplank/corecable/hanging']
  },
  upper: {
    main:  ['bench/dbbench/pushup', 'row/latpulldown/pullup', 'ohp/dbohp'],
    acc:   ['latraise/fly', 'curl', 'tric', 'coreplank/corecable/hanging']
  },
  lower: {
    main:  ['squat/goblet/legpress', 'rdl/dl/hipthrust'],
    acc:   ['legext', 'legcurl', 'calf', 'coreplank']
  },
  push: {
    main:  ['bench/dbbench/pushup', 'ohp/dbohp'],
    acc:   ['fly', 'tric', 'latraise', 'coreplank']
  },
  pull: {
    main:  ['row/dbrow/latpulldown/pullup', 'rdl/dl'],
    acc:   ['curl', 'legcurl', 'coreplank/corecable/hanging']
  },
  legs: {
    main:  ['squat/goblet/legpress', 'rdl/hipthrust/dl'],
    acc:   ['legext', 'legcurl', 'calf', 'coreplank']
  }
};

function resolveSlot(slot, avail){
  const options = slot.split('/').map(id=>EXERCISES.find(e=>e.id===id)).filter(Boolean);
  const fit = options.filter(e=>withinEquip(e, avail));
  return (fit.length? pick(fit) : pick(options));
}

function generatePlan({level='beginner', days=3, goal='recomp', equipment=[], adherence='yes', rpe=7, week=1}){
  days = Math.min(6, Math.max(2, Number(days)||3));
  const split = SPLITS[days] || SPLITS[3];
  const base = LEVEL_PARAMS[level] || LEVEL_PARAMS.beginner;
  const tweaked = {...base};
  const g = GOAL_TWEAKS[goal] || GOAL_TWEAKS.recomp;
  const repMain = repRange(base.repMain, g.repMainDelta);
  const repAcc  = repRange(base.repAcc,  g.repAccDelta);
  tweaked.restMain = Math.round(base.restMain * g.restBoost);
  tweaked.restAcc  = Math.round(base.restAcc  * g.restBoost);

  const prog = progressionAdjust({ ...tweaked }, adherence, rpe);
  const avail = new Set(equipment);
  const daysOut = [];

  split.forEach((focusArr, i)=>{
    const focus = focusArr[0];
    const bp = BLUEPRINT[focus];
    const mains = bp.main.map(s=>resolveSlot(s, avail));
    const accs  = bp.acc.slice().sort(()=>Math.random()-0.5).slice(0, 3).map(s=>resolveSlot(s, avail));
    const dayName = `${['Mon','Tue','Wed','Thu','Fri','Sat'][i%6] || 'Day'} – ${focus.toUpperCase()}`;

    daysOut.push({
      name: dayName,
      focus,
      main: mains.map(x=>({ id:x.id, name:x.name, sets:prog.setsMain, reps:repMain, rest:prog.restMain })),
      accessories: accs.map(x=>({ id:x.id, name:x.name, sets:prog.setsAcc, reps:repAcc, rest:prog.restAcc })),
      note: week%4===0? 'Deload week: leave 3–4 reps in reserve (RIR) and reduce weight ~10–15%.' : 'Aim to leave 1–2 reps in reserve (RIR). Increase weight next week if all top sets feel ≤7 RPE.'
    });
  });

  return { meta:{ level, days, goal, week, adherence, rpe }, plan: daysOut };
}
// --- Supabase-backed store ---
const db = {
  // AUTH
  async session() {
    const { data } = await supabase.auth.getSession();
    return data.session || null;
  },
  async user() {
    const { data } = await supabase.auth.getUser();
    return data.user || null;
  },
  async register({ username, email, password }) {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { username } }
    });
    if (error) throw error;
    // create profile row
    const { error: pErr } = await supabase.from('profiles').insert({
      id: data.user.id, username, units: 'lbs', weekly_goal: 3
    });
    if (pErr) throw pErr;
    return data.user;
  },
  async login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },
  async logout() { await supabase.auth.signOut(); },

  // SETTINGS (profiles)
  async getSettings() {
    const u = await db.user();
    if (!u) return { units: 'lbs', weeklyGoal: 3 };
    const { data, error } = await supabase
      .from('profiles')
      .select('units, weekly_goal')
      .eq('id', u.id)
      .single();
    if (error || !data) return { units: 'lbs', weeklyGoal: 3 };
    return { units: data.units, weeklyGoal: data.weekly_goal };
  },
  async setSettings({ units, weeklyGoal }) {
    const u = await db.user();
    if (!u) throw new Error('Not authed');
    const { error } = await supabase
      .from('profiles')
      .update({ units, weekly_goal: weeklyGoal })
      .eq('id', u.id);
    if (error) throw error;
  },

  // WORKOUT LOGS
  async addLog({ date, exercise, sets, reps, weight, notes }) {
    const u = await db.user();
    if (!u) throw new Error('Not authed');
    const { error } = await supabase.from('workout_logs').insert({
      user_id: u.id,
      date,
      exercise_id: null,           // optional if you have exercises table
      exercise_name: exercise,     // denormalized for quick lists
      sets, reps, weight, notes
    });
    if (error) throw error;
    await db.pushActivity(`Logged ${exercise} (${sets}×${reps} @ ${weight})`);
  },
  async deleteLog(id) {
    const u = await db.user();
    const { error } = await supabase
      .from('workout_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', u.id);
    if (error) throw error;
  },
  async listLogs({ onDate, text, sort = 'newest', limit = 200, offset = 0 } = {}) {
    let q = supabase.from('workout_logs')
      .select('id,date,exercise_name,sets,reps,weight,notes,volume,created_at')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (onDate) q = q.eq('date', onDate);
    if (text)  q = q.ilike('exercise_name', `%${text}%`);

    if (sort === 'volume') q = q.order('volume', { ascending: false });
    if (sort === 'oldest') q = q.order('date', { ascending: true });

    const { data, error } = await q.range(offset, offset + limit - 1);
    if (error) throw error;
    return data;
  },

  // DASHBOARD STATS
  async weekStats({ startISO, endISO }) {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('date,sets,reps,weight')
      .gte('date', startISO)
      .lte('date', endISO);
    if (error) throw error;
    const days = new Set();
    let volume = 0;
    for (const r of data) {
      days.add(r.date);
      volume += r.sets * r.reps * r.weight;
    }
    return { workouts: days.size, volume };
  },

  // PROGRESS
  async progress() {
    // Use a materialized view or compute on the fly
    const { data, error } = await supabase
      .from('exercise_stats') // if you created this view; else compute client-side from listLogs()
      .select('exercise_name,total_volume,max_weight,best_1rm,last_date')
      .order('total_volume', { ascending: false });
    if (error) return null;   // fallback path if view doesn’t exist
    return data;
  },

  // PLANS
  async savePlan({ weekOfISO, meta, plan }) {
    const u = await db.user();
    const { error } = await supabase.from('weekly_plans').upsert({
      user_id: u.id,
      week_of: weekOfISO,
      level: meta.level,
      days: meta.days,
      goal: meta.goal,
      progression: (meta.rpe <= 7 && meta.adherence === 'yes') ? 1 : (meta.rpe >= 9 ? -1 : 0),
      equipment: meta.equipment || [],
      plan
    }, { onConflict: 'user_id,week_of' });
    if (error) throw error;
  },
  async loadPlan(weekOfISO) {
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('plan, level, days, goal, progression, equipment, week_of, created_at')
      .eq('week_of', weekOfISO)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ACTIVITY FEED
  async pushActivity(message) {
    const u = await db.user();
    if (!u) return;
    await supabase.from('activity_feed').insert({ user_id: u.id, message });
  },
  subscribeActivity(handler) {
    return supabase
      .channel('activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' }, (payload) => handler(payload.new))
      .subscribe();
  }
};

function computeStreak(){
    const logs = store.getLogs();
    if (!logs.length) return 0;
    const days = new Set(logs.map(l => String(l.date).slice(0, 10)));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);
    let cursor = days.has(todayKey) ? +today : (+today - 86400000);
    let streak = 0;
    while (true){
        const key = new Date(cursor).toISOString().slice(0, 10);
        if (!days.has(key)) break;
        streak++;
        cursor -= 86400000;
    }
    return streak;
}

function mount(templateId, data = {}){
    const template = document.getElementById(templateId);
    const clone = template.content.cloneNode(true);
    Object.keys(data).forEach(k => {
        const el = clone.querySelector(`[data-${k}]`);
        if (el) el.textContent = data[k];
    });
    const app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(clone);
}

const $ = (sel, root = document) => root.querySelector(sel);
const on = (el, evt, cb) => el && el.addEventListener(evt, cb);
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function scorePassword(pw){
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw) && /\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
}

function validateRegister({ username, email, password }){
    const errors = {};
    if (!username || username.trim().length < 3) errors.username = "Username Must be at Least 3 Characters.";
    if (!emailRegex.test(email)) errors.email = "Enter a Valid Email Address.";
    if (scorePassword(password) < 3) errors.password = "Password Must be 8+ Chars with Upper/Lowercase, a Number, and Preferably a Symbol.";
    return { ok: Object.keys(errors).length === 0, errors };
}

function validateLogin({ email, password }){
    const errors = {};
    if (!emailRegex.test(email)) errors.email = "Invalid Email.";
    if (!password) errors.password = "Password is Required.";
    return { ok: Object.keys(errors).length === 0, errors };
}

function escapeHTML(str){
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function startOfWeek(d = new Date()){
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7;
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - day);
    return x;
}

function formatUnits formatUnitsAsync(w){
    const s = await db.getSettings().units || "lbs";
    return `${w} ${s.units || 'lbs'}`;
}

async function isAuthed(){ return !!(await db.session()); }
async function guard(){
  if (!(await isAuthed())) { location.hash = "#/login"; return false; }
  return true;
}

// ========================================
// ROUTER
// ========================================
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

async function render(){
  const hash = location.hash || "#/login";
  const routeKey = hash.split("?")[0];
  const publicRoutes = ["#/login", "#/register"];
  const isPublic = publicRoutes.includes(routeKey);

  if (!isPublic && !(await isAuthed())) { location.hash = "#/login"; return; }
  const handler = routes[routeKey] || renderHome;
  await handler();                      // now async
  await updateChrome();
  updateActiveNav(routeKey);
}

async function updateChrome(){
  const authed = !!(await db.session());
  const logoutBtn = $("#logoutBtn");
  const settingsBtn = $("#settingsBtn");
  if (authed) { logoutBtn.classList.remove("hidden"); settingsBtn.classList.remove("hidden"); }
  else { logoutBtn.classList.add("hidden"); settingsBtn.classList.add("hidden"); }
  $("#shell").style.display = authed ? "grid" : "block";
  $("#sidebar").style.display = authed ? "block" : "none";
}

window.addEventListener("hashchange", () => render());
window.addEventListener("load", async () => {
  if (!location.hash) {
    const authed = !!(await db.session());
    location.hash = authed ? "#/home" : "#/login";
  }
  render();
});

}

// ========================================
// RENDERERS
// ========================================
on(form, "submit", async (e) => {
  e.preventDefault();
  const payload = {email: $("#loginEmail").value.trim().toLowerCase(), password: $("#loginPassword").value};
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
  } catch (err) {
    msg.className = "alert error";
    msg.textContent = err.message || "Invalid email or password.";
  }
});

}

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
  } catch (err) {
    msg.className = "alert error";
    msg.textContent = err.message || "Registration failed.";
  }
});

}

    async function renderHome(){
    if (!await guard()) return;
    document.body.classList.remove("auth");
    const user = store.getCurrentUser();
    mount("home-template", { username: user.username });
    
   
    const weekStart = startOfWeek(new Date());
    const startISO = weekStart.toISOString().slice(0,10);
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    const endISO = end.toISOString().slice(0,10);

    const stats = await db.weekStats({ startISO, endISO });
    $("#statWorkouts").textContent = String(stats.workouts);
    $("#statVolume").textContent = stats.volume.toLocaleString();

    
    const list = $("#activityList");
    list.innerHTML = "";
    logs.slice(0, 5).forEach(l => {
        const li = document.createElement("li");
        li.textContent = `${l.date} • ${l.exercise} • ${l.sets}x${l.reps} @ ${formatUnits(l.weight)}`;
        list.appendChild(li);
    });
}

function renderWorkoutLog(){
    if (!guard()) return;
    document.body.classList.remove("auth");
    mount("workout-log-template");
    $("#sidebar")?.classList.remove("open");
    
    const form = $("#workoutForm");
    const err = $("#woErr");
    const ok = $("#woOK");
    const today = new Date().toISOString().slice(0, 10);
    $("#woDate").value = today;
    
    on(form, "submit", (e) => {
        e.preventDefault();
        err.textContent = ""; ok.textContent = "";
        
        const units = store.getSettings().units || "lbs";
        await db.addLog({
            date: $("#woDate").value || today,
            exercise: $("#woExercise").value.trim(),
            sets: +$("#woSets").value,
            reps: +$("#woReps").value,
            weight: +$("#woWeight").value,
            notes: notesEl ? notesEl.value.trim() : ""
            });

        Notify.success(Notify.praise(), details, 4500);
        ok.textContent = "Workout saved!";
        form.reset();
        $("#woDate").value = today;
    });
}

function renderBodyDiagram(){
    if (!guard()) return;
    document.body.classList.remove("auth");
    mount("body-diagram-template");

    const contentArea = document.getElementById("app");
    if(contentArea) contentArea.classList.add("full-width");

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'videoModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="modalTitle"> Exercise Video </h3>
                <button class="modal-close" aria-label="Close"> &times; </button>
            </div>
            <iframe id="modalVideo" class="modal-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
    `;
    document.body.appendChild(modal);

    const toggleBtn = document.getElementById("toggleViewBtn");
    const front = document.getElementById("frontView");
    const back = document.getElementById("backView");

    toggleBtn.addEventListener("click", () => {
        const isFront = front.style.display !== "none";
        front.style.display = isFront ? "none" : "block";
        back.style.display = isFront ? "block" : "none";
        toggleBtn.textContent = isFront ? "Show Front View" : "Show Back View";
    });

    const exercises = {
        chest: [
            {name: "Bench Press", img: "images/chest/Bench-Press.jpg", url: "https://www.youtube.com/embed/hWbUlkb5Ms4"},
            {name: "Dumbbell Chest Flies", img: "images/chest/Dumbbell-Chest-Flies.jpg", url: ""},
            {name: "Dumbbell Chest Press", img: "images/chest/Dumbbell-Chest-Press.jpg", url: ""},
            {name: "Dumbbell Incline Chest Press", img: "images/chest/Dumbbell-Incline-Chest-Press.jpg", url: ""},
            {name: "High-to-Low Cable Flies", img: "images/chest/High-to-Low-Cable-Crossover.jpg", url: ""},
            {name: "Incline Bench Press", img: "images/chest/Incline-Bench-Press.jpg", url: ""},
            {name: "Incline Chest Flies", img: "images/chest/Incline-Chest-Flies.jpg", url: ""},
            {name: "Machine Chest Flies", img: "images/chest/Machine-Chest-Flies.jpg", url: ""},
            {name: "Machine Chest Press", img: "images/chest/Machine-Chest-Press.jpg", url: ""}
        ],
        biceps: [
            {name: "Alternating Dumbbell Curls", img: "images/biceps/Alternating-Dumbbell-Curls.jpg", url: ""},
            {name: "Barbell Curls", img: "images/biceps/Barbell-Curls.jpg", url: ""},
            {name: "Cable Bicep Curls", img: "images/biceps/Cable-Bicep-Curl.jpg", url: ""},
            {name: "Concentration Curls", img: "images/biceps/Concentration-Curls.jpg", url: ""},
            {name: "Cross-body Hammer Curls", img: "images/biceps/Cross-Body-Hammer-Curls.jpg", url: ""},
            {name: "EZ-bar Curls", img: "images/biceps/Ez-Barbell-Curl.jpg", url: ""},
            {name: "Hammer Curls", img: "images/biceps/Hammer-Curls.jpg", url: ""},
            {name: "Incline Dumbbell Curls", img: "images/biceps/Incline-Dumbbell-Curl.jpg", url: ""},
            {name: "Reverse Curls", img: "images/biceps/Reverse-Curl.jpg", url: ""},
            {name: "Seated Alternating Dumbbell Curls", img: "images/biceps/Seated-Alternating-Dumbell-Curls.jpg", url: ""},
            {name: "Standing Dumbbell Curls", img: "images/biceps/Standing-Dumbbell-Curls.jpg", url: ""},
            {name: "Zottman Curls", img: "images/biceps/Zottman-Curls.jpg", url: ""}
        ],
        abs: [
            {name: "Bicycle Crunches", img: "images/abs/Bicycle-Crunches.jpg", url: ""},
            {name: "Crunches", img: "images/abs/Crunches.jpg", url: ""},
            {name: "Dumbbell Side Bend", img: "images/abs/Dumbbell-Side-Bend.jpg", url: ""},
            {name: "Flutter Kicks", img: "images/abs/Flutter-Kicks.jpg", url: ""},
            {name: "Leg Raises", img: "images/abs/Leg-Raises.jpg", url: ""},
            {name: "Mountain Climbers", img: "images/abs/Mountain-Climbers.jpg", url: ""},
            {name: "Plank", img: "images/abs/Plank.jpg", url: ""},
            {name: "Reverse Crunches", img: "images/abs/Reverse-Crunches.jpg", url: ""},
            {name: "Russian Twist", img: "images/abs/Russian-Twist.jpg", url: ""},
            {name: "Side Plank", img: "images/abs/Side-Plank.jpg", url: ""},
            {name: "Toe Touches", img: "images/abs/Toe-Touches.jpg", url: ""},
            {name: "V-Ups", img: "images/abs/V-Ups.jpg", url: ""},
            {name: "Weighted Crunches", img: "images/abs/Weighted-Crunches.jpg", url: ""},
            {name: "Weight Sit Ups", img: "images/abs/Weighted-Sit-Ups.jpg", url: ""},
        ],
        quads: ["Squats", "Lunges"],
        traps: ["Shrugs", "Rack Pulls"],
        delts: ["Overhead Press", "Lateral Raises"],
        lats: ["Pull-Ups", "Lat Pulldown"],
        glutes: ["Hip Thrusts", "Glute Bridge"],
        hams: ["Deadlifts", "Leg Curls"]
    };

    const muscleMap = {
        'quadsL': 'quads',
        'quadsR': 'quads',
        'deltsL': 'delts',
        'deltsR': 'delts',
        'hamsL': 'hams',
        'hamsR': 'hams',
        'biceps2': 'biceps'
    };

    function showMuscle(id, label){
        const info = document.getElementById("muscleInfo");
        const name = document.getElementById("muscleName");
        const gallery = document.getElementById("muscleExercises");

        if (!info || !name || !gallery) {
            console.error("Elements Not Found.");
            return;
        }
        
        name.textContent = label;
        gallery.innerHTML = "";
        const muscleExercises = exercises[id] || [];
        
        muscleExercises.forEach(ex => {
            console.log("Exercise:", ex.name, "Image path:", ex.img);
            
            const card = document.createElement("div");
            card.className = "workout-card";
            card.innerHTML = `
                <img src="${ex.img}" alt="${ex.name}" style="border: 2px solid var(--border);" />
                <h4> ${ex.name} </h4>
            `;

            const imgEl = card.querySelector('img');
            imgEl.addEventListener('load', () => console.log("Image loaded:", ex.name));
            imgEl.addEventListener('error', () => console.log("Image FAILED:", ex.name, ex.img));

            card.addEventListener("click", () => {
                document.getElementById('modalTitle').textContent = ex.name;
                document.getElementById('modalVideo').src = ex.url;
                modal.classList.add('show');
            });
            gallery.appendChild(card);
        });
        info.style.display = "block";
    }

    function closeModal(){
        modal.classList.remove('show');
        document.getElementById('modalVideo').src = '';
    }
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    })

    Object.keys(exercises).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.cursor = "pointer";
            el.addEventListener("click", () => {
                const label = id.replace(/L|R|2/, '').toUpperCase();
                showMuscle(id, label);
            });
        }
    });

    Object.entries(muscleMap).forEach(([svgId, exerciseGroup]) => {
        const el = document.getElementById(svgId);
        if (el) {
            el.style.cursor = "pointer";
            el.addEventListener("click", () => {
                const label = exerciseGroup.toUpperCase();
                showMuscle(exerciseGroup, label);
            });
        }
    });
}

function renderHistory(){
    if (!guard()) return;
    document.body.classList.remove("auth");
    mount("history-template");
    $("#sidebar")?.classList.remove("open");
    
    const tbody = $("#historyBody");
    const fDate = $("#filterDate");
    const fText = $("#filterText");
    const fSort = $("#filterSort");
    
    async function reflow() {
        const logs = await db.listLogs({
          onDate: fDate.value || null,
          text: fText.value.trim(),
          sort: fSort.value
  });

  tbody.innerHTML = "";
  logs.forEach(l => {
    const vol = l.sets * l.reps * l.weight;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${l.date}</td>
      <td>${escapeHTML(l.exercise_name)}</td>
      <td>${l.sets}</td>
      <td>${l.reps}</td>
      <td>${formatUnits(l.weight)}</td>
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
[fDate, fText, fSort].forEach(i => i.addEventListener("input", reflow));
reflow();

}

    async function renderProgress(){
    if (!(await guard()) return;
    document.body.classList.remove("auth");
    mount("progress-template");
    $("#sidebar")?.classList.remove("open");
    
    const list = $("#progressList");
    const logs = await db.getLogs();
    const byExercise = {};
    logs.forEach(l => {
        if (!byExercise[l.exercise]) byExercise[l.exercise] = { max: 0, sessions: 0, totalVal: 0 };
        byExercise[l.exercise].max = Math.max(byExercise[l.exercise].max, l.weight);
        byExercise[l.exercise].sessions += 1;
        byExercise[l.exercise].totalVal += l.sets * l.reps * l.weight;
    });
    
    const entries = Object.entries(byExercise);
    if (!entries.length) list.innerHTML = `<li class="helper">Log Some Workouts to See Progress.</li>`;
    else list.innerHTML = entries.map(([name, v]) =>
        `<li><strong>${escapeHTML(name)}</strong> — max ${formatUnits(v.max)}, sessions ${v.sessions}, volume ${v.totalVal.toLocaleString()}</li>`
    ).join("");
}

function renderGeneratePlan(){
    if (!(!await guard()) return;
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

    const savedPlan = store.getPlan();
    if (savedPlan) {
        $("#planWeek").textContent = `Week ${savedPlan.meta.week}`;
    }

    async function getSelectedEquip(){
        return Array.from($("equipRow").querySelectorAll('input:checked')).map(x => x.value);
    }
   function weekOfISO(d=new Date()){
    const monday = startOfWeek(d);
    return monday.toISOString().slice(0,10);
  }

 async function renderGeneratePlan(){
  if (!(await guard())) return;
  document.body.classList.remove("auth");
  mount("generate-plan-template");
  $("#sidebar")?.classList.remove("open");

  // ... build equipment UI as you do now

  async function getSelectedEquip(){
    return Array.from($("#equipRow").querySelectorAll('input:checked')).map(x => x.value);
  }

  function weekOfISO(d=new Date()){
    const monday = startOfWeek(d);
    return monday.toISOString().slice(0,10);
  }

  async function renderPlanOutput(planData){
    // (your current DOM render logic)
    // persist remotely:
    await db.savePlan({ weekOfISO: weekOfISO(), meta: planData.meta, plan: planData.plan });
    Notify.success("Workout Plan Generated!", "Your personalized plan is saved.");
  }

  on($("#generateBtn"), "click", async () => {
    const meta = {
      level: $("#planLevel").value,
      days: $("#planDays").value,
      goal: $("#planGoal").value,
      equipment: await getSelectedEquip(),
      adherence: $("#planAdherence").value,
      rpe: Number($("#planRPE").value) || 7,
      week: 1
    };
    if (meta.equipment.length === 0) {
      Notify.info("No Equipment Selected", "Select at least one piece of equipment.");
      return;
    }
    const plan = generatePlan(meta);
    await renderPlanOutput(plan);
    $("#planWeek").textContent = `Week ${plan.meta.week}`;
  });

  // Try to load existing plan for this week
  const existing = await db.loadPlan(weekOfISO());
  if (existing?.plan) {
    // reconstruct meta for display if you want
    $("#planWeek").textContent = `Week ${/* derive a number if you track it */ 1}`;
    // render existing plan to DOM:
    // reuse your existing render code, feeding { meta: ???, plan: existing.plan }
  }
}


    async function renderSettings(){
    if (!(await guard()) return;
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
        await db.setSettings({...store.getSettings(), units: unitsSel.value, weeklyGoal: +weeklyGoal.value || 3 });
        msg.className = "alert success";
        msg.textContent = "Settings Saved.";
    });

    on(clearBtn, "click", async () => {
            msg.className = "alert";
            msg.textContent = "All Data Cleared."
        }
    });
}

// ========================================
// CHROME UI
// ========================================
function updateChrome(){
    const authed = isAuthed();
    const logoutBtn = $("#logoutBtn");
    const settingsBtn = $("#settingsBtn");

    if (authed) {
        logoutBtn.classList.remove("hidden");
        settingsBtn.classList.remove("hidden");
    } else {
        logoutBtn.classList.add("hidden");
        settingsBtn.classList.add("hidden");
    }

    $("#shell").style.display = authed ? "grid" : "block";
    $("#sidebar").style.display = authed ? "block" : "none";
}

on ($("#menuToggle"), "click", () => {
    const sb = $("#sidebar");
    const open = sb.classList.toggle("open");
    $("#menuToggle").setAttribute("aria-expanded", String(open));
});

on (document, "click", (e) => {
    if (e.target && e.target.id === "logoutBtn"){
        store.clearCurrentUser();
        location.hash = "#/login";
    }
    if (e.target && e.target.id === "settingsBtn"){
        location.hash = "#/settings";
    }
});

function updateActiveNav(routeKey) {
    document.querySelectorAll(".sidebar-link").forEach(a => {
        a.classList.toggle("active", a.getAttribute("href") === routeKey);
    });
}

// ========================================
// BOOT
// ========================================
window.addEventListener("hashchange", render);
window.addEventListener("load", () => {
    const authed = isAuthed();
    if (!location.hash) {
        location.hash = authed ? "#/home" : "#/login";
    }
    render();
});

// ========================================
// TOAST NOTIFICATIONS
// ========================================
const Notify = (() => {
    const containerId = "congrats";
    const PRAISE = ["Nice Work!", "Let's Go!", "Consistency is Key.", "Keep It Up!!", "Small Steps Add Up."];
    const icon = (t) => (t === "success" ? "✅" : t === "error" ? "⚠️" : "ℹ️");

    function ensureContainer() {
        let c = document.getElementById(containerId);
        if (!c) {
            c = document.createElement("div");
            c.id = containerId;
            c.className = "congrats";
            c.setAttribute("aria-live", "polite");
            c.setAttribute("aria-atomic", "true");
            document.body.appendChild(c);
        }
        return c;
    }

    function show({title, message = "", type = "info", duration = 3500}) {
        const c = ensureContainer();
        const el = document.createElement("div");

        el.className = `congrat congrat-${type}`;
        el.innerHTML = `
            <div class="congrat-icon">${icon(type)}</div>
            <div class="congrat-body">
                <strong>${title}</strong>
                ${message ? `<div class="congrat-msg">${message}</div>` : ""}
            </div>
            <button class="congrat-close" aria-label="Close">&times;</button>
        `;
        c.appendChild(el);
        requestAnimationFrame(() => el.classList.add("show"));

        const remove = () => {
            el.classList.remove("show");
            el.addEventListener("transitionend", () => el.remove(), {once: true});
        };

        const t = setTimeout(remove, duration);
        el.querySelector(".congrat-close").addEventListener("click", () => {clearTimeout(t); remove();});
    }

    return {
        show,
        success: (t, m, d) => show({title: t, message: m, type: "success", duration: d}),
        info: (t, m, d) => show({title: t, message: m, type: "info", duration: d}),
        praise: () => PRAISE[Math.floor(Math.random() * PRAISE.length)]
    };
})();
