"use strict";

/* Keys */
const USERS_KEY = "users";
const CURRENT_USER_KEY = "currentUser";
const LOGS_KEY = "neurofit.logs";
const SETTINGS_KEY = "neurofit.settings";

/* Storage helpers */
const store = {
  getUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); },
  setUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); },
  getCurrentUser() { const r = localStorage.getItem(CURRENT_USER_KEY); return r ? JSON.parse(r) : null; },
  setCurrentUser(u) { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u)); },
  clearCurrentUser() { localStorage.removeItem(CURRENT_USER_KEY); },
  getLogs() { return JSON.parse(localStorage.getItem(LOGS_KEY) || "[]"); },
  setLogs(arr) { localStorage.setItem(LOGS_KEY, JSON.stringify(arr)); },
  getSettings() { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); },
  setSettings(obj) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj)); },
  clearData() { localStorage.removeItem(LOGS_KEY); localStorage.removeItem(SETTINGS_KEY); }
};

/* Streak calc */
function computeStreak() {
  const logs = store.getLogs();
  if (!logs.length) return 0;
  const days = new Set(logs.map(l => String(l.date).slice(0, 10)));
  const today = new Date(); today.setHours(0,0,0,0);
  const todayKey = today.toISOString().slice(0,10);
  let cursor = days.has(todayKey) ? +today : (+today - 86400000);
  let streak = 0;
  while (true) {
    const key = new Date(cursor).toISOString().slice(0,10);
    if (!days.has(key)) break;
    streak++; cursor -= 86400000;
  }
  return streak;
}

/* Small helpers */
function mount(templateId, data = {}) {
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

function scorePassword(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
function validateRegister({ username, email, password }) {
  const errors = {};
  if (!username || username.trim().length < 3) errors.username = "Username must be at least 3 characters.";
  if (!emailRegex.test(email)) errors.email = "Enter a valid email address.";
  if (scorePassword(password) < 3) errors.password = "Password must be 8+ chars with upper/lowercase, a number, and preferably a symbol.";
  return { ok: Object.keys(errors).length === 0, errors };
}
function validateLogin({ email, password }) {
  const errors = {};
  if (!emailRegex.test(email)) errors.email = "Invalid email.";
  if (!password) errors.password = "Password is required.";
  return { ok: Object.keys(errors).length === 0, errors };
}
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
}
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0,0,0,0); x.setDate(x.getDate() - day);
  return x;
}
function formatUnits(w) {
  const units = store.getSettings().units || "lbs";
  return `${w} ${units}`;
}
function isAuthed() { return !!store.getCurrentUser(); }
function guard() { if (!isAuthed()) { location.hash = "#/login"; return false; } return true; }

/* Router */
const routes = {
  "#/login": renderLogin,
  "#/register": renderRegister,
  "#/home": renderHome,
  "#/workouts/log": renderWorkoutLog,
  "#/workouts/diagram": renderBodyDiagram,
  "#/workouts/history": renderHistory,
  "#/progress": renderProgress,
  "#/library": renderLibrary,
  "#/settings": renderSettings
};
function render() {
  const hash = location.hash || "#/login";
  const routeKey = hash.split("?")[0];
  const publicRoutes = ["#/login", "#/register"];
  const isPublic = publicRoutes.includes(routeKey);
  if (!isPublic && !isAuthed()) { location.hash = "#/login"; return; }
  (routes[routeKey] || routes["#/home"])();
  updateChrome();
  updateActiveNav(routeKey);
}

