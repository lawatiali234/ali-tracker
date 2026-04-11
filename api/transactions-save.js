export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.KV_REST_API_URL ||
              process.env.UPSTASH_REDIS_REST_URL ||
              process.env.STORAGE_KV_REST_API_URL ||
              process.env.STORAGE_UPSTASH_REDIS_REST_URL;

  const token = process.env.KV_REST_API_TOKEN ||
                process.env.UPSTASH_REDIS_REST_TOKEN ||
                process.env.STORAGE_KV_REST_API_TOKEN ||
                process.env.STORAGE_UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ error: 'No KV env vars found' });
  }

  try {
    const { transactions } = req.body;
    const valueStr = JSON.stringify(transactions);

    // Upstash REST API: POST /set/key with raw string value in body
    const response = await fetch(`${url}/set/ali_manual_txs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(valueStr)  // send as JSON-encoded string
    });

    const data = await response.json();
    res.status(200).json({ ok: true, result: data.result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
