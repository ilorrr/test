const USERS_KEY = "users";
const CURRENT_USER_KEY = "currentUser";

//Storage
const store = {
  getUsers(){
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  },
  setUsers(u){
    localStorage.setItem(USERS_KEY, JSON.stringify(u));
  },
  getCurrentUser(){
    const r = localStorage.getItem(CURRENT_USER_KEY); 
    return r? JSON.parse(r): null;
  },
  setCurrentUser(u){
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
  },
  clearCurrentUser(){
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};

//Helpers
function mount(html){
    document.getElementById("app").innerHTML = html;
}
function isAuthed(){
    return !!store.getCurrentUser();
}
function guard(){
    if(!isAuthed()){
        location.hash="#/login";
        return false;
    }
    return true;
}
function $(sel, root=document){
    return root.querySelector(sel);
}
function on(el, evt, cb){
    el.addEventListener(evt, cb);
}

//Email & Password Validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function scorePassword(pw){
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function validateRegister({username, email, password}){
  const errors = {};
  if (!username || username.trim().length < 3){
   errors.username = "Username must be at least 3 characters."; 
  }
  if (!emailRegex.test(email)){
    errors.email = "Enter a valid email address.";
  }
  
  const s = scorePassword(password);
  if (s < 3){
    errors.password = "Password must be 8+ chars with upper/lowercase, a number, and preferably a symbol.";
  }
  return { ok: Object.keys(errors).length === 0, errors, score: s };
}

function validateLogin({email, password}){
  const errors = {};
  if (!emailRegex.test(email)){
    errors.email = "Invalid email.";
  }
  if (!password){
    errors.password = "Password is required.";
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

//Templates
const Views = {
  Login: () => `
    <section class="card" aria-labelledby="login-title">
      <h2 id="login-title"> Welcome back </h2>
      <p> Please sign in to continue. </p>
      
      <form id="loginForm" class="form" novalidate>
        <div>
          <input class="input" type="email" id="loginEmail" placeholder="Email" required />
          <div id="loginEmailErr" class="alert error"></div>
        </div>
        
        <div>
          <input class="input" type="password" id="loginPassword" placeholder="Password" required />
          <div id="loginPasswordErr" class="alert error"></div>
        </div>
        
        <button class="btn btn-primary" type="submit"> Login </button>
      </form>
      
      <div class="row" style="margin-top:8px;">
        <span> New here? </span>
        <a class="link" href="#/register"> Create an account </a>
      </div>
      
      <div id="loginMsg" class="alert"></div>
    </section>
  `,
  Register: () => `
    <section class="card" aria-labelledby="reg-title">
      <h2 id="reg-title"> Create account </h2>
      <p> It takes less than a minute. </p>
      
      <form id="regForm" class="form" novalidate>
        <div>
          <input class="input" id="regUsername" type="text" placeholder="Username" required />
          <div id="regUsernameErr" class="alert error"></div>
        </div>
        
        <div>
          <input class="input" id="regEmail" type="email" placeholder="Email" required />
          <div id="regEmailErr" class="alert error"></div>
        </div>
        
        <div>
          <input class="input" id="regPassword" type="password" placeholder="Password (8+ chars)" required aria-describedby="pwHelp" />
          <div class="meter" id="pwMeter"><div class="meter-fill"></div></div>
          <div id="pwHelp" class="helper"> Use upper & lower case, a number, and a symbol. </div>
          <div id="regPasswordErr" class="alert error"></div>
        </div>
        
        <button class="btn btn-primary" type="submit"> Register </button>
      </form>
      
      <div class="row" style="margin-top:8px;">
        <span> Already have an account? </span>
        <a class="link" href="#/login"> Sign in </a>
      </div>
      
      <div id="regMsg" class="alert"></div>
    </section>
  `,
  Home: (user, tab="overview") => `
    <div class="grid cols-3" style="margin-bottom:16px;">
      <div class="card">
        <h3> Welcome, ${user.username} 👋</h3>
        <p> Here’s a quick snapshot of your app. </p>
      </div>
      
      <div class="card">
        <h3> Status </h3>
        <p><strong> Online </strong> • Session active </p>
      </div>
      
      <div class="card">
        <h3> Tips </h3>
        <p> Use the sidebar to navigate between sections. </p>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3> Quick Add </h3>
        <p class="helper"> Demo form with validation. </p>
        
        <form id="quickForm" class="form" novalidate>
          <input id="quickTitle" class="input" placeholder="Title" required />
          
          <select id="quickPriority" class="select" required>
            <option value=""> Priority… </option>
            <option> Low </option>
            <option> Medium </option>
            <option> High </option>
          </select>
          
          <textarea id="quickNotes" class="textarea" rows="4" placeholder="Notes (optional)"></textarea>
          <button class="btn btn-primary" type="submit"> Add </button>
          <div id="quickErr" class="alert error"></div>
          <div id="quickOk" class="alert success"></div>
        </form>
      </div>

      <div class="card">
        <h3> ${tab === "stats" ? "Statistics" : tab === "settings" ? "Settings" : "Activity"} </h3>
        <p class="helper"> ${tab === "stats" ? "Placeholder stats card." : tab === "settings" ? "Placeholder settings card." : "Recent actions appear here."} </p>
        <ul id="activityList"></ul>
      </div>
    </div>
  `
};

//Router
const routes = {
  "#/login": renderLogin,
  "#/register": renderRegister,
  "#/home": renderHome
};

function render(){
  const hash = location.hash || "#/login";
  (routes[hash.split("?")[0]] || routes["#/login"])();
  updateChrome();
}

//Renderers
function renderLogin(){
  document.body.classList.add("auth");      // compact centered mode
  mount(Views.Login());
  $("#sidebar")?.classList.remove("open");

  const form = $("#loginForm");
  const msg = $("#loginMsg");
  on(form, "submit", (e)=>{
    e.preventDefault();
    const payload = {
      email: $("#loginEmail").value.trim().toLowerCase(),
      password: $("#loginPassword").value
    };
    
    const v = validateLogin(payload);
    $("#loginEmailErr").textContent = v.errors.email || "";
    $("#loginPasswordErr").textContent = v.errors.password || "";
    if(!v.ok) return;

    const users = store.getUsers();
    const user = users[payload.email];
    if (user && user.password === payload.password){
      store.setCurrentUser({username:user.username, email: payload.email});
      msg.className = "alert success"; 
      msg.textContent = "Login successful. Redirecting…";
      setTimeout(()=> location.hash="#/home", 200);
    } else {
      msg.className = "alert error"; 
      msg.textContent = "Invalid email or password.";
    }
  });
}

function renderRegister(){
  document.body.classList.add("auth");      // compact centered mode
  mount(Views.Register());
  $("#sidebar")?.classList.remove("open");

  const form = $("#regForm");
  const msg = $("#regMsg");
  const pw = $("#regPassword");
  const meter = $("#pwMeter");
  const meterFill = meter.querySelector(".meter-fill");

  on(pw,"input", ()=>{
    const s = scorePassword(pw.value);
    meter.className = `meter strength-${Math.max(1, s)}`;
    meterFill.style.width = `${(s / 4) * 100}%`;
  });

  on(form, "submit", (e)=>{
    e.preventDefault();
    const payload = {
      username: $("#regUsername").value,
      email: $("#regEmail").value.trim().toLowerCase(),
      password: pw.value
    };
    
    const v = validateRegister(payload);
    $("#regUsernameErr").textContent = v.errors.username || "";
    $("#regEmailErr").textContent = v.errors.email || "";
    $("#regPasswordErr").textContent = v.errors.password || "";
    if(!v.ok) return;

    const users = store.getUsers();
    if (users[payload.email]){
      msg.className = "alert error";
      msg.textContent = "User already exists.";
      return;
    }
    users[payload.email] = { username: payload.username, password: payload.password };
    store.setUsers(users);
    msg.className = "alert success";
    msg.textContent = "Registration successful. You can log in now.";
    setTimeout(()=> location.hash="#/login", 600);
  });
}

function renderHome(){
  if(!guard()) return;
  document.body.classList.remove("auth");   // back to dashboard layout

  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const tab = params.get("tab") || "overview";
  const user = store.getCurrentUser();
  mount(Views.Home(user, tab));

  // Demo quick-form validation
  const qForm = $("#quickForm");
  const qErr = $("#quickErr");
  const qOk = $("#quickOk");
  on(qForm,"submit",(e)=>{
    e.preventDefault();
    
    qErr.textContent= ""; 
    qOk.textContent= "";
    
    const title = $("#quickTitle").value.trim();
    const prio = $("#quickPriority").value;
    if (title.length < 3){
        qErr.textContent= "Title must be at least 3 characters.";
        return;
    }
    if (!prio){
        qErr.textContent= "Please choose a priority.";
        return;
    }
    
    qOk.textContent= "Saved (demo).";
    qForm.reset();
  });
}

//Chrome (logout + sidebar)
function updateChrome(){
  const authed = isAuthed();
  const logoutBtn = $("#logoutBtn");
  if (authed){
    logoutBtn.classList.remove("hidden");
  } else {
    logoutBtn.classList.add("hidden");
  }

  $("#shell").style.display = authed ? "grid" : "block";
  $("#sidebar").style.display = authed ? "block" : "none";
}

//Sidebar toggle for mobile
on($("#menuToggle"), "click", ()=>{
  const sb = $("#sidebar");
  const open = sb.classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded", String(open));
});

//Global logout
on(document, "click", (e)=>{
  if (e.target && e.target.id === "logoutBtn"){
    store.clearCurrentUser();
    location.hash = "#/login";
  }
});

window.addEventListener("hashchange", render);
window.addEventListener("load", render);
