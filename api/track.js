const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { event, result } = req.body || {};

  const validEvents = ['page_visit', 'quiz_start', 'quiz_complete', 'cta_click'];
  if (!validEvents.includes(event)) {
    return res.status(400).json({ error: 'Invalid event' });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const pipeline = redis.pipeline();

    pipeline.incr(`stat:total:${event}`);
    pipeline.incr(`stat:daily:${today}:${event}`);

    if (event === 'quiz_complete' && result) {
      const validResults = ['career', 'love', 'self', 'decision'];
      if (validResults.includes(result)) {
        pipeline.incr(`stat:result:${result}`);
      }
    }

    pipeline.sadd('stat:active_days', today);

    await pipeline.exec();

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Redis error:', err);
    return res.status(500).json({ error: 'Tracking failed' });
  }
};
