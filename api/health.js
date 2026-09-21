import { json } from "./_lib/supabase.js";

export default async function handler(req, res) {
  json(res, 200, { ok: true, service: "AST2 Mining API" });
}
