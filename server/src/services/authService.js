import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { signToken } from "../middleware/auth.js";
import { toPublicUser, badgeFromPoints } from "./userMapper.js";

function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email.trim());
}

function nextUserCode(role) {
  const prefix = role === "collector" ? "COL" : role === "admin" ? "ADM" : "USR";
  const row = db.prepare(`SELECT user_code FROM users WHERE user_code LIKE ? ORDER BY user_code DESC LIMIT 1`).get(`${prefix}%`);
  if (!row) return `${prefix}001`;
  const n = Number.parseInt(row.user_code.slice(3), 10) || 0;
  return `${prefix}${String(n + 1).padStart(3, "0")}`;
}

export function register({ email, password, name }) {
  const existing = getUserByEmail(email);
  if (existing) {
    return { ok: false, message: "An account with this email already exists." };
  }
  const user_code = nextUserCode("household");
  const full_name = (name || email.split("@")[0].replace(/\./g, " ") || "User").trim();
  const password_hash = bcrypt.hashSync(password, 10);
  const level = badgeFromPoints(0);

  db.prepare(
    `INSERT INTO users (user_code, full_name, email, password_hash, role, eco_points, streak_days, level, barangay)
     VALUES (?, ?, ?, ?, 'household', 0, 0, ?, 'Holy Spirit')`
  ).run(user_code, full_name, email.trim().toLowerCase(), password_hash, level);

  const user = db.prepare("SELECT * FROM users WHERE user_code = ?").get(user_code);
  const token = signToken({
    sub: user.id,
    code: user.user_code,
    role: user.role,
    email: user.email
  });
  return { ok: true, token, user: toPublicUser(user) };
}

export function login({ email, password, role }) {
  const user = getUserByEmail(email);
  if (!user || user.role !== role) {
    return { ok: false, message: "Invalid credentials for selected role." };
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return { ok: false, message: "Invalid credentials for selected role." };
  }
  const token = signToken({
    sub: user.id,
    code: user.user_code,
    role: user.role,
    email: user.email
  });
  return { ok: true, token, user: toPublicUser(user) };
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function guestLoginAsDemoHousehold() {
  const user = db.prepare("SELECT * FROM users WHERE user_code = ?").get("USR001");
  if (!user) return { ok: false, message: "Demo user not available." };
  const token = signToken({
    sub: user.id,
    code: user.user_code,
    role: user.role,
    email: user.email
  });
  return { ok: true, token, user: toPublicUser(user) };
}
