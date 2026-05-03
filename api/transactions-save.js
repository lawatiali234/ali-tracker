export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ error: 'No KV env vars' });
  }

  try {
    const { transactions } = req.body;
    const encoded = encodeURIComponent(JSON.stringify(transactions));

    const response = await fetch(`${url}/set/ali_manual_txs/${encoded}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    res.status(200).json({ ok: data.result === 'OK' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
