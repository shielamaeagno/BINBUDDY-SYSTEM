/* ====================================================
   BINBUDDY - APP ENGINE (Workflow-Driven Backend Logic)
   ==================================================== */

const STORAGE_KEY = "binbuddy-state-v2";

const BADGE_LEVELS = [
  { min: 0, label: "Eco Starter" },
  { min: 100, label: "Eco Supporter" },
  { min: 300, label: "Eco Champion" },
  { min: 700, label: "Eco Hero" }
];

const AppState = {
  currentScreen: "auth",
  role: "household",
  authMode: "login",
  logType: "bio",
  logQty: 1.0,
  currentUserId: null,
  users: [],
  logs: [],
  redemptions: [],
  notifications: []
};

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString();
}

function buildSeedState() {
  return {
    users: [
      {
        id: "USR001",
        name: "Maria Santos",
        email: "maria@email.com",
        password: "password123",
        role: "household",
        ecoPoints: 1245,
        streak: 7,
        badge: "Eco Champion",
        barangay: "Holy Spirit"
      },
      {
        id: "COL001",
        name: "Roberto Cruz",
        email: "collector@email.com",
        password: "password123",
        role: "collector",
        ecoPoints: 0,
        streak: 0,
        badge: "Collector",
        barangay: "Holy Spirit"
      },
      {
        id: "ADM001",
        name: "Brgy. Holy Spirit Admin",
        email: "admin@email.com",
        password: "password123",
        role: "admin",
        ecoPoints: 0,
        streak: 0,
        badge: "Admin",
        barangay: "Holy Spirit"
      }
    ],
    logs: [
      {
        id: "LOG001",
        userId: "USR001",
        userName: "Maria Santos",
        type: "PET",
        weight: 1.2,
        createdAt: nowIso(),
        status: "Completed",
        verifiedBy: "COL001",
        completedAt: nowIso(),
        ecoPointsAwarded: 24
      },
      {
        id: "LOG002",
        userId: "USR001",
        userName: "Maria Santos",
        type: "HDPE",
        weight: 0.8,
        createdAt: nowIso(),
        status: "Pending",
        verifiedBy: null,
        completedAt: null,
        ecoPointsAwarded: 0
      }
    ],
    redemptions: [],
    notifications: []
  };
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      users: AppState.users,
      logs: AppState.logs,
      redemptions: AppState.redemptions,
      notifications: AppState.notifications
    })
  );
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = buildSeedState();
    AppState.users = seed.users;
    AppState.logs = seed.logs;
    AppState.redemptions = seed.redemptions;
    AppState.notifications = seed.notifications;
    persistState();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    AppState.users = parsed.users || [];
    AppState.logs = parsed.logs || [];
    AppState.redemptions = parsed.redemptions || [];
    AppState.notifications = parsed.notifications || [];
  } catch (_err) {
    const fallback = buildSeedState();
    AppState.users = fallback.users;
    AppState.logs = fallback.logs;
    AppState.redemptions = fallback.redemptions;
    AppState.notifications = fallback.notifications;
    persistState();
  }
}

const AuthService = {
  register(payload) {
    const { email, password, role } = payload;
    const existing = AppState.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.role === role);
    if (existing) return { ok: false, message: "Account already exists for this role." };
    const idPrefix = role === "collector" ? "COL" : role === "admin" ? "ADM" : "USR";
    const id = `${idPrefix}${String(AppState.users.length + 1).padStart(3, "0")}`;
    const user = {
      id,
      name: email.split("@")[0].replace(/\./g, " "),
      email,
      password,
      role,
      ecoPoints: 0,
      streak: 0,
      badge: "Eco Starter",
      barangay: "Holy Spirit"
    };
    AppState.users.push(user);
    persistState();
    return { ok: true, user };
  },
  login(payload) {
    const { email, password, role } = payload;
    const user = AppState.users.find(
      u =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password &&
        u.role === role
    );
    if (!user) return { ok: false, message: "Invalid credentials for selected role." };
    AppState.currentUserId = user.id;
    return { ok: true, user };
  },
  currentUser() {
    return AppState.users.find(u => u.id === AppState.currentUserId) || null;
  }
};

