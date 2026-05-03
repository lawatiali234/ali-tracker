export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(200).json({ transactions: [] });
  }

  try {
    const response = await fetch(`${url}/get/ali_manual_txs`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    const transactions = data.result ? JSON.parse(decodeURIComponent(data.result)) : [];
    res.status(200).json({ transactions: Array.isArray(transactions) ? transactions : [] });
  } catch (e) {
    res.status(200).json({ transactions: [], error: e.message });
  }
}
