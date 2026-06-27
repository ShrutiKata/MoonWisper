import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Allow cross-origin from same domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { event, result } = req.body;

  const validEvents = ['page_visit', 'quiz_start', 'quiz_complete', 'cta_click'];
  if (!validEvents.includes(event)) {
    return res.status(400).json({ error: 'Invalid event' });
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const pipeline = kv.pipeline();

    // Global counters
    pipeline.incr(`stat:total:${event}`);

    // Daily counters
    pipeline.incr(`stat:daily:${today}:${event}`);

    // Track which result types were given (for quiz_complete)
    if (event === 'quiz_complete' && result) {
      const validResults = ['career', 'love', 'self', 'decision'];
      if (validResults.includes(result)) {
        pipeline.incr(`stat:result:${result}`);
      }
    }

    // Track daily unique days (for activity chart)
    pipeline.sadd('stat:active_days', today);

    await pipeline.exec();

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('KV error:', err);
    return res.status(500).json({ error: 'Tracking failed' });
  }
}
