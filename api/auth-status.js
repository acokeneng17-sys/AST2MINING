import { telegramAuthStatus } from "./_lib/telegram.js";

export default async function handler(req,res){
  if(req.method==="OPTIONS"){res.status(204).end();return;}
  res.status(200).json(telegramAuthStatus(req));
}