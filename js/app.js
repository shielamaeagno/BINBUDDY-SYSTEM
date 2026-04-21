/* ====================================================
   BINBUDDY - FULL APP ENGINE
   ==================================================== */

// ===============================
// GLOBAL STATE
// ===============================
const AppState = {
  currentScreen: "auth",
  role: "household",
  logType: "bio",
  logQty: 1.0,
  ecoPoints: 1245,
  streak: 7,
  logs: [],
  notifications: [],
};

// ===============================
// INIT ON LOAD
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  initSplash();
  initNavigation();
  initAuth();
  initGuide();
  initRewards();
  initNotifications();
  renderLeaderboard();
  renderRecentLogs();
  renderProfile();
});

// ===============================
// SPLASH SCREEN
// ===============================
function initSplash() {
  const splashScreen = document.getElementById("screen-splash");
  if (!splashScreen) {
    goTo("auth");
    return;
  }

  // Keep splash visible briefly, then continue to auth.
  setTimeout(() => {
    goTo("auth");
  }, 1800);
}

// ===============================
// SCREEN NAVIGATION SYSTEM
// ===============================
function goTo(screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

  const target = document.getElementById(`screen-${screen}`);
  if (target) target.classList.add("active");

  AppState.currentScreen = screen;

  // Keep bottom navigation selection in sync
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.nav === screen);
  });

  // Bottom nav visibility
  const nav = document.getElementById("bottom-nav");
  if (nav) {
    if (screen === "auth" || screen === "splash") {
      nav.classList.add("hidden");
    } else {
      nav.classList.remove("hidden");
    }
  }

  // refresh dynamic screens
  if (screen === "leaderboard") renderLeaderboard();
  if (screen === "track") renderRecentLogs();
  if (screen === "guide") initGuide();
  if (screen === "profile") renderProfile();
}

