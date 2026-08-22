/* ============================================================
 * mini-games.js — 小游戏中心（6 个自包含小游戏）
 * 依赖全局：localforage, getStorageKey, showNotification, playSound,
 *           showModal, hideModal, settings, APP_PREFIX
 * 暴露：window.openMiniGamesCenter, window.initMiniGames
 * 引入方式：在 index.html 中添加一行：
 *   <script src="js/features/mini-games.js"></script>
 * ============================================================ */

/* ======================== 数据与存储层 ======================== */

// 小游戏汇总数据（持久化）
let mgData = {
    rpsStreak: 0,        // 石头剪刀布当前连胜
    rpsBestStreak: 0,    // 历史最高连胜
    rpsWins: 0,
    rpsTotal: 0,
    memoryBest: { steps: null, time: null }, // 翻牌最佳：步数 / 用时(ms)
    jumpHigh: 0,         // 跳一跳最高分
    gomokuWins: 0,
    gomokuLosses: 0,
    ludoWins: 0,
    ludoLosses: 0,
    monoWins: 0,
    monoLosses: 0,
    ludoCells: {}         // 飞行棋每格自定义内容 { '0': '起点', '5': '🎁', ... }
};
let mgDataLoaded = false;

// 懒加载数据：openMiniGamesCenter 内部会调用，确保即使 initMiniGames 未被调用也能工作
async function mgLoadData() {
    if (mgDataLoaded) return;
    try {
        // 优先使用 localforage + getStorageKey（依赖 SESSION_ID）
        const key = getStorageKey('miniGamesData');
        const saved = await localforage.getItem(key);
        if (saved && typeof saved === 'object') {
            mgData = Object.assign({}, mgData, saved);
        }
    } catch (e) {
        // SESSION_ID 未初始化等异常 → 降级用 localStorage
        try {
            const raw = localStorage.getItem('miniGames_' + 'miniGamesData');
            if (raw) mgData = Object.assign({}, mgData, JSON.parse(raw));
        } catch (e2) { /* 静默失败 */ }
    }
    mgDataLoaded = true;
}

function mgSaveData() {
    try {
        localforage.setItem(getStorageKey('miniGamesData'), mgData);
    } catch (e) {
        try {
            localStorage.setItem('miniGames_' + 'miniGamesData', JSON.stringify(mgData));
        } catch (e2) { /* 静默失败 */ }
    }
}

/* ======================== 游戏中心模态框 ======================== */

let mgModal = null;       // 中心模态框元素
let mgCurrentView = 'center'; // 当前显示的视图 id

// 游戏元信息（用于中心卡片展示）
const MG_GAMES = [
    { id: 'rps',     icon: '✊',  name: '石头剪刀布', desc: '和Ta比比运气',     best: () => '连胜 ' + mgData.rpsStreak + ' / 最高 ' + mgData.rpsBestStreak },
    { id: 'gomoku',  icon: '⚫',  name: '五子棋',     desc: '执黑对战AI',        best: () => '胜 ' + mgData.gomokuWins + ' 负 ' + mgData.gomokuLosses },
    { id: 'ludo',    icon: '✈️', name: '飞行棋',     desc: '掷骰子竞速',        best: () => '胜 ' + mgData.ludoWins + ' 负 ' + mgData.ludoLosses },
    { id: 'memory',  icon: '🃏',  name: '翻牌大作战', desc: '配对记忆挑战',      best: () => mgData.memoryBest.steps ? '最佳 ' + mgData.memoryBest.steps + '步' : '未挑战' },
    { id: 'mono',    icon: '🏠',  name: '双版大富翁', desc: '买地收租致富',      best: () => '胜 ' + mgData.monoWins + ' 负 ' + mgData.monoLosses },
    { id: 'jump',    icon: '🦘',  name: '跳一跳',     desc: '蓄力跳跃挑战',      best: () => '最高 ' + mgData.jumpHigh + ' 分' }
];

// 构建中心模态框（若已存在则复用）
function mgEnsureModal() {
    const existing = document.getElementById('mg-modal');
    if (existing) { mgModal = existing; return mgModal; }

    const modal = document.createElement('div');
    modal.id = 'mg-modal';
    modal.className = 'modal';
    modal.style.zIndex = '9000';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px; padding:20px 20px 24px;">
            <div id="mg-view-center"></div>
            <div id="mg-view-rps"     style="display:none;"></div>
            <div id="mg-view-gomoku"  style="display:none;"></div>
            <div id="mg-view-ludo"    style="display:none;"></div>
            <div id="mg-view-memory"  style="display:none;"></div>
            <div id="mg-view-mono"    style="display:none;"></div>
            <div id="mg-view-jump"    style="display:none;"></div>
        </div>`;
    modal.addEventListener('click', (e) => { if (e.target === modal) mgCloseCenter(); });
    document.body.appendChild(modal);
    mgModal = modal;
    return modal;
}

// 渲染中心卡片网格
function mgRenderCenter() {
    const wrap = document.getElementById('mg-view-center');
    if (!wrap) return;
    const cards = MG_GAMES.map(g => `
        <div class="mg-card" onclick="mgShowGame('${g.id}')"
             style="background:var(--primary-bg); border:1.5px solid var(--border-color); border-radius:14px;
                    padding:16px 12px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:6px;
                    transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;"
             onmouseover="this.style.transform='translateY(-3px)';this.style.borderColor='var(--accent-color)';this.style.boxShadow='0 6px 18px rgba(var(--accent-color-rgb),0.18)';"
             onmouseout="this.style.transform='';this.style.borderColor='var(--border-color)';this.style.boxShadow='';">
            <div style="font-size:30px; line-height:1;">${g.icon}</div>
            <div style="font-size:14px; font-weight:700; color:var(--text-primary);">${g.name}</div>
            <div style="font-size:11px; color:var(--text-secondary); text-align:center;">${g.desc}</div>
            <div style="font-size:10px; color:var(--accent-color); margin-top:2px;">${g.best()}</div>
        </div>`).join('');
    wrap.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
            <div style="font-size:17px; font-weight:800; color:var(--text-primary);">🎮 游戏中心</div>
            <button onclick="mgCloseCenter()" style="width:30px; height:30px; border-radius:50%; border:1px solid var(--border-color);
                    background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:16px; line-height:1;">×</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px;">${cards}</div>
        <div style="font-size:11px; color:var(--text-secondary); text-align:center; margin-top:14px; opacity:0.7;">
            数据自动保存在本地，切换主题即换肤 ✦
        </div>`;
}

// 切换视图
function mgSwitchView(viewId) {
    ['center', 'rps', 'gomoku', 'ludo', 'memory', 'mono', 'jump'].forEach(v => {
        const el = document.getElementById('mg-view-' + v);
        if (el) el.style.display = (v === viewId) ? 'block' : 'none';
    });
    mgCurrentView = viewId;
}

// 打开游戏中心
window.openMiniGamesCenter = async function () {
    await mgLoadData();
    mgEnsureModal();
    mgCleanupJump(); // 关闭可能残留的蓄力定时器
    mgRenderCenter();
    mgSwitchView('center');
    showModal(mgModal);
};