const WasteLogService = {
  normalizeWasteType(rawType) {
    if (rawType === "PET" || rawType === "pet") return "PET";
    if (rawType === "HDPE" || rawType === "hdpe") return "HDPE";
    if (rawType === "bio") return "PET";
    if (rawType === "rec") return "HDPE";
    return null;
  },
  validate(weight, rawType, user) {
    if (!user) return "Login required.";
    const normalizedType = this.normalizeWasteType(rawType);
    if (!normalizedType) return "Waste type selection is required (PET or HDPE only).";
    if (weight === null || weight === undefined || Number.isNaN(weight)) return "Weight is required and must be numeric.";
    if (weight <= 0) return "Weight must be greater than zero.";
    return null;
  },
  createLog({ user, rawType, weight }) {
    const log = {
      id: `LOG${String(Date.now()).slice(-6)}`,
      userId: user.id,
      userName: user.name,
      type: this.normalizeWasteType(rawType),
      weight: Number(weight.toFixed(2)),
      createdAt: nowIso(),
      status: "Pending",
      verifiedBy: null,
      completedAt: null,
      ecoPointsAwarded: 0
    };
    AppState.logs.unshift(log);
    AppState.notifications.unshift({
      text: `Log submitted (${log.type}, ${log.weight} kg). Status: Pending.`,
      createdAt: nowIso()
    });
    persistState();
    return log;
  }
};

const VerificationService = {
  verifyLog(logId, isVerified, collectorId) {
    const log = AppState.logs.find(l => l.id === logId);
    if (!log) return null;
    if (!isVerified) {
      log.status = "Pending";
      persistState();
      return log;
    }
    if (log.status === "Completed") return log;
    log.status = "Completed";
    log.verifiedBy = collectorId;
    log.completedAt = nowIso();
    log.ecoPointsAwarded = Math.round(log.weight * (log.type === "PET" ? 20 : 25));
    const user = AppState.users.find(u => u.id === log.userId);
    if (user) {
      user.ecoPoints += log.ecoPointsAwarded;
      user.streak += 1;
      user.badge = BADGE_LEVELS.reduce((acc, level) => (user.ecoPoints >= level.min ? level.label : acc), "Eco Starter");
      AppState.notifications.unshift({
        text: `Log ${log.id} completed. +${log.ecoPointsAwarded} EcoPoints awarded.`,
        createdAt: nowIso()
      });
    }
    persistState();
    return log;
  }
};

const RewardsService = {
  catalog() {
    return [
      { id: "RWD-LOAD-50", name: "Mobile Load", display: "₱50 Load", cost: 500 },
      { id: "RWD-VOUCH-100", name: "Voucher", display: "₱100 Voucher", cost: 1000 },
      { id: "RWD-GCASH-75", name: "GCash", display: "₱75 GCash", cost: 750 }
    ];
  },
  redeem(rewardId, user) {
    const reward = this.catalog().find(r => r.id === rewardId);
    if (!reward) return { ok: false, message: "Reward not found." };
    if (!user) return { ok: false, message: "Login required." };
    if (user.ecoPoints < reward.cost) return { ok: false, message: "Not enough EcoPoints." };
    user.ecoPoints -= reward.cost;
    AppState.redemptions.unshift({
      id: `RDM${Date.now()}`,
      userId: user.id,
      rewardId: reward.id,
      rewardName: reward.display,
      cost: reward.cost,
      createdAt: nowIso()
    });
    AppState.notifications.unshift({
      text: `Redeemed ${reward.display} for ${reward.cost} points.`,
      createdAt: nowIso()
    });
    persistState();
    return { ok: true, reward };
  }
};

const AnalyticsService = {
  metrics() {
    const total = AppState.logs.length;
    const completed = AppState.logs.filter(l => l.status === "Completed").length;
    const pending = total - completed;
    const totalCollectedKg = AppState.logs
      .filter(l => l.status === "Completed")
      .reduce((sum, l) => sum + l.weight, 0);
    const compliance = total > 0 ? Math.round((completed / total) * 100) : 0;
    const ecoPointsDistributed = AppState.logs.reduce((sum, l) => sum + (l.ecoPointsAwarded || 0), 0);
    return {
      totalLogs: total,
      completedLogs: completed,
      pendingLogs: pending,
      totalCollectedKg: Number(totalCollectedKg.toFixed(1)),
      compliance,
      ecoPointsDistributed
    };
  },
  weeklySeries() {
    const byDay = {};
    AppState.logs.forEach(log => {
      if (log.status !== "Completed") return;
      const day = new Date(log.createdAt).toLocaleDateString(undefined, { weekday: "short" });
      byDay[day] = (byDay[day] || 0) + log.weight;
    });
    const sequence = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return sequence.map(day => ({ day, val: Number((byDay[day] || 0).toFixed(1)) }));
  }
};

