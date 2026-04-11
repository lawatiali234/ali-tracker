export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Try all possible Upstash env var name combinations
  const url = process.env.KV_REST_API_URL ||
              process.env.UPSTASH_REDIS_REST_URL ||
              process.env.STORAGE_KV_REST_API_URL ||
              process.env.STORAGE_UPSTASH_REDIS_REST_URL;

  const token = process.env.KV_REST_API_TOKEN ||
                process.env.UPSTASH_REDIS_REST_TOKEN ||
                process.env.STORAGE_KV_REST_API_TOKEN ||
                process.env.STORAGE_UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return res.status(200).json({ transactions: [], debug: 'No KV env vars found' });
  }

  try {
    const response = await fetch(`${url}/get/ali_manual_txs`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    // data.result is the stored string — parse it
    const transactions = data.result ? JSON.parse(data.result) : [];
    res.status(200).json({ transactions: Array.isArray(transactions) ? transactions : [] });
  } catch (e) {
    res.status(200).json({ transactions: [], error: e.message });
  }
}
