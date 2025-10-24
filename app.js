/* =========================================================
   NeuroFit — Single-file Frontend (Supabase Edition)
   Requires:
   - index.html includes <script type="module"> window.supabase = createClient(...) </script>
   - Supabase backend from backend.sql applied
   ========================================================= */

/* =========================
   PLAN GENERATOR ENGINE
   ========================= */
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
  recomp:      { repMainDelta:+0, repAccDelta:+0, restBoost:1.0 },
};

function progressionAdjust(levelParams, adherence, rpe) {
  const p = { ...levelParams };
  if (adherence === 'yes' && rpe <= 7) p.setsMain += 1;
  if (adherence === 'no' || rpe >= 9) {
    p.setsMain = Math.max(2, p.setsMain - 1);
    p.setsAcc  = Math.max(1, p.setsAcc  - 1);
  }
  return p;
}
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const repRange = (base, delta) => [Math.max(3, base[0]+delta), Math.max(4, base[1]+delta)];
const fmtRange = ([a,b]) => `${a}–${b}`;
const withinEquip = (ex, avail) => ex.equip.some(e => avail.has(e));

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

function resolveSlot(slot, avail){
  const options = slot.split('/').map(id => EXERCISES.find(e=>e.id===id)).filter(Boolean);
  const fit = options.filter(e => withinEquip(e, avail));
  return (fit.length ? pick(fit) : pick(options));
}

function generatePlan({level='beginner', days=3, goal='recomp', equipment=[], adherence='yes', rpe=7, week=1}){
  days = Math.min(6, Math.max(2, Number(days)||3));
  const split = SPLITS[days] || SPLITS[3];
  const base = LEVEL_PARAMS[level] || LEVEL_PARAMS.beginner;
  const g = GOAL_TWEAKS[goal] || GOAL_TWEAKS.recomp;

  const tweaked = { ...base, restMain: Math.round(base.restMain*g.restBoost), restAcc: Math.round(base.restAcc*g.restBoost) };
  const prog = progressionAdjust({ ...tweaked }, adherence, rpe);

  const repMain = repRange(base.repMain, g.repMainDelta);
  const repAcc  = repRange(base.repAcc,  g.repAccDelta);
  const avail = new Set(equipment);

  const daysOut = [];
  split.forEach((focusArr, i) => {
    const focus = focusArr[0];
    const bp = BLUEPRINT[focus];
    const mains = bp.main.map(s => resolveSlot(s, avail));
    const accs  = bp.acc.slice().sort(() => Math.random()-0.5).slice(0,3).map(s => resolveSlot(s, avail));
    const dayName = `${['Mon','Tue','Wed','Thu','Fri','Sat'][i%6] || 'Day'} – ${focus.toUpperCase()}`;

    daysOut.push({
      name: dayName,
      focus,
      main: mains.map(x => ({ id:x.id, name:x.name, sets:prog.setsMain, reps:repMain, rest:prog.restMain })),
      accessories: accs.map(x => ({ id:x.id, name:x.name, sets:prog.setsAcc, reps:repAcc,  rest:prog.restAcc  })),
      note: week%4===0 ? 'Deload week: leave 3–4 RIR and reduce weight ~10–15%.' : 'Leave 1–2 RIR. Increase weight next week if top sets feel ≤7 RPE.'
    });
  });

  return { meta:{ level, days, goal, week, adherence, rpe, equipment }, plan: daysOut };
}

/* =========================
   SUPABASE "db" HELPERS
   ========================= */