function initSplash() {
  const splashScreen = document.getElementById("screen-splash");
  if (!splashScreen) {
    goTo("auth");
    return;
  }
  setTimeout(() => goTo("auth"), 1800);
}

function goTo(screen) {
  const user = AuthService.currentUser();
  if (screen === "collector" && (!user || user.role !== "collector")) {
    showToast("Collector access only.");
    return;
  }
  if (screen === "admin" && (!user || user.role !== "admin")) {
    showToast("Admin access only.");
    return;
  }

  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(`screen-${screen}`);
  if (target) target.classList.add("active");
  AppState.currentScreen = screen;
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.nav === screen);
  });
  const nav = document.getElementById("bottom-nav");
  if (nav) nav.classList.toggle("hidden", screen === "auth" || screen === "splash");
  refreshUI();
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function openLogModal() {
  const user = AuthService.currentUser();
  if (!user || user.role !== "household") {
    showToast("Household login required.");
    return;
  }
  document.getElementById("log-modal").classList.add("active");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("active");
}

function updateQtyUI() {
  const qty = document.getElementById("qty-display");
  if (qty) qty.textContent = AppState.logQty.toFixed(1);
  const modalQty = document.getElementById("modal-qty");
  if (modalQty) modalQty.textContent = AppState.logQty.toFixed(1);
}

function setupWasteTypeSelectors() {
  const restrictChips = scopeSelector => {
    const chips = document.querySelectorAll(`${scopeSelector} .waste-chip`);
    chips.forEach(chip => {
      const type = chip.dataset.type;
      if (type === "bio") chip.textContent = "PET";
      if (type === "rec") chip.textContent = "HDPE";
      if (type === "res" || type === "spc") chip.style.display = "none";
    });
  };

  restrictChips("#manual-panel");
  restrictChips("#log-modal");

  const manualChips = document.querySelectorAll("#manual-panel .waste-chip");
  manualChips.forEach(chip => chip.classList.remove("active"));
  const defaultManual = document.querySelector("#manual-panel .waste-chip[data-type='bio']");
  if (defaultManual) defaultManual.classList.add("active");

  const modalChips = document.querySelectorAll("#log-modal .waste-chip");
  modalChips.forEach(chip => chip.classList.remove("active"));
  const defaultModal = document.querySelector("#log-modal .waste-chip[data-type='bio']");
  if (defaultModal) defaultModal.classList.add("active");

  AppState.logType = "bio";
}

function increaseQty() {
  AppState.logQty = Math.round((AppState.logQty + 0.1) * 10) / 10;
  updateQtyUI();
}

function decreaseQty() {
  AppState.logQty = Math.max(0.1, Math.round((AppState.logQty - 0.1) * 10) / 10);
  updateQtyUI();
}

function getManualInputWeight() {
  const qtyDisplay = document.getElementById("qty-display");
  const parsedQty = qtyDisplay ? Number.parseFloat(qtyDisplay.textContent) : AppState.logQty;
  return Number.isFinite(parsedQty) ? parsedQty : NaN;
}

function submitLog() {
  const user = AuthService.currentUser();
  if (!user || user.role !== "household") {
    showToast("Only household users can submit logs.");
    return;
  }
  const weight = Number.isFinite(AppState.logQty) ? AppState.logQty : getManualInputWeight();
  const error = WasteLogService.validate(weight, AppState.logType, user);
  if (error) {
    showToast(error);
    return;
  }
  const log = WasteLogService.createLog({ user, rawType: AppState.logType, weight });
  closeModal("log-modal");
  openSuccessModal(log);
  refreshUI();
}

