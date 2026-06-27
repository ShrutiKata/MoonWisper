const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminKey =
    (req.headers && req.headers['x-admin-key']) ||
    (req.query && req.query.key) ||
    (req.body && req.body.key);

  if (adminKey !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Find every key this app has ever written (totals, daily, results, active_days)
    const keys = await redis.keys('stat:*');

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return res.status(200).json({ ok: true, deleted: keys.length });
  } catch (err) {
    console.error('Redis error:', err);
    return res.status(500).json({ error: 'Reset failed' });
  }
};
