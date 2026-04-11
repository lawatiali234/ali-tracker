import { google } from 'googleapis';

export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect('/?error=access_denied');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/callback`
  );

  const { tokens } = await oauth2Client.getToken(code);

  // Save as gauth (matches what sync.js reads)
  const cookieValue = encodeURIComponent(JSON.stringify(tokens));
  res.setHeader('Set-Cookie', `gauth=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60*60*24*30}`);
  res.redirect('/');
}