/* Renderers */
function renderLogin() {
  document.body.classList.add("auth");
  mount("login-template");
  $("#sidebar")?.classList.remove("open");

  const form = $("#loginForm");
  const msg = $("#loginMsg");
  on(form, "submit", (e) => {
    e.preventDefault();
    const payload = { email: $("#loginEmail").value.trim().toLowerCase(), password: $("#loginPassword").value };
    const v = validateLogin(payload);
    $("#loginEmailErr").textContent = v.errors.email || "";
    $("#loginPasswordErr").textContent = v.errors.password || "";
    if (!v.ok) return;

    const users = store.getUsers();
    const user = users[payload.email];
    if (user && user.password === payload.password) {
      store.setCurrentUser({ username: user.username, email: payload.email });
      msg.className = "alert success";
      msg.textContent = "Login successful. Redirecting…";
      Notify.success(`Welcome back, ${user.username}!`, `Let’s make progress today.`);
      const s = computeStreak();
      if (s > 0) Notify.info(`Streak: ${s} day${s>1?"s":""}`);
      document.body.classList.remove("auth");
      setTimeout(() => (location.hash = "#/home"), 200);
    } else {
      msg.className = "alert error";
      msg.textContent = "Invalid email or password.";
    }
  });
}

function renderRegister() {
  document.body.classList.add("auth");
  mount("register-template");
  $("#sidebar")?.classList.remove("open");

  const form = $("#regForm");
  const msg = $("#regMsg");
  const pw = $("#regPassword");
  const meter = $("#pwMeter");
  const meterFill = meter.querySelector(".meter-fill");

  on(pw, "input", () => {
    const s = scorePassword(pw.value);
    meter.className = `meter strength-${Math.max(1, s)}`;
    meterFill.style.width = `${(s / 4) * 100}%`;
  });

  on(form, "submit", (e) => {
    e.preventDefault();
    const payload = { username: $("#regUsername").value, email: $("#regEmail").value.trim().toLowerCase(), password: pw.value };
    const v = validateRegister(payload);
    $("#regUsernameErr").textContent = v.errors.username || "";
    $("#regEmailErr").textContent = v.errors.email || "";
    $("#regPasswordErr").textContent = v.errors.password || "";
    if (!v.ok) return;

    const users = store.getUsers();
    if (users[payload.email]) {
      msg.className = "alert error"; msg.textContent = "User already exists."; return;
    }
    users[payload.email] = { username: payload.username, password: payload.password };
    store.setUsers(users);
    msg.className = "alert success";
    msg.textContent = "Registration successful. You can log in now.";
    setTimeout(() => (location.hash = "#/login"), 600);
  });
}

function renderHome() {
  if (!guard()) return;
  document.body.classList.remove("auth");
  const user = store.getCurrentUser();
  mount("home-template", { username: user.username });

  const logs = store.getLogs();
  const weekStart = startOfWeek(new Date());
  const thisWeek = logs.filter(l => new Date(l.date) >= weekStart);
  const workoutsCount = new Set(thisWeek.map(l => l.date)).size;
  const volume = thisWeek.reduce((s, l) => s + l.sets * l.reps * l.weight, 0);
  $("#statWorkouts").textContent = String(workoutsCount);
  $("#statVolume").textContent = volume.toLocaleString();

  const list = $("#activityList");
  list.innerHTML = "";
  logs.slice(0, 5).forEach(l => {
    const li = document.createElement("li");
    li.textContent = `${l.date} • ${l.exercise} • ${l.sets}x${l.reps} @ ${formatUnits(l.weight)}`;
    list.appendChild(li);
  });
}

function renderWorkoutLog() {
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
    const notesEl = $("#woNotes");
    const payload = {
      id: crypto.randomUUID(),
      date: $("#woDate").value || today,
      exercise: $("#woExercise").value.trim(),
      sets: +$("#woSets").value,
      reps: +$("#woReps").value,
      weight: +$("#woWeight").value,
      notes: notesEl ? notesEl.value.trim() : "",
      units,
      createdAt: Date.now()
    };
    if (!payload.exercise || !payload.sets || !payload.reps) { err.textContent = "Please fill sets, reps, and exercise."; return; }

    const logs = store.getLogs();
    logs.unshift(payload);
    store.setLogs(logs);

    const details = `${payload.exercise}: ${payload.sets}×${payload.reps}${payload.weight ? ` @ ${formatUnits(payload.weight)}` : ""}`;
    Notify.success(Notify.praise(), details, 4500);
    ok.textContent = "Workout saved!";
    form.reset();
    $("#woDate").value = today;
  });
}