function openSuccessModal(log) {
  const type = document.getElementById("success-type");
  const qty = document.getElementById("success-qty");
  const pts = document.getElementById("success-pts");
  if (type) type.textContent = log.type;
  if (qty) qty.textContent = `${log.weight} kg logged`;
  if (pts) pts.textContent = "Status: Pending";
  const modal = document.getElementById("success-modal");
  if (modal) modal.classList.add("active");
}

function renderRecentLogs() {
  const recent = document.getElementById("recent-logs");
  if (recent) {
    recent.innerHTML = AppState.logs.slice(0, 5).map(l => `
      <div class="card" style="margin-bottom:8px">
        <strong>${l.type}</strong><br/>
        ${l.weight} kg • <strong>${l.status}</strong><br/>
        <small>${formatDateTime(l.createdAt)}</small>
      </div>
    `).join("");
  }
  const history = document.getElementById("full-history");
  if (history) {
    history.innerHTML = AppState.logs.map(l => `
      <div class="card" style="margin-bottom:8px">
        <strong>${l.type}</strong><br/>
        ${l.weight} kg • <strong>${l.status}</strong>
        ${l.status === "Completed" ? `• +${l.ecoPointsAwarded} pts` : ""}<br/>
        <small>${formatDateTime(l.createdAt)}</small>
      </div>
    `).join("");
  }
}

function renderNotifications() {
  const el = document.getElementById("notif-list");
  if (!el) return;
  el.innerHTML = AppState.notifications.slice(0, 20).map(n => `
    <div class="card">
      ${n.text}<br/>
      <small>${formatDateTime(n.createdAt)}</small>
    </div>
  `).join("");
}

function renderLeaderboard() {
  const users = AppState.users
    .filter(u => u.role === "household")
    .slice()
    .sort((a, b) => b.ecoPoints - a.ecoPoints)
    .slice(0, 10);
  const el = document.getElementById("leaderboard-list");
  if (!el) return;
  el.innerHTML = users.map((u, i) => `
    <div class="card" style="display:flex;justify-content:space-between">
      <span>#${i + 1} ${u.name}</span>
      <strong>${u.ecoPoints} pts</strong>
    </div>
  `).join("");
}

function renderProfile() {
  const user = AuthService.currentUser() || AppState.users.find(u => u.role === "household");
  if (!user) return;
  const name = document.getElementById("profile-name");
  const pts = document.getElementById("profile-pts");
  const streak = document.getElementById("profile-streak");
  const badge = document.getElementById("eco-badge-pts");
  if (name) name.textContent = user.name;
  if (pts) pts.textContent = user.ecoPoints;
  if (streak) streak.textContent = user.streak;
  if (badge) badge.textContent = `⭐ ${user.ecoPoints} pts`;
  document.querySelectorAll(".ecopoints-value").forEach(el => {
    el.textContent = user.ecoPoints;
  });
}

function renderCollectorView() {
  const list = document.getElementById("pickup-list");
  if (!list) return;
  const pendingFirst = AppState.logs.slice().sort((a, b) => (a.status === "Pending" ? -1 : 1));
  list.innerHTML = pendingFirst.map(log => `
    <div class="card" style="margin-bottom:10px">
      <strong>${log.userName}</strong> • ${log.type} • ${log.weight} kg<br/>
      <small>Status: <strong>${log.status}</strong></small>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-outline" onclick="handleCollectorDecision('${log.id}',false)">Not Verified</button>
        <button class="btn btn-primary" onclick="handleCollectorDecision('${log.id}',true)">Verify</button>
      </div>
    </div>
  `).join("");
  const metrics = AnalyticsService.metrics();
  const statValues = document.querySelectorAll("#screen-collector .stat-value");
  if (statValues[0]) statValues[0].textContent = metrics.totalLogs;
  if (statValues[1]) statValues[1].textContent = metrics.completedLogs;
  if (statValues[2]) statValues[2].textContent = metrics.totalLogs - metrics.completedLogs;
  if (statValues[3]) statValues[3].textContent = metrics.pendingLogs;
}

