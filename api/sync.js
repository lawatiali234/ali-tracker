import { google } from 'googleapis';

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    cookies[name.trim()] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

const MONTH_MAP = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'
};

function parseBMEmail(body, emailDate) {
  const descMatch = body.match(/Description\s*:\s*([^\n<\r]+)/i);
  const amtMatch = body.match(/Amount\s*:\s*OMR\s*([\d.]+)/i);
  const dtMatch = body.match(/Date\/Time\s*:\s*(\d{2})\s+([A-Z]{3})\s+(\d{4})/i);

  if (!amtMatch) return null;

  const amount = parseFloat(amtMatch[1]);
  const rawDesc = descMatch ? descMatch[1].trim() : 'Bank Muscat';
  const merchant = rawDesc.replace(/^\d+-/, '').replace(/\s+\+\d+.*$/, '').trim();

  let date;
  if (dtMatch) {
    const day = dtMatch[1];
    const mo = MONTH_MAP[dtMatch[2].toUpperCase()] || '01';
    const yr = dtMatch[3];
    date = `${yr}-${mo}-${day}`;
  } else {
    date = new Date(parseInt(emailDate)).toISOString().slice(0, 10);
  }

  const month = date.slice(0, 7);
  const m = merchant.toLowerCase();
  let cat = 'personal';
  if (/talabat|mcdonald|kfc|burger|pizza|coffee|cafe|shawarma|sushi|biryani|food|rest|grill|kitchen|bakery|juice|cream|cinnabon|slider|seven brother|chick buck|land burger|steak|jollibee|hardee|swift shawarma/i.test(m)) cat = 'food';
  else if (/oman oil|shell|al maha|fuel|petrol|enoc|emarat/i.test(m)) cat = 'fuel';
  else if (/ace musc|mudhabi|padel|paddle|strike/i.test(m)) cat = 'paddle';
  else if (/steam|riot|gaming planet|likecard|dokan|remal|g2a|ea games|tap.*gaming|damadah|supercell/i.test(m)) cat = 'gaming';
  else if (/amazon|aliexpress|alibaba|noon|sultan center|carrefour|borders|aramex|dhl/i.test(m)) cat = 'shopping';
  else if (/hotel|flight|uber|tfl|karwa|airbnb|harrods|louis vuitton|deliveroo|heathrow/i.test(m)) cat = 'trips';
  else if (/rop traffic|etraffic|parking|nissan service|grand tire/i.test(m)) cat = 'transport';
  else if (/middle east college|college|university|school|tuition/i.test(m)) cat = 'education';
  else if (/vox cinema|seen jeem|magic planet|ground control/i.test(m)) cat = 'entertainment';
  else if (/transfer|wallet/i.test(m)) cat = 'transfers';

  if (/ALI RAID|easy deposit|cdm deposit|inward payment|reversal/i.test(merchant)) return null;

  return { date, merchant, amount, cat, month };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cookies = parseCookies(req.headers.cookie);
  let tokens;
  try {
    tokens = JSON.parse(cookies.gTokens || cookies.gauth || '{}');
  } catch {
    return res.status(401).json({ error: 'Not authenticated', transactions: [] });
  }

  if (!tokens.access_token) {
    return res.status(401).json({ error: 'Not authenticated', transactions: [] });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const searchRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:NOREPLY@bankmuscat.com subject:"Account Transaction" after:2026/04/01',
      maxResults: 100,
    });

    const messages = searchRes.data.messages || [];
    const transactions = [];

    for (const msg of messages) {
      try {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const payload = full.data.payload;
        let body = '';

        if (payload.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload.parts) {
          for (const part of payload.parts) {
            if ((part.mimeType === 'text/html' || part.mimeType === 'text/plain') && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64').toString('utf-8');
              break;
            }
          }
        }

        const tx = parseBMEmail(body, full.data.internalDate);
        if (tx) transactions.push(tx);
      } catch(e) {
        // skip individual message errors
      }
    }

    res.status(200).json({ transactions, count: transactions.length });
  } catch (error) {
    console.error('Sync error:', error.message);
    res.status(500).json({ error: error.message, transactions: [] });
  }
}