const db = {
  // Auth
  async session(){ const { data } = await window.supabase.auth.getSession(); return data.session || null; },
  async user(){ const { data } = await window.supabase.auth.getUser(); return data.user || null; },
  async register({ username, email, password }){
    const { data, error } = await window.supabase.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw error;
    return data.user;
  },
  async login({ email, password }){
    const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },
  async logout(){ await window.supabase.auth.signOut(); },

  // Profile settings
  async getSettings(){
    const u = await db.user();
    if (!u) return { units:'lbs', weeklyGoal:3 };
    const { data, error } = await window.supabase.from('profiles').select('units, weekly_goal, username').eq('id', u.id).single();
    if (error || !data) return { units:'lbs', weeklyGoal:3 };
    return { units: data.units, weeklyGoal: data.weekly_goal, username: data.username };
  },
  async setSettings({ units, weeklyGoal }){
    const u = await db.user(); if (!u) throw new Error('Not authed');
    const { error } = await window.supabase.from('profiles').update({ units, weekly_goal: weeklyGoal }).eq('id', u.id);
    if (error) throw error;
  },

  // Workout logs
  async addLog({ date, exercise, sets, reps, weight, notes }){
    const u = await db.user(); if (!u) throw new Error('Not authed');
    const { error } = await window.supabase.from('workout_logs').insert({
      user_id: u.id, date, exercise_name: exercise, sets, reps, weight, notes
    });
    if (error) throw error;
    await db.pushActivity(`Logged ${exercise} (${sets}×${reps}${weight?` @ ${weight}`:''})`);
  },
  async deleteLog(id){
    const u = await db.user(); if (!u) throw new Error('Not authed');
    const { error } = await window.supabase.from('workout_logs').delete().eq('id', id).eq('user_id', u.id);
    if (error) throw error;
  },
  async listLogs({ onDate, text, sort='newest', limit=200, offset=0 }={}){
    const u = await db.user(); if (!u) throw new Error('Not authed');
    let q = window.supabase.from('workout_logs')
      .select('id,date,exercise_name,sets,reps,weight,notes,volume,created_at')
      .eq('user_id', u.id);

    if (onDate) q = q.eq('date', onDate);
    if (text)   q = q.ilike('exercise_name', `%${text}%`);

    // default sort: newest
    if (sort === 'volume') q = q.order('volume', { ascending:false });
    else if (sort === 'oldest') q = q.order('date', { ascending:true }).order('created_at', { ascending:true });
    else q = q.order('date', { ascending:false }).order('created_at', { ascending:false });

    const { data, error } = await q.range(offset, offset+limit-1);
    if (error) throw error;
    return data || [];
  },

  // Weekly stats for dashboard
  async weekStats({ startISO, endISO }){
    const u = await db.user(); if (!u) throw new Error('Not authed');
    const { data, error } = await window.supabase
      .from('workout_logs')
      .select('date,sets,reps,weight')
      .eq('user_id', u.id)
      .gte('date', startISO)
      .lte('date', endISO);
    if (error) throw error;
    const days = new Set(); let volume = 0;
    for (const r of data) { days.add(String(r.date)); volume += (r.sets||0)*(r.reps||0)*(r.weight||0); }
    return { workouts: days.size, volume };
  },

  // Progress
  async progress(){
    const u = await db.user(); if (!u) throw new Error('Not authed');
    const { data, error } = await window.supabase
      .from('exercise_stats_v')
      .select('exercise_name,total_volume,max_weight,best_1rm,last_date')
      .eq('user_id', u.id)
      .order('total_volume', { ascending:false });
    if (error) return null;
    return data || [];
  },

  // Plans
  async savePlan({ weekOfISO, meta, plan }){
    const u = await db.user(); if (!u) throw new Error('Not authed');
    const progression = (meta.rpe <= 7 && meta.adherence === 'yes') ? 1 : (meta.rpe >= 9 ? -1 : 0);
    const { error } = await window.supabase.from('weekly_plans').upsert({
      user_id: u.id, week_of: weekOfISO, level: meta.level, days: meta.days,
      goal: meta.goal, progression, equipment: meta.equipment || [], plan
    }, { onConflict: 'user_id,week_of' });
    if (error) throw error;
  },
  async loadPlan(weekOfISO){
    const u = await db.user(); if (!u) throw new Error('Not authed');
    const { data, error } = await window.supabase
      .from('weekly_plans')
      .select('plan, level, days, goal, progression, equipment, week_of, created_at')
      .eq('user_id', u.id)
      .eq('week_of', weekOfISO)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Activity feed
  async pushActivity(message){
    const u = await db.user(); if (!u) return;
    await window.supabase.from('activity_feed').insert({ user_id: u.id, message });
  }
};

/* =========================
   UTILITIES
   ========================= */
const $ = (sel, root=document) => root.querySelector(sel);
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
  if (!username || username.trim().length < 3) errors.username = "Username must be at least 3 characters.";
  if (!emailRegex.test(email)) errors.email = "Enter a valid email address.";
  if (scorePassword(password) < 3) errors.password = "Password must be 8+ chars with upper/lowercase, a number, and preferably a symbol.";
  return { ok: Object.keys(errors).length === 0, errors };
}
function validateLogin({ email, password }){
  const errors = {};
  if (!emailRegex.test(email)) errors.email = "Invalid email.";
  if (!password) errors.password = "Password is required.";
  return { ok: Object.keys(errors).length === 0, errors };
}
function escapeHTML(str){ return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function startOfWeek(d=new Date()){
  const x = new Date(d);
  const day = (x.getDay()+6)%7;
  x.setHours(0,0,0,0);
  x.setDate(x.getDate()-day);
  return x;
}
const mount = (templateId, data={}) => {
  const tpl = document.getElementById(templateId);
  const clone = tpl.content.cloneNode(true);
  Object.keys(data).forEach(k => {
    const el = clone.querySelector(`[data-${k}]`);
    if (el) el.textContent = data[k];
  });
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(clone);
};
const isAuthed = async () => !!(await db.session());
const guard = async () => { if (!(await isAuthed())) { location.hash = '#/login'; return false; } return true; };

/* =========================
   ROUTER
   ========================= */
const routes = {
  '#/login': renderLogin,
  '#/register': renderRegister,
  '#/home': renderHome,
  '#/workouts/log': renderWorkoutLog,
  '#/workouts/diagram': renderBodyDiagram,
  '#/workouts/history': renderHistory,
  '#/progress': renderProgress,
  '#/settings': renderSettings,
  '#/generatePlan': renderGeneratePlan
};

async function render(){
  const hash = location.hash || '#/login';
  const routeKey = hash.split('?')[0];
  const publicRoutes = ['#/login','#/register'];
  const isPublic = publicRoutes.includes(routeKey);
  if (!isPublic && !(await isAuthed())) { location.hash = '#/login'; return; }
  const handler = routes[routeKey] || renderHome;
  await handler();
  await updateChrome();
  updateActiveNav(routeKey);
}

async function updateChrome(){
  const authed = !!(await db.session());
  const logoutBtn = $('#logoutBtn');
  const settingsBtn = $('#settingsBtn');
  if (authed) { logoutBtn.classList.remove('hidden'); settingsBtn.classList.remove('hidden'); }
  else { logoutBtn.classList.add('hidden'); settingsBtn.classList.add('hidden'); }
  $('#shell').style.display = authed ? 'grid' : 'block';
  $('#sidebar').style.display = authed ? 'block' : 'none';
}

function updateActiveNav(routeKey){
  document.querySelectorAll('.sidebar-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === routeKey);
  });
}

