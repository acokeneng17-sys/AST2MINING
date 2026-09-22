import crypto from "node:crypto";

export function validateTelegramInitData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !authDate) return null;
  const maxAge = Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE || 86400);
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (!Number.isFinite(authDate) || age < -300 || age > maxAge) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => `${key}=${value}`).join("\n");
  const secretKey = crypto.createHmac("sha256","WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256",secretKey).update(dataCheckString).digest("hex");
  if (calculated.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calculated),Buffer.from(hash))) return null;
  const userRaw = params.get("user");
  if (!userRaw) return null;
  try { return JSON.parse(userRaw); } catch { return null; }
}

export function getTelegramUser(req) {
  const header = req.headers["x-telegram-init-data"];
  return validateTelegramInitData(header);
}

export function telegramAuthStatus(req) {
  const initData = req.headers["x-telegram-init-data"] || "";
  if (!initData) return { ok:false, reason:"missing_init_data" };
  const params = new URLSearchParams(initData);
  const authDate = Number(params.get("auth_date"));
  const hash = params.get("hash");
  if (!hash || !authDate) return { ok:false, reason:"missing_auth_fields" };
  const maxAge = Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE || 86400);
  const age = Math.floor(Date.now()/1000)-authDate;
  if (age < -300 || age > maxAge) return { ok:false, reason:"expired_init_data", age };
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok:false, reason:"missing_bot_token" };
  const user = validateTelegramInitData(initData);
  return user ? { ok:true, user_id:String(user.id) } : { ok:false, reason:"invalid_signature", age };
}
