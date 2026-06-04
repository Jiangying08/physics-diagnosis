/**
 * 初三物理学科诊断 - 后端服务
 * Express + sql.js（纯 JS SQLite）
 */
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// 静态文件：学生/教师/管理页面
app.use(express.static(path.join(__dirname, 'public')));

// ============ API 路由 ============

// GET /api/quiz — 获取完整的问卷数据（题目、维度、学员类型）
app.get('/api/quiz', async (req, res) => {
  try {
    const db = await getDb();

    const dimsResult = db.exec('SELECT * FROM dimensions ORDER BY key');
    const dims = dimsResult[0] ? dimsResult[0].values.map(row => ({
      key: row[0], label: row[1], color: row[2], icon: row[3], description: row[4],
    })) : [];

    const typesResult = db.exec('SELECT * FROM types ORDER BY key');
    const types = typesResult[0] ? typesResult[0].values.map(row => ({
      key: row[0], name: row[1], emoji: row[2], slogan: row[3],
      strengths: JSON.parse(row[4]), weaknesses: JSON.parse(row[5]), todos: JSON.parse(row[6]),
    })) : [];

    const qResult = db.exec('SELECT * FROM questions ORDER BY sort_order');
    const questions = qResult[0] ? qResult[0].values.map(row => {
      const qid = row[0];
      const optResult = db.exec(`SELECT * FROM options WHERE question_id = ${qid} ORDER BY sort_order`);
      const opts = optResult[0] ? optResult[0].values.map(o => ({
        label: o[2], text: o[3], score: o[4], weakness: o[5],
      })) : [];
      return { id: qid, dim: row[1], text: row[2], opts };
    }) : [];

    res.json({ dims, types, questions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '获取问卷数据失败' });
  }
});

// POST /api/submit — 提交学生答题结果
app.post('/api/submit', async (req, res) => {
  try {
    const { name, scores, type, wrong_answers } = req.body;
    if (!name || !scores || !type) {
      return res.status(400).json({ error: '缺少必要字段（name, scores, type）' });
    }
    const db = await getDb();
    const id = 's_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
    db.run('INSERT INTO results (id, name, scores, type, wrong_answers) VALUES (?,?,?,?,?)',
      [id, name, JSON.stringify(scores), type, JSON.stringify(wrong_answers || [])]);
    // 保存到文件
    const fs = require('fs');
    const buffer = Buffer.from(db.export());
    fs.writeFileSync(path.join(__dirname, 'quiz.db'), buffer);
    res.json({ success: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '提交失败' });
  }
});

// GET /api/results — 获取所有学生结果（教师端）
app.get('/api/results', async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec('SELECT * FROM results ORDER BY created_at DESC');
    const list = result[0] ? result[0].values.map(row => ({
      id: row[0], name: row[1],
      scores: JSON.parse(row[2]), type: row[3],
      wrong_answers: JSON.parse(row[4]), date: row[5],
    })) : [];
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '获取数据失败' });
  }
});

// DELETE /api/results/:id — 删除学生记录
app.delete('/api/results/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM results WHERE id = ?', [req.params.id]);
    const fs = require('fs');
    const buffer = Buffer.from(db.export());
    fs.writeFileSync(path.join(__dirname, 'quiz.db'), buffer);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '删除失败' });
  }
});

// ============ 管理端 API：批量保存问卷 ============

// POST /api/quiz/save-all — 一次性保存所有问卷内容
app.post('/api/quiz/save-all', async (req, res) => {
  try {
    const { questions, types } = req.body;
    const db = await getDb();

    // 更新题目
    if (questions && Array.isArray(questions)) {
      const updQ = db.prepare('UPDATE questions SET text = ? WHERE id = ?');
      questions.forEach(q => {
        updQ.run([q.text, q.id]);
        if (q.opts && Array.isArray(q.opts)) {
          const dbOptsResult = db.exec(`SELECT id FROM options WHERE question_id = ${q.id} ORDER BY sort_order`);
          const dbOpts = dbOptsResult[0] ? dbOptsResult[0].values.map(r => r[0]) : [];
          const updOpt = db.prepare('UPDATE options SET text = ?, score = ?, weakness = ? WHERE id = ?');
          q.opts.forEach((o, oi) => {
            if (dbOpts[oi]) {
              updOpt.run([o.text, o.score, o.weakness || null, dbOpts[oi]]);
            }
          });
          updOpt.free();
        }
      });
      updQ.free();
    }

    // 更新类型
    if (types && Array.isArray(types)) {
      const updT = db.prepare('UPDATE types SET slogan = ?, strengths = ?, weaknesses = ?, todos = ? WHERE key = ?');
      types.forEach(t => {
        updT.run([t.slogan, JSON.stringify(t.strengths), JSON.stringify(t.weaknesses), JSON.stringify(t.todos), t.key]);
      });
      updT.free();
    }

    // 保存到文件
    const fs = require('fs');
    const buffer = Buffer.from(db.export());
    fs.writeFileSync(path.join(__dirname, 'quiz.db'), buffer);

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '保存失败', detail: e.message });
  }
});

// ============ 启动 ============
async function start() {
  await getDb();

  // 获取本机局域网 IP
  const os = require('os');
  const nets = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ 服务已启动！`);
    console.log(`  📍 本机访问：http://localhost:${PORT}`);
    console.log(`  🌐 局域网访问：http://${localIP}:${PORT}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  📝 学生端：http://${localIP}:${PORT}/student.html`);
    console.log(`  👩‍🏫 教师端：http://${localIP}:${PORT}/teacher.html`);
    console.log(`  ⚙️  管理端：http://${localIP}:${PORT}/admin.html`);
  });
}

start().catch(e => {
  console.error('启动失败:', e);
  process.exit(1);
});