on($('#menuToggle'), 'click', () => {
  const sb = $('#sidebar');
  const open = sb.classList.toggle('open');
  $('#menuToggle').setAttribute('aria-expanded', String(open));
});
on(document, 'click', async (e) => {
  if (e.target && e.target.id === 'logoutBtn'){ await db.logout(); location.hash = '#/login'; }
  if (e.target && e.target.id === 'settingsBtn'){ location.hash = '#/settings'; }
});

/* =========================
   RENDERERS
   ========================= */
async function renderLogin(){
  document.body.classList.add('auth');
  mount('login-template');
  $('#sidebar')?.classList.remove('open');

  const form = $('#loginForm');
  const msg = $('#loginMsg');

  on(form, 'submit', async (e) => {
    e.preventDefault();
    const payload = { email: $('#loginEmail').value.trim().toLowerCase(), password: $('#loginPassword').value };
    const v = validateLogin(payload);
    $('#loginEmailErr').textContent = v.errors.email || '';
    $('#loginPasswordErr').textContent = v.errors.password || '';
    if (!v.ok) return;
    try{
      await db.login(payload);
      msg.className = 'alert success';
      msg.textContent = 'Login successful. Redirecting…';
      Notify.success('Welcome back!', "Let's make progress today.");
      document.body.classList.remove('auth');
      setTimeout(() => (location.hash = '#/home'), 200);
    }catch(err){
      msg.className = 'alert error';
      msg.textContent = err.message || 'Invalid email or password.';
    }
  });
}

