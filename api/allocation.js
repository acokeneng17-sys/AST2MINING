import { sb, json } from "./_lib/supabase.js";
import { getTelegramUser } from "./_lib/telegram.js";

export default async function handler(req, res) {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser?.id) return json(res, 401, { error: "Invalid Telegram session" });

    const users = await sb(`users?telegram_id=eq.${encodeURIComponent(String(tgUser.id))}&select=id,points,ast2_holding,boost_level,wallet_address`);
    if (!users?.length) return json(res, 404, { error: "User not registered" });
    const me = users[0];

    const cfg = Object.fromEntries((await sb("app_settings?select=key,value") || []).map(r => [r.key, r.value]));
    const pool = Number(cfg.reward_pool || 500000000);

    const all = await sb("users?select=id,points");
    const totalPoints = (all || []).reduce((sum, u) => sum + Number(u.points || 0), 0);
    const points = Number(me.points || 0);
    const allocation = totalPoints > 0 ? Math.min(pool, (points / totalPoints) * pool) : 0;

    return json(res, 200, {
      pool_ast2: pool,
      points,
      total_points: totalPoints,
      allocation_ast2: allocation,
      wallet_address: me.wallet_address || null,
      boost_level: Number(me.boost_level || 1),
      ast2_holding: Number(me.ast2_holding || 0)
    });
  } catch (e) { return json(res, 500, { error: e.message }); }
}