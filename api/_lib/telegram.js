import crypto from "node:crypto";

export function validateTelegramInitData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !authDate) return null;

  const maxAge = Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE || 86400);
  if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > maxAge) return null;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calculated.length !== hash.length ||
      !crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash))) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try { return JSON.parse(userRaw); } catch { return null; }
}

export function getTelegramUser(req) {
  const header = req.headers["x-telegram-init-data"];
  return validateTelegramInitData(header);
}
