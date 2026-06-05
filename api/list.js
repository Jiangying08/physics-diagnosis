// Vercel API: 教师端获取所有诊断结果
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const TOKEN = process.env.GH_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: 'Server not configured' });

    // 从 GitHub Issues 获取所有学生结果
    let allIssues = [];
    let page = 1;
    while (true) {
      const ghRes = await fetch(
        `https://api.github.com/repos/Jiangying08/physics-diagnosis/issues?labels=student-result&state=all&per_page=100&page=${page}`,
        { headers: { Authorization: `token ${TOKEN}` } }
      );
      if (!ghRes.ok) break;
      const issues = await ghRes.json();
      if (!issues.length) break;
      allIssues = allIssues.concat(issues);
      if (issues.length < 100) break;
      page++;
    }

    // 解析数据
    const students = [];
    allIssues.forEach(issue => {
      try {
        const data = JSON.parse(issue.body);
        if (data.n && data.s && data.t) {
          students.push({
            name: data.n,
            scores: data.s,
            type: data.t,
            date: data.d,
            weaknesses: data.w || [],
            created: issue.created_at
          });
        }
      } catch (e) { /* 跳过解析失败的 */ }
    });

    return res.status(200).json({ success: true, data: students });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