async function renderRegister(){
  document.body.classList.add('auth');
  mount('register-template');
  $('#sidebar')?.classList.remove('open');

  const form = $('#regForm');
  const msg = $('#regMsg');
  const pw = $('#regPassword');
  const meter = $('#pwMeter');
  const meterFill = meter.querySelector('.meter-fill');

  on(pw, 'input', () => {
    const s = scorePassword(pw.value);
    meter.className = `meter strength-${Math.max(1,s)}`;
    meterFill.style.width = `${(s/4)*100}%`;
  });

  on(form, 'submit', async (e) => {
    e.preventDefault();
    const payload = { username: $('#regUsername').value.trim(), email: $('#regEmail').value.trim().toLowerCase(), password: pw.value };
    const v = validateRegister(payload);
    $('#regUsernameErr').textContent = v.errors.username || '';
    $('#regEmailErr').textContent = v.errors.email || '';
    $('#regPasswordErr').textContent = v.errors.password || '';
    if (!v.ok) return;
    try{
      await db.register(payload);
      msg.className = 'alert success';
      msg.textContent = 'Registration successful. Check your email to confirm, then log in.';
      setTimeout(() => (location.hash = '#/login'), 800);
    }catch(err){
      msg.className = 'alert error';
      msg.textContent = err.message || 'Registration failed.';
    }
  });
}

async function renderHome(){
  if (!(await guard())) return;
  document.body.classList.remove('auth');

  // username from profile
  const settings = await db.getSettings();
  mount('home-template', { username: settings.username || 'Athlete' });

  const weekStart = startOfWeek(new Date());
  const startISO = weekStart.toISOString().slice(0,10);
  const endDate = new Date(weekStart); endDate.setDate(endDate.getDate()+6);
  const endISO = endDate.toISOString().slice(0,10);

  const stats = await db.weekStats({ startISO, endISO });
  $('#statWorkouts').textContent = String(stats.workouts);
  $('#statVolume').textContent = stats.volume.toLocaleString();

  // show last 5 activities = last 5 logs (simple)
  const list = $('#activityList');
  list.innerHTML = '';
  const recent = await db.listLogs({ limit: 5 });
  const units = settings.units || 'lbs';
  recent.forEach(l => {
    const li = document.createElement('li');
    const w = l.weight != null ? ` @ ${l.weight} ${units}` : '';
    li.textContent = `${l.date} • ${l.exercise_name} • ${l.sets}x${l.reps}${w}`;
    list.appendChild(li);
  });
}

async function renderWorkoutLog(){
  if (!(await guard())) return;
  document.body.classList.remove('auth');
  mount('workout-log-template');
  $('#sidebar')?.classList.remove('open');

  const form = $('#workoutForm');
  const err = $('#woErr');
  const ok  = $('#woOK');
  const today = new Date().toISOString().slice(0,10);
  $('#woDate').value = today;

  on(form, 'submit', async (e) => {
    e.preventDefault();
    err.textContent = ''; ok.textContent = '';

    const notesEl = $('#woNotes');
    const payload = {
      date: $('#woDate').value || today,
      exercise: $('#woExercise').value.trim(),
      sets: +$('#woSets').value,
      reps: +$('#woReps').value,
      weight: +$('#woWeight').value,
      notes: notesEl ? notesEl.value.trim() : ''
    };
    if (!payload.exercise || !payload.sets || !payload.reps) { err.textContent = 'Please fill sets, reps, and exercise.'; return; }

    try{
      await db.addLog(payload);
      const settings = await db.getSettings();
      const units = settings.units || 'lbs';
      const details = `${payload.exercise}: ${payload.sets}×${payload.reps}${payload.weight?` @ ${payload.weight} ${units}`:''}`;
      Notify.success(Notify.praise(), details, 4500);
      ok.textContent = 'Workout saved!';
      form.reset();
      $('#woDate').value = today;
    }catch(ex){
      err.textContent = ex.message || 'Failed to save workout.';
    }
  });
}