// ===============================
// TOAST SYSTEM
// ===============================
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// ===============================
// MODALS
// ===============================
function openLogModal() {
  document.getElementById("log-modal").classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

// ===============================
// LOG TYPE SELECT
// ===============================
function selectLogType(type, el) {
  AppState.logType = type;

  document.querySelectorAll(".waste-chip").forEach(c => c.classList.remove("active"));
  if (el) el.classList.add("active");
}

// ===============================
// QUANTITY CONTROL (TRACK SCREEN)
// ===============================
function increaseQty() {
  AppState.logQty = Math.round((AppState.logQty + 0.1) * 10) / 10;
  updateQtyUI();
}

function decreaseQty() {
  AppState.logQty = Math.max(0.1, Math.round((AppState.logQty - 0.1) * 10) / 10);
  updateQtyUI();
}

function updateQtyUI() {
  const qty = document.getElementById("qty-display");
  if (qty) qty.textContent = AppState.logQty.toFixed(1);

  const modalQty = document.getElementById("modal-qty");
  if (modalQty) modalQty.textContent = AppState.logQty.toFixed(1);
}

// ===============================
// SUBMIT WASTE LOG
// ===============================
function submitLog() {
  const points = Math.floor(AppState.logQty * 20);

  AppState.ecoPoints += points;
  AppState.streak += 1;

  const log = {
    id: Date.now(),
    type: AppState.logType,
    qty: AppState.logQty,
    points,
    date: new Date().toLocaleDateString(),
  };

  AppState.logs.unshift(log);

  // notification
  AppState.notifications.unshift({
    text: `You earned ${points} EcoPoints from ${AppState.logType.toUpperCase()} waste`,
    date: new Date().toLocaleString(),
  });

  updateEcoPointsUI();
  renderRecentLogs();
  renderNotifications();
  renderProfile();

  closeModal("log-modal");
  openSuccessModal(log);

  showToast("EcoPoints earned! 🌿");
}

// ===============================
// SUCCESS MODAL
// ===============================
function openSuccessModal(log) {
  const type = document.getElementById("success-type");
  const qty = document.getElementById("success-qty");
  const pts = document.getElementById("success-pts");

  if (type) type.textContent = log.type.toUpperCase();
  if (qty) qty.textContent = `${log.qty} kg logged`;
  if (pts) pts.textContent = `+${log.points} EcoPoints`;

  document.getElementById("success-modal").classList.add("active");
}

// ===============================
// ECOPOINTS UPDATE
// ===============================
function updateEcoPointsUI() {
  document.querySelectorAll(".ecopoints-value").forEach(el => {
    el.textContent = AppState.ecoPoints;
  });

  const profilePts = document.getElementById("profile-pts");
  if (profilePts) profilePts.textContent = AppState.ecoPoints;
}

// ===============================
// RECENT LOGS
// ===============================
function renderRecentLogs() {
  const el = document.getElementById("recent-logs");
  if (!el) return;

  el.innerHTML = AppState.logs.slice(0, 5).map(l => `
    <div class="card" style="margin-bottom:8px">
      <strong>${l.type.toUpperCase()}</strong><br/>
      ${l.qty} kg • +${l.points} pts<br/>
      <small>${l.date}</small>
    </div>
  `).join("");
}

// ===============================
// FULL HISTORY
// ===============================
function renderFullHistory() {
  const el = document.getElementById("full-history");
  if (!el) return;

  el.innerHTML = AppState.logs.map(l => `
    <div class="card" style="margin-bottom:8px">
      <strong>${l.type.toUpperCase()}</strong><br/>
      ${l.qty} kg • +${l.points} pts<br/>
      <small>${l.date}</small>
    </div>
  `).join("");
}

// ===============================
// LEADERBOARD
// ===============================
function renderLeaderboard() {
  const data = [
    { name: "Maria Santos", pts: 1245 },
    { name: "Juan Dela Cruz", pts: 980 },
    { name: "Ana Reyes", pts: 870 },
    { name: "Mark Lopez", pts: 760 },
    { name: "John Cruz", pts: 690 },
  ];

  const el = document.getElementById("leaderboard-list");
  if (!el) return;

  el.innerHTML = data.map((u, i) => `
    <div class="card" style="display:flex;justify-content:space-between">
      <span>#${i + 1} ${u.name}</span>
      <strong>${u.pts} pts</strong>
    </div>
  `).join("");
}

// ===============================
// GUIDE SYSTEM
// ===============================
function initGuide() {
  const items = [
    { name: "Banana Peel", type: "Biodegradable" },
    { name: "Egg Shells", type: "Biodegradable" },
    { name: "Plastic Bottle", type: "Recyclable" },
    { name: "Can", type: "Recyclable" },
    { name: "Diaper", type: "Residual" },
  ];

  const el = document.getElementById("guide-items");
  if (!el) return;

  el.innerHTML = items.map(i => `
    <div class="card">
      <strong>${i.name}</strong><br/>
      → ${i.type}
    </div>
  `).join("");
}

// ===============================
// REWARDS
// ===============================
function initRewards() {
  const el = document.getElementById("rewards-grid");
  if (!el) return;

  el.innerHTML = `
    <div class="card">📱 ₱50 Load - 500 pts</div>
    <div class="card">🛒 ₱100 Grocery Voucher - 1000 pts</div>
    <div class="card">🎁 Eco Bag - 300 pts</div>
    <div class="card">🌱 Tree Planting Certificate - 1500 pts</div>
  `;
}

// ===============================
// NOTIFICATIONS
// ===============================
function initNotifications() {
  const el = document.getElementById("notif-list");
  if (!el) return;

  el.innerHTML = AppState.notifications.map(n => `
    <div class="card">
      ${n.text}<br/>
      <small>${n.date}</small>
    </div>
  `).join("");
}

function renderNotifications() {
  initNotifications();
}

// ===============================
// PROFILE
// ===============================
function renderProfile() {
  const name = document.getElementById("profile-name");
  const pts = document.getElementById("profile-pts");
  const streak = document.getElementById("profile-streak");

  if (name) name.textContent = "Maria Santos";
  if (pts) pts.textContent = AppState.ecoPoints;
  if (streak) streak.textContent = AppState.streak;
}

// ===============================
// AUTH (LOGIN SIMULATION)
// ===============================
function initAuth() {
  const loginBtn = document.getElementById("btn-login");
  const guestBtn = document.getElementById("btn-guest");
  const authTabs = document.querySelectorAll(".auth-tab");
  const roleCards = document.querySelectorAll(".role-card");
  const authPrimaryButton = document.getElementById("btn-login");
  const authSubtitle = document.querySelector("#screen-auth .auth-header p");

  // Login/Register tab switching (UI simulation)
  authTabs.forEach((tab, idx) => {
    tab.addEventListener("click", () => {
      authTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      if (!authPrimaryButton) return;
      const isRegister = idx === 1;
      authPrimaryButton.textContent = isRegister ? "Create BinBuddy Account" : "Login to BinBuddy";
      if (authSubtitle) {
        authSubtitle.textContent = isRegister
          ? "Create your account and start earning EcoPoints"
          : "Smart waste tracking for a cleaner Lipa City";
      }
    });
  });

  // Role card selection
  roleCards.forEach(card => {
    card.addEventListener("click", () => {
      roleCards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      AppState.role = card.dataset.role || "household";
    });
  });

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      if (AppState.role === "collector") goTo("collector");
      else if (AppState.role === "admin") goTo("admin");
      else goTo("home");
      document.getElementById("bottom-nav").classList.remove("hidden");
      showToast("Welcome to BinBuddy 🌿");
    });
  }

  if (guestBtn) {
    guestBtn.addEventListener("click", () => {
      goTo("home");
      document.getElementById("bottom-nav").classList.remove("hidden");
    });
  }
}

// ===============================
// NAVIGATION BUTTONS
// ===============================
function initNavigation() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    const navigate = () => {
      const screen = btn.dataset.nav;
      if (screen) goTo(screen);
    };

    btn.addEventListener("click", navigate);
    btn.addEventListener("touchend", (e) => {
      e.preventDefault();
      navigate();
    }, { passive: false });
  });

  // Fallback for the home quick-access guide card.
  const quickGuideCard = document.querySelector("[onclick*=\"goTo('guide')\"]");
  if (quickGuideCard) {
    quickGuideCard.addEventListener("click", () => goTo("guide"));
    quickGuideCard.addEventListener("touchend", (e) => {
      e.preventDefault();
      goTo("guide");
    }, { passive: false });
  }
}

// ===============================
// EXPOSE FUNCTIONS (HTML ACCESS)
// ===============================
window.goTo = goTo;
window.showToast = showToast;
window.openLogModal = openLogModal;
window.closeModal = closeModal;
window.submitLog = submitLog;
window.selectLogType = selectLogType;
window.increaseQty = increaseQty;
window.decreaseQty = decreaseQty;
window.renderLeaderboard = renderLeaderboard;
window.renderNotifications = renderNotifications;
window.initGuide = initGuide;
window.initRewards = initRewards;