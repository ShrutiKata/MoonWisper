const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const adminKey = (req.headers && req.headers['x-admin-key']) || (req.query && req.query.key);
  if (adminKey !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [
      totalVisits,
      totalQuizStart,
      totalQuizComplete,
      totalCTAClick,
      resultCareer,
      resultLove,
      resultSelf,
      resultDecision,
      activeDays
    ] = await Promise.all([
      redis.get('stat:total:page_visit'),
      redis.get('stat:total:quiz_start'),
      redis.get('stat:total:quiz_complete'),
      redis.get('stat:total:cta_click'),
      redis.get('stat:result:career'),
      redis.get('stat:result:love'),
      redis.get('stat:result:self'),
      redis.get('stat:result:decision'),
      redis.smembers('stat:active_days')
    ]);

    // Daily stats last 14 days
    const dailyStats = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const [v, qs, qc, cta] = await Promise.all([
        redis.get(`stat:daily:${dateStr}:page_visit`),
        redis.get(`stat:daily:${dateStr}:quiz_start`),
        redis.get(`stat:daily:${dateStr}:quiz_complete`),
        redis.get(`stat:daily:${dateStr}:cta_click`)
      ]);
      dailyStats.push({
        date: dateStr,
        visits: Number(v) || 0,
        quiz_start: Number(qs) || 0,
        quiz_complete: Number(qc) || 0,
        cta_click: Number(cta) || 0
      });
    }

    const tv = Number(totalVisits) || 0;
    const ts = Number(totalQuizStart) || 0;
    const tc = Number(totalQuizComplete) || 0;
    const ta = Number(totalCTAClick) || 0;

    return res.status(200).json({
      totals: {
        page_visit: tv,
        quiz_start: ts,
        quiz_complete: tc,
        cta_click: ta
      },
      rates: {
        completion_rate: ts > 0 ? Math.round((tc / ts) * 100) : 0,
        cta_conversion:  tv > 0 ? Math.round((ta / tv) * 100) : 0
      },
      results: {
        career:   Number(resultCareer)   || 0,
        love:     Number(resultLove)     || 0,
        self:     Number(resultSelf)     || 0,
        decision: Number(resultDecision) || 0
      },
      daily: dailyStats,
      active_days: (activeDays || []).length
    });
  } catch (err) {
    console.error('Redis error:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
};
