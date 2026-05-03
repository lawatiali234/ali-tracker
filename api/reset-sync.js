export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  await fetch(`${url}/del/ali_synced_ids`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  res.status(200).json({ ok: true, message: 'Sync IDs cleared — all emails will re-sync' });
}
