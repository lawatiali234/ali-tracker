import { google } from 'googleapis';
import { getClient } from './auth.js';

export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/?error=access_denied');
  
  try {
    const oauth2Client = getClient(req);
    const { tokens } = await oauth2Client.getToken(code);
    const tokenStr = encodeURIComponent(JSON.stringify(tokens));
    res.setHeader('Set-Cookie', `gTokens=${tokenStr}; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; Path=/`);
    res.redirect('/');
  } catch(err) {
    console.error(err);
    res.redirect('/?error=' + encodeURIComponent(err.message));
  }
}