// 初始化钩子（供 app.js 调用，可不调用——内部懒加载）
window.initMiniGames = async function () {
    await mgLoadData();
};

// 关闭中心
window.mgCloseCenter = function () {
    mgCleanupJump();
    if (mgModal) hideModal(mgModal);
};

// 返回游戏中心
window.mgBackToCenter = function () {
    mgCleanupJump();
    mgRenderCenter(); // 刷新最佳成绩
    mgSwitchView('center');
};

// 进入指定游戏
window.mgShowGame = function (id) {
    switch (id) {
        case 'rps':     mgSwitchView('rps');    mgRpsRender();    break;
        case 'gomoku':  mgSwitchView('gomoku'); mgGomokuInit();   break;
        case 'ludo':    mgSwitchView('ludo');   mgLudoInit();     break;
        case 'memory':  mgSwitchView('memory'); mgMemoryInit();   break;
        case 'mono':    mgSwitchView('mono');   mgMonoInit();     break;
        case 'jump':    mgSwitchView('jump');   mgJumpInit();     break;
    }
};

/* ======================== 通用 UI 片段 ======================== */

// 游戏顶部栏（返回按钮 + 标题）
function mgHeader(title, extraRight = '') {
    return `<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
        <button onclick="mgBackToCenter()" style="display:flex; align-items:center; gap:4px; padding:6px 12px; border-radius:10px;
                border:1px solid var(--border-color); background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:12px;">
            ← 返回
        </button>
        <div style="font-size:15px; font-weight:800; color:var(--text-primary);">${title}</div>
        <div style="min-width:60px; text-align:right;">${extraRight}</div>
    </div>`;
}

// 通用按钮样式
function mgBtn(label, onclick, primary = true) {
    const bg = primary ? 'var(--accent-color)' : 'var(--primary-bg)';
    const color = primary ? '#fff' : 'var(--text-primary)';
    const border = primary ? 'none' : '1px solid var(--border-color)';
    return `<button onclick="${onclick}" style="padding:10px 18px; border-radius:12px; border:${border}; background:${bg};
            color:${color}; font-size:13px; font-weight:600; cursor:pointer;">${label}</button>`;
}

/* ======================== 游戏 1：石头剪刀布 ======================== */

const RPS_CHOICES = [
    { key: 'rock',     label: '石头', emoji: '✊' },
    { key: 'scissors', label: '剪刀', emoji: '✌️' },
    { key: 'paper',    label: '布',   emoji: '✋' }
];
let mgRpsLocked = false;
// 上一局展示状态（用于 render 时保留双方选择与结果）
let mgRpsLast = { playerEmoji: '?', aiEmoji: '?', resultHtml: '选择你的出招吧～' };

function mgRpsRender() {
    const wrap = document.getElementById('mg-view-rps');
    wrap.innerHTML = mgHeader('✊ 石头剪刀布') + `
        <div id="mg-rps-arena" style="display:flex; flex-direction:column; align-items:center; gap:18px; padding:8px 0 4px;">
            <div style="display:flex; align-items:center; justify-content:space-around; width:100%; gap:12px;">
                <div style="text-align:center; flex:1;">
                    <div style="font-size:11px; color:var(--text-secondary); margin-bottom:6px;">你</div>
                    <div id="mg-rps-player" style="font-size:54px; line-height:1; min-height:60px;">${mgRpsLast.playerEmoji}</div>
                </div>
                <div style="font-size:20px; font-weight:800; color:var(--accent-color);">VS</div>
                <div style="text-align:center; flex:1;">
                    <div style="font-size:11px; color:var(--text-secondary); margin-bottom:6px;">${mgPartnerName()}</div>
                    <div id="mg-rps-ai" style="font-size:54px; line-height:1; min-height:60px;">${mgRpsLast.aiEmoji}</div>
                </div>
            </div>
            <div id="mg-rps-result" style="font-size:15px; font-weight:700; color:var(--text-primary); min-height:22px;">${mgRpsLast.resultHtml}</div>
            <div style="display:flex; gap:14px; flex-wrap:wrap; justify-content:center;">
                ${RPS_CHOICES.map(c => `<button onclick="mgRpsPlay('${c.key}')" class="mg-rps-btn"
                    style="font-size:34px; width:74px; height:74px; border-radius:50%; border:1.5px solid var(--border-color);
                    background:var(--primary-bg); cursor:pointer; display:flex; align-items:center; justify-content:center;
                    transition:transform .15s ease, border-color .15s ease;"
                    onmouseover="this.style.transform='scale(1.08)';this.style.borderColor='var(--accent-color)';"
                    onmouseout="this.style.transform='';this.style.borderColor='var(--border-color)';">${c.emoji}</button>`).join('')}
            </div>
            <div style="display:flex; gap:18px; font-size:12px; color:var(--text-secondary);">
                <span>当前连胜：<b style="color:var(--accent-color);">${mgData.rpsStreak}</b></span>
                <span>最高连胜：<b>${mgData.rpsBestStreak}</b></span>
                <span>累计：${mgData.rpsTotal} 局</span>
            </div>
        </div>`;
}

window.mgRpsPlay = function (choice) {
    if (mgRpsLocked) return;
    mgRpsLocked = true;
    const player = RPS_CHOICES.find(c => c.key === choice);
    const ai = RPS_CHOICES[Math.floor(Math.random() * 3)];
    // 立即显示玩家选择，AI 进入滚动状态
    mgRpsLast.playerEmoji = player.emoji;
    mgRpsLast.aiEmoji = '?';
    mgRpsLast.resultHtml = '<span style="color:var(--text-secondary);">……</span>';
    mgRpsRender();
    const aiEl = document.getElementById('mg-rps-ai');

    // AI 出招滚动动画
    let ticks = 0;
    const timer = setInterval(() => {
        if (aiEl) aiEl.textContent = RPS_CHOICES[ticks % 3].emoji;
        ticks++;
        if (ticks > 6) {
            clearInterval(timer);
            const outcome = mgRpsJudge(player.key, ai.key);
            mgData.rpsTotal++;
            let resultHtml = '';
            if (outcome === 'win') {
                mgData.rpsWins++;
                mgData.rpsStreak++;
                if (mgData.rpsStreak > mgData.rpsBestStreak) mgData.rpsBestStreak = mgData.rpsStreak;
                resultHtml = '<span style="color:var(--accent-color);">你赢了！🎉</span>';
                if (typeof playSound === 'function') playSound('message');
            } else if (outcome === 'lose') {
                mgData.rpsStreak = 0;
                resultHtml = '<span style="color:var(--text-secondary);">你输了～</span>';
            } else {
                resultHtml = '<span style="color:var(--text-primary);">平局！</span>';
            }
            // 写入最终状态后全量刷新（保留双方选择 + 结果 + 统计）
            mgRpsLast.aiEmoji = ai.emoji;
            mgRpsLast.resultHtml = resultHtml;
            mgSaveData();
            mgRpsRender();
            mgRpsLocked = false;
        }
    }, 90);
};

