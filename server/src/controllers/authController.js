import { body, validationResult } from "express-validator";
import { register, login, getUserById, guestLoginAsDemoHousehold } from "../services/authService.js";
import { toPublicUser } from "../services/userMapper.js";

export const registerValidators = [
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6, max: 128 }),
  body("name").optional().isString().isLength({ max: 100 })
];

export function postRegister(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, message: "Invalid input.", errors: errors.array() });
  }
  const { email, password, name } = req.body;
  const result = register({ email, password, name });
  if (!result.ok) return res.status(400).json(result);
  return res.status(201).json(result);
}

export const loginValidators = [
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 1, max: 128 }),
  body("role").isIn(["household", "collector", "admin"])
];

export function postLogin(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, message: "Invalid input.", errors: errors.array() });
  }
  const { email, password, role } = req.body;
  const result = login({ email, password, role });
  if (!result.ok) return res.status(401).json(result);
  return res.json(result);
}

export function getMe(req, res) {
  const user = getUserById(req.auth.sub);
  if (!user) return res.status(404).json({ ok: false, message: "User not found." });
  return res.json({ ok: true, user: toPublicUser(user) });
}

export function postGuest(req, res) {
  if (process.env.ALLOW_GUEST_LOGIN === "false") {
    return res.status(403).json({ ok: false, message: "Guest login is disabled." });
  }
  const result = guestLoginAsDemoHousehold();
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
}