function renderBodyDiagram() {
  if (!guard()) return;
  document.body.classList.remove("auth");
  mount("body-diagram-template");

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
    chest: ["Bench Press", "Push-Ups", "Incline Press"],
    biceps: ["Barbell Curl", "Dumbbell Curl"],
    abs: ["Crunches", "Plank", "Leg Raise"],
    quadsL: ["Squats", "Lunges"],
    quadsR: ["Squats", "Lunges"],
    traps: ["Shrugs", "Rack Pulls"],
    deltsL: ["Overhead Press", "Lateral Raises"],
    deltsR: ["Overhead Press", "Lateral Raises"],
    lats: ["Pull-Ups", "Lat Pulldown"],
    glutes: ["Hip Thrusts", "Glute Bridge"],
    hamsL: ["Deadlifts", "Leg Curls"],
    hamsR: ["Deadlifts", "Leg Curls"]
  };

  function showMuscle(id, label) {
    const info = document.getElementById("muscleInfo");
    const name = document.getElementById("muscleName");
    const list = document.getElementById("muscleExercises");
    name.textContent = label;
    list.innerHTML = "";
    (exercises[id] || []).forEach(ex => {
      const li = document.createElement("li");
      li.textContent = ex;
      list.appendChild(li);
    });
    info.style.display = "block";
  }

  // attach clicks to defined ids; map biceps2 -> biceps
  Object.keys(exercises).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => showMuscle(id, id.toUpperCase()));
  });
  const b2 = document.getElementById("biceps2");
  if (b2) b2.addEventListener("click", () => showMuscle("biceps", "BICEPS"));
}

