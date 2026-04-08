import { google } from 'googleapis';
import { getClient } from './auth.js';
import { serialize } from 'cookie';

export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect('/?error=access_denied');
  }
  const oauth2Client = getClient(req);
  const { tokens } = await oauth2Client.getToken(code);
  res.setHeader('Set-Cookie', serialize('gTokens', JSON.stringify(tokens), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/'
  }));
  res.redirect('/');
}
