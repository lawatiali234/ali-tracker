export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(200).json({ transactions: [] });
  }

  try {
    // Upstash REST API: use pipeline format
    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['GET', 'ali_manual_txs']
      ])
    });

    const data = await response.json();
    // Pipeline returns array of results: [{ result: "value" }]
    const raw = data[0]?.result;
    const transactions = raw ? JSON.parse(raw) : [];
    res.status(200).json({ transactions: Array.isArray(transactions) ? transactions : [] });
  } catch (e) {
    res.status(200).json({ transactions: [], error: e.message });
  }
}