// 判定胜负
function mgRpsJudge(p, a) {
    if (p === a) return 'draw';
    if ((p === 'rock' && a === 'scissors') ||
        (p === 'scissors' && a === 'paper') ||
        (p === 'paper' && a === 'rock')) return 'win';
    return 'lose';
}

/* ======================== 游戏 2：五子棋 ======================== */

const MG_GOMOKU_SIZE = 15;
let mgGomokuBoard = [];   // 0 空 / 1 玩家1(黑) / 2 玩家2(白)
let mgGomokuOver = false;
let mgGomokuLocked = false;
let mgGomokuMode = 'pvp';    // 'ai' 人机，'pvp' 双人对战（一人操控两方，模拟对方陪你下棋）
let mgGomokuTurn = 1;       // 1=黑方/我，2=白方/对方

function mgGomokuInit() {
    mgGomokuBoard = Array.from({ length: MG_GOMOKU_SIZE }, () => Array(MG_GOMOKU_SIZE).fill(0));
    mgGomokuOver = false;
    mgGomokuLocked = false;
    mgGomokuTurn = 1;
    mgGomokuRender();
}

function mgGomokuRender(lastR = -1, lastC = -1) {
    const wrap = document.getElementById('mg-view-gomoku');
    const cellSize = 26;
    const modeBtn = (mode, label) => `<button onclick="mgGomokuSetMode('${mode}')" style="padding:6px 12px; border-radius:10px;
        border:1px solid var(--border-color); background:${mgGomokuMode===mode?'var(--accent-color)':'var(--primary-bg)'};
        color:${mgGomokuMode===mode?'#fff':'var(--text-secondary)'}; cursor:pointer; font-size:12px;">${label}</button>`;
    const turnText = mgGomokuMode === 'pvp'
        ? (mgGomokuTurn === 1
            ? '轮到 <b style="color:#1a1a1a;">● 你（黑方）</b>'
            : '轮到 <b style="color:var(--text-secondary);">○ 对方（白方）</b>')
        : '你执 <b style="color:#1a1a1a;">●</b>，AI 执 <b style="color:var(--text-secondary);">○</b>，点击空格落子';
    wrap.innerHTML = mgHeader('⚫ 五子棋',
        `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <button onclick="mgGomokuInit()" style="padding:6px 12px; border-radius:10px; border:1px solid var(--border-color);
                background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:12px;">重新开始</button>
            ${modeBtn('pvp','双人对战')}
            ${modeBtn('ai','人机对战')}
        </div>`) + `
        <div style="display:flex; justify-content:center;">
            <div style="display:grid; grid-template-columns:repeat(${MG_GOMOKU_SIZE}, ${cellSize}px); gap:0;
                background:var(--secondary-bg); border:2px solid var(--border-color); border-radius:8px; padding:4px;">
                ${mgGomokuBoard.map((row, r) => row.map((v, c) => {
                    const isLast = (r === lastR && c === lastC);
                    let content = '';
                    if (v === 1) content = `<span style="font-size:18px; color:#1a1a1a;">●</span>`;
                    else if (v === 2) content = `<span style="font-size:18px; color:#fff; text-shadow:0 0 1px #999;">○</span>`;
                    const bg = (r + c) % 2 === 0 ? 'var(--primary-bg)' : 'var(--secondary-bg)';
                    const border = isLast ? '2px solid var(--accent-color)' : '1px solid var(--border-color)';
                    return `<div onclick="mgGomokuPlace(${r},${c})"
                        style="width:${cellSize}px; height:${cellSize}px; background:${bg}; border:${border};
                        display:flex; align-items:center; justify-content:center; cursor:pointer;
                        box-sizing:border-box;">${content}</div>`;
                }).join('')).join('')}
            </div>
        </div>
        <div id="mg-gomoku-status" style="text-align:center; margin-top:12px; font-size:13px; color:var(--text-secondary);">
            ${turnText}
        </div>`;
}

window.mgGomokuSetMode = function(mode) {
    if (!['ai','pvp'].includes(mode)) return;
    mgGomokuMode = mode;
    mgGomokuInit();
};

window.mgGomokuPlace = function (r, c) {
    if (mgGomokuOver || mgGomokuLocked) return;
    if (mgGomokuBoard[r][c] !== 0) return;
    mgGomokuBoard[r][c] = mgGomokuTurn;
    mgGomokuRender(r, c);
    if (mgGomokuCheckWin(r, c, mgGomokuTurn)) {
        mgGomokuEnd(mgGomokuTurn === 1 ? 'player' : (mgGomokuMode === 'pvp' ? 'partner' : 'ai'));
        return;
    }
    if (mgGomokuBoardFull()) { mgGomokuEnd('draw'); return; }

    if (mgGomokuMode === 'pvp') {
        // 双人模式：交换回合
        mgGomokuTurn = mgGomokuTurn === 1 ? 2 : 1;
        mgGomokuRender(r, c);
    } else {
        // AI 模式：对方 AI 下
        mgGomokuLocked = true;
        const status = document.getElementById('mg-gomoku-status');
        if (status) status.textContent = 'AI 思考中…';
        setTimeout(() => {
            const [ar, ac] = mgGomokuAI();
            mgGomokuBoard[ar][ac] = 2;
            mgGomokuRender(ar, ac);
            if (mgGomokuCheckWin(ar, ac, 2)) { mgGomokuEnd('ai'); return; }
            if (mgGomokuBoardFull()) { mgGomokuEnd('draw'); return; }
            mgGomokuLocked = false;
            const s = document.getElementById('mg-gomoku-status');
            if (s) s.innerHTML = '你执 <b style="color:#1a1a1a;">●</b>，AI 执 <b style="color:var(--text-secondary);">○</b>，点击空格落子';
        }, 350);
    }
};

function mgGomokuBoardFull() {
    for (let r = 0; r < MG_GOMOKU_SIZE; r++)
        for (let c = 0; c < MG_GOMOKU_SIZE; c++)
            if (mgGomokuBoard[r][c] === 0) return false;
    return true;
}

// 检测 (r,c) 落子后 player 是否五连
function mgGomokuCheckWin(r, c, player) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
        let count = 1;
        for (let s = 1; s < 5; s++) {
            const nr = r + dr * s, nc = c + dc * s;
            if (nr < 0 || nr >= MG_GOMOKU_SIZE || nc < 0 || nc >= MG_GOMOKU_SIZE) break;
            if (mgGomokuBoard[nr][nc] === player) count++; else break;
        }
        for (let s = 1; s < 5; s++) {
            const nr = r - dr * s, nc = c - dc * s;
            if (nr < 0 || nr >= MG_GOMOKU_SIZE || nc < 0 || nc >= MG_GOMOKU_SIZE) break;
            if (mgGomokuBoard[nr][nc] === player) count++; else break;
        }
        if (count >= 5) return true;
    }
    return false;
}

// 是否有相邻棋子（用于加速 AI 搜索）
function mgHasNeighbor(r, c) {
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MG_GOMOKU_SIZE && nc >= 0 && nc < MG_GOMOKU_SIZE && mgGomokuBoard[nr][nc] !== 0) return true;
        }
    return false;
}

// 评估在 (r,c) 落子对 player 的价值（4 个方向连子形评分）
function mgGomokuScorePos(r, c, player) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let total = 0;
    for (const [dr, dc] of dirs) {
        let count = 1, blocks = 0;
        // 正方向
        let i = r + dr, j = c + dc;
        while (i >= 0 && i < MG_GOMOKU_SIZE && j >= 0 && j < MG_GOMOKU_SIZE && mgGomokuBoard[i][j] === player) { count++; i += dr; j += dc; }
        if (i < 0 || i >= MG_GOMOKU_SIZE || j < 0 || j >= MG_GOMOKU_SIZE || mgGomokuBoard[i][j] !== 0) blocks++;
        // 反方向
        i = r - dr; j = c - dc;
        while (i >= 0 && i < MG_GOMOKU_SIZE && j >= 0 && j < MG_GOMOKU_SIZE && mgGomokuBoard[i][j] === player) { count++; i -= dr; j -= dc; }
        if (i < 0 || i >= MG_GOMOKU_SIZE || j < 0 || j >= MG_GOMOKU_SIZE || mgGomokuBoard[i][j] !== 0) blocks++;
        // 评分表
        if (count >= 5) total += 100000;
        else if (count === 4 && blocks === 0) total += 10000;   // 活四
        else if (count === 4) total += 1000;                    // 冲四
        else if (count === 3 && blocks === 0) total += 1000;    // 活三
        else if (count === 3) total += 100;                     // 眠三
        else if (count === 2 && blocks === 0) total += 100;     // 活二
        else if (count === 2) total += 10;
        else total += 1;
    }
    return total;
}

// AI 选择落子：进攻分 + 防守分，取最高
function mgGomokuAI() {
    let bestScore = -1, bestR = 7, bestC = 7, hasCandidate = false;
    for (let r = 0; r < MG_GOMOKU_SIZE; r++) {
        for (let c = 0; c < MG_GOMOKU_SIZE; c++) {
            if (mgGomokuBoard[r][c] !== 0) continue;
            if (!mgHasNeighbor(r, c)) continue;
            hasCandidate = true;
            const offense = mgGomokuScorePos(r, c, 2); // AI 进攻
            const defense = mgGomokuScorePos(r, c, 1); // 堵玩家
            const score = offense * 1.1 + defense;      // 进攻略优先
            if (score > bestScore) { bestScore = score; bestR = r; bestC = c; }
        }
    }
    if (!hasCandidate) { bestR = 7; bestC = 7; }
    return [bestR, bestC];
}

function mgGomokuEnd(winner) {
    mgGomokuOver = true;
    mgGomokuLocked = true;
    const status = document.getElementById('mg-gomoku-status');
    if (winner === 'player') {
        mgData.gomokuWins++;
        if (status) status.innerHTML = `<b style="color:var(--accent-color);">你赢了！🎉 五子连珠</b>`;
        if (typeof playSound === 'function') playSound('message');
    } else if (winner === 'partner') {
        mgData.gomokuLosses++;
        if (status) status.innerHTML = `<b style="color:#E67E22;">对方获胜！再来一局吧</b>`;
    } else if (winner === 'ai') {
        mgData.gomokuLosses++;
        if (status) status.innerHTML = `<b style="color:var(--text-secondary);">AI 获胜，再来一局吧</b>`;
    } else {
        if (status) status.innerHTML = `<b>平局，棋盘已满</b>`;
    }
    mgSaveData();
}

/* ======================== 游戏 3：飞行棋（格子可自定义内容） ======================== */

const MG_LUDO_LEN = 40;
let mgLudoState = null;

function mgLudoInit() {
    mgLudoState = {
        playerPos: 0,
        aiPos: 0,
        turn: 'player', // player / ai
        over: false,
        rolling: false,
        editMode: false  // 编辑格子模式
    };
    // 确保持久化结构存在
    if (!mgData.ludoCells || typeof mgData.ludoCells !== 'object') {
        mgData.ludoCells = {};
        mgSaveData();
    }
    mgLudoRender();
}

/* 取第 i 格的自定义内容（text/emoji） */
function mgLudoCellText(i) {
    return (mgData.ludoCells && mgData.ludoCells[String(i)]) || '';
}

function mgLudoRender(rollingText) {
    const wrap = document.getElementById('mg-view-ludo');
    const cells = [];
    for (let i = 0; i < MG_LUDO_LEN; i++) {
        const isStart = i === 0, isEnd = i === MG_LUDO_LEN - 1;
        let markers = '';
        if (mgLudoState.playerPos === i) markers += '<span style="font-size:16px;">✈️</span>';
        if (mgLudoState.aiPos === i) markers += '<span style="font-size:16px;">🛩️</span>';
        let bg = 'var(--primary-bg)';
        if (isStart) bg = 'rgba(var(--accent-color-rgb),0.22)';
        else if (isEnd) bg = 'rgba(var(--accent-color-rgb),0.42)';
        else if (mgLudoCellText(i)) bg = 'rgba(255, 217, 61, 0.22)'; // 有自定义内容的格子高亮
        const customText = mgLudoCellText(i);
        const cellCursor = mgLudoState.editMode ? 'cursor:pointer;' : '';
        const cellClick = mgLudoState.editMode ? `onclick="mgLudoEditCell(${i})"` : '';
        const editHint = mgLudoState.editMode ? `<span style="position:absolute; top:2px; right:3px; font-size:9px; opacity:0.6;">✏️</span>` : '';
        cells.push(`<div ${cellClick} style="position:relative; aspect-ratio:1; background:${bg}; border:1px solid var(--border-color);
            border-radius:8px; display:flex; align-items:center; justify-content:center; min-height:34px; gap:2px; ${cellCursor} overflow:hidden;">
            <span style="position:absolute; top:2px; left:4px; font-size:9px; color:var(--text-secondary);">${i}</span>
            ${editHint}
            <span style="font-size:13px; line-height:1; max-width:100%; word-break:break-all; text-align:center; padding:0 2px;">${customText ? mgEscapeHtml(customText) : markers}</span>
        </div>`);
    }
    const turnText = mgLudoState.over ? '' : (mgLudoState.turn === 'player' ? '轮到你' : mgPartnerName() + ' 行动中…');
    const status = rollingText || (mgLudoState.over ? mgLudoState.message : turnText);
    const editBtnLabel = mgLudoState.editMode ? '✅ 完成编辑' : '✏️ 编辑格子';
    wrap.innerHTML = mgHeader('✈️ 飞行棋',
        `<div style="display:flex; gap:6px;">
            <button onclick="mgLudoInit()" style="padding:6px 12px; border-radius:10px; border:1px solid var(--border-color);
                background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:12px;">重新开始</button>
            <button onclick="mgLudoToggleEdit()" style="padding:6px 12px; border-radius:10px; border:1px solid var(--border-color);
                background:${mgLudoState.editMode?'rgba(var(--accent-color-rgb),0.18)':'var(--primary-bg)'}; color:${mgLudoState.editMode?'var(--accent-color)':'var(--text-secondary)'}; cursor:pointer; font-size:12px;">${editBtnLabel}</button>
        </div>`) + `
        <div style="display:flex; justify-content:space-around; margin-bottom:10px; font-size:12px; color:var(--text-secondary);">
            <span>你 ✈️：第 <b style="color:var(--accent-color);">${mgLudoState.playerPos}</b> 格</span>
            <span>${mgPartnerName()} 🛩️：第 <b>${mgLudoState.aiPos}</b> 格</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(8, 1fr); gap:4px; margin-bottom:14px;">${cells.join('')}</div>
        ${mgLudoState.editMode ? `<div style="font-size:11px; color:var(--text-secondary); text-align:center; margin-bottom:10px;">点击任意格子可添加/修改内容（emoji、文字、事件…）</div>` : ''}
        <div style="text-align:center;">
            <div id="mg-ludo-status" style="font-size:13px; color:var(--text-primary); margin-bottom:10px; min-height:20px;">${status}</div>
            ${mgLudoState.over ? '' : (mgLudoState.editMode ? '' : mgBtn('🎲 掷骰子', 'mgLudoRoll()', true))}
        </div>`;
}

/* 简易 HTML 转义（飞行棋内部用） */
function mgEscapeHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* 切换编辑模式 */
window.mgLudoToggleEdit = function () {
    mgLudoState.editMode = !mgLudoState.editMode;
    mgLudoRender();
    if (mgLudoState.editMode && typeof showNotification === 'function') {
        showNotification('已进入格子编辑模式，点击格子即可修改内容', 'info');
    }
};

/* 编辑某个格子的内容 */
window.mgLudoEditCell = function (i) {
    if (!mgLudoState || !mgLudoState.editMode) return;
    const cur = mgLudoCellText(i);
    const v = prompt(`第 ${i} 格内容\n（可填 emoji / 文字 / 事件描述，留空则清除）`, cur);
    if (v === null) return; // 取消
    const text = v.trim();
    if (text) mgData.ludoCells[String(i)] = text;
    else delete mgData.ludoCells[String(i)];
    mgSaveData();
    mgLudoRender();
};

window.mgLudoRoll = function () {
    if (mgLudoState.over || mgLudoState.rolling) return;
    if (mgLudoState.turn !== 'player') return;
    mgLudoState.rolling = true;
    // 骰子滚动动画
    let ticks = 0;
    const animate = setInterval(() => {
        mgLudoRender('骰子：' + (Math.floor(Math.random() * 6) + 1) + ' …');
        ticks++;
        if (ticks >= 6) {
            clearInterval(animate);
            const step = Math.floor(Math.random() * 6) + 1;
            mgLudoState.playerPos = Math.min(MG_LUDO_LEN - 1, mgLudoState.playerPos + step);
            const cellText = mgLudoCellText(mgLudoState.playerPos);
            let msg = '你掷出 ' + step + '，前进到第 ' + mgLudoState.playerPos + ' 格';
            if (cellText) msg += '\n📍 格子事件：' + cellText;
            mgLudoRender(msg);
            if (mgLudoState.playerPos >= MG_LUDO_LEN - 1) {
                mgLudoState.over = true;
                mgLudoState.message = '🎉 你先到终点，获胜！';
                mgData.ludoWins++;
                mgSaveData();
                if (typeof playSound === 'function') playSound('message');
                mgLudoRender();
                mgLudoState.rolling = false;
                return;
            }
            // 轮到 AI
            mgLudoState.turn = 'ai';
            mgLudoState.rolling = false;
            setTimeout(mgLudoAiTurn, 800);
        }
    }, 80);
};

function mgLudoAiTurn() {
    if (mgLudoState.over) return;
    const step = Math.floor(Math.random() * 6) + 1;
    mgLudoState.aiPos = Math.min(MG_LUDO_LEN - 1, mgLudoState.aiPos + step);
    const cellText = mgLudoCellText(mgLudoState.aiPos);
    let msg = mgPartnerName() + ' 掷出 ' + step + '，前进到第 ' + mgLudoState.aiPos + ' 格';
    if (cellText) msg += '\n📍 格子事件：' + cellText;
    mgLudoRender(msg);
    if (mgLudoState.aiPos >= MG_LUDO_LEN - 1) {
        mgLudoState.over = true;
        mgLudoState.message = mgPartnerName() + ' 先到终点，你输了～';
        mgData.ludoLosses++;
        mgSaveData();
        mgLudoRender();
        return;
    }
    mgLudoState.turn = 'player';
    setTimeout(() => { if (!mgLudoState.over) mgLudoRender('轮到你掷骰子'); }, 700);
}

/* ======================== 游戏 4：翻牌大作战 ======================== */

const MG_MEMORY_EMOJIS = ['🌸', '🌙', '⭐', '🍀', '🎀', '🍰', '🎈', '💎'];
let mgMemoryState = null;
let mgMemoryTimer = null;

function mgMemoryInit() {
    if (mgMemoryTimer) { clearInterval(mgMemoryTimer); mgMemoryTimer = null; }
    // 生成 8 对牌并洗牌
    const deck = [...MG_MEMORY_EMOJIS, ...MG_MEMORY_EMOJIS];
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    mgMemoryState = {
        cards: deck.map(e => ({ emoji: e, flipped: false, matched: false })),
        first: null,
        steps: 0,
        startTime: Date.now(),
        elapsed: 0,
        over: false,
        locked: false
    };
    mgMemoryRender();
    // 计时器
    mgMemoryTimer = setInterval(() => {
        if (mgMemoryState && !mgMemoryState.over) {
            mgMemoryState.elapsed = Date.now() - mgMemoryState.startTime;
            const tEl = document.getElementById('mg-memory-time');
            if (tEl) tEl.textContent = mgFormatTime(mgMemoryState.elapsed);
        }
    }, 500);
}

function mgFormatTime(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function mgMemoryRender() {
    const wrap = document.getElementById('mg-view-memory');
    const cards = mgMemoryState.cards.map((card, idx) => {
        const show = card.flipped || card.matched;
        const bg = card.matched ? 'rgba(var(--accent-color-rgb),0.25)' : (show ? 'var(--secondary-bg)' : 'var(--accent-color)');
        const content = show ? card.emoji : '<span style="color:#fff; font-size:18px;">?</span>';
        return `<div onclick="mgMemoryFlip(${idx})"
            style="aspect-ratio:1; background:${bg}; border:1.5px solid ${card.matched ? 'var(--accent-color)' : 'var(--border-color)'};
            border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:26px; cursor:pointer;
            opacity:${card.matched ? 0.6 : 1}; transition:transform .15s ease;"
            onmouseover="if(!this.dataset.disabled){this.style.transform='scale(1.05)';}"
            onmouseout="this.style.transform='';">${content}</div>`;
    }).join('');
    wrap.innerHTML = mgHeader('🃏 翻牌大作战',
        `<button onclick="mgMemoryInit()" style="padding:6px 12px; border-radius:10px; border:1px solid var(--border-color);
            background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:12px;">重新开始</button>`) + `
        <div style="display:flex; justify-content:space-around; margin-bottom:12px; font-size:12px; color:var(--text-secondary);">
            <span>步数：<b id="mg-memory-steps" style="color:var(--accent-color);">${mgMemoryState.steps}</b></span>
            <span>用时：<b id="mg-memory-time">${mgFormatTime(mgMemoryState.elapsed)}</b></span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">${cards}</div>
        <div id="mg-memory-msg" style="text-align:center; margin-top:14px; font-size:13px; color:var(--text-secondary); min-height:20px;">
            翻开两张相同的牌即可配对
        </div>`;
}

window.mgMemoryFlip = function (idx) {
    if (!mgMemoryState || mgMemoryState.over || mgMemoryState.locked) return;
    const card = mgMemoryState.cards[idx];
    if (card.flipped || card.matched) return;
    card.flipped = true;
    mgMemoryState.steps++;
    const stepsEl = document.getElementById('mg-memory-steps');
    if (stepsEl) stepsEl.textContent = mgMemoryState.steps;

    if (mgMemoryState.first === null) {
        mgMemoryState.first = idx;
        mgMemoryRender();
    } else {
        const firstIdx = mgMemoryState.first;
        const firstCard = mgMemoryState.cards[firstIdx];
        mgMemoryState.first = null;
        mgMemoryState.locked = true;
        mgMemoryRender();
        if (firstCard.emoji === card.emoji) {
            // 配对成功
            setTimeout(() => {
                card.matched = true;
                firstCard.matched = true;
                card.flipped = false;
                firstCard.flipped = false;
                mgMemoryState.locked = false;
                const msg = document.getElementById('mg-memory-msg');
                if (msg) msg.innerHTML = '<span style="color:var(--accent-color);">配对成功！✦</span>';
                if (typeof playSound === 'function') playSound('message');
                if (mgMemoryState.cards.every(c => c.matched)) {
                    mgMemoryWin();
                } else {
                    mgMemoryRender();
                }
            }, 380);
        } else {
            // 配对失败，翻回
            setTimeout(() => {
                card.flipped = false;
                firstCard.flipped = false;
                mgMemoryState.locked = false;
                const msg = document.getElementById('mg-memory-msg');
                if (msg) msg.innerHTML = '<span style="color:var(--text-secondary);">不对哦，再试试</span>';
                mgMemoryRender();
            }, 700);
        }
    }
};

function mgMemoryWin() {
    mgMemoryState.over = true;
    if (mgMemoryTimer) { clearInterval(mgMemoryTimer); mgMemoryTimer = null; }
    const steps = mgMemoryState.steps;
    const time = mgMemoryState.elapsed;
    // 更新最佳记录
    let isNewBest = false;
    if (!mgData.memoryBest.steps || steps < mgData.memoryBest.steps ||
        (steps === mgData.memoryBest.steps && (!mgData.memoryBest.time || time < mgData.memoryBest.time))) {
        mgData.memoryBest = { steps: steps, time: time };
        isNewBest = true;
    }
    mgSaveData();
    const msg = document.getElementById('mg-memory-msg');
    if (msg) msg.innerHTML = `<b style="color:var(--accent-color);">🎉 全部配对完成！</b><br>
        <span style="font-size:12px;">用时 ${mgFormatTime(time)}，共 ${steps} 步 ${isNewBest ? '· 新纪录！' : ''}</span>`;
    if (typeof playSound === 'function') playSound('message');
}

/* ======================== 游戏 5：双版大富翁（简化版） ======================== */

const MG_MONO_LEN = 20;
let mgMonoState = null;
let mgMonoCells = [];

function mgMonoInit() {
    // 生成 20 格地块
    mgMonoCells = [];
    for (let i = 0; i < MG_MONO_LEN; i++) {
        if (i === 0) {
            mgMonoCells.push({ name: '起点', price: 0, type: 'start' });
        } else if (i === MG_MONO_LEN - 1) {
            mgMonoCells.push({ name: '终点', price: 0, type: 'end' });
        } else {
            mgMonoCells.push({ name: '地块 ' + i, price: 80 + i * 18, type: 'land' });
        }
    }
    mgMonoState = {
        playerPos: 0,
        aiPos: 0,
        playerGold: 1000,
        aiGold: 1000,
        owners: new Array(MG_MONO_LEN).fill(0), // 0 无人 / 1 玩家 / 2 AI
        turn: 'player',
        phase: 'roll',     // roll / decide / over
        over: false,
        message: '轮到你掷骰子',
        rolling: false
    };
    mgMonoRender();
}

function mgMonoRender() {
    const wrap = document.getElementById('mg-view-mono');
    const cells = mgMonoCells.map((cell, i) => {
        const owner = mgMonoState.owners[i];
        const onPlayer = mgMonoState.playerPos === i;
        const onAi = mgMonoState.aiPos === i;
        let borderColor = 'var(--border-color)';
        let ownerTag = '';
        if (owner === 1) { borderColor = 'var(--accent-color)'; ownerTag = '<span style="font-size:8px; color:var(--accent-color);">你</span>'; }
        else if (owner === 2) { borderColor = '#ff6b6b'; ownerTag = '<span style="font-size:8px; color:#ff6b6b;">Ta</span>'; }
        const markers = (onPlayer ? '✈️' : '') + (onAi ? '🛩️' : '');
        return `<div style="position:relative; aspect-ratio:1; background:var(--primary-bg); border:1.5px solid ${borderColor};
            border-radius:8px; padding:3px; display:flex; flex-direction:column; justify-content:space-between; min-height:46px;">
            <div style="font-size:8px; color:var(--text-secondary); line-height:1.1;">${cell.name}</div>
            <div style="font-size:8px; color:var(--text-secondary);">${cell.type === 'land' ? '💰' + cell.price : ''}</div>
            <div style="text-align:center; font-size:13px; line-height:1;">${markers}</div>
            <div style="position:absolute; top:2px; right:3px;">${ownerTag}</div>
        </div>`;
    }).join('');

    const actionHtml = mgMonoState.over ? '' :
        (mgMonoState.turn === 'player' && mgMonoState.phase === 'roll'
            ? mgBtn('🎲 掷骰子', 'mgMonoRoll()', true)
            : (mgMonoState.turn === 'player' && mgMonoState.phase === 'decide'
                ? `<div style="display:flex; gap:10px; justify-content:center;">${mgBtn('购买 🏠', 'mgMonoBuy()', true)}${mgBtn('跳过', 'mgMonoSkip()', false)}</div>`
                : `<div style="font-size:12px; color:var(--text-secondary);">${mgPartnerName()} 思考中…</div>`));

    wrap.innerHTML = mgHeader('🏠 双版大富翁',
        `<button onclick="mgMonoInit()" style="padding:6px 12px; border-radius:10px; border:1px solid var(--border-color);
            background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:12px;">重新开始</button>`) + `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:12px; gap:8px;">
            <div style="flex:1; background:var(--primary-bg); border:1px solid var(--border-color); border-radius:10px; padding:8px;">
                <div style="font-weight:700; color:var(--accent-color);">你 ✈️</div>
                <div style="color:var(--text-secondary); margin-top:2px;">💰 ${mgMonoState.playerGold}</div>
                <div style="color:var(--text-secondary);">📍 第 ${mgMonoState.playerPos} 格</div>
                <div style="color:var(--text-secondary);">🏠 ${mgMonoState.owners.filter(o=>o===1).length} 块</div>
            </div>
            <div style="flex:1; background:var(--primary-bg); border:1px solid var(--border-color); border-radius:10px; padding:8px;">
                <div style="font-weight:700; color:#ff6b6b;">${mgPartnerName()} 🛩️</div>
                <div style="color:var(--text-secondary); margin-top:2px;">💰 ${mgMonoState.aiGold}</div>
                <div style="color:var(--text-secondary);">📍 第 ${mgMonoState.aiPos} 格</div>
                <div style="color:var(--text-secondary);">🏠 ${mgMonoState.owners.filter(o=>o===2).length} 块</div>
            </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:4px; margin-bottom:14px;">${cells}</div>
        <div id="mg-mono-status" style="text-align:center; font-size:13px; color:var(--text-primary); margin-bottom:10px; min-height:20px;">${mgMonoState.message}</div>
        <div style="text-align:center;">${actionHtml}</div>`;
}

window.mgMonoRoll = function () {
    if (mgMonoState.over || mgMonoState.rolling) return;
    if (mgMonoState.turn !== 'player' || mgMonoState.phase !== 'roll') return;
    mgMonoState.rolling = true;
    let ticks = 0;
    const animate = setInterval(() => {
        mgMonoState.message = '骰子：' + (Math.floor(Math.random() * 6) + 1) + ' …';
        mgMonoRender();
        ticks++;
        if (ticks >= 6) {
            clearInterval(animate);
            const step = Math.floor(Math.random() * 6) + 1;
            mgMonoState.playerPos = (mgMonoState.playerPos + step) % MG_MONO_LEN;
            // 经过起点奖励
            if (mgMonoState.playerPos < step) {
                mgMonoState.playerGold += 200;
            }
            mgMonoState.rolling = false;
            mgMonoResolvePlayer();
        }
    }, 80);
};

function mgMonoResolvePlayer() {
    const pos = mgMonoState.playerPos;
    const cell = mgMonoCells[pos];
    const owner = mgMonoState.owners[pos];
    if (cell.type === 'start') {
        mgMonoState.message = '回到起点，轮到 ' + mgPartnerName();
        mgMonoRender();
        setTimeout(mgMonoAiTurn, 800);
    } else if (cell.type === 'end') {
        mgMonoState.message = '抵达终点！';
        mgMonoRender();
        setTimeout(mgMonoAiTurn, 800);
    } else if (owner === 0) {
        // 空地，可购买
        mgMonoState.phase = 'decide';
        mgMonoState.message = '停在「' + cell.name + '」，价格 ' + cell.price + '，是否购买？';
        mgMonoRender();
    } else if (owner === 1) {
        mgMonoState.message = '停在自家地块，休息一下';
        mgMonoRender();
        setTimeout(mgMonoAiTurn, 800);
    } else {
        // 对方地块，付过路费
        const rent = Math.floor(cell.price * 0.4);
        mgMonoState.playerGold -= rent;
        mgMonoState.aiGold += rent;
        mgMonoState.message = '停在 ' + mgPartnerName() + ' 的地块，付过路费 ' + rent;
        mgMonoRender();
        if (mgMonoCheckBankrupt()) return;
        setTimeout(mgMonoAiTurn, 900);
    }
}

window.mgMonoBuy = function () {
    if (mgMonoState.phase !== 'decide') return;
    const pos = mgMonoState.playerPos;
    const cell = mgMonoCells[pos];
    if (mgMonoState.playerGold < cell.price) {
        showNotification('金币不足', 'warning');
        return;
    }
    mgMonoState.playerGold -= cell.price;
    mgMonoState.owners[pos] = 1;
    mgMonoState.phase = 'roll';
    mgMonoState.message = '已购买「' + cell.name + '」';
    mgMonoRender();
    setTimeout(mgMonoAiTurn, 800);
};

window.mgMonoSkip = function () {
    if (mgMonoState.phase !== 'decide') return;
    mgMonoState.phase = 'roll';
    mgMonoState.message = '跳过购买，轮到 ' + mgPartnerName();
    mgMonoRender();
    setTimeout(mgMonoAiTurn, 800);
};

function mgMonoAiTurn() {
    if (mgMonoState.over) return;
    mgMonoState.turn = 'ai';
    mgMonoState.message = mgPartnerName() + ' 掷骰子…';
    mgMonoRender();
    setTimeout(() => {
        const step = Math.floor(Math.random() * 6) + 1;
        mgMonoState.aiPos = (mgMonoState.aiPos + step) % MG_MONO_LEN;
        if (mgMonoState.aiPos < step) mgMonoState.aiGold += 200;
        const pos = mgMonoState.aiPos;
        const cell = mgMonoCells[pos];
        const owner = mgMonoState.owners[pos];
        if (cell.type === 'start' || cell.type === 'end') {
            mgMonoState.message = mgPartnerName() + ' 前进到第 ' + pos + ' 格';
        } else if (owner === 0) {
            // AI 决策：金币充足则购买
            if (mgMonoState.aiGold > cell.price + 150) {
                mgMonoState.aiGold -= cell.price;
                mgMonoState.owners[pos] = 2;
                mgMonoState.message = mgPartnerName() + ' 购买了「' + cell.name + '」';
            } else {
                mgMonoState.message = mgPartnerName() + ' 未购买「' + cell.name + '」';
            }
        } else if (owner === 2) {
            mgMonoState.message = mgPartnerName() + ' 停在自家地块';
        } else {
            const rent = Math.floor(cell.price * 0.4);
            mgMonoState.aiGold -= rent;
            mgMonoState.playerGold += rent;
            mgMonoState.message = mgPartnerName() + ' 付你过路费 ' + rent;
        }
        mgMonoRender();
        if (mgMonoCheckBankrupt()) return;
        // 回到玩家回合
        mgMonoState.turn = 'player';
        mgMonoState.phase = 'roll';
        if (!mgMonoState.over) {
            setTimeout(() => {
                mgMonoState.message = '轮到你掷骰子';
                mgMonoRender();
            }, 800);
        }
    }, 800);
}

function mgMonoCheckBankrupt() {
    if (mgMonoState.playerGold < 0) {
        mgMonoState.over = true;
        mgMonoState.message = '💸 你金币不足，破产了！' + mgPartnerName() + ' 获胜';
        mgData.monoLosses++;
        mgSaveData();
        mgMonoRender();
        return true;
    }
    if (mgMonoState.aiGold < 0) {
        mgMonoState.over = true;
        mgMonoState.message = '🎉 ' + mgPartnerName() + ' 破产，你获胜！';
        mgData.monoWins++;
        mgSaveData();
        mgMonoRender();
        if (typeof playSound === 'function') playSound('message');
        return true;
    }
    return false;
}

/* ======================== 游戏 6：跳一跳 ======================== */

let mgJumpState = null;
let mgJumpChargeTimer = null;

function mgJumpInit() {
    mgCleanupJump();
    mgJumpState = {
        score: 0,
        over: false,
        charging: false,
        charge: 0,         // 0-100 蓄力值
        // 平台坐标（相对容器的 left）
        platformW: 56,
        currentX: 30,      // 当前平台 left
        nextX: 0,          // 下个平台 left（由 gap 决定）
        gap: 0,            // 当前与下个平台中心距离
        pieceX: 0          // 棋子 left（站在当前平台上）
    };
    mgJumpGenNext();
    mgJumpRender();
}

// 生成下一个平台
function mgJumpGenNext() {
    const minGap = 90, maxGap = 170;
    mgJumpState.gap = Math.floor(Math.random() * (maxGap - minGap + 1)) + minGap;
    mgJumpState.nextX = mgJumpState.currentX + mgJumpState.gap;
    mgJumpState.pieceX = mgJumpState.currentX + mgJumpState.platformW / 2 - 12;
}

function mgJumpRender() {
    const wrap = document.getElementById('mg-view-jump');
    const s = mgJumpState;
    const trackWidth = 460;
    // 视口偏移：让当前平台大致居左，下个平台可见
    const viewOffset = Math.max(0, s.currentX - 30);
    wrap.innerHTML = mgHeader('🦘 跳一跳',
        `<button onclick="mgJumpInit()" style="padding:6px 12px; border-radius:10px; border:1px solid var(--border-color);
            background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:12px;">重新开始</button>`) + `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:12px; color:var(--text-secondary);">
            <span>得分：<b id="mg-jump-score" style="color:var(--accent-color); font-size:16px;">${s.score}</b></span>
            <span>最高：${mgData.jumpHigh}</span>
        </div>
        <div id="mg-jump-track" style="position:relative; height:180px; background:var(--primary-bg); border:1px solid var(--border-color);
            border-radius:14px; overflow:hidden;">
            <div style="position:absolute; left:${s.currentX - viewOffset}px; bottom:20px; width:${s.platformW}px; height:14px;
                background:var(--accent-color); border-radius:8px;"></div>
            <div style="position:absolute; left:${s.nextX - viewOffset}px; bottom:20px; width:${s.platformW}px; height:14px;
                background:var(--accent-color); border-radius:8px; opacity:0.85;"></div>
            <div id="mg-jump-piece" style="position:absolute; left:${s.pieceX - viewOffset}px; bottom:34px; width:24px; height:24px;
                font-size:22px; line-height:24px; text-align:center; transition:left .15s ease, bottom .15s ease;">🟢</div>
            <div id="mg-jump-chargebar" style="position:absolute; left:50%; transform:translateX(-50%); bottom:8px; width:60%; height:6px;
                background:var(--secondary-bg); border-radius:3px; overflow:hidden;">
                <div id="mg-jump-charge-fill" style="width:0%; height:100%; background:var(--accent-color); transition:width .08s linear;"></div>
            </div>
        </div>
        <div id="mg-jump-msg" style="text-align:center; margin-top:14px; font-size:13px; color:var(--text-secondary); min-height:20px;">
            ${s.over ? s.message : '按住下方按钮蓄力，松开跳跃'}
        </div>
        <div style="text-align:center; margin-top:12px;">
            ${s.over ? '' : `<button id="mg-jump-btn" onpointerdown="mgJumpStartCharge()" onpointerup="mgJumpRelease()" onpointerleave="mgJumpRelease()"
                style="padding:14px 36px; border-radius:16px; border:none; background:var(--accent-color); color:#fff; font-size:14px; font-weight:700;
                cursor:pointer; user-select:none; touch-action:none;">蓄力跳跃</button>`}
        </div>`;
}

// 开始蓄力
window.mgJumpStartCharge = function () {
    if (!mgJumpState || mgJumpState.over || mgJumpState.charging) return;
    mgJumpState.charging = true;
    mgJumpState.charge = 0;
    const fill = document.getElementById('mg-jump-charge-fill');
    mgJumpChargeTimer = setInterval(() => {
        mgJumpState.charge = Math.min(100, mgJumpState.charge + 4);
        if (fill) fill.style.width = mgJumpState.charge + '%';
        // 棋子下压效果
        const piece = document.getElementById('mg-jump-piece');
        if (piece) piece.style.transform = 'scaleY(' + (1 - mgJumpState.charge / 300) + ')';
    }, 50);
};

// 释放跳跃
window.mgJumpRelease = function () {
    if (!mgJumpState || !mgJumpState.charging) return;
    mgJumpState.charging = false;
    if (mgJumpChargeTimer) { clearInterval(mgJumpChargeTimer); mgJumpChargeTimer = null; }
    const s = mgJumpState;
    const charge = s.charge;
    // 跳跃距离 = 蓄力 * 系数
    const jumpDist = charge * 2.4;
    const targetCenter = s.currentX + s.platformW / 2 + s.gap;
    const landX = s.currentX + s.platformW / 2 + jumpDist;
    const piece = document.getElementById('mg-jump-piece');
    const fill = document.getElementById('mg-jump-charge-fill');
    if (fill) fill.style.width = '0%';
    if (piece) piece.style.transform = '';

    // 动画跳跃
    const viewOffset = Math.max(0, s.currentX - 30);
    if (piece) {
        piece.style.transition = 'left .35s ease, bottom .35s ease';
        const peakBottom = 70;
        piece.style.bottom = peakBottom + 'px';
        setTimeout(() => { piece.style.bottom = '34px'; }, 175);
        piece.style.left = (landX - 12 - viewOffset) + 'px';
    }

    setTimeout(() => {
        // 判定是否落在下个平台上（中心误差不超过平台宽度的一半）
        const tolerance = s.platformW / 2;
        const diff = Math.abs(landX - targetCenter);
        if (diff <= tolerance) {
            // 成功
            s.score++;
            if (s.score > mgData.jumpHigh) mgData.jumpHigh = s.score;
            mgSaveData();
            if (typeof playSound === 'function') playSound('message');
            // 平移：下个平台变成当前平台
            s.currentX = s.nextX;
            mgJumpGenNext();
            mgJumpRender();
        } else {
            // 失败
            s.over = true;
            s.message = '💀 掉落了！得分 ' + s.score + (s.score === mgData.jumpHigh && s.score > 0 ? ' · 平最高纪录' : '');
            mgSaveData();
            mgJumpRender();
        }
    }, 360);
};

// 清理跳一跳定时器
function mgCleanupJump() {
    if (mgJumpChargeTimer) { clearInterval(mgJumpChargeTimer); mgJumpChargeTimer = null; }
    if (mgMemoryTimer) { clearInterval(mgMemoryTimer); mgMemoryTimer = null; }
    if (mgJumpState) mgJumpState.charging = false;
}

/* ======================== 工具：获取对方名称 ======================== */

function mgPartnerName() {
    try {
        if (typeof settings !== 'undefined' && settings && settings.partnerName) return settings.partnerName;
    } catch (e) {}
    return 'Ta';
}

/* ======================== 显式暴露（供 HTML onclick 调用） ======================== */
// 顶级 function 声明在经典脚本中本即为全局，这里显式挂到 window 以确保万无一失
window.mgGomokuInit = mgGomokuInit;
window.mgLudoInit = mgLudoInit;
window.mgMemoryInit = mgMemoryInit;
window.mgMonoInit = mgMonoInit;
window.mgJumpInit = mgJumpInit;