function handleCollectorDecision(logId, isVerified) {
  const user = AuthService.currentUser();
  if (!user || user.role !== "collector") {
    showToast("Collector login required.");
    return;
  }
  const updated = VerificationService.verifyLog(logId, isVerified, user.id);
  if (!updated) {
    showToast("Log not found.");
    return;
  }
  showToast(isVerified ? "Log marked as Completed." : "Status kept as Pending.");
  refreshUI();
}

function renderAdminAnalytics() {
  const metrics = AnalyticsService.metrics();
  const kpis = document.querySelectorAll("#screen-admin .kpi-card .kpi-value");
  if (kpis[0]) kpis[0].textContent = `${metrics.totalCollectedKg}kg`;
  if (kpis[1]) kpis[1].textContent = `${metrics.compliance}%`;
  if (kpis[2]) kpis[2].textContent = `${metrics.completedLogs}`;
  if (kpis[3]) kpis[3].textContent = `${AppState.users.filter(u => u.role === "household").length}`;

  const pointsNode = document.querySelector("#screen-admin .card .section-title + div");
  if (pointsNode) pointsNode.textContent = `${metrics.ecoPointsDistributed}`;

  const adminUsers = document.getElementById("admin-users");
  if (adminUsers) {
    const ranked = AppState.users
      .filter(u => u.role === "household")
      .slice()
      .sort((a, b) => b.ecoPoints - a.ecoPoints)
      .slice(0, 5);
    adminUsers.innerHTML = ranked.map((u, i) => `
      <div class="card" style="display:flex;justify-content:space-between">
        <span>#${i + 1} ${u.name}</span>
        <strong>${u.ecoPoints} pts</strong>
      </div>
    `).join("");
  }

  const chart = document.getElementById("admin-chart");
  if (chart) {
    const data = AnalyticsService.weeklySeries();
    const max = Math.max(...data.map(d => d.val), 1);
    chart.innerHTML = data.map(d => `
      <div class="chart-col">
        <div class="chart-val">${d.val}</div>
        <div class="chart-bar" style="height:${(d.val / max) * 80}px"></div>
        <div class="chart-label">${d.day}</div>
      </div>
    `).join("");
  }
}

function initGuide() {
  const el = document.getElementById("guide-items");
  if (!el) return;
  const items = [
    { name: "PET Bottle", type: "PET" },
    { name: "HDPE Detergent Bottle", type: "HDPE" },
    { name: "Milk Jug", type: "HDPE" },
    { name: "Water Bottle", type: "PET" }
  ];
  el.innerHTML = items.map(i => `
    <div class="card">
      <strong>${i.name}</strong><br/>
      → ${i.type}
    </div>
  `).join("");
}

function initRewards() {
  const grid = document.getElementById("rewards-grid");
  if (!grid) return;
  grid.innerHTML = RewardsService.catalog().map(r => `
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div><strong>${r.display}</strong><br/><small>${r.cost} pts</small></div>
      <button class="btn btn-outline" onclick="redeemReward('${r.id}')">Redeem</button>
    </div>
  `).join("");
}

function redeemReward(rewardId) {
  const user = AuthService.currentUser();
  if (!user || user.role !== "household") {
    showToast("Only household users can redeem rewards.");
    return;
  }
  const result = RewardsService.redeem(rewardId, user);
  if (!result.ok) {
    showToast(result.message);
    return;
  }
  showToast(`Redeemed: ${result.reward.display}`);
  refreshUI();
}

