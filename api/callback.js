import { getClient } from './auth.js';

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: JSON.stringify(value) })
  });
}

export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/?error=access_denied');

  const oauth2Client = getClient(req);
  const { tokens } = await oauth2Client.getToken(code);

  // Save token to Upstash — no cookie needed
  await kvSet('ali_gmail_token', tokens);

  res.redirect('/?synced=1');
}