function renderHistory() {
  if (!guard()) return;
  document.body.classList.remove("auth");
  mount("history-template");
  $("#sidebar")?.classList.remove("open");

  const tbody = $("#historyBody");
  const fDate = $("#filterDate");
  const fText = $("#filterText");
  const fSort = $("#filterSort");

  function reflow() {
    const logs = store.getLogs().slice();
    const dateVal = fDate.value;
    const textVal = fText.value.toLowerCase().trim();
    let list = logs.filter(l => (!dateVal || l.date === dateVal) && (!textVal || l.exercise.toLowerCase().includes(textVal)));
    if (fSort.value === "oldest") list.sort((a,b) => a.createdAt - b.createdAt);
    else if (fSort.value === "volume") list.sort((a,b) => (b.sets*b.reps*b.weight) - (a.sets*a.reps*a.weight));
    else list.sort((a,b) => b.createdAt - a.createdAt);

    tbody.innerHTML = "";
    list.forEach(l => {
      const tr = document.createElement("tr");
      const vol = l.sets * l.reps * l.weight;
      tr.innerHTML = `
        <td>${l.date}</td>
        <td>${escapeHTML(l.exercise)}</td>
        <td>${l.sets}</td>
        <td>${l.reps}</td>
        <td>${formatUnits(l.weight)}</td>
        <td>${vol}</td>
        <td>${escapeHTML(l.notes || "")}</td>
        <td><button class="btn btn-outline" data-del="${l.id}">Delete</button></td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del");
        const remaining = store.getLogs().filter(x => x.id !== id);
        store.setLogs(remaining);
        reflow();
      });
    });
  }
  [fDate, fText, fSort].forEach(i => i.addEventListener("input", reflow));
  reflow();
}

function renderProgress() {
  if (!guard()) return;
  document.body.classList.remove("auth");
  mount("progress-template");
  $("#sidebar")?.classList.remove("open");

  const list = $("#progressList");
  const logs = store.getLogs();
  const byExercise = {};
  logs.forEach(l => {
    if (!byExercise[l.exercise]) byExercise[l.exercise] = { max: 0, sessions: 0, totalVal: 0 };
    byExercise[l.exercise].max = Math.max(byExercise[l.exercise].max, l.weight);
    byExercise[l.exercise].sessions += 1;
    byExercise[l.exercise].totalVal += l.sets * l.reps * l.weight;
  });

  const entries = Object.entries(byExercise);
  if (!entries.length) list.innerHTML = `<li class="helper">Log some workouts to see progress.</li>`;
  else list.innerHTML = entries.map(([name, v]) =>
    `<li><strong>${escapeHTML(name)}</strong> — max ${formatUnits(v.max)}, sessions ${v.sessions}, volume ${v.totalVal.toLocaleString()}</li>`
  ).join("");
}

function renderLibrary() {
  if (!guard()) return;
  document.body.classList.remove("auth");
  mount("library-template");
  $("#sidebar")?.classList.remove("open");
}

function renderSettings() {
  if (!guard()) return;
  document.body.classList.remove("auth");
  mount("settings-template");
  $("#sidebar")?.classList.remove("open");

  const unitsSel = $("#unitsSelect");
  const weeklyGoal = $("#weeklyGoal");
  const saveBtn = $("#saveSettings");
  const clearBtn = $("#clearData");
  const msg = $("#settingsMsg");
  const s = store.getSettings();

  if (s.units) unitsSel.value = s.units;
  if (s.weeklyGoal) weeklyGoal.value = s.weeklyGoal;

  on(saveBtn, "click", () => {
    store.setSettings({ ...store.getSettings(), units: unitsSel.value, weeklyGoal: +weeklyGoal.value || null });
    msg.className = "alert success";
    msg.textContent = "Settings saved.";
  });
  on(clearBtn, "click", () => {
    if (confirm("Delete all logs and settings?")) {
      store.clearData();
      msg.className = "alert";
      msg.textContent = "All data cleared.";
    }
  });
}

/* Chrome/UI */
function updateChrome() {
  const authed = isAuthed();
  const logoutBtn = $("#logoutBtn");
  authed ? logoutBtn.classList.remove("hidden") : logoutBtn.classList.add("hidden");
  $("#shell").style.display = authed ? "grid" : "block";
  $("#sidebar").style.display = authed ? "block" : "none";
}
on($("#menuToggle"), "click", () => {
  const sb = $("#sidebar");
  const open = sb.classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded", String(open));
});
on(document, "click", (e) => {
  if (e.target && e.target.id === "logoutBtn") {
    store.clearCurrentUser(); location.hash = "#/login";
  }
});
function updateActiveNav(routeKey) {
  document.querySelectorAll(".sidebar-link").forEach(a => {
    a.classList.toggle("active", a.getAttribute("href") === routeKey);
  });
}

/* Boot */
window.addEventListener("hashchange", render);
window.addEventListener("load", () => {
  if (!location.hash) location.hash = "#/home";
  render();
});

/* Congrats/toast utility */
const Notify = (() => {
  const containerId = "congrats";
  const PRAISE = ["Nice work!", "Let’s go!", "Consistency is elite.", "You showed up today.", "Small steps add up."];  
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

  function show({ title, message = "", type = "info", duration = 3500 }) {
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
      el.addEventListener("transitionend", () => el.remove(), { once: true });
    };
    const t = setTimeout(remove, duration);
    el.querySelector(".congrat-close").addEventListener("click", () => { clearTimeout(t); remove(); });
  }

  return {
    show,
    success: (t, m, d) => show({ title: t, message: m, type: "success", duration: d }),
    info: (t, m, d) => show({ title: t, message: m, type: "info", duration: d }),
    praise: () => PRAISE[Math.floor(Math.random() * PRAISE.length)]
  };
})();
