import { getClient } from './auth.js';

export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/?error=access_denied');

  const oauth2Client = getClient(req);
  const { tokens } = await oauth2Client.getToken(code);

  const cookieValue = encodeURIComponent(JSON.stringify(tokens));
  res.setHeader('Set-Cookie', `gauth=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60*60*24*30}`);
  res.redirect('/');
}
