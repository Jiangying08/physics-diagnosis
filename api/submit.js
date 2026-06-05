// Vercel API: 学生提交诊断结果
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, scores, type, date, weaknesses } = req.body;
  if (!name || !scores || !type) return res.status(400).json({ error: 'Missing fields' });

  try {
    const TOKEN = process.env.GH_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: 'Server not configured' });

    const title = `[诊断结果] ${name} - ${date}`;
    const body = JSON.stringify({ n: name, s: scores, t: type, d: date, w: weaknesses || [] });

    const ghRes = await fetch('https://api.github.com/repos/Jiangying08/physics-diagnosis/issues', {
      method: 'POST',
      headers: {
        Authorization: `token ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels: ['student-result'] })
    });

    if (!ghRes.ok) {
      const err = await ghRes.text();
      return res.status(500).json({ error: 'GitHub API error', detail: err });
    }

    const data = await ghRes.json();
    return res.status(200).json({ success: true, number: data.number });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
