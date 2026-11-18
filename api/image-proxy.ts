export default async function handler(req: any, res: any) {
  const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl || (!rawUrl.startsWith('https://') && !rawUrl.startsWith('http://'))) {
    res.status(400).send('Invalid image URL');
    return;
  }

  try {
    const imgRes = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!imgRes.ok) {
      res.status(imgRes.status).send('Image fetch failed');
      return;
    }

    const ct = (imgRes.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/')) {
      res.status(415).send('Not an image');
      return;
    }

    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.byteLength > 5 * 1024 * 1024) {
      res.status(413).send('Image too large');
      return;
    }

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(buf);
  } catch {
    res.status(502).send('Image proxy error');
  }
}
