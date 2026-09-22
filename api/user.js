import { sb, json } from "./_lib/supabase.js";
import { getTelegramUser } from "./_lib/telegram.js";

export default async function handler(req, res) {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser?.id) return json(res, 401, { error: "Invalid Telegram session" });

    if (req.method === "GET") {
      const rows = await sb(`users?telegram_id=eq.${encodeURIComponent(String(tgUser.id))}&select=*`);
      if (!rows?.length) return json(res, 200, { user: null, telegram_user: tgUser });
      return json(res, 200, { user: rows[0], telegram_user: tgUser });
    }

    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    const body = req.body || {};
    const existing = await sb(`users?telegram_id=eq.${encodeURIComponent(String(tgUser.id))}&select=id,referral_code,referred_by`);

    const referralCode = existing?.[0]?.referral_code || `AST2-${tgUser.id}`;
    const payload = {
      telegram_id: String(tgUser.id),
      username: tgUser.username ? `@${tgUser.username}` : (tgUser.first_name || "User"),
      referral_code: referralCode
    };

    if (body.referred_by && !existing?.[0]?.referred_by && body.referred_by !== referralCode) {
      payload.referred_by = String(body.referred_by).slice(0, 100);
    }

    let user;
    if (existing?.length) {
      user = (await sb(`users?id=eq.${existing[0].id}&select=*`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      }))[0];
    } else {
      user = (await sb("users", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      }))[0];
    }

    return json(res, 200, { user, telegram_user: tgUser });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
