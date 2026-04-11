// api/sync.js — uses Gmail REST API directly, no googleapis dependency needed

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

const MONTH_MAP = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'
};

function parseBMEmail(body, internalDate) {
  const descMatch = body.match(/Description\s*:\s*([^\n<\r]+)/i);
  const amtMatch  = body.match(/Amount\s*:\s*OMR\s*([\d.]+)/i);
  const dtMatch   = body.match(/Date\/Time\s*:\s*(\d{2})\s+([A-Z]{3})\s+(\d{4})/i);

  if (!amtMatch) return null;

  const amount = parseFloat(amtMatch[1]);
  const rawDesc = descMatch ? descMatch[1].trim() : 'Bank Muscat';
  const merchant = rawDesc.replace(/^\d+-/, '').replace(/\s+\+\d[\d\s]+.*$/, '').trim();

  let date;
  if (dtMatch) {
    const day = dtMatch[1];
    const mo  = MONTH_MAP[dtMatch[2].toUpperCase()] || '01';
    const yr  = dtMatch[3];
    date = `${yr}-${mo}-${day}`;
  } else {
    date = new Date(parseInt(internalDate)).toISOString().slice(0, 10);
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

  // Skip self-transfers and deposits
  if (/ALI RAID|easy deposit|cdm deposit|inward payment|reversal/i.test(merchant)) return null;

  return { date, merchant, amount, cat, month };
}

function decodeBase64(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload) {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if ((part.mimeType === 'text/html' || part.mimeType === 'text/plain') && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
  }
  return '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Get access token from cookie
  const cookies = parseCookies(req.headers.cookie);
  let tokens;
  try {
    tokens = JSON.parse(cookies.gTokens || cookies.gauth || '{}');
  } catch(e) {
    return res.status(401).json({ error: 'Cookie parse error', transactions: [] });
  }

  if (!tokens.access_token) {
    return res.status(401).json({ error: 'Not authenticated', transactions: [] });
  }

  const accessToken = tokens.access_token;
  const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

  try {
    // Search for BM transaction emails after Apr 1 2026
    const searchUrl = `${BASE}/messages?q=${encodeURIComponent('from:NOREPLY@bankmuscat.com subject:"Account Transaction" after:2026/04/01')}&maxResults=100`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!searchRes.ok) {
      const err = await searchRes.text();
      return res.status(searchRes.status).json({ error: `Gmail search failed: ${searchRes.status} ${err}`, transactions: [] });
    }

    const searchData = await searchRes.json();
    const messages = searchData.messages || [];
    const transactions = [];

    for (const msg of messages) {
      try {
        const msgRes = await fetch(`${BASE}/messages/${msg.id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!msgRes.ok) continue;

        const full = await msgRes.json();
        const body = extractBody(full.payload);
        const tx = parseBMEmail(body, full.internalDate);
        if (tx) transactions.push(tx);
      } catch(e) {
        // skip bad messages
      }
    }

    res.status(200).json({ transactions, count: transactions.length });

  } catch(error) {
    res.status(500).json({ error: error.message, transactions: [] });
  }
}
