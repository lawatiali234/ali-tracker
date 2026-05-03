import { google } from 'googleapis';

const MONTH_MAP = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'
};

function categorizeMerchant(merchant) {
  const m = merchant.toLowerCase();
  if (/ali raid/i.test(merchant)) return null; // skip self transfers
  if (/mooshsin|mohasser|aliexpress|alibaba|ugr/.test(m)) return 'supra';
  if (/talabat|mcdonald|kfc|burger|pizza|coffee|cafe|shawarma|sushi|biryani|grill|kitchen|bakery|juice|cream|cinnabon|slider|seven brother|chick buck|land burger|steak|jollibee|hardee|swift shawarma|kucu|restaurant|dining|eatery|\btea\b|tea time|tea corner|tea path|rules coffee|cioccolat|starbucks|costa|dunkin|subway|domino|pizza hut|popeye|raising cane|five guy|shake shack|nando|baskin|cold stone|frozen|tropical|ahlain|adil|somi|adam bakery|ocean mart|take biryani|bait|gulf|healthy bar|top bous|serve|land smokehouse|jollibee/.test(m)) return 'food';
  if (/oman oil|shell|al maha|enoc|emarat|petrol|fuel|gasoline|filling station/.test(m)) return 'fuel';
  if (/ace musc|mudhabi|padel|paddle|strike|playtomic|muscat sport/.test(m)) return 'paddle';
  if (/steam|riot|gaming planet|likecard|dokan|remal|g2a|ea games|tap.*gaming|damadah|supercell|playstation|xbox|nintendo|blizzard|ubisoft|epic games/.test(m)) return 'gaming';
  if (/amazon|noon|sultan center|carrefour|lulu|hypermarket|supermarket|mall|shopping|boutique|borders|aramex|dhl|fedex|elegant art|al luban|ever baws|sky line|kiks|modern concepts|alsajwan/.test(m)) return 'shopping';
  if (/hotel|resort|airbnb|flight|airline|airport|uber|tfl|karwa|harrods|louis vuitton|deliveroo|heathrow|sand dance|playtomic.*dubai/.test(m)) return 'trips';
  if (/rop traffic|etraffic|e-traffic|traffic fine|parking|nissan service|toyota service|car service|grand tire|easy travel/.test(m)) return 'transport';
  if (/middle east college|college|university|school|tuition/.test(m)) return 'education';
  if (/vox cinema|cinema|magic planet|ground control|seen jeem|bowling|al masa/.test(m)) return 'entertainment';
  if (/voxi|omantel|microsoft|apple\.com|itunes|google|youtube|spotify|netflix|clinic|hospital|pharmacy|health|blade|barber|salon|prophysio|first class spa|burjeel|segpay|psmhelp/.test(m)) return 'personal';
  return 'personal';
}

function parseCardEmail(body, emailDate) {
  const descMatch = body.match(/Description\s*:\s*([^\n<\r]+)/i);
  const amtMatch  = body.match(/Amount\s*:\s*OMR\s*([\d.]+)/i);
  const dtMatch   = body.match(/Date\/Time\s*:\s*(\d{2})\s+([A-Z]{3})\s+(\d{2,4})/i);
  if (!amtMatch) return null;

  const amount = parseFloat(amtMatch[1]);
  const rawDesc = descMatch ? descMatch[1].trim() : 'Bank Muscat';
  const merchant = rawDesc.replace(/^\d+-/, '').replace(/\s+\+\d+.*$/, '').trim();
  const cat = categorizeMerchant(merchant);
  if (cat === null) return null;

  let date;
  if (dtMatch) {
    const day = dtMatch[1].padStart(2, '0');
    const mo  = MONTH_MAP[dtMatch[2].toUpperCase()] || '01';
    let yr = dtMatch[3];
    if (yr.length === 2) yr = '20' + yr;
    date = `${yr}-${mo}-${day}`;
  } else {
    date = new Date(parseInt(emailDate)).toISOString().slice(0, 10);
  }

  return { date, merchant, amount, cat, month: date.slice(0, 7) };
}

function parseSentEmail(body, emailDate) {
  // "You have sent OMR X to NAME from your a/c"
  const match = body.match(/You have sent OMR\s*([\d.]+)\s+to\s+([^\s<\n]+)/i);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  const recipient = match[2].trim();

  // Skip ALI RAID self transfers
  if (/ALI RAID/i.test(recipient)) return null;

  const date = new Date(parseInt(emailDate)).toISOString().slice(0, 10);
  const cat = /mooshsin|mohasser/i.test(recipient) ? 'supra' : 'transfers';

  return { date, merchant: `${recipient} (Wallet)`, amount, cat, month: date.slice(0, 7) };
}

function parseReceivedEmail(body, emailDate) {
  // "You have received OMR X from NAME in your a/c"
  // First check full body for ALI RAID before any parsing
  if (/ALI RAID/i.test(body)) return null;

  const match = body.match(/You have received OMR\s*([\d.]+)\s+from\s+(.+?)\s+in your/i);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  const sender = match[2].trim();

  // Double check sender name
  if (/ALI RAID|ALI LAWATI/i.test(sender)) return null;

  const date = new Date(parseInt(emailDate)).toISOString().slice(0, 10);
  return { date, merchant: sender, amount, cat: 'income', month: date.slice(0, 7) };
}

function parseCreditDebitEmail(body, emailDate) {
  // "Your account has been credited/debited by OMR X"
  // Skip ALL ALI RAID transfers (self transfers between own accounts), Cash Deposits
  if (/ALI RAID|CASH DEP|EASY DEPOSIT|CDM|ATM/i.test(body)) return null;

  const debitMatch = body.match(/debited by OMR\s*([\d.]+)/i);
  if (!debitMatch) return null; // only process debits (outgoing transfers)

  const amount = parseFloat(debitMatch[1]);
  const nameMatch = body.match(/Transfer\s+([A-Z][A-Z\s]+?)(?:\s+LFT|\s+Txn|<|\n|$)/i);
  const name = nameMatch ? nameMatch[1].trim() : 'Transfer';

  if (/ALI RAID/i.test(name)) return null;

  const date = new Date(parseInt(emailDate)).toISOString().slice(0, 10);
  const cat = /mooshsin|mohasser/i.test(name) ? 'supra' : 'transfers';

  return { date, merchant: `${name} (Wallet)`, amount, cat, month: date.slice(0, 7) };
}

function parseEmail(body, emailDate) {
  if (/Your Debit card.*has been utilised/i.test(body)) return parseCardEmail(body, emailDate);
  if (/You have sent OMR/i.test(body)) return parseSentEmail(body, emailDate);
  if (/You have received OMR/i.test(body)) return parseReceivedEmail(body, emailDate);
  if (/has been credited by OMR|has been debited by OMR/i.test(body)) return parseCreditDebitEmail(body, emailDate);
  return null;
}

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
    let syncedIds = [];
    try { syncedIds = (await kvGet('ali_synced_ids')) || []; } catch(e) {}
    const syncedSet = new Set(syncedIds);

    const searchRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:NOREPLY@bankmuscat.com after:2026/04/01',
      maxResults: 100,
    });

    const messages = (searchRes.data.messages || []).filter(m => !syncedSet.has(m.id));
    if (messages.length === 0) {
      return httpRes.status(200).json({ transactions: [], count: 0 });
    }

    const fetched = await Promise.all(
      messages.map(msg =>
        gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' }).catch(() => null)
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
      // Always mark as synced to avoid reprocessing
      newSyncedIds.push(messages[i].id);
      const tx = parseEmail(body, full.internalDate);
      if (tx) transactions.push(tx);
    }

    if (newSyncedIds.length > 0) {
      try { await kvSet('ali_synced_ids', [...syncedIds, ...newSyncedIds]); } catch(e) {}
    }

    httpRes.status(200).json({ transactions, count: transactions.length });
  } catch (error) {
    httpRes.status(500).json({ error: error.message, transactions: [] });
  }
}