async function renderBodyDiagram(){
  if (!(await guard())) return;
  document.body.classList.remove('auth');
  mount('body-diagram-template');

  const contentArea = document.getElementById('app');
  if (contentArea) contentArea.classList.add('full-width');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'videoModal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalTitle"> Exercise Video </h3>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <iframe id="modalVideo" class="modal-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>`;
  document.body.appendChild(modal);

  const toggleBtn = document.getElementById('toggleViewBtn');
  const front = document.getElementById('frontView');
  const back  = document.getElementById('backView');

  toggleBtn.addEventListener('click', () => {
    const isFront = front.style.display !== 'none';
    front.style.display = isFront ? 'none' : 'block';
    back.style.display  = isFront ? 'block' : 'none';
    toggleBtn.textContent = isFront ? 'Show Front View' : 'Show Back View';
  });

  const exercises = {
    chest: [
      {name:'Bench Press', img:'images/chest/Bench-Press.jpg', url:'https://www.youtube.com/embed/hWbUlkb5Ms4'}
      // … (you can add more thumbnails later)
    ],
    biceps: [],
    abs: [],
    quads: ['Squats','Lunges'],
    traps: ['Shrugs','Rack Pulls'],
    delts: ['Overhead Press','Lateral Raises'],
    lats: ['Pull-Ups','Lat Pulldown'],
    glutes: ['Hip Thrusts','Glute Bridge'],
    hams: ['Deadlifts','Leg Curls']
  };

  const muscleMap = { quadsL:'quads', quadsR:'quads', deltsL:'delts', deltsR:'delts', hamsL:'hams', hamsR:'hams', biceps2:'biceps' };

  function showMuscle(id, label){
    const info = document.getElementById('muscleInfo');
    const name = document.getElementById('muscleName');
    const gallery = document.getElementById('muscleExercises');
    if (!info || !name || !gallery) return;

    name.textContent = label;
    gallery.innerHTML = '';
    const muscleExercises = exercises[id] || [];
    muscleExercises.forEach(ex => {
      const card = document.createElement('div');
      card.className = 'workout-card';
      card.innerHTML = `<img src="${ex.img}" alt="${ex.name}" style="border: 2px solid var(--border);" /><h4>${ex.name}</h4>`;
      card.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = ex.name;
        document.getElementById('modalVideo').src = ex.url || '';
        modal.classList.add('show');
      });
      gallery.appendChild(card);
    });
    info.style.display = 'block';
  }
  function closeModal(){ modal.classList.remove('show'); document.getElementById('modalVideo').src = ''; }
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  Object.keys(exercises).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const label = id.replace(/L|R|2/, '').toUpperCase();
        showMuscle(id, label);
      });
    }
  });
  Object.entries(muscleMap).forEach(([svgId, exerciseGroup]) => {
    const el = document.getElementById(svgId);
    if (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const label = exerciseGroup.toUpperCase();
        showMuscle(exerciseGroup, label);
      });
    }
  });
}

async function renderHistory(){
  if (!(await guard())) return;
  document.body.classList.remove('auth');
  mount('history-template');
  $('#sidebar')?.classList.remove('open');

  const tbody = $('#historyBody');
  const fDate = $('#filterDate');
  const fText = $('#filterText');
  const fSort = $('#filterSort');

  const settings = await db.getSettings();
  const units = settings.units || 'lbs';

  async function reflow(){
    const logs = await db.listLogs({
      onDate: fDate.value || null,
      text: fText.value.trim(),
      sort: fSort.value
    });
    tbody.innerHTML = '';
    logs.forEach(l => {
      const vol = (l.sets||0)*(l.reps||0)*(l.weight||0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${l.date}</td>
        <td>${escapeHTML(l.exercise_name)}</td>
        <td>${l.sets}</td>
        <td>${l.reps}</td>
        <td>${l.weight != null ? `${l.weight} ${units}` : '-'}</td>
        <td>${vol}</td>
        <td>${escapeHTML(l.notes || '')}</td>
        <td><button class="btn btn-outline" data-del="${l.id}">Delete</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await db.deleteLog(btn.getAttribute('data-del'));
        reflow();
      });
    });
  }
  [fDate, fText, fSort].forEach(i => i.addEventListener('input', reflow));
  reflow();
}

