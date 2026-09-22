import { sb, json, handleOptions } from "./_lib/supabase.js";
import { getTelegramUser } from "./_lib/telegram.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return handleOptions(req, res);
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser?.id) return json(res, 401, { error: "Invalid Telegram session" }, req);
    const telegramId = String(tgUser.id);
    if (req.method === "GET") {
      const rows = await sb(`users?telegram_id=eq.${encodeURIComponent(telegramId)}&select=*`);
      if (!rows?.length) return json(res, 200, { user: null, telegram_user: tgUser }, req);
      return json(res, 200, { user: rows[0], telegram_user: tgUser }, req);
    }
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" }, req);
    const body = req.body || {};
    const existing = await sb(`users?telegram_id=eq.${encodeURIComponent(telegramId)}&select=id,referral_code,referred_by,wallet_address`);
    const referralCode = existing?.[0]?.referral_code || `AST2-${tgUser.id}`;
    const payload = { telegram_id: telegramId, username: tgUser.username ? `@${tgUser.username}` : (tgUser.first_name || "User"), referral_code: referralCode };
    if (body.referred_by && !existing?.[0]?.referred_by && body.referred_by !== referralCode) payload.referred_by = String(body.referred_by).slice(0, 100);
    if (body.wallet_address) payload.wallet_address = String(body.wallet_address).trim().slice(0, 150);
    let user;
    if (existing?.length) user = (await sb(`users?id=eq.${existing[0].id}&select=*`, {method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(payload)}))[0];
    else user = (await sb("users",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(payload)}))[0];
    return json(res, 200, { user, telegram_user: tgUser }, req);
  } catch (e) { return json(res, 500, { error: e.message }, req); }
}