import { google } from 'googleapis';
import { getClient } from './auth.js';

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) rc.split(';').forEach(c => {
    const parts = c.split('=');
    list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
  });
  return list;
}

function categorize(s) {
  s = s.toLowerCase();
  if (/\bace\b|ace musc|paddle|padel|\bstrike\b|mudhabi/.test(s)) return 'paddle';
  if (/oman oil|\bshell\b|al maha|maha fuel|station:/.test(s)) return 'fuel';
  if (/you have sent omr .+ to /.test(s)) return 'transfer';
  if (/jollibee|mcdonald|kfc|burger|pizza|talabat|biryani|cioccolat|bateel|tea corner|silk route|abu rateb|nandos|coffee|restaurant|cafe|dining|food|shawarma|sushi|kucu/.test(s)) return 'food';
  if (/barber|blade|salon|spa|gym|health centre|clinic|hospital|pharmacy|anthropic|youtube|netflix|spotify|google|voxi|subscription|knowledge view/.test(s)) return 'personal';
  if (/aliexpress|amazon|noon|lulu|carrefour|sultan center|dubizzle|seen jeem/.test(s)) return 'shopping';
  if (/you have received|transfer ali raid|easy deposit|atm cash|cdm|inward payment|vat/.test(s)) return null;
  return 'ask';
}

function parseEmail(msg) {
  const s = msg.snippet || '';
  const ts = parseInt(msg.internalDate);
  const date = new Date(ts);
  const dateStr = date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

  if (/you have sent omr .+ to ali raid/i.test(s)) return null;
  if (date <= new Date('2026-03-20')) return null;

  const sentM = s.match(/You have sent OMR ([\d,.]+) to ([A-Z][A-Z '\-]+?) (?:from your|using)/i);
  if (sentM) {
    return {
      id: msg.messageId,
      merchant: 'Sent → ' + sentM[2].trim(),
      amount: parseFloat(sentM[1]),
      category: 'transfer',
      date: dateStr,
      ts
    };
  }

  const descM = s.match(/Description\s*:\s*[\d]+-(.+?)(?:\s+Amount|\s*$)/i);
  const amtM  = s.match(/Amount\s*:\s*OMR\s*([\d,.]+)/i);
  if (descM && amtM) {
    const merchant = descM[1].trim().replace(/\s+(Amount|Date|POS\d+).*$/i, '');
    const cat = categorize(s);
    if (!cat) return null;
    return {
      id: msg.messageId,
      merchant,
      amount: parseFloat(amtM[1]),
      category: cat,
      date: dateStr,
      ts
    };
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const cookies = parseCookies(req);
  const tokenStr = cookies.gTokens;
  if (!tokenStr) return res.status(401).json({ error: 'not_authenticated' });

  try {
    const tokens = JSON.parse(tokenStr);
    const oauth2Client = getClient(req);
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const searchRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:NOREPLY@bankmuscat.com subject:"Account Transaction"',
      maxResults: 100
    });

    const messages = searchRes.data.messages || [];
    const transactions = [];

    for (const m of messages) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['Date']
      });
      const tx = parseEmail({
        messageId: m.id,
        snippet: detail.data.snippet,
        internalDate: detail.data.internalDate
      });
      if (tx && tx.amount > 0) transactions.push(tx);
    }

    transactions.sort((a, b) => b.ts - a.ts);
    res.json({ transactions, count: transactions.length, synced: new Date().toISOString() });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
