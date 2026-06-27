import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Password check via header or query param
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  if (adminKey !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch all global counters in one shot
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
      kv.get('stat:total:page_visit'),
      kv.get('stat:total:quiz_start'),
      kv.get('stat:total:quiz_complete'),
      kv.get('stat:total:cta_click'),
      kv.get('stat:result:career'),
      kv.get('stat:result:love'),
      kv.get('stat:result:self'),
      kv.get('stat:result:decision'),
      kv.smembers('stat:active_days')
    ]);

    // Fetch daily stats for last 14 days
    const dailyStats = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const [v, qs, qc, cta] = await Promise.all([
        kv.get(`stat:daily:${dateStr}:page_visit`),
        kv.get(`stat:daily:${dateStr}:quiz_start`),
        kv.get(`stat:daily:${dateStr}:quiz_complete`),
        kv.get(`stat:daily:${dateStr}:cta_click`)
      ]);
      dailyStats.push({
        date: dateStr,
        visits: v || 0,
        quiz_start: qs || 0,
        quiz_complete: qc || 0,
        cta_click: cta || 0
      });
    }

    const completionRate = totalQuizStart > 0
      ? Math.round((totalQuizComplete / totalQuizStart) * 100)
      : 0;
    const ctaConversion = totalVisits > 0
      ? Math.round((totalCTAClick / totalVisits) * 100)
      : 0;

    return res.status(200).json({
      totals: {
        page_visit: totalVisits || 0,
        quiz_start: totalQuizStart || 0,
        quiz_complete: totalQuizComplete || 0,
        cta_click: totalCTAClick || 0
      },
      rates: {
        completion_rate: completionRate,
        cta_conversion: ctaConversion
      },
      results: {
        career: resultCareer || 0,
        love: resultLove || 0,
        self: resultSelf || 0,
        decision: resultDecision || 0
      },
      daily: dailyStats,
      active_days: (activeDays || []).length
    });
  } catch (err) {
    console.error('KV error:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
