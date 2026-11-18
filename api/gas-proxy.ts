const DEFAULT_GAS_GET_ALL_URL =
  'https://script.google.com/macros/s/AKfycbx5gTcxhLQ1i2ZksvPGzzmJC4YXVvZp5-Rm7C74WZserM5mooPsMB450m128QdHMAV_TQ/exec?action=getAll';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, Cache-Control, Pragma, X-Requested-With'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const rawUrlParam = req.query?.url;
    const targetUrl =
      typeof rawUrlParam === 'string' && rawUrlParam.trim()
        ? rawUrlParam
        : DEFAULT_GAS_GET_ALL_URL;

    let bodyStr: string | undefined;
    if (req.method === 'POST') {
      bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    }

    const gasRes = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: req.method === 'POST' ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
      body: req.method === 'POST' ? bodyStr : undefined,
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    const data = await gasRes.text();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Apps Script proxy error' });
  }
}
