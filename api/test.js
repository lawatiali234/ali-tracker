export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(200).json({ error: 'No env vars', url: !!url, token: !!token });
  }

  try {
    // Test: write a value
    const setRes = await fetch(`${url}/set/test_key/hello`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const setData = await setRes.json();

    // Test: read it back
    const getRes = await fetch(`${url}/get/test_key`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const getData = await getRes.json();

    res.status(200).json({
      set: setData,
      get: getData,
      url_prefix: url.substring(0, 30)
    });
  } catch(e) {
    res.status(200).json({ error: e.message });
  }
}
