import { sb, json } from "./_lib/supabase.js";
import { getTelegramUser } from "./_lib/telegram.js";

export default async function handler(req, res) {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser?.id) return json(res, 401, { error: "Invalid Telegram session" });

    const users = await sb(`users?telegram_id=eq.${encodeURIComponent(String(tgUser.id))}&select=id,points`);
    if (!users?.length) return json(res, 404, { error: "User not registered" });

    const allocations = await sb(`allocations?user_id=eq.${users[0].id}&select=*&order=id.desc`);
    const pool = Number((await sb("app_settings?key=eq.reward_pool&select=value"))?.[0]?.value || 500000000);

    return json(res, 200, {
      pool_ast2: pool,
      points: Number(users[0].points || 0),
      allocations: allocations || []
    });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
