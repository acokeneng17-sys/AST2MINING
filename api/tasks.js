import { sb, json } from "./_lib/supabase.js";
import { getTelegramUser } from "./_lib/telegram.js";

export default async function handler(req, res) {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser?.id) return json(res, 401, { error: "Invalid Telegram session" });

    if (req.method === "GET") {
      const tasks = await sb("social_tasks?active=eq.true&select=id,title,description,task_type,link,reward&order=id.asc");
      return json(res, 200, { tasks: tasks || [] });
    }

    // Task completion tracking needs a dedicated table to prevent duplicate rewards.
    // Until that table is added, do not award points from the API.
    return json(res, 409, { error: "Task rewards are disabled until task completion tracking is enabled." });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}
