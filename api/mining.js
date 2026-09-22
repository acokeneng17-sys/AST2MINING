import { sb, json } from "./_lib/supabase.js";
import { getTelegramUser } from "./_lib/telegram.js";

async function settings() {
  const rows = await sb("app_settings?select=key,value");
  return Object.fromEntries((rows || []).map(r => [r.key, r.value]));
}
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

async function getHolding(walletAddress, master, decimals = 9) {
  if (!walletAddress) return 0;
  const url = `https://tonapi.io/v2/accounts/${encodeURIComponent(walletAddress)}/jettons/${encodeURIComponent(master)}`;
  const r = await fetch(url);
  if (r.status === 404) return 0;
  if (!r.ok) throw new Error(`TONAPI error ${r.status}`);
  const d = await r.json();
  const raw = BigInt(String(d.balance || "0"));
  return Number(raw) / Math.pow(10, decimals);
}

export default async function handler(req, res) {
  try {
    const tgUser = getTelegramUser(req);
    if (!tgUser?.id) return json(res, 401, { error: "Invalid Telegram session" });
    if (req.method !== "POST" && req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

    const telegramId = String(tgUser.id);
    const users = await sb(`users?telegram_id=eq.${encodeURIComponent(telegramId)}&select=*`);
    if (!users?.length) return json(res, 404, { error: "User not registered" });
    let user = users[0];
    const cfg = await settings();

    const master = cfg.ast2_master;
    const decimals = num(cfg.ast2_decimals, 9);
    if (master && user.wallet_address) {
      const holding = await getHolding(user.wallet_address, master, decimals);
      const holdingChanged = Math.abs(num(user.ast2_holding) - holding) > 0.000000001;
      if (holdingChanged) {
        user = (await sb(`users?id=eq.${user.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ ast2_holding: holding })
        }))[0];
      }
    }

    const base = num(cfg.base_mining, 40);
    const perLevel = num(cfg.mining_per_level, 10);
    const holdingPerLevel = num(cfg.holding_per_level, 1000);
    const maxLevel = num(cfg.max_boost_level, 500);
    const level = Math.max(1, Math.min(maxLevel, Math.floor(num(user.ast2_holding) / holdingPerLevel)));
    const miningRate = base + level * perLevel;
    const now = Date.now();
    const snapshotMs = num(cfg.snapshot_hours, 24) * 60 * 60 * 1000;
    const last = user.last_snapshot ? new Date(user.last_snapshot).getTime() : 0;

    if (req.method === "GET") {
      return json(res, 200, { user, boost_level: level, mining_rate: miningRate, snapshot_hours: num(cfg.snapshot_hours, 24), ready: !user.mining_active || !last || now - last >= snapshotMs });
    }

    const action = req.body?.action || "start";
    if (action === "start") {
      if (user.mining_active && last && now - last < snapshotMs) {
        return json(res, 200, { ok: true, status: "active", user, boost_level: level, mining_rate: miningRate, next_claim_at: new Date(last + snapshotMs).toISOString() });
      }
      const updated = (await sb(`users?id=eq.${user.id}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ mining_active: true, last_snapshot: new Date().toISOString(), boost_level: level })
      }))[0];
      return json(res, 200, { ok: true, status: "started", user: updated, boost_level: level, mining_rate: miningRate, next_claim_at: new Date(now + snapshotMs).toISOString() });
    }

    if (action === "claim") {
      if (!user.mining_active || !last) return json(res, 400, { error: "Mining session is not active" });
      if (now - last < snapshotMs) return json(res, 400, { error: "Mining is not ready yet", next_claim_at: new Date(last + snapshotMs).toISOString() });

      const newPoints = num(user.points) + miningRate;
      const updated = (await sb(`users?id=eq.${user.id}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ points: newPoints, last_snapshot: new Date().toISOString(), mining_active: true, boost_level: level })
      }))[0];

      await sb("holding_snapshots", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: user.id, ast2_holding: num(user.ast2_holding), boost_level: level, mining_rate: miningRate, snapshot_at: new Date().toISOString() })
      });

      return json(res, 200, { ok: true, status: "claimed", reward_points: miningRate, user: updated, boost_level: level, mining_rate: miningRate, next_claim_at: new Date(now + snapshotMs).toISOString() });
    }
    return json(res, 400, { error: "Unknown action" });
  } catch (e) { return json(res, 500, { error: e.message }); }
}