/* ==== 功能：学习 START ====
   倒计时 / 今日任务 / 每日单词 / 一建四科考点 / 四科进度 / 错题速记 / 时长统计
   数据全部走 Store；单词与考点按天轮换（开始日锚定，取模循环）。 */
const Study = {
  SUBJECTS: ['经济', '法规', '管理', '水利实务'],
  PER_WORDS: 10,
  PER_POINTS: 5,

  startDate(){ return Store.get('studyStart', Util.today()); },
  dayIdx(d){ return Math.max(0, Math.floor((new Date(d || Util.today()) - new Date(this.startDate())) / 864e5)); },

  wordsOf(d){
    const i = this.dayIdx(d), n = this.PER_WORDS, t = WORDS.length, out = [];
    for (let k = 0; k < n; k++){ const g = (i*n + k) % t; out.push({ g, w: WORDS[g] }); }
    return out;
  },
  pointsOf(d){
    const i = this.dayIdx(d), subj = this.SUBJECTS[i % 4], bank = YJ_POINTS[subj];
    const occ = Math.floor(i / 4), out = [];
    for (let k = 0; k < this.PER_POINTS; k++){ const g = (occ * this.PER_POINTS + k) % bank.length; out.push({ g, p: bank[g] }); }
    return { subj, list: out };
  },

  wordMap(d){ const m = {}; Store.list('wordStat:' + (d || Util.today())).forEach(e => { m[e.g] = e.st; }); return m; },
  pointMap(d){ const m = {}; Store.list('pointStat:' + (d || Util.today())).forEach(e => { m[e.g] = true; }); return m; },

  render(){
    this.renderExam();
    this.renderTasks();
    this.renderWords();
    this.renderPoints();
    this.renderProg();
    this.renderTime();
    this.renderNotes();
    this.streak();
  },

  /* ---------- 倒计时 ---------- */
  renderExam(){
    const exam = Store.get('exam', { name:'一级建造师', date:'2026-09-19' });
    if (!Store.get('exam')) Store.set('exam', exam);
    const days = Math.max(0, Math.ceil((new Date(exam.date) - new Date(Util.today())) / 864e5));
    document.getElementById('examBox').innerHTML =
      `<div class="hero num" style="color:var(--accent)">${days}<span class="unit">天</span></div>
       <p class="hint">${Util.esc(exam.name)} · ${exam.date}</p>`;
    document.getElementById('examName').value = exam.name;
    document.getElementById('examDate').value = exam.date;
  },
  saveExam(){
    const name = document.getElementById('examName').value.trim();
    const date = document.getElementById('examDate').value;
    if (!name || !date){ UI.toast('考试名称和日期都要填'); return; }
    Store.set('exam', { name, date });
    UI.toast('已更新');
    this.renderExam();
  },

  /* ---------- 今日任务 ---------- */
  renderTasks(){
    const today = Util.today();
    const tasks = Store.list('studyTasks');
    const undone = tasks.filter(t => !t.done).sort((a,b) => a.date < b.date ? -1 : 1);
    const doneToday = tasks.filter(t => t.done && t.date === today);
    const list = undone.concat(doneToday);
    document.getElementById('taskList').innerHTML = list.length ? list.map(t => {
      const od = !t.done && t.date < today;
      return `<div class="item ${t.done?'done':''}">
        <button class="box" onclick="Study.toggleTask('${t.id}')">${t.done?'✓':''}</button>
        <span class="grow">${od?'<span class="tag red">顺延</span>':''}${Util.esc(t.text)}</span>
        <button class="del" onclick="Study.delTask('${t.id}')">✕</button></div>`;
    }).join('') : '<div class="empty">今天还没有学习任务，加一条吧</div>';
  },
  addTask(){
    const v = document.getElementById('taskText').value.trim();
    if (!v) return;
    Store.upsert('studyTasks', { text:v, date:Util.today(), done:false });
    document.getElementById('taskText').value = '';
    this.renderTasks();
  },
  toggleTask(id){
    const t = Store.list('studyTasks').find(x => x.id === id);
    if (t) Store.upsert('studyTasks', { id, done: !t.done });
    this.renderTasks();
  },
  delTask(id){ Store.softDelete('studyTasks', id); this.renderTasks(); },

  /* ---------- 每日单词 ---------- */
  renderWords(){
    const ws = this.wordsOf();
    const st = this.wordMap();
    const marked = ws.filter(x => st[x.g]).length;
    document.getElementById('wordSub').textContent = `每日 ${this.PER_WORDS} 词 · 已标记 ${marked}/${ws.length} · 第 ${this.dayIdx()+1} 组`;
    document.getElementById('wordBar').style.width = (marked/ws.length*100) + '%';
    document.getElementById('wordList').innerHTML = ws.map(({g, w}) => {
      const s = st[g] || '';
      return `<div class="w-row ${s}">
        <div><span class="w-word">${Util.esc(w[0])}</span><span class="w-phon">${Util.esc(w[1])}</span></div>
        <div class="w-mean" id="wm-${g}" ${s?'':'hidden'}>${Util.esc(w[2])}</div>
        <div class="w-acts">
          <button class="mini" onclick="Study.toggleMean(${g})">释义</button>
          <button class="mini" style="${s==='k'?'border-color:#57ab5a;color:#57ab5a':''}" onclick="Study.markWord(${g},'k')">认识</button>
          <button class="mini" style="${s==='u'?'border-color:#f47067;color:#f47067':''}" onclick="Study.markWord(${g},'u')">生疏</button>
        </div></div>`;
    }).join('');
  },
  toggleMean(g){ const el = document.getElementById('wm-' + g); if (el) el.hidden = !el.hidden; },
  markWord(g, st){
    Store.upsertDaily('wordStat', { id:'w' + g, g, st });
    this.renderWords();
    this.streak();
  },

  /* ---------- 一建考点 ---------- */
  renderPoints(){
    const { subj, list } = this.pointsOf();
    const st = this.pointMap();
    const marked = list.filter(x => st[x.g]).length;
    document.getElementById('pointSub').textContent = `今天轮值：${subj} · 已掌握 ${marked}/${list.length}`;
    document.getElementById('pointBar').style.width = (marked/list.length*100) + '%';
    document.getElementById('pointList').innerHTML = list.map(({g, p}, i) => `
      <div class="w-row ${st[g]?'k':''}">
        <div style="font-size:14.5px;line-height:1.7"><span style="color:var(--text-dim);font-size:12px;margin-right:8px">${String(i+1).padStart(2,'0')}</span>${Util.esc(p)}${st[g]?'<span style="color:#57ab5a;font-size:11px">（已掌握）</span>':''}</div>
        <div class="w-acts" style="margin-top:8px">
          <button class="mini" style="${st[g]?'border-color:#57ab5a;color:#57ab5a':''}" onclick="Study.markPoint('${subj}',${g})">${st[g]?'取消掌握':'标记掌握'}</button>
        </div></div>`).join('');
  },
  markPoint(subj, g){
    const today = Util.today();
    const id = 'p' + subj + g;
    const exist = Store.list('pointStat:' + today).find(e => e.id === id);
    if (exist) Store.softDelete('pointStat:' + today, id);
    else Store.upsertDaily('pointStat', { id, g });
    this.renderPoints();
    this.streak();
  },

  /* ---------- 四科进度 ---------- */
  renderProg(){
    let prog = Store.list('subjProg');
    if (!prog.length){
      this.SUBJECTS.forEach(n => Store.upsert('subjProg', { name:n, pct:0 }));
      prog = Store.list('subjProg');
    }
    document.getElementById('progList').innerHTML = prog.map(s => `
      <div style="padding:9px 0;border-bottom:1px dashed rgba(128,128,128,.22)">
        <div style="display:flex;align-items:baseline">
          <span style="font-size:14.5px">${Util.esc(s.name)}</span>
          <span class="num" style="margin-left:auto;color:var(--accent)">${s.pct}%</span>
        </div>
        <div class="pbar"><i style="width:${s.pct}%"></i></div>
        <div class="row" style="margin-top:6px">
          <button class="mini" style="flex:1" onclick="Study.bumpProg('${s.id}',-5)">−5%</button>
          <button class="mini" style="flex:1" onclick="Study.bumpProg('${s.id}',5)">+5%</button>
        </div>
      </div>`).join('');
  },
  bumpProg(id, d){
    const s = Store.list('subjProg').find(x => x.id === id);
    if (s) Store.upsert('subjProg', { id, pct: Math.max(0, Math.min(100, s.pct + d)) });
    this.renderProg();
  },

  /* ---------- 学习时长 ---------- */
  addTime(m){
    Store.upsertDaily('studyTime', { m });
    UI.toast('已记录 ' + m + ' 分钟');
    this.renderTime();
  },
  minutesOf(d){ return Store.list('studyTime:' + d).reduce((s,e) => s + (e.m||0), 0); },
  renderTime(){
    const tm = this.minutesOf(Util.today());
    document.getElementById('timeSub').textContent =
      '今天 ' + (tm >= 60 ? Math.floor(tm/60) + ' 小时' + (tm%60 ? ' ' + tm%60 + ' 分' : '') : tm + ' 分钟');
    const days = []; for (let i = 6; i >= 0; i--) days.push(Util.offsetDay(-i));
    const vals = days.map(d => this.minutesOf(d));
    const max = Math.max(...vals, 60);
    const W = 300, bw = 26, gap = (W - bw*7) / 6, H = 76;
    const bars = days.map((d,i) => {
      const h = Math.round(vals[i] / max * H);
      return `<rect x="${i*(bw+gap)}" y="${H-h+12}" width="${bw}" height="${Math.max(h, vals[i]?2:0)}" rx="3" fill="${d===Util.today()?'#1f6feb':'#2a323d'}"/>
      ${vals[i] ? `<text x="${i*(bw+gap)+bw/2}" y="${H-h+7}" text-anchor="middle" font-size="9" fill="#7d8590">${vals[i]}m</text>` : ''}
      <text x="${i*(bw+gap)+bw/2}" y="${H+26}" text-anchor="middle" font-size="10" fill="#7d8590">${d.slice(5)}</text>`;
    }).join('');
    document.getElementById('timeChart').innerHTML =
      `<svg viewBox="0 0 ${W} ${H+32}" style="width:100%;max-width:320px;display:block">${bars}</svg>`;
  },

  /* ---------- 错题 / 重点速记 ---------- */
  renderNotes(){
    const list = Store.list('studyNotes', (a,b) => a.time < b.time ? 1 : -1);
    document.getElementById('noteList').innerHTML = list.length ? list.map(n => `
      <div class="item">
        <span class="grow"><span class="tag ${n.tag==='错题'?'red':'acc'}">${Util.esc(n.tag)}</span>${Util.esc(n.text)}
        <div class="hint" style="margin-top:2px">${n.time||''}</div></span>
        <button class="del" onclick="Study.delNote('${n.id}')">✕</button></div>`).join('')
      : '<div class="empty">错题和重点，随记随存</div>';
  },
  addNote(){
    const v = document.getElementById('noteText').value.trim();
    if (!v) return;
    Store.upsert('studyNotes', { tag: document.getElementById('noteTag').value, text: v, time: Util.today() });
    document.getElementById('noteText').value = '';
    this.renderNotes();
  },
  delNote(id){ Store.softDelete('studyNotes', id); this.renderNotes(); },

  /* ---------- 连续学习天数 ---------- */
  streak(){
    const todayHas = Store.countDaily('wordStat') || Store.countDaily('pointStat');
    let s = 0;
    const start = todayHas ? 0 : 1;
    for (let i = start; i < 365; i++){
      const d = Util.offsetDay(-i);
      if (Store.list('wordStat:' + d).length || Store.list('pointStat:' + d).length) s++;
      else break;
    }
    Store.set('_streak', s);
    return s;
  }
};
/* ==== 功能：学习 END ==== */