async function renderProgress(){
  if (!(await guard())) return;
  document.body.classList.remove('auth');
  mount('progress-template');
  $('#sidebar')?.classList.remove('open');

  const list = $('#progressList');
  const settings = await db.getSettings();
  const units = settings.units || 'lbs';

  let data = await db.progress();
  if (!data || !data.length) {
    // fallback: derive from logs if the view is empty
    const logs = await db.listLogs();
    const byExercise = {};
    for (const l of logs) {
      if (!byExercise[l.exercise_name]) byExercise[l.exercise_name] = { max: 0, sessions: 0, totalVal: 0 };
      byExercise[l.exercise_name].max = Math.max(byExercise[l.exercise_name].max, l.weight || 0);
      byExercise[l.exercise_name].sessions += 1;
      byExercise[l.exercise_name].totalVal += (l.sets||0)*(l.reps||0)*(l.weight||0);
    }
    const entries = Object.entries(byExercise);
    if (!entries.length) { list.innerHTML = `<li class="helper">Log some workouts to see progress.</li>`; return; }
    list.innerHTML = entries.map(([name, v]) =>
      `<li><strong>${escapeHTML(name)}</strong> — max ${v.max} ${units}, sessions ${v.sessions}, volume ${v.totalVal.toLocaleString()}</li>`
    ).join('');
    return;
  }

  list.innerHTML = data.map(row =>
    `<li><strong>${escapeHTML(row.exercise_name)}</strong> — max ${Number(row.max_weight||0)} ${units}, ` +
    `1RM ${row.best_1rm ? Number(row.best_1rm).toFixed(0) : 0} ${units}, ` +
    `volume ${Number(row.total_volume||0).toLocaleString()} (last: ${row.last_date})</li>`
  ).join('');
}

async function renderGeneratePlan(){
  if (!(await guard())) return;
  document.body.classList.remove('auth');
  mount('generate-plan-template');
  $('#sidebar')?.classList.remove('open');

  const equipRow = $('#equipRow');
  EQUIPMENT.forEach(e => {
    const label = document.createElement('label');
    label.className = 'chip';
    label.innerHTML = `<input type="checkbox" value="${e}"> ${e}`;
    equipRow.appendChild(label);
  });

  function getSelectedEquip(){
    return Array.from(equipRow.querySelectorAll('input:checked')).map(x => x.value);
  }
  function weekOfISO(d=new Date()){ const monday = startOfWeek(d); return monday.toISOString().slice(0,10); }

  async function renderPlanOutput(planData){
    const out = $('#planOutput');
    out.innerHTML = '';
    planData.plan.forEach(day => {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'day-plan';
      const h4 = document.createElement('h4'); h4.textContent = day.name; dayDiv.appendChild(h4);

      const exGrid = document.createElement('div'); exGrid.className = 'exercise-grid';
      const makeExercise = (e, isMain) => {
        const div = document.createElement('div'); div.className = 'exercise-item';
        const sets = `${e.sets} × ${fmtRange(e.reps)} reps`;
        div.innerHTML = `<strong>${e.name}</strong> ${isMain?'<span class="badge">Main</span>':'<span class="badge" style="background:var(--muted)">Accessory</span>'}
                         <small>${sets} • Rest ${e.rest}s</small>`;
        return div;
      };
      day.main.forEach(m => exGrid.appendChild(makeExercise(m,true)));
      day.accessories.forEach(a => exGrid.appendChild(makeExercise(a,false)));
      dayDiv.appendChild(exGrid);

      const noteP = document.createElement('p'); noteP.className='plan-note'; noteP.textContent = day.note; dayDiv.appendChild(noteP);
      out.appendChild(dayDiv);
    });

    $('#planWeek').textContent = `Week ${planData.meta.week}`;
    await db.savePlan({ weekOfISO: weekOfISO(), meta: planData.meta, plan: planData.plan });
    Notify.success('Workout Plan Generated!', 'Your personalized plan is saved.');
  }

  on($('#generateBtn'), 'click', async () => {
    const meta = {
      level: $('#planLevel').value,
      days: Number($('#planDays').value) || 4,
      goal: $('#planGoal').value,
      equipment: getSelectedEquip(),
      adherence: $('#planAdherence').value,
      rpe: Number($('#planRPE').value) || 7,
      week: 1
    };
    if (meta.equipment.length === 0){ Notify.info('No Equipment Selected', 'Select at least one piece of equipment.'); return; }
    const plan = generatePlan(meta);
    await renderPlanOutput(plan);
  });

  // Load existing for current week if present
  const existing = await db.loadPlan(weekOfISO());
  if (existing?.plan) {
    const meta = { level: existing.level, days: existing.days, goal: existing.goal, adherence:'yes', rpe:7, week: 1, equipment: existing.equipment || [] };
    await renderPlanOutput({ meta, plan: existing.plan });
  }
}