function initAuth() {
  const loginBtn = document.getElementById("btn-login");
  const guestBtn = document.getElementById("btn-guest");
  const authTabs = document.querySelectorAll(".auth-tab");
  const roleCards = document.querySelectorAll(".role-card");
  const authPrimaryButton = document.getElementById("btn-login");
  const authSubtitle = document.querySelector("#screen-auth .auth-header p");
  const inputs = document.querySelectorAll("#screen-auth .form-control");
  const emailInput = inputs[0];
  const passwordInput = inputs[1];

  authTabs.forEach((tab, idx) => {
    tab.addEventListener("click", () => {
      authTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      AppState.authMode = idx === 1 ? "register" : "login";
      if (authPrimaryButton) {
        authPrimaryButton.textContent = AppState.authMode === "register" ? "Create BinBuddy Account" : "Login to BinBuddy";
      }
      if (authSubtitle) {
        authSubtitle.textContent = AppState.authMode === "register"
          ? "Create your account and start earning EcoPoints"
          : "Smart waste tracking for a cleaner Lipa City";
      }
    });
  });

  roleCards.forEach(card => {
    card.addEventListener("click", () => {
      roleCards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      AppState.role = card.dataset.role || "household";
    });
  });

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const email = (emailInput ? emailInput.value : "").trim();
      const password = passwordInput ? passwordInput.value : "";
      if (!email || !password) {
        showToast("Email and password are required.");
        return;
      }
      if (AppState.authMode === "register") {
        const reg = AuthService.register({ email, password, role: AppState.role });
        if (!reg.ok) {
          showToast(reg.message);
          return;
        }
      }
      const login = AuthService.login({ email, password, role: AppState.role });
      if (!login.ok) {
        showToast(login.message);
        return;
      }
      const targetScreen = AppState.role === "collector" ? "collector" : AppState.role === "admin" ? "admin" : "home";
      goTo(targetScreen);
      showToast(`Welcome, ${login.user.name}`);
      refreshUI();
    });
  }

  if (guestBtn) {
    guestBtn.addEventListener("click", () => {
      const guest = AppState.users.find(u => u.role === "household");
      if (guest) AppState.currentUserId = guest.id;
      goTo("home");
      showToast("Guest household mode");
      refreshUI();
    });
  }
}

function initAdminActions() {
  const exportBtn = document.getElementById("btn-export");
  if (!exportBtn) return;
  exportBtn.addEventListener("click", () => {
    const user = AuthService.currentUser();
    if (!user || user.role !== "admin") {
      showToast("Admin access only.");
      return;
    }
    showToast("CSV export generated.");
  });
}

function initNavigation() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    const navigate = () => {
      const screen = btn.dataset.nav;
      if (screen) goTo(screen);
    };
    btn.addEventListener("click", navigate);
    btn.addEventListener(
      "touchend",
      e => {
        e.preventDefault();
        navigate();
      },
      { passive: false }
    );
  });

  const plus = document.getElementById("qty-plus");
  const minus = document.getElementById("qty-minus");
  if (plus) plus.addEventListener("click", increaseQty);
  if (minus) minus.addEventListener("click", decreaseQty);

  document.querySelectorAll("#manual-panel .waste-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (chip.style.display === "none") return;
      document.querySelectorAll("#manual-panel .waste-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      AppState.logType = chip.dataset.type;
    });
  });

  const submitBtn = document.getElementById("btn-submit-log");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const user = AuthService.currentUser();
      if (!user || user.role !== "household") {
        showToast("Only household users can submit logs.");
        return;
      }
      const weight = getManualInputWeight();
      const error = WasteLogService.validate(weight, AppState.logType, user);
      if (error) {
        showToast(error);
        return;
      }
      AppState.logQty = weight;
      submitLog();
    });
  }
}

function selectModalType(type, el) {
  const normalized = type === "bio" || type === "pet" || type === "PET"
    ? "bio"
    : type === "rec" || type === "hdpe" || type === "HDPE"
      ? "rec"
      : null;
  if (!normalized || !el || el.style.display === "none") {
    showToast("Please select PET or HDPE only.");
    return;
  }
  document.querySelectorAll("#log-modal .waste-chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  AppState.logType = normalized;
}

function refreshUI() {
  renderProfile();
  renderRecentLogs();
  renderNotifications();
  renderCollectorView();
  renderLeaderboard();
  renderAdminAnalytics();
  initRewards();
  persistState();
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  initSplash();
  setupWasteTypeSelectors();
  initNavigation();
  initAuth();
  initAdminActions();
  initGuide();
  updateQtyUI();
  refreshUI();
});

window.AppState = AppState;
window.goTo = goTo;
window.showToast = showToast;
window.openLogModal = openLogModal;
window.closeModal = closeModal;
window.submitLog = submitLog;
window.increaseQty = increaseQty;
window.decreaseQty = decreaseQty;
window.renderLeaderboard = renderLeaderboard;
window.renderNotifications = renderNotifications;
window.initGuide = initGuide;
window.initRewards = initRewards;
window.handleCollectorDecision = handleCollectorDecision;
window.redeemReward = redeemReward;
window.selectModalType = selectModalType;