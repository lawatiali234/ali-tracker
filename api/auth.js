import { google } from 'googleapis';

function getClient(req) {
  const base = req ? `https://${req.headers.host}` : '';
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${base}/api/callback`
  );
}

export { getClient };

export default async function handler(req, res) {
  const oauth2Client = getClient(req);
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly']
  });
  res.redirect(url);
}
