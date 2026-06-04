/**
 * 数据库初始化 + 种子数据
 * 使用 sql.js（纯 JS SQLite，无需编译）
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'quiz.db');
let db = null;
let SQL = null;

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

async function getDb() {
  if (db) return db;
  SQL = await initSqlJs();

  // 尝试加载已有的数据库文件
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    // 验证数据库是否有效
    try {
      db.exec('SELECT COUNT(*) FROM questions');
      return db;
    } catch (e) {
      // 数据库文件损坏，重新创建
      db = null;
    }
  }

  // 创建新数据库
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  createTables();
  seedData();
  saveDb();
  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS dimensions (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dim_key TEXT NOT NULL REFERENCES dimensions(key),
      text TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      text TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      weakness TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS types (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      slogan TEXT NOT NULL,
      strengths TEXT NOT NULL DEFAULT '[]',
      weaknesses TEXT NOT NULL DEFAULT '[]',
      todos TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scores TEXT NOT NULL DEFAULT '{}',
      type TEXT NOT NULL,
      wrong_answers TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
}

function seedData() {
  // 维度
  const insDim = db.prepare('INSERT OR IGNORE INTO dimensions VALUES (?,?,?,?,?)');
  insDim.run(['concept', '概念理解', '#4299E1', '🧠', '对物理定义、定理、规律的本质理解，而非死记硬背']);
  insDim.run(['model', '模型建构', '#48BB78', '🔧', '将实际问题抽象为物理模型，画出受力图、光路图等']);
  insDim.run(['math', '数学运用', '#ED8936', '📐', '用数学工具（公式、比例、单位换算等）解决物理问题']);
  insDim.run(['reading', '审题习惯', '#9F7AEA', '🔍', '从题干中提取关键条件，排除无关信息的干扰']);
  insDim.run(['flexible', '思维灵活', '#FC8181', '💡', '面对新情境、新问法时灵活调用知识，不拘泥于固定套路']);
  insDim.free();

  // 题型
  const insType = db.prepare('INSERT OR IGNORE INTO types VALUES (?,?,?,?,?,?,?)');
  insType.run(['A', '直觉建构者', '🔮', '你有很好的物理直觉和概念理解力，但有时"太快"而漏掉题目的关键条件。',
    JSON.stringify([{t:'概念理解力强',d:'你对物理概念的本质有很好的直觉。学新知识时"就是能懂"。'},{t:'建模能力好',d:'你能在脑中构建清晰的物理模型，快速抓住框架。'}]),
    JSON.stringify([{t:'审题容易跳步',d:'做题时因"觉得太简单"而漏读条件。不是不会，是没看到。'},{t:'步骤不够规范',d:'习惯在脑子里想清楚就直接写答案，跳过中间步骤。'}]),
    JSON.stringify([{t:'"三步审题法"锁住跳步',d:'①圈出所有已知条件 ②画出对应图景 ③标出问题。做完再动笔。',target:'坚持 3 周养成习惯'},{t:'每道题写出完整步骤',d:'公式→代入→结果→单位，一步不缺。',target:'连续 10 道题步骤完整'},{t:'用"讲题法"检验理解',d:'学完一个概念后从头到尾讲一遍，能脱稿讲通才算真懂。',target:'脱稿讲 3 分钟不卡壳'}])]);
  insType.run(['B', '规范执行者', '📋', '你做题规范、步骤完整，这是很好的基础。但遇到新题型时需要更灵活一些。',
    JSON.stringify([{t:'做题规范严谨',d:'步骤完整、审题仔细，综合计算中准确率很高。'},{t:'公式运用准确',d:'对物理公式掌握扎实，知道不同场景如何选用。'}]),
    JSON.stringify([{t:'遇到新题型容易慌',d:'题目换了问法或场景陌生时，可能不知从何下手。'},{t:'思维灵活性不足',d:'习惯用一种固定方式解题，面对非常规问题需更多变通。'}]),
    JSON.stringify([{t:'"陌生题拆解三步法"',d:'①圈出所有已知条件 ②问"这和哪类题相似" ③大问题拆小问题。',target:'独立完成 5 道陌生题型'},{t:'一题多解拓展思路',d:'找一道题用两种不同方法求解。',target:'累计 15 道一题多解'},{t:'做自己的"错题教练"',d:'每道错题旁写一句"我当时为什么会想错"。',target:'积累 20 道有反思的错题'}])]);
  insType.run(['C', '快速扫描者', '⚡', '你反应快、信息抓取快，但要当心知识"碎片化"，物理需要连成网。',
    JSON.stringify([{t:'信息处理快',d:'读题快、反应快，考试中能快速过一遍全卷。'},{t:'思维灵活',d:'脑子转得快，能在不同思路间灵活切换。'}]),
    JSON.stringify([{t:'知识体系碎片化',d:'每个知识点都懂一些，但串不起来。环环相扣掉一个后面就吃力。'},{t:'概念深度不够',d:'可能停留在"知道是什么"层面，"为什么"没深究。'}]),
    JSON.stringify([{t:'每讲画一张"知识网图"',d:'用 A4 纸画出本节所有概念、公式、关系图。',target:'累计 8 张知识网图'},{t:'用"教别人"检验深度',d:'假装给完全不懂的同学讲原理，讲不清楚说明不够深。',target:'每模块脱稿讲通'},{t:'慢下来做"思维复盘"',d:'做完题想：①考了什么 ②用了什么方法 ③还有别的解法吗？',target:'连续 15 道有复盘记录'}])]);
  insType.run(['D', '记忆驱动者', '📝', '你下功夫记公式和结论，但物理不是记忆学科——"为什么"才是拿高分的关键。',
    JSON.stringify([{t:'公式记得牢',d:'你花功夫记公式和题型，这是解题的"武器库"。'},{t:'学习态度认真',d:'愿意花时间去记去背，努力不会白费。'}]),
    JSON.stringify([{t:'不追问"为什么"',d:'习惯"记住结论"而非"理解来源"。题目一变就懵。'},{t:'概念理解薄弱',d:'在"这是什么"层面还行，"为什么是这样"有待加强。'}]),
    JSON.stringify([{t:'每个概念"追根溯源"',d:'写在纸上→写出来源推导→用自己的话解释意义。',target:'前 10 个核心概念完成溯源卡'},{t:'做完题问自己"为什么"',d:'不只满足于做对，多问"为什么这个解法对？"',target:'连续 15 道有"为什么"标注'},{t:'做概念辨析对比表',d:'用表格写出易混概念的定义、区别和联系。',target:'至少 4 次概念辨析'}])]);
  insType.run(['E', '缓慢建构者', '🌱', '你学物理可能需要多花点时间，但一旦真正理解了就不会忘。坚持住！',
    JSON.stringify([{t:'理解后不会忘',d:'学得慢但扎实，真正理解了的就不会忘记。'},{t:'愿意下功夫',d:'即使暂时不理想仍然在坚持——这是最稀缺的天赋。'}]),
    JSON.stringify([{t:'基础概念有漏洞',d:'声光热力中有部分概念理解不透彻，需要补上。'},{t:'缺乏信心',d:'长期不理想可能让你觉得"学不好物理"——实际上需要换一种方法。'}]),
    JSON.stringify([{t:'从最薄弱的概念开始补',d:'找出最没把握的 1-2 个知识点，从课本原话→例题→复述。',target:'每周补透 1 个薄弱概念'},{t:'用实验视频辅助理解',d:'去 B 站看物理实验视频，边看边画过程。',target:'看完 5 个物理实验视频'},{t:'"每日一题"培养节奏',d:'每天只做一道，但步骤写清楚。不贪多，要精。',target:'连续 20 天每日一题打卡'}])]);
  insType.free();

  // 题目数据
  const questions = [
    { dim: 'concept', text: '关于声音的产生与传播，以下说法正确的是？' },
    { dim: 'concept', text: '关于物态变化，以下说法正确的是？' },
    { dim: 'concept', text: '关于光的反射和折射，以下说法正确的是？' },
    { dim: 'model', text: '用水平推力推地面上的木箱，木箱没动。木箱在水平方向受力情况是？' },
    { dim: 'model', text: '一块木块静止在粗糙斜面上，它受到的摩擦力方向是？' },
    { dim: 'model', text: '在"探究凸透镜成像规律"实验中，当物距 u > 2f 时，成像情况是？' },
    { dim: 'math', text: '一个质量为 500g 的物体，体积为 200cm³，它的密度是？' },
    { dim: 'math', text: '一个 60kg 的人站立，每只脚与地面接触约 200cm²，g=10N/kg。他对地面的压强约为？' },
    { dim: 'math', text: '甲速是乙的 2 倍，乙时间是甲的 3 倍。甲、乙路程之比是？' },
    { dim: 'reading', text: '题目："质量为 2kg 的物体放在水平桌面上，用 5N 的拉力使其做匀速直线运动"，求摩擦力。解题关键是什么？' },
    { dim: 'reading', text: '题目："1kg 物体从高处由静止开始下落，不计空气阻力，g=10N/kg"，求 2s 后下落距离。解题关键是什么？' },
    { dim: 'flexible', text: '冬天室外说话呼出"白气"而夏天看不到。以下解释最合理的是？' },
  ];

  const optionsData = [
    [{l:'A',t:'声音在真空中传播速度最快',s:0,w:'声学概念错误——真空不能传声'},{l:'B',t:'声音是由物体振动产生的',s:3,w:null},{l:'C',t:'只要物体振动，我们就一定能听到声音',s:0,w:'忽略了人耳听觉频率范围和传声介质'},{l:'D',t:'声音在固体中传播比在空气中慢',s:1,w:'混淆了不同介质中的声速——固体传声比空气快'}],
    [{l:'A',t:'晶体在熔化过程中吸收热量，但温度保持不变',s:3,w:null},{l:'B',t:'液体蒸发需要达到一定温度才能发生',s:0,w:'混淆了蒸发和沸腾——蒸发在任何温度下都能发生'},{l:'C',t:'冰在熔化过程中温度会逐渐升高',s:0,w:'晶体熔化特点理解错误——冰是晶体，熔化时吸热但温度不变'},{l:'D',t:'夏天冰箱拿出饮料瓶外壁"出汗"，是瓶子漏了',s:0,w:'对液化现象不理解——是水蒸气遇冷瓶壁液化'}],
    [{l:'A',t:'光在发生漫反射时，不遵循光的反射定律',s:0,w:'漫反射的每一条光线都遵循反射定律'},{l:'B',t:'光从空气斜射入水中时，折射角小于入射角',s:3,w:null},{l:'C',t:'光在真空中的传播速度是 3×10⁵m/s',s:1,w:'数量级记错——光速是 3×10⁸m/s'},{l:'D',t:'凸透镜对光有发散作用',s:0,w:'凸透镜会聚、凹透镜发散'}],
    [{l:'A',t:'推力 > 静摩擦力',s:0,w:'若推力大于摩擦力，木箱会加速运动'},{l:'B',t:'推力 = 静摩擦力',s:3,w:null},{l:'C',t:'推力 < 静摩擦力',s:0,w:'若推力小于摩擦力，物体会反向运动'},{l:'D',t:'木箱没动所以不受摩擦力',s:1,w:'有推力且静止，必有静摩擦力平衡'}],
    [{l:'A',t:'沿斜面向上',s:3,w:null},{l:'B',t:'沿斜面向下',s:0,w:'木块有下滑趋势，摩擦阻碍下滑应向上'},{l:'C',t:'垂直斜面向上',s:1,w:'混淆了支持力和摩擦力'},{l:'D',t:'水平向左',s:0,w:'无法建立斜面模型'}],
    [{l:'A',t:'成正立、放大的虚像',s:0,w:'u>2f时成倒立缩小实像'},{l:'B',t:'成倒立、缩小的实像',s:3,w:null},{l:'C',t:'成倒立、放大的实像',s:1,w:'混淆了 f<u<2f 和 u>2f'},{l:'D',t:'不成像',s:0,w:'不同物距成像性质不同，但都能成像'}],
    [{l:'A',t:'2.5 g/cm³',s:3,w:null},{l:'B',t:'0.4 g/cm³',s:1,w:'公式记反了——ρ=m/V'},{l:'C',t:'250 g/cm³',s:0,w:'单位处理失误'},{l:'D',t:'100,000 g/cm³',s:0,w:'计算能力严重不足'}],
    [{l:'A',t:'1.5×10⁴ Pa',s:3,w:null},{l:'B',t:'3.0×10⁴ Pa',s:1,w:'只算了一只脚的面积'},{l:'C',t:'1.5×10³ Pa',s:0,w:'单位换算错误'},{l:'D',t:'3.0×10³ Pa',s:0,w:'对压强公式理解有误'}],
    [{l:'A',t:'2 : 3',s:3,w:null},{l:'B',t:'3 : 2',s:1,w:'比例推导不严谨'},{l:'C',t:'1 : 6',s:0,w:'未正确运用 s=vt 推导'},{l:'D',t:'6 : 1',s:0,w:'错误理解"乙时间是甲的3倍"'}],
    [{l:'A',t:'质量 2kg',s:0,w:'被数字吸引忽略关键信息'},{l:'B',t:'"匀速直线运动"意味着合力为零',s:3,w:null},{l:'C',t:'水平拉力 5N',s:1,w:'匀速条件下才能推出摩擦力'},{l:'D',t:'水平桌面',s:0,w:'被无关背景信息干扰'}],
    [{l:'A',t:'质量 1kg',s:0,w:'质量不影响下落快慢'},{l:'B',t:'"由静止开始"即初速度为零',s:3,w:null},{l:'C',t:'g=10N/kg',s:1,w:'不是本题的"关键条件"'},{l:'D',t:'不计空气阻力',s:1,w:'漏了更关键的初速度条件'}],
    [{l:'A',t:'冬天温度低，呼出的水蒸气遇冷液化成小水滴',s:3,w:null},{l:'B',t:'冬天呼出的气体温度比夏天高',s:0,w:'人体体温恒定，呼出气体温度差异不大'},{l:'C',t:'夏天没有水蒸气呼出',s:0,w:'人呼吸时都会呼出水蒸气'},{l:'D',t:'冬天呼出的气体成分与夏天不同',s:1,w:'成分没变，变化的是外部环境温度'}],
  ];

  const insQ = db.prepare('INSERT INTO questions (dim_key, text, sort_order) VALUES (?,?,?)');
  const insOpt = db.prepare('INSERT INTO options (question_id, label, text, score, weakness, sort_order) VALUES (?,?,?,?,?,?)');

  questions.forEach((q, qi) => {
    insQ.run([q.dim, q.text, qi + 1]);
    // sql.js 获取 lastInsertRowid 的方式
    const result = db.exec('SELECT last_insert_rowid() as id');
    const qid = result[0].values[0][0];
    const opts = optionsData[qi];
    opts.forEach((o, oi) => {
      insOpt.run([qid, o.l, o.t, o.s, o.w, oi + 1]);
    });
  });
  insQ.free();
  insOpt.free();

  console.log('✓ 种子数据已写入数据库');
}

module.exports = { getDb };
