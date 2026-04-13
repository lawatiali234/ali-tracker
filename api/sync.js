import { google } from 'googleapis';

const MONTH_MAP = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'
};

function categorizeMerchant(merchant) {
  const m = merchant.toLowerCase();

  // SUPRA — car related transfers and AliExpress/Alibaba
  if (/mooshsin|mohasser|aliexpress|alibaba/.test(m)) return 'supra';

  // SKIP — self transfers and deposits
  if (/ali raid|easy deposit|cdm deposit|inward payment|reversal/i.test(merchant)) return null;

  // FOOD & DINING
  if (/talabat|mcdonald|kfc|burger|pizza|coffee|cafe|shawarma|sushi|biryani|grill|kitchen|bakery|juice|cream|cinnabon|slider|seven brother|chick buck|land burger|steak|jollibee|hardee|swift shawarma|kucu|restaurant|dining|eatery|bistro|diner|kebab|falafel|noodle|pasta|taco|wok|bbq|barbeque|chicken|fish|seafood|sandwich|wrap|salad|soup|bake|donut|waffle|pancake|breakfast|brunch|lunch|dinner|canteen|buffet|food|meal|eat|snack|munch|bite|taste|flavour|flavor|spice|herb|fresh|organic|healthy|diet|vegan|halal|arabic|lebanese|turkish|indian|chinese|thai|japanese|korean|mexican|italian|french|american|british|mediterranean|asian|western|eastern|al maidah|tajine|machboos|harees|majboos|luqaimat|saloona|ahlain|adil|somi|sevan|adam bakery|rules coffee|cioccolat|starbucks|costa|tim horton|dunkin|subway|domino|pizza hut|hardee|popeye|raising cane|five guy|shake shack|nando|wagamama|cheesecake|baskin|cold stone|haagen|gelato|frozen|tropical|ocean|bait|gulf|arab|oman|muscat/.test(m)) return 'food';

  // FUEL
  if (/oman oil|shell|al maha|enoc|emarat|petrol|fuel|gasoline|filling station|service station|total|bp |caltex|mobil|sinopec|station.*oil|oil.*station/.test(m)) return 'fuel';

  // PADDLE / SPORTS
  if (/ace musc|mudhabi|padel|paddle|strike|squash|tennis|badminton|sport.*club|club.*sport|fitness|gym|crossfit|yoga|pilates|zumba|swimming|pool|court|arena|stadium|athletic|workout|training|exercise|playtomic/.test(m)) return 'paddle';

  // GAMING
  if (/steam|riot|gaming planet|likecard|dokan|remal|g2a|ea games|tap.*gaming|damadah|supercell|playstation|xbox|nintendo|blizzard|ubisoft|epic games|origin|battlenet|twitch|discord|game|psn|xbox live|apple arcade|google play games/.test(m)) return 'gaming';

  // SHOPPING & RETAIL
  if (/amazon|aliexpress|alibaba|noon|sultan center|carrefour|lulu|hypermarket|supermarket|mall|shopping|boutique|fashion|clothing|apparel|shoes|footwear|sport.*wear|adidas|nike|puma|reebok|zara|h&m|primark|marks|spencer|next|gap|uniqlo|ikea|home centre|pan emirate|ace hardware|hardware|electronics|apple store|samsung|huawei|xiaomi|borders|books|stationery|office|supply|pharmacy|drug|medical store|optical|jewellery|jewelry|gold|diamond|watch|accessory|bag|purse|wallet|perfume|cosmetic|beauty|skincare|haircare|salon|barber|blade|aramex|dhl|fedex|ups|delivery|courier|alsajwan|elegant art|al luban|ever baws|sky line|kiks|modern concepts/.test(m)) return 'shopping';

  // TRIPS & TRAVEL
  if (/hotel|resort|inn|hostel|airbnb|booking|expedia|flight|airline|airways|airport|terminal|lounge|visa|passport|travel|tour|trip|holiday|vacation|cruise|ferry|taxi|uber|careem|lyft|grab|tfl|metro|subway|train|bus|rent.*car|car.*rent|hertz|avis|budget rent|enterprise|harrods|harvey nichols|selfridge|fortnum|liberty|bloomingdale|saks|neiman|nordstrom|louis vuitton|gucci|prada|chanel|dior|fendi|burberry|versace|armani|ralph lauren|tommy|calvin|karwa|gulf air|oman air|emirates|etihad|qatar air|flydubai|air arabia|turkish air/.test(m)) return 'trips';

  // TRANSPORT (local)
  if (/rop traffic|etraffic|e-traffic|traffic fine|salik|parking|mawqif|nissan service|toyota service|honda service|bmw service|mercedes service|car service|auto service|tyre|tire|battery|garage|workshop|grand tire|easy travel|rta |adnoc/.test(m)) return 'transport';

  // EDUCATION
  if (/middle east college|college|university|school|institute|academy|tuition|course|training|certification|exam|test center|british council|ielts|toefl|sat |gre |gmat/.test(m)) return 'education';

  // ENTERTAINMENT
  if (/vox cinema|reel cinema|cineplex|cinema|movie|theatre|theater|concert|show|event|ticket|festival|theme park|waterpark|bowling|billiard|snooker|arcade|trampoline|laser tag|escape room|magic planet|fun zone|adventure|safari|zoo|aquarium|museum|gallery|exhibit|seen jeem|ground control|al masa|netflix|spotify|disney|hbo|prime video|youtube premium|apple tv|shahid/.test(m)) return 'entertainment';

  // PERSONAL (subscriptions, health, services)
  if (/clinic|hospital|doctor|dental|pharmacy|health|medical|lab|test|scan|xray|physio|therapy|mental|insurance|takaful|voxi|airtel|ooredoo|omantel|du telecom|etisalat|sim|mobile|recharge|microsoft|office 365|adobe|dropbox|icloud|google storage|antivirus|vpn|domain|hosting|apple\.com|itunes|app store|google play|paypal|revolut|wise|western union|moneygram|psmhelp|segpay|upg|epc|oneic|binaa|flowof life|eToro|t4trade|burjeel|prophysio|first class spa/.test(m)) return 'personal';

  // TRANSFERS (wallets, sent money)
  if (/wallet|transfer|sent to|pay to|mobile pay/.test(m)) return 'transfers';

  // Default
  return 'personal';
}

function parseBMEmail(body, emailDate) {
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
      q: 'from:NOREPLY@bankmuscat.com subject:"Account Transaction" after:2026/04/01',
      maxResults: 50,
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
      const tx = parseBMEmail(body, full.internalDate);
      if (tx) {
        transactions.push(tx);
        newSyncedIds.push(messages[i].id);
      }
    }

    if (newSyncedIds.length > 0) {
      try { await kvSet('ali_synced_ids', [...syncedIds, ...newSyncedIds]); } catch(e) {}
    }

    httpRes.status(200).json({ transactions, count: transactions.length });
  } catch (error) {
    httpRes.status(500).json({ error: error.message, transactions: [] });
  }
}
