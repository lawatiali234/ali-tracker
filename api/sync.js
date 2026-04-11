import { google } from 'googleapis';

const MONTH_MAP = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'
};

function parseBMEmail(body, emailDate) {
  const descMatch = body.match(/Description\s*:\s*([^\n<\r]+)/i);
  const amtMatch  = body.match(/Amount\s*:\s*OMR\s*([\d.]+)/i);
  // Match both 4-digit and 2-digit years
  const dtMatch   = body.match(/Date\/Time\s*:\s*(\d{2})\s+([A-Z]{3})\s+(\d{2,4})/i);

  if (!amtMatch) return null;

  const amount = parseFloat(amtMatch[1]);
  const rawDesc = descMatch ? descMatch[1].trim() : 'Bank Muscat';
  const merchant = rawDesc.replace(/^\d+-/, '').replace(/\s+\+\d+.*$/, '').trim();

  let date;
  if (dtMatch) {
    const day = dtMatch[1].padStart(2, '0');
    const mo  = MONTH_MAP[dtMatch[2].toUpperCase()] || '01';
    // Handle 2-digit year (26 → 2026)
    let yr = dtMatch[3];
    if (yr.length === 2) yr = '20' + yr;
    date = `${yr}-${mo}-${day}`;
  } else {
    date = new Date(parseInt(emailDate)).toISOString().slice(0, 10);
  }

  const month = date.slice(0, 7);
  const m = merchant.toLowerCase();
  let cat = 'personal';
  if (/talabat|mcdonald|kfc|burger|pizza|coffee|cafe|shawarma|sushi|biryani|food|rest|grill|kitchen|bakery|juice|cream|cinnabon|slider|seven brother|chick buck|land burger|steak|jollibee|hardee|swift shawarma/.test(m)) cat = 'food';
  else if (/oman oil|shell|al maha|fuel|petrol|enoc|emarat/.test(m)) cat = 'fuel';
  else if (/ace musc|mudhabi|padel|paddle|strike/.test(m)) cat = 'paddle';
  else if (/steam|riot|gaming planet|likecard|dokan|remal|g2a|ea games|tap.*gaming|damadah|supercell/.test(m)) cat = 'gaming';
  else if (/amazon|aliexpress|alibaba|noon|sultan center|carrefour|borders|aramex|dhl/.test(m)) cat = 'shopping';
  else if (/hotel|flight|uber|tfl|karwa|airbnb|harrods|louis vuitton|deliveroo|heathrow/.test(m)) cat = 'trips';
  else if (/rop traffic|etraffic|parking|nissan service|grand tire/.test(m)) cat = 'transport';
  else if (/middle east college|college|university|school|tuition/.test(m)) cat = 'education';
  else if (/vox cinema|seen jeem|magic planet|ground control/.test(m)) cat = 'entertainment';
  if (/ALI RAID|easy deposit|cdm deposit|inward payment|reversal/i.test(merchant)) return null;

  return { date, merchant, amount, cat, month };
}

// Upstash helpers
const kvGet = async (key) => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const r = await fetch(`${url}/get/${key}`, { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  return d.result ? JSON.parse(decodeURIComponent(d.result)) : null;
};

const kvSet = async (key, value) => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const encoded = encodeURIComponent(JSON.stringify(value));
  await fetch(`${url}/set/${key}/${encoded}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
};

export default async function handler(req, httpRes) {
  httpRes.setHeader('Access-Control-Allow-Origin', '*');
  httpRes.setHeader('Access-Control-Allow-Headers', 'Authorization');

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace('Bearer ', '').trim();
  if (!accessToken) {
    return httpRes.status(401).json({ error: 'Not authenticated', transactions: [] });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    // Load already-synced message IDs from Upstash
    let syncedIds = [];
    try { syncedIds = (await kvGet('ali_synced_ids')) || []; } catch(e) {}
    const syncedSet = new Set(syncedIds);

    const searchRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:NOREPLY@bankmuscat.com subject:"Account Transaction" after:2026/04/01',
      maxResults: 50,
    });

    const messages = (searchRes.data.messages || []).filter(m => !syncedSet.has(m.id));

    if (messages.length === 0) {
      return httpRes.status(200).json({ transactions: [], count: 0 });
    }

    // Fetch all new messages in parallel
    const fetched = await Promise.all(
      messages.map(msg =>
        gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
          .catch(() => null)
      )
    );

    const transactions = [];
    const newSyncedIds = [];

    for (let i = 0; i < fetched.length; i++) {
      const item = fetched[i];
      if (!item) continue;
      const full = item.data;
      const payload = full.payload;
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
      const tx = parseBMEmail(body, full.internalDate);
      if (tx) {
        transactions.push(tx);
        newSyncedIds.push(messages[i].id);
      }
    }

    // Save updated synced IDs back to Upstash
    if (newSyncedIds.length > 0) {
      try {
        await kvSet('ali_synced_ids', [...syncedIds, ...newSyncedIds]);
      } catch(e) {}
    }

    httpRes.status(200).json({ transactions, count: transactions.length });
  } catch (error) {
    httpRes.status(500).json({ error: error.message, transactions: [] });
  }
}