async function renderSettings(){
  if (!(await guard())) return;
  document.body.classList.remove('auth');
  mount('settings-template');
  $('#sidebar')?.classList.remove('open');

  const unitsSel = $('#unitsSelect');
  const weeklyGoal = $('#weeklyGoal');
  const saveBtn = $('#saveSettings');
  const clearBtn = $('#clearData');
  const msg = $('#settingsMsg');

  const s = await db.getSettings();
  if (s.units) unitsSel.value = s.units;
  if (s.weeklyGoal) weeklyGoal.value = s.weeklyGoal;

  on(saveBtn, 'click', async () => {
    try{
      await db.setSettings({ units: unitsSel.value, weeklyGoal: +weeklyGoal.value || 3 });
      msg.className = 'alert success'; msg.textContent = 'Settings saved.';
    }catch(ex){
      msg.className = 'alert error'; msg.textContent = ex.message || 'Failed to save settings.';
    }
  });

  on(clearBtn, 'click', async () => {
    // Clearing remote data en masse is dangerous; keep it as a UI reset only
    msg.className = 'alert'; msg.textContent = 'To clear logs, delete them from History.';
  });
}

/* =========================
   BOOT
   ========================= */
window.addEventListener('hashchange', render);
window.addEventListener('load', async () => {
  if (!location.hash) {
    const authed = !!(await db.session());
    location.hash = authed ? '#/home' : '#/login';
  }
  render();
});

/* =========================
   TOAST NOTIFICATIONS
   ========================= */
const Notify = (() => {
  const containerId = 'congrats';
  const PRAISE = ['Nice Work!', "Let's Go!", 'Consistency is Key.', 'Keep It Up!!', 'Small Steps Add Up.'];
  const icon = (t) => (t === 'success' ? '✅' : t === 'error' ? '⚠️' : 'ℹ️');

  function ensureContainer(){
    let c = document.getElementById(containerId);
    if (!c) {
      c = document.createElement('div');
      c.id = containerId;
      c.className = 'congrats';
      c.setAttribute('aria-live','polite');
      c.setAttribute('aria-atomic','true');
      document.body.appendChild(c);
    }
    return c;
  }

  function show({title, message='', type='info', duration=3500}){
    const c = ensureContainer();
    const el = document.createElement('div');
    el.className = `congrat congrat-${type}`;
    el.innerHTML = `
      <div class="congrat-icon">${icon(type)}</div>
      <div class="congrat-body">
        <strong>${title}</strong>
        ${message ? `<div class="congrat-msg">${message}</div>` : ''}
      </div>
      <button class="congrat-close" aria-label="Close">&times;</button>`;
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const remove = () => { el.classList.remove('show'); el.addEventListener('transitionend', () => el.remove(), { once:true }); };
    const t = setTimeout(remove, duration);
    el.querySelector('.congrat-close').addEventListener('click', () => { clearTimeout(t); remove(); });
  }

  return {
    show,
    success: (t,m,d) => show({ title:t, message:m, type:'success', duration:d }),
    info: (t,m,d) => show({ title:t, message:m, type:'info', duration:d }),
    praise: () => PRAISE[Math.floor(Math.random()*PRAISE.length)]
  };
})();
