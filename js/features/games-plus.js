/**
 * games-plus.js — 小游戏中心扩展包（挂进现有游戏中心）
 * 新增：消消乐 / 连连看 / 2048 / 羊了个羊
 * 机制：向 mini-games.js 的 MG_GAMES 注入卡片 + 动态补充视图容器 +
 *       通过 window.__mgExtraOpen 接入 mgShowGame 分发
 * 暴露：window.openGamesPlus（直达游戏中心）
 */

/* ==================== 数据层（最佳成绩） ==================== */
let gpData = { match3Best: 0, linkBest: 0, g2048Best: 0, sheepWins: 0, mineWins: 0, tileBest: 0, pongWins: 0, fishCaught: 0 };
let gpLoaded = false;
async function gpLoadData() {
    if (gpLoaded) return;
    try {
        const saved = await localforage.getItem(getStorageKey('gamesPlusData'));
        if (saved && typeof saved === 'object') gpData = Object.assign({}, gpData, saved);
    } catch (e) {
        try { const raw = localStorage.getItem('gpFallback_gamesPlusData'); if (raw) gpData = Object.assign({}, gpData, JSON.parse(raw)); } catch (e2) {}
    }
    gpLoaded = true;
}
function gpSave() {
    try { localforage.setItem(getStorageKey('gamesPlusData'), gpData); }
    catch (e) { try { localStorage.setItem('gpFallback_gamesPlusData', JSON.stringify(gpData)); } catch (e2) {} }
}
function gpNotify(m, t, d) { try { showNotification(m, t || 'info', d || 3000); } catch (e) {} }
function gpName() { try { return mgPartnerName(); } catch (e) { return '梦角'; } }

/* ==================== 注册进游戏中心 ==================== */
const GP_META = [
    { id: 'match3', icon: '🍬', name: '消消乐',   desc: '三连消除得高分', best: () => gpData.match3Best ? '最高 ' + gpData.match3Best : '未挑战' },
    { id: 'link',   icon: '🔗', name: '连连看',   desc: '相同图案连消除', best: () => gpData.linkBest ? '最佳 ' + gpData.linkBest + ' 秒' : '未挑战' },
    { id: 'g2048',  icon: '🔢', name: '2048',     desc: '滑动合成大数字', best: () => gpData.g2048Best ? '最高 ' + gpData.g2048Best : '未挑战' },
    { id: 'sheep',  icon: '🐑', name: '羊了个羊', desc: '叠层三消大挑战', best: () => gpData.sheepWins ? '通关 ' + gpData.sheepWins + ' 次' : '未通关' },
    { id: 'mine',   icon: '💣', name: '双人扫雷', desc: '轮流排雷比谁快', best: () => gpData.mineWins ? '胜 ' + gpData.mineWins + ' 局' : '未挑战' },
    { id: 'tile',   icon: '🧱', name: '打地砖',   desc: '连击打碎所有砖', best: () => gpData.tileBest ? '最高 ' + gpData.tileBest : '未挑战' },
    { id: 'pong',   icon: '🏓', name: 'Pong 乒乓', desc: '和 Ta 对打乒乓球', best: () => gpData.pongWins ? '胜 ' + gpData.pongWins + ' 局' : '未挑战' },
    { id: 'fish',   icon: '🎣', name: '钓鱼',     desc: '双人同时垂钓·渔获互赠', best: () => gpData.fishCaught ? '钓到 ' + gpData.fishCaught + ' 条' : '未挑战' }
];
function gpAppendViews() {
    const modal = document.getElementById('mg-modal');
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    GP_META.forEach(g => {
        if (!document.getElementById('mg-view-' + g.id)) {
            const div = document.createElement('div');
            div.id = 'mg-view-' + g.id;
            div.style.display = 'none';
            content.appendChild(div);
        }
    });
}
function gpRegister() {
    gpLoadData();
    try { MG_GAMES.push(...GP_META.filter(m => !MG_GAMES.some(g => g.id === m.id))); } catch (e) {}
    const origEnsure = window.mgEnsureModal;
    if (typeof origEnsure === 'function') {
        window.mgEnsureModal = function () { const m = origEnsure(); gpAppendViews(); return m; };
    }
    window.__mgExtraOpen = Object.assign({}, window.__mgExtraOpen, {
        match3: gpOpenMatch3,
        link: gpOpenLink,
        g2048: gpOpen2048,
        sheep: gpOpenSheep,
        mine: gpOpenMine,
        tile: gpOpenTile,
        pong: gpOpenPong,
        fish: gpOpenFish
    });
}
window.openGamesPlus = async function () {
    if (typeof openMiniGamesCenter === 'function') openMiniGamesCenter();
};
document.addEventListener('DOMContentLoaded', () => setTimeout(gpRegister, 600));

/* ==================== 游戏一：消消乐 ==================== */
const M3_EMOJIS = ['🍎', '🌸', '⭐', '🍀', '💧', '🎈'];
let m3Board = [], m3Score = 0, m3Moves = 30, m3Sel = null, m3Busy = false;
let m3TaScore = 0, m3Turn = 'me';
function gpOpenMatch3() { gpLoadData(); m3Init(); }
function m3Init() {
    m3Board = []; m3Score = 0; m3Moves = 30; m3Sel = null; m3Busy = false; m3TaScore = 0; m3Turn = 'me';
    for (let r = 0; r < 8; r++) {
        m3Board[r] = [];
        for (let c = 0; c < 8; c++) m3Board[r][c] = Math.floor(Math.random() * M3_EMOJIS.length);
    }
    // 开局避免自带三连
    let guard = 0;
    while (m3FindMatches().size && guard++ < 200) {
        m3FindMatches().forEach(key => { const [r, c] = key.split(',').map(Number); m3Board[r][c] = (m3Board[r][c] + 1) % M3_EMOJIS.length; });
    }
    m3Render();
}
// AI 回合：找一个能消除的交换，执行一次
function m3AIMove() {
    if (m3Moves <= 0) return;
    m3Busy = true;
    // 寻找一个可消除的交换
    let found = null;
    for (let r = 0; r < 8 && !found; r++) for (let c = 0; c < 8 && !found; c++) {
        // 向右交换
        if (c < 7) {
            [m3Board[r][c], m3Board[r][c+1]] = [m3Board[r][c+1], m3Board[r][c]];
            if (m3FindMatches().size) found = [r, c, r, c+1];
            [m3Board[r][c], m3Board[r][c+1]] = [m3Board[r][c+1], m3Board[r][c]];
        }
        // 向下交换
        if (r < 7 && !found) {
            [m3Board[r][c], m3Board[r+1][c]] = [m3Board[r+1][c], m3Board[r][c]];
            if (m3FindMatches().size) found = [r, c, r+1, c];
            [m3Board[r][c], m3Board[r+1][c]] = [m3Board[r+1][c], m3Board[r][c]];
        }
    }
    if (!found) { m3Busy = false; m3Turn = 'me'; m3Render(); return; }
    const [r1, c1, r2, c2] = found;
    [m3Board[r1][c1], m3Board[r2][c2]] = [m3Board[r2][c2], m3Board[r1][c1]];
    let total = 0;
    const cascade = () => {
        const hits = m3FindMatches();
        if (!hits.size) {
            m3Busy = false; m3Turn = 'me';
            if (m3Moves <= 0) {
                if (m3Score > gpData.match3Best) { gpData.match3Best = m3Score; gpSave(); }
                const win = m3Score >= m3TaScore;
                if (win) gpData.match3Wins = (gpData.match3Wins || 0) + 1; gpSave();
                m3Render(`本局结束！你 ${m3Score} : ${m3TaScore} ${gpName()} ${win ? '🎉 你赢了！' : '😢 Ta 赢了'}`);
                try { pgChat('partner', win ? '呜呜你赢了…再来一局？🍬' : '哈哈我赢啦！不服再来 🍬'); } catch (e) {}
            } else m3Render();
            return;
        }
        total += hits.size;
        hits.forEach(key => { const [rr, cc] = key.split(',').map(Number); m3Board[rr][cc] = null; });
        m3TaScore += hits.size * 10 * (1 + Math.floor(total / 10));
        m3Gravity();
        m3Render();
        setTimeout(cascade, 220);
    };
    cascade();
}
function m3FindMatches() {
    const hits = new Set();
    for (let r = 0; r < 8; r++) {
        let run = 1;
        for (let c = 1; c <= 8; c++) {
            if (c < 8 && m3Board[r][c] === m3Board[r][c - 1] && m3Board[r][c] !== null && m3Board[r][c] !== undefined) run++;
            else { if (run >= 3) for (let k = c - run; k < c; k++) hits.add(r + ',' + k); run = 1; }
        }
    }
    for (let c = 0; c < 8; c++) {
        let run = 1;
        for (let r = 1; r <= 8; r++) {
            if (r < 8 && m3Board[r][c] === m3Board[r - 1][c] && m3Board[r][c] !== null && m3Board[r][c] !== undefined) run++;
            else { if (run >= 3) for (let k = r - run; k < r; k++) hits.add(k + ',' + c); run = 1; }
        }
    }
    return hits;
}
function m3Gravity() {
    for (let c = 0; c < 8; c++) {
        const col = [];
        for (let r = 7; r >= 0; r--) if (m3Board[r][c] !== null) col.push(m3Board[r][c]);
        for (let r = 7; r >= 0; r--) m3Board[r][c] = col.length ? col.shift() : Math.floor(Math.random() * M3_EMOJIS.length);
    }
}
function m3Render(endText) {
    const wrap = document.getElementById('mg-view-match3');
    if (!wrap) return;
    let grid = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const isSel = m3Sel && m3Sel[0] === r && m3Sel[1] === c;
        grid += `<div onclick="m3Tap(${r},${c})" style="height:38px; display:flex; align-items:center; justify-content:center; font-size:22px; cursor:pointer;
            background:${isSel ? 'rgba(var(--accent-color-rgb),0.25)' : 'var(--primary-bg)'}; border:1px solid ${isSel ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius:8px; transition:background .15s;">${m3Board[r][c] !== null ? M3_EMOJIS[m3Board[r][c]] : ''}</div>`;
    }
    wrap.innerHTML = mgHeader('🍬 消消乐') + `
        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-primary); margin-bottom:10px;">
            <span>你：<b style="color:var(--accent-color);">${m3Score}</b></span>
            <span>步数：<b>${m3Moves}</b></span>
            <span>${gpName()}：<b id="m3-ta-score" style="color:#ff6b6b;">${m3TaScore}</b></span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(8,1fr); gap:3px; user-select:none;">${grid}</div>
        <div style="text-align:center; margin-top:12px;">${endText ? `<div style="font-size:15px; font-weight:800; color:var(--accent-color); margin-bottom:10px;">${endText}</div>${mgBtn('🔄 再来一局', 'm3Init()')}` : mgBtn('🔄 重新开始', 'm3Init()', false)}</div>`;
}
window.m3Tap = function (r, c) {
    if (m3Busy || m3Moves <= 0 || m3Turn !== 'me') return;
    if (!m3Sel) { m3Sel = [r, c]; m3Render(); return; }
    const [sr, sc] = m3Sel;
    if (sr === r && sc === c) { m3Sel = null; m3Render(); return; }
    if (Math.abs(sr - r) + Math.abs(sc - c) !== 1) { m3Sel = [r, c]; m3Render(); return; }
    // 交换
    [m3Board[sr][sc], m3Board[r][c]] = [m3Board[r][c], m3Board[sr][sc]];
    const hits = m3FindMatches();
    if (!hits.size) {
        [m3Board[sr][sc], m3Board[r][c]] = [m3Board[r][c], m3Board[sr][sc]];
        m3Sel = null; m3Render(); return;
    }
    m3Busy = true; m3Sel = null; m3Moves--;
    let total = 0;
    const cascade = () => {
        const hits = m3FindMatches();
        if (!hits.size) {
            m3Busy = false;
            if (m3Moves <= 0) {
                if (m3Score > gpData.match3Best) { gpData.match3Best = m3Score; gpSave(); }
                const win = m3Score >= m3TaScore;
                if (win) gpData.match3Wins = (gpData.match3Wins || 0) + 1; gpSave();
                m3Render(`本局结束！你 ${m3Score} : ${m3TaScore} ${gpName()} ${win ? '🎉 你赢了！' : '😢 Ta 赢了'}`);
                try { pgChat('partner', win ? '呜呜你赢了…再来一局？🍬' : '哈哈我赢啦！不服再来 🍬'); } catch (e) {}
            } else {
                m3Turn = 'ta';
                m3Render();
                setTimeout(m3AIMove, 500);
            }
            return;
        }
        total += hits.size;
        hits.forEach(key => { const [rr, cc] = key.split(',').map(Number); m3Board[rr][cc] = null; });
        m3Score += hits.size * 10 * (1 + Math.floor(total / 10));
        m3Gravity();
        m3Render();
        setTimeout(cascade, 220);
    };
    cascade();
};

/* ==================== 游戏二：连连看 ==================== */
const LK_EMOJIS = ['🌸', '🌙', '⭐', '🍀', '🎀', '🍰', '🎈', '💎', '🐱', '🍓'];
const LK_ROWS = 6, LK_COLS = 8;
let lkGrid = [], lkSel = null, lkTimer = null, lkSecs = 0, lkHints = 3, lkLeft = 0;
let lkTaScore = 0, lkTurn = 'me';
function gpOpenLink() { gpLoadData(); lkInit(); }
function lkInit() {
    lkGrid = Array.from({ length: LK_ROWS + 2 }, () => Array(LK_COLS + 2).fill(null));
    lkTaScore = 0; lkTurn = 'me';
    const pairs = LK_ROWS * LK_COLS / 2; // 24
    const bag = [];
    for (let i = 0; i < pairs; i++) { const e = LK_EMOJIS[Math.floor(Math.random() * LK_EMOJIS.length)]; bag.push(e, e); }
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    let k = 0;
    for (let r = 1; r <= LK_ROWS; r++) for (let c = 1; c <= LK_COLS; c++) lkGrid[r][c] = bag[k++];
    lkSel = null; lkHints = 3; lkLeft = pairs * 2;
    lkSecs = 0;
    if (lkTimer) clearInterval(lkTimer);
    lkTimer = setInterval(() => { lkSecs++; const el = document.getElementById('lk-time'); if (el) el.textContent = lkSecs + ' 秒'; }, 1000);
    lkRender();
}
// AI 回合：找一对可连的消除
function lkAIMove() {
    if (lkLeft <= 0) return;
    const cells = [];
    for (let r = 1; r <= LK_ROWS; r++) for (let c = 1; c <= LK_COLS; c++) if (lkGrid[r][c] !== null) cells.push([r, c]);
    for (const [r1, c1] of cells) for (const [r2, c2] of cells) {
        if ((r1 !== r2 || c1 !== c2) && lkGrid[r1][c1] === lkGrid[r2][c2] && lkLinkable(r1, c1, r2, c2)) {
            lkGrid[r1][c1] = null; lkGrid[r2][c2] = null; lkLeft -= 2;
            lkTaScore += 100;
            if (lkLeft === 0) {
                clearInterval(lkTimer);
                lkRender(`😢 ${gpName()} 抢先消除完了！你 ${lkSecs} 秒 · Ta 得分 ${lkTaScore}`);
                try { pgChat('partner', '哈哈我比你快！再来一局？🔗'); } catch (e) {}
                return;
            }
            lkTurn = 'me';
            lkRender();
            return;
        }
    }
    lkTurn = 'me'; lkRender();
}
function lkLinkable(r1, c1, r2, c2) {
    // BFS：最多两转弯，走空格（含外圈），终点为另一块同类
    if (lkGrid[r1][c1] !== lkGrid[r2][c2] || lkGrid[r1][c1] === null) return false;
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const best = Array.from({ length: LK_ROWS + 2 }, () => Array(LK_COLS + 2).fill(99));
    const queue = [[r1, c1, -1, -1]]; // r, c, 上一步方向, 转弯数
    while (queue.length) {
        const [r, c, d, t] = queue.shift();
        for (let nd = 0; nd < 4; nd++) {
            const nr = r + DIRS[nd][0], nc = c + DIRS[nd][1];
            if (nr < 0 || nr >= LK_ROWS + 2 || nc < 0 || nc >= LK_COLS + 2) continue;
            const nt = (nd === d) ? t : t + 1;
            if (nt > 2) continue;
            const isEmpty = lkGrid[nr][nc] === null;
            const isTarget = nr === r2 && nc === c2;
            if (!isEmpty && !isTarget) continue;
            if (isTarget) return true;
            if (nt < best[nr][nc]) { best[nr][nc] = nt; queue.push([nr, nc, nd, nt]); }
        }
    }
    return false;
}
window.lkTap = function (r, c) {
    if (lkTurn !== 'me') return;
    if (lkGrid[r][c] === null) return;
    if (!lkSel) { lkSel = [r, c]; lkRender(); return; }
    const [sr, sc] = lkSel;
    if (sr === r && sc === c) { lkSel = null; lkRender(); return; }
    if (lkLinkable(sr, sc, r, c)) {
        lkGrid[sr][sc] = null; lkGrid[r][c] = null; lkLeft -= 2; lkSel = null;
        try { if (typeof playSound === 'function') playSound('send'); } catch (e) {}
        if (lkLeft === 0) {
            clearInterval(lkTimer);
            if (!gpData.linkBest || lkSecs < gpData.linkBest) { gpData.linkBest = lkSecs; gpSave(); }
            gpData.linkWins = (gpData.linkWins || 0) + 1; gpSave();
            lkRender(`🎉 你抢先消除完！用时 ${lkSecs} 秒（Ta 得分 ${lkTaScore}）${lkSecs <= gpData.linkBest ? '（新纪录！）' : ''}`);
            try { pgChat('partner', '呜呜你手太快了…再来一局？🔗'); } catch (e) {}
            return;
        }
        lkTurn = 'ta';
        lkRender();
        setTimeout(lkAIMove, 500);
    } else { lkSel = [r, c]; lkRender(); }
};
window.lkHint = function () {
    if (lkHints <= 0) { gpNotify('提示次数用完啦', 'warning'); return; }
    const cells = [];
    for (let r = 1; r <= LK_ROWS; r++) for (let c = 1; c <= LK_COLS; c++) if (lkGrid[r][c] !== null) cells.push([r, c]);
    for (const [r1, c1] of cells) for (const [r2, c2] of cells) {
        if ((r1 !== r2 || c1 !== c2) && lkGrid[r1][c1] === lkGrid[r2][c2] && lkLinkable(r1, c1, r2, c2)) {
            lkHints--;
            lkSel = [r1, c1];
            lkRender();
            gpNotify(`提示：${lkGrid[r1][c1]}（剩余 ${lkHints} 次）`, 'info');
            return;
        }
    }
};
function lkRender(endText) {
    const wrap = document.getElementById('mg-view-link');
    if (!wrap) return;
    let grid = '';
    for (let r = 1; r <= LK_ROWS; r++) for (let c = 1; c <= LK_COLS; c++) {
        const v = lkGrid[r][c];
        const isSel = lkSel && lkSel[0] === r && lkSel[1] === c;
        grid += `<div onclick="lkTap(${r},${c})" style="height:40px; display:flex; align-items:center; justify-content:center; font-size:22px; cursor:pointer;
            background:${isSel ? 'rgba(var(--accent-color-rgb),0.25)' : 'var(--primary-bg)'}; border:1px solid ${isSel ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius:8px;">${v || ''}</div>`;
    }
    wrap.innerHTML = mgHeader('🔗 连连看') + `
        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-primary); margin-bottom:10px;">
            <span>用时：<b id="lk-time" style="color:var(--accent-color);">${lkSecs} 秒</b></span>
            <span>剩余：<b>${lkLeft}</b></span>
            <span>${gpName()}：<b id="lk-ta-score" style="color:#ff6b6b;">${lkTaScore}</b></span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(8,1fr); gap:3px; user-select:none;">${grid}</div>
        <div style="text-align:center; margin-top:12px; display:flex; gap:8px; justify-content:center;">
            ${endText ? mgBtn('🔄 再来一局', 'lkInit()') : mgBtn(`💡 提示 (${lkHints})`, 'lkHint()', false)}
            ${endText ? '' : mgBtn('🔄 重开', 'lkInit()', false)}
        </div>`;
}

/* ==================== 游戏三：2048 ==================== */
const G2_COLORS = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
let g2Board = [], g2Score = 0, g2Over = false, g2Won = false;
let g2TaScore = 0, g2TaBoard = [], g2Turn = 'me';
function gpOpen2048() { gpLoadData(); g2Init(); }
function g2Init() {
    g2Board = Array.from({ length: 4 }, () => Array(4).fill(0));
    g2TaBoard = Array.from({ length: 4 }, () => Array(4).fill(0));
    g2Score = 0; g2Over = false; g2Won = false; g2TaScore = 0; g2Turn = 'me';
    g2Add(); g2Add();
    g2TaAdd(); g2TaAdd();
    g2Render();
    if (!g2Bound) {
        g2Bound = true;
        document.addEventListener('keydown', e => {
            if (document.getElementById('mg-view-g2048') && document.getElementById('mg-view-g2048').style.display !== 'none') {
                const map = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' };
                if (map[e.key]) { e.preventDefault(); g2Move(map[e.key]); }
            }
        });
    }
}
let g2Bound = false;
function g2Add() {
    const empties = [];
    g2Board.forEach((row, r) => row.forEach((v, c) => { if (!v) empties.push([r, c]); }));
    if (!empties.length) return;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    g2Board[r][c] = Math.random() < 0.9 ? 2 : 4;
}
function g2TaAdd() {
    const empties = [];
    g2TaBoard.forEach((row, r) => row.forEach((v, c) => { if (!v) empties.push([r, c]); }));
    if (!empties.length) return;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    g2TaBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
}
function g2TaCanMove() {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        if (!g2TaBoard[r][c]) return true;
        if (r < 3 && g2TaBoard[r][c] === g2TaBoard[r + 1][c]) return true;
        if (c < 3 && g2TaBoard[r][c] === g2TaBoard[r][c + 1]) return true;
    }
    return false;
}
function g2AIMove() {
    if (g2Over) return;
    if (!g2TaCanMove()) {
        g2Over = true;
        if (g2Score > gpData.g2048Best) { gpData.g2048Best = g2Score; gpSave(); }
        const win = g2Score >= g2TaScore;
        if (win) gpData.g2048Wins = (gpData.g2048Wins || 0) + 1; gpSave();
        try { pgChat('partner', win ? '你比我厉害…再来！🔢' : '我的棋盘满啦，但我分数更高哦～🔢'); } catch (e) {}
        g2Render();
        return;
    }
    // 选一个能移动的方向（优先得分高的）
    let bestDir = 'L', bestGain = -1;
    for (const dir of ['L', 'R', 'U', 'D']) {
        let gain = 0, moved = false;
        const get = (i, j) => {
            if (dir === 'L') return g2TaBoard[i][j];
            if (dir === 'R') return g2TaBoard[i][3 - j];
            if (dir === 'U') return g2TaBoard[j][i];
            return g2TaBoard[3 - j][i];
        };
        for (let i = 0; i < 4; i++) {
            const line = [get(i, 0), get(i, 1), get(i, 2), get(i, 3)];
            const [, g] = g2Slide(line);
            gain += g;
            if (g > 0) moved = true;
        }
        if (moved && gain > bestGain) { bestGain = gain; bestDir = dir; }
    }
    if (bestGain < 0) { g2Turn = 'me'; g2Render(); return; }
    let gain = 0;
    const get = (i, j) => {
        if (bestDir === 'L') return g2TaBoard[i][j];
        if (bestDir === 'R') return g2TaBoard[i][3 - j];
        if (bestDir === 'U') return g2TaBoard[j][i];
        return g2TaBoard[3 - j][i];
    };
    const set = (i, j, v) => {
        if (bestDir === 'L') g2TaBoard[i][j] = v;
        else if (bestDir === 'R') g2TaBoard[i][3 - j] = v;
        else if (bestDir === 'U') g2TaBoard[j][i] = v;
        else g2TaBoard[3 - j][i] = v;
    };
    for (let i = 0; i < 4; i++) {
        const line = [get(i, 0), get(i, 1), get(i, 2), get(i, 3)];
        const [arr, g] = g2Slide(line);
        gain += g;
        for (let j = 0; j < 4; j++) set(i, j, arr[j]);
    }
    g2TaScore += gain;
    g2TaAdd();
    g2Turn = 'me';
    g2Render();
}
function g2Slide(line) {
    const arr = line.filter(v => v);
    let gained = 0;
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === arr[i + 1]) { arr[i] *= 2; gained += arr[i]; arr.splice(i + 1, 1); }
    }
    while (arr.length < 4) arr.push(0);
    return [arr, gained];
}
window.g2Move = function (dir) {
    if (g2Over || g2Turn !== 'me') return;
    let moved = false, gain = 0;
    const get = (i, j) => {
        if (dir === 'L') return g2Board[i][j];
        if (dir === 'R') return g2Board[i][3 - j];
        if (dir === 'U') return g2Board[j][i];
        return g2Board[3 - j][i];
    };
    const set = (i, j, v) => {
        if (dir === 'L') g2Board[i][j] = v;
        else if (dir === 'R') g2Board[i][3 - j] = v;
        else if (dir === 'U') g2Board[j][i] = v;
        else g2Board[3 - j][i] = v;
    };
    for (let i = 0; i < 4; i++) {
        const line = [get(i, 0), get(i, 1), get(i, 2), get(i, 3)];
        const [arr, gained] = g2Slide(line);
        gain += gained;
        for (let j = 0; j < 4; j++) { if (get(i, j) !== arr[j]) moved = true; set(i, j, arr[j]); }
    }
    if (!moved) return;
    g2Score += gain;
    g2Add();
    if (gain && typeof playSound === 'function') { try { playSound('mood'); } catch (e) {} }
    // 结束判定
    let canMove = false;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        if (!g2Board[r][c]) canMove = true;
        if (r < 3 && g2Board[r][c] === g2Board[r + 1][c]) canMove = true;
        if (c < 3 && g2Board[r][c] === g2Board[r][c + 1]) canMove = true;
    }
    if (!canMove) {
        g2Over = true;
        if (g2Score > gpData.g2048Best) { gpData.g2048Best = g2Score; gpSave(); }
        const win = g2Score >= g2TaScore;
        if (win) gpData.g2048Wins = (gpData.g2048Wins || 0) + 1; gpSave();
        try { pgChat('partner', win ? `你 ${g2Score} 比我高…再来！🔢` : `我 ${g2TaScore} 比你高哦～不服来战 🔢`); } catch (e) {}
    } else {
        g2Turn = 'ta';
        g2Render();
        setTimeout(g2AIMove, 400);
        return;
    }
    g2Render();
};
function g2SwipeBind() {
    const el = document.getElementById('g2-board');
    if (!el) return;
    let sx = 0, sy = 0;
    el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) g2Move(dx > 0 ? 'R' : 'L'); else g2Move(dy > 0 ? 'D' : 'U');
    }, { passive: true });
}
function g2Render() {
    const wrap = document.getElementById('mg-view-g2048');
    if (!wrap) return;
    let cells = '';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const v = g2Board[r][c];
        const bg = v ? (G2_COLORS[v] || '#3c3a32') : 'rgba(238,228,218,0.35)';
        const color = v <= 4 ? '#776e65' : '#f9f6f2';
        cells += `<div style="aspect-ratio:1; display:flex; align-items:center; justify-content:center; background:${bg}; border-radius:8px; font-size:${v >= 1024 ? 18 : 24}px; font-weight:800; color:${color};">${v || ''}</div>`;
    }
    wrap.innerHTML = mgHeader('🔢 2048') + `
        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-primary); margin-bottom:10px;">
            <span>你：<b style="color:var(--accent-color);">${g2Score}</b></span>
            <span>最高：<b>${gpData.g2048Best || '-'}</b></span>
            <span>${gpName()}：<b id="g2-ta-score" style="color:#ff6b6b;">${g2TaScore}</b></span>
        </div>
        <div id="g2-board" style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; background:rgba(238,228,218,0.2); padding:6px; border-radius:10px; touch-action:none;">${cells}</div>
        ${g2Over ? `<div style="text-align:center; margin-top:12px;"><div style="font-size:15px; font-weight:800; color:var(--accent-color); margin-bottom:10px;">游戏结束！你 ${g2Score} : ${g2TaScore} ${gpName()} ${g2Score >= g2TaScore ? '🎉 你赢了！' : '😢 Ta 赢了'}</div>${mgBtn('🔄 再来一局', 'g2Init()')}</div>`
            : `<div style="display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:12px;">
                ${mgBtn('⬆️', "g2Move('U')", false)}
                <div style="display:flex; gap:6px;">
                    ${mgBtn('⬅️', "g2Move('L')", false)} ${mgBtn('⬇️', "g2Move('D')", false)} ${mgBtn('➡️', "g2Move('R')", false)}
                </div>
                <div style="font-size:11px; color:var(--text-secondary);">键盘方向键 / 按钮 / 滑动皆可</div>
            </div>`}`;
    g2SwipeBind();
}

/* ==================== 游戏四：羊了个羊（简化叠层版） ==================== */
const SP_KINDS = ['🥕', '🍚', '🍗', '🍉', '🍺', '⚽', '🎬', '🧢', '🍀'];
const SP_TILE = 54;
let spTiles = [], spTray = [], spShuffles = 1, spOver = false;
let spTaScore = 0, spTurn = 'me';
function gpOpenSheep() { gpLoadData(); spInit(); }
function spInit() {
    const bag = [];
    SP_KINDS.forEach(k => bag.push(k, k, k));
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    spTiles = []; spTray = []; spShuffles = 1; spOver = false; spTaScore = 0; spTurn = 'me';
    const mk = (layer, gx, gy, x, y) => spTiles.push({ id: spTiles.length, layer, gx, gy, x, y, kind: bag.pop(), removed: false });
    for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 4; gx++) mk(0, gx, gy, 8 + gx * 64, 8 + gy * 64);
    for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) mk(1, gx, gy, 40 + gx * 64, 40 + gy * 64);
    for (let gy = 0; gy < 2; gy++) for (let gx = 0; gx < 3; gx++) mk(2, gx, gy, 24 + gx * 64, 24 + 8 + gy * 64);
    spRender();
}
// AI 回合：取一张未覆盖的牌
function spAIMove() {
    if (spOver) return;
    const avail = spTiles.filter(t => !t.removed && !spCovered(t));
    if (avail.length) {
        const t = avail[Math.floor(Math.random() * avail.length)];
        t.removed = true;
        spTaScore += 10;
    }
    const remain = spTiles.filter(x => !x.removed).length;
    if (remain === 0 && spTray.length === 0) {
        spOver = true;
        const win = spTiles.filter(t => t.removed).length * 10 - spTaScore >= spTaScore;
        spRender(win ? '🎉 通关！你比 Ta 快！' : '😢 Ta 抢在你前面取完了');
        try { pgChat('partner', win ? '你手太快了…再来一局？🐑' : '哈哈我先取完啦～不服来战 🐑'); } catch (e) {}
        return;
    }
    spTurn = 'me';
    spRender();
}
function spCovered(tile) {
    return spTiles.some(t => !t.removed && t.layer > tile.layer &&
        Math.abs(t.x - tile.x) < SP_TILE - 6 && Math.abs(t.y - tile.y) < SP_TILE - 6);
}
window.spPick = function (id) {
    if (spOver || spTurn !== 'me') return;
    const t = spTiles.find(x => x.id === id);
    if (!t || t.removed || spCovered(t)) return;
    t.removed = true;
    spTray.push(t.kind);
    let eliminated = false;
    for (const k of SP_KINDS) {
        if (spTray.filter(x => x === k).length >= 3) {
            let n = 0;
            spTray = spTray.filter(x => { if (x === k && n < 3) { n++; return false; } return true; });
            eliminated = true;
        }
    }
    try { if (typeof playSound === 'function') playSound(eliminated ? 'send' : 'mood'); } catch (e) {}
    const remain = spTiles.filter(x => !x.removed).length;
    if (spTray.length >= 7) {
        spOver = true;
        spRender(`槽位满了…你得分 ${spTiles.filter(t=>t.removed).length * 10 - spTaScore} 不敌 Ta 的 ${spTaScore} 🐑`);
        try { pgChat('partner', '羊了个羊你输啦～再来一局？🐑'); } catch (e) {}
        return;
    }
    if (remain === 0 && spTray.length === 0) {
        spOver = true;
        gpData.sheepWins++; gpSave();
        spRender('🎉 通关！你就是羊界之光！');
        try { pgChat('partner', `羊了个羊被你通关啦！不服来战 🐑`); } catch (e) {}
        return;
    }
    spTurn = 'ta';
    spRender();
    setTimeout(spAIMove, 500);
};
window.spShuffle = function () {
    if (spShuffles <= 0 || spOver) { gpNotify('洗牌机会用完啦', 'warning'); return; }
    const kinds = spTiles.filter(t => !t.removed).map(t => t.kind);
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    spTiles.filter(t => !t.removed).forEach((t, i) => t.kind = kinds[i]);
    spShuffles--;
    spRender();
};
function spRender(endText) {
    const wrap = document.getElementById('mg-view-sheep');
    if (!wrap) return;
    const remain = spTiles.filter(x => !x.removed).length;
    const myScore = spTiles.filter(t => t.removed).length * 10 - spTaScore;
    const board = spTiles.map(t => {
        const covered = spCovered(t);
        return `<div onclick="spPick(${t.id})" style="position:absolute; left:${t.x}px; top:${t.y}px; width:${SP_TILE - 8}px; height:${SP_TILE - 8}px;
            display:${t.removed ? 'none' : 'flex'}; align-items:center; justify-content:center; font-size:24px; cursor:${covered ? 'default' : 'pointer'};
            background:#fff; border:1.5px solid ${covered ? '#ccc' : 'var(--accent-color)'}; border-radius:9px;
            box-shadow:0 2px 5px rgba(0,0,0,0.18); opacity:${covered ? 0.85 : 1}; z-index:${t.layer + 1};">${t.kind}</div>`;
    }).join('');
    wrap.innerHTML = mgHeader('🐑 羊了个羊') + `
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; text-align:center;">点击亮起的图块收入槽位 · 集齐 3 个相同即消除 · 槽满即败 · 和 ${gpName()} 比拼谁更快</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;">
            <span>你：<b style="color:var(--accent-color);">${myScore}</b></span>
            <span>剩余：<b>${remain}</b></span>
            <span>${gpName()}：<b id="sp-ta-score" style="color:#ff6b6b;">${spTaScore}</b></span>
        </div>
        <div style="position:relative; width:290px; height:230px; margin:0 auto; background:var(--secondary-bg); border:1px solid var(--border-color); border-radius:12px; overflow:hidden;">${board}</div>
        <div style="display:flex; justify-content:center; gap:4px; margin-top:12px; min-height:38px;">
            ${Array.from({ length: 7 }, (_, i) => spTray[i] || '').map(k => k
                ? `<div style="width:34px; height:34px; display:flex; align-items:center; justify-content:center; font-size:19px; background:var(--primary-bg); border:1px solid var(--border-color); border-radius:8px;">${k}</div>`
                : `<div style="width:34px; height:34px; border:1px dashed var(--border-color); border-radius:8px;"></div>`).join('')}
        </div>
        <div style="text-align:center; margin-top:10px;">
            ${endText ? `<div style="font-size:15px; font-weight:800; color:var(--accent-color); margin-bottom:10px;">${endText}</div>${mgBtn('🔄 再来一局', 'spInit()')}`
                : `${mgBtn(`🔀 洗牌 (${spShuffles})`, 'spShuffle()', false)} ${mgBtn('🔄 重开', 'spInit()', false)}`}
        </div>
        <div style="font-size:11px; color:var(--text-secondary); text-align:center; margin-top:6px;">通关次数：${gpData.sheepWins}</div>`;
}

/* ==================== 游戏五：双人扫雷 ==================== */
const MINE_ROWS = 8, MINE_COLS = 8, MINE_COUNT = 10;
let mineBoard = [], mineRevealed = [], mineFlagged = [], mineTurn = 'me', mineOver = false, mineMeCount = 0, mineTaCount = 0;
function gpOpenMine() { gpLoadData(); mineInit(); }
function mineInit() {
    mineBoard = []; mineRevealed = []; mineFlagged = [];
    for (let r = 0; r < MINE_ROWS; r++) {
        mineBoard[r] = []; mineRevealed[r] = []; mineFlagged[r] = [];
        for (let c = 0; c < MINE_COLS; c++) { mineBoard[r][c] = 0; mineRevealed[r][c] = false; mineFlagged[r][c] = false; }
    }
    let placed = 0;
    while (placed < MINE_COUNT) {
        const r = Math.floor(Math.random() * MINE_ROWS), c = Math.floor(Math.random() * MINE_COLS);
        if (mineBoard[r][c] === -1) continue;
        mineBoard[r][c] = -1; placed++;
    }
    for (let r = 0; r < MINE_ROWS; r++) for (let c = 0; c < MINE_COLS; c++) {
        if (mineBoard[r][c] === -1) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MINE_ROWS && nc >= 0 && nc < MINE_COLS && mineBoard[nr][nc] === -1) n++;
        }
        mineBoard[r][c] = n;
    }
    mineTurn = 'me'; mineOver = false; mineMeCount = 0; mineTaCount = 0;
    mineRender();
}
function mineReveal(r, c) {
    if (mineOver || mineRevealed[r][c] || mineFlagged[r][c]) return;
    mineRevealed[r][c] = true;
    if (mineBoard[r][c] === -1) {
        mineOver = true;
        gpData.mineWins++; gpSave();
        mineRender('💥 踩到雷了！' + gpName() + ' 获胜');
        return;
    }
    if (mineTurn === 'me') mineMeCount++; else mineTaCount++;
    if (mineBoard[r][c] === 0) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MINE_ROWS && nc >= 0 && nc < MINE_COLS && !mineRevealed[nr][nc]) mineReveal(nr, nc);
        }
    }
    // 胜负判定：所有非雷都揭开
    let safe = 0;
    for (let rr = 0; rr < MINE_ROWS; rr++) for (let cc = 0; cc < MINE_COLS; cc++) if (mineBoard[rr][cc] !== -1 && mineRevealed[rr][cc]) safe++;
    if (safe === MINE_ROWS * MINE_COLS - MINE_COUNT) {
        mineOver = true;
        const winner = mineMeCount >= mineTaCount ? '你' : gpName();
        if (mineMeCount >= mineTaCount) gpData.mineWins++; gpSave();
        mineRender('🎉 全部安全！' + winner + ' 揭开更多格子获胜');
        return;
    }
    mineTurn = mineTurn === 'me' ? 'ta' : 'me';
    if (mineTurn === 'ta' && !mineOver) setTimeout(mineAITurn, 600);
    mineRender();
}
function mineAITurn() {
    if (mineOver) return;
    const hidden = [];
    for (let r = 0; r < MINE_ROWS; r++) for (let c = 0; c < MINE_COLS; c++) if (!mineRevealed[r][c] && !mineFlagged[r][c]) hidden.push([r, c]);
    if (!hidden.length) return;
    // 优先点已知安全格（数字=周围已揭开数），否则随机
    for (const [r, c] of hidden) {
        let risky = false;
        for (let dr = -1; dr <= 1 && !risky; dr++) for (let dc = -1; dc <= 1 && !risky; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MINE_ROWS && nc >= 0 && nc < MINE_COLS && mineRevealed[nr][nc] && mineBoard[nr][nc] > 0) {
                let hiddenN = 0;
                for (let dr2 = -1; dr2 <= 1; dr2++) for (let dc2 = -1; dc2 <= 1; dc2++) {
                    const nr2 = nr + dr2, nc2 = nc + dc2;
                    if (nr2 >= 0 && nr2 < MINE_ROWS && nc2 >= 0 && nc2 < MINE_COLS && !mineRevealed[nr2][nc2]) hiddenN++;
                }
                if (hiddenN === mineBoard[nr][nc]) { risky = true; break; }
            }
        }
        if (!risky) { mineReveal(r, c); return; }
    }
    const [r, c] = hidden[Math.floor(Math.random() * hidden.length)];
    mineReveal(r, c);
}
window.mineCell = function (r, c) { if (mineTurn === 'me' && !mineOver) mineReveal(r, c); };
function mineRender(endText) {
    const wrap = document.getElementById('mg-view-mine');
    if (!wrap) return;
    const cells = [];
    for (let r = 0; r < MINE_ROWS; r++) for (let c = 0; c < MINE_COLS; c++) {
        const rev = mineRevealed[r][c];
        const v = mineBoard[r][c];
        let txt = '', bg = 'var(--secondary-bg)';
        if (rev) {
            if (v === -1) { txt = '💣'; bg = '#ffcccc'; }
            else if (v > 0) { txt = v; bg = '#e8f5e9'; }
            else { bg = '#e0e0e0'; }
        } else {
            txt = mineFlagged[r][c] ? '🚩' : '';
            bg = mineTurn === 'me' ? '#bbdefb' : '#ffe0b2';
        }
        cells.push(`<button onclick="mineCell(${r},${c})" style="width:32px;height:32px;font-size:16px;font-weight:700;border:1px solid var(--border-color);border-radius:4px;background:${bg};color:${v === 1 ? '#1976d2' : v === 2 ? '#388e3c' : v >= 3 ? '#d32f2f' : 'var(--text-primary)'};cursor:pointer;">${txt}</button>`);
    }
    wrap.innerHTML = mgHeader('💣 双人扫雷') + `
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;text-align:center;">轮流揭开格子 · 踩到雷的人输 · 安全格多者胜</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;">
            <span>你：${mineMeCount}</span><span style="color:var(--accent-color);">${mineOver ? '结束' : (mineTurn === 'me' ? '你的回合' : gpName() + ' 回合')}</span><span>${gpName()}：${mineTaCount}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(${MINE_COLS},32px);gap:3px;justify-content:center;">${cells.join('')}</div>
        <div style="text-align:center;margin-top:12px;">${endText ? `<div style="font-size:14px;font-weight:700;color:var(--accent-color);margin-bottom:8px;">${endText}</div>` : ''}${mgBtn('🔄 重开', 'mineInit()', false)}</div>`;
}

/* ==================== 游戏六：打地砖 ==================== */
let tileBoard = [], tileScore = 0, tileCombo = 0, tileLeft = 0;
let tileTaScore = 0, tileTurn = 'me';
function gpOpenTile() { gpLoadData(); tileInit(); }
function tileInit() {
    tileBoard = []; tileScore = 0; tileCombo = 0; tileLeft = 0; tileTaScore = 0; tileTurn = 'me';
    for (let r = 0; r < 5; r++) {
        tileBoard[r] = [];
        for (let c = 0; c < 7; c++) {
            const hp = Math.floor(Math.random() * 3) + 1;
            tileBoard[r][c] = hp; tileLeft += hp;
        }
    }
    tileRender();
}
// AI 回合：敲一块砖
function tileAIMove() {
    if (tileLeft <= 0) return;
    const targets = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) if (tileBoard[r][c] > 0) targets.push([r, c]);
    if (!targets.length) { tileTurn = 'me'; tileRender(); return; }
    const [r, c] = targets[Math.floor(Math.random() * targets.length)];
    tileBoard[r][c]--; tileLeft--;
    const gain = 10 + Math.floor(Math.random() * 20);
    tileTaScore += gain + (tileBoard[r][c] === 0 ? 20 : 0);
    if (tileLeft === 0) {
        if (tileScore > (gpData.tileBest || 0)) { gpData.tileBest = tileScore; gpSave(); }
        const win = tileScore >= tileTaScore;
        if (win) gpData.tileWins = (gpData.tileWins || 0) + 1; gpSave();
        tileRender(`全部打碎！你 ${tileScore} : ${tileTaScore} ${gpName()} ${win ? '🎉 你赢了！' : '😢 Ta 赢了'}`);
        try { pgChat('partner', win ? '你手速好快…再来！🧱' : '哈哈我敲得比你快～不服来战 🧱'); } catch (e) {}
        return;
    }
    tileTurn = 'me';
    tileRender();
}
function tileHit(r, c) {
    if (tileLeft <= 0 || tileTurn !== 'me') return;
    if (tileBoard[r][c] <= 0) return;
    tileBoard[r][c]--; tileLeft--; tileCombo++;
    const gain = 10 + tileCombo * 2;
    tileScore += gain;
    if (tileBoard[r][c] === 0) tileScore += 20;
    if (tileLeft === 0) {
        if (tileScore > (gpData.tileBest || 0)) { gpData.tileBest = tileScore; gpSave(); }
        const win = tileScore >= tileTaScore;
        if (win) gpData.tileWins = (gpData.tileWins || 0) + 1; gpSave();
        tileRender(`全部打碎！你 ${tileScore} : ${tileTaScore} ${gpName()} ${win ? '🎉 你赢了！' : '😢 Ta 赢了'}`);
        return;
    }
    tileTurn = 'ta';
    tileRender();
    setTimeout(tileAIMove, 400);
}
window.tileHit = tileHit;
function tileRender(endText) {
    const wrap = document.getElementById('mg-view-tile');
    if (!wrap) return;
    const colors = ['#fca5a5', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4'];
    const cells = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
        const hp = tileBoard[r][c];
        cells.push(`<button onclick="tileHit(${r},${c})" style="width:40px;height:40px;font-size:18px;font-weight:700;border-radius:8px;border:2px solid rgba(0,0,0,.15);background:${hp > 0 ? colors[(r + c) % colors.length] : '#eee'};cursor:${hp > 0 ? 'pointer' : 'default'};color:#333;">${hp > 0 ? hp : '✓'}</button>`);
    }
    wrap.innerHTML = mgHeader('🧱 打地砖') + `
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;">
            <span>你：<b style="color:var(--accent-color);">${tileScore}</b></span><span>连击：<b style="color:var(--accent-color);">${tileCombo}</b></span><span>剩余：<b>${tileLeft}</b></span><span>${gpName()}：<b id="tile-ta-score" style="color:#ff6b6b;">${tileTaScore}</b></span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,40px);gap:5px;justify-content:center;">${cells.join('')}</div>
        <div style="text-align:center;margin-top:12px;">${endText ? `<div style="font-size:14px;font-weight:700;color:var(--accent-color);margin-bottom:8px;">${endText}</div>` : ''}${mgBtn('🔄 重开', 'tileInit()', false)}</div>
        <div style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:6px;">最高：${gpData.tileBest || 0}</div>`;
}

/* ==================== 游戏七：Pong 乒乓 ==================== */
let pongCanvas = null, pongCtx = null, pongAnim = null;
let pongY = 140, pongTaY = 140, pongBallX = 200, pongBallY = 150, pongVX = 4, pongVY = 3, pongMyScore = 0, pongTaScore = 0, pongOver = false;
function gpOpenPong() { gpLoadData(); pongInit(); }
function pongInit() {
    pongMyScore = 0; pongTaScore = 0; pongOver = false;
    pongResetBall(1);
    pongRender();
    pongStartLoop();
}
function pongResetBall(dir) {
    pongBallX = 200; pongBallY = 150;
    pongVX = 4 * dir; pongVY = (Math.random() * 4 - 2);
}
function pongStartLoop() {
    if (pongAnim) cancelAnimationFrame(pongAnim);
    const loop = () => {
        if (pongOver) return;
        // 玩家挡板跟随鼠标/触摸
        // AI 挡板
        if (pongBallX > 200) pongTaY += (pongBallY - (pongTaY + 30)) * 0.08;
        pongTaY = Math.max(0, Math.min(240, pongTaY));
        // 球移动
        pongBallX += pongVX; pongBallY += pongVY;
        if (pongBallY < 6 || pongBallY > 294) pongVY *= -1;
        // 玩家挡板碰撞
        if (pongBallX < 20 && pongBallY > pongY && pongBallY < pongY + 60) { pongVX = Math.abs(pongVX) * 1.05; pongVY += (pongBallY - (pongY + 30)) * 0.1; }
        // AI 挡板碰撞
        if (pongBallX > 380 && pongBallY > pongTaY && pongBallY < pongTaY + 60) { pongVX = -Math.abs(pongVX) * 1.05; pongVY += (pongBallY - (pongTaY + 30)) * 0.1; }
        // 出界
        if (pongBallX < 0) { pongTaScore++; pongResetBall(1); }
        if (pongBallX > 400) { pongMyScore++; pongResetBall(-1); }
        if (pongMyScore >= 7 || pongTaScore >= 7) {
            pongOver = true;
            if (pongMyScore > pongTaScore) gpData.pongWins++;
            gpSave();
            pongRender(pongMyScore > pongTaScore ? '🎉 你赢了！' : '😢 ' + gpName() + ' 赢了');
            return;
        }
        pongRender();
        pongAnim = requestAnimationFrame(loop);
    };
    pongAnim = requestAnimationFrame(loop);
}
window.pongMove = function (y) { pongY = Math.max(0, Math.min(240, y - 30)); };
function pongRender(endText) {
    let wrap = document.getElementById('mg-view-pong');
    if (!wrap) return;
    wrap.innerHTML = mgHeader('🏓 Pong 乒乓') + `
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-bottom:8px;">
            <span>你：${pongMyScore}</span><span>${gpName()}：${pongTaScore}</span>
        </div>
        <canvas id="pong-canvas" width="400" height="300" style="width:100%;max-width:400px;background:#1a1a2e;border-radius:10px;display:block;margin:0 auto;touch-action:none;"></canvas>
        <div style="text-align:center;margin-top:8px;font-size:11px;color:var(--text-secondary);">移动鼠标或手指控制左侧挡板 · 先到 7 分胜</div>
        <div style="text-align:center;margin-top:8px;">${endText ? `<div style="font-size:14px;font-weight:700;color:var(--accent-color);margin-bottom:8px;">${endText}</div>` : ''}${mgBtn('🔄 重开', 'pongInit()', false)}</div>`;
    pongCanvas = document.getElementById('pong-canvas');
    if (pongCanvas) {
        pongCtx = pongCanvas.getContext('2d');
        const move = (e) => {
            const rect = pongCanvas.getBoundingClientRect();
            const y = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * (300 / rect.height);
            pongY = Math.max(0, Math.min(240, y - 30));
        };
        pongCanvas.addEventListener('mousemove', move);
        pongCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); }, { passive: false });
        pongDraw();
    }
}
function pongDraw() {
    if (!pongCtx) return;
    const ctx = pongCtx;
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, 400, 300);
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(200, 0); ctx.lineTo(200, 300); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.fillRect(8, pongY, 8, 60);
    ctx.fillRect(384, pongTaY, 8, 60);
    ctx.beginPath(); ctx.arc(pongBallX, pongBallY, 6, 0, Math.PI * 2); ctx.fill();
}

/* ==================== 游戏八：钓鱼（双人同时垂钓 + 渔获互赠） ==================== */
const FISH_SPECIES = [
    { name: '小鲫鱼', emoji: '🐟', rare: 1, score: 10 },
    { name: '鲤鱼', emoji: '🐠', rare: 2, score: 25 },
    { name: '金鱼', emoji: '🐡', rare: 3, score: 50 },
    { name: '章鱼', emoji: '🐙', rare: 4, score: 80 },
    { name: '鲨鱼', emoji: '🦈', rare: 5, score: 150 },
    { name: '金龙', emoji: '🐉', rare: 6, score: 300 }
];
let fishState = 'idle', fishTimer = null, fishCatch = null, fishScore = 0;
let fishTaScore = 0, fishAITimer = null, fishGameTimer = null, fishTimeLeft = 60;
let fishBag = {}, fishTaBag = {};   // 本次渔获 {鱼名: {emoji, count}}
function gpOpenFish() { gpLoadData(); fishInit(); }
function fishRand() {
    const pool = [];
    FISH_SPECIES.forEach(f => { for (let i = 0; i < (7 - f.rare); i++) pool.push(f); });
    return pool[Math.floor(Math.random() * pool.length)];
}
function fishBagAdd(bag, f) {
    if (!bag[f.name]) bag[f.name] = { emoji: f.emoji, count: 0 };
    bag[f.name].count++;
}
function fishInit() {
    fishState = 'idle'; fishCatch = null; fishScore = 0; fishTaScore = 0; fishTimeLeft = 60;
    fishBag = {}; fishTaBag = {};
    if (fishTimer) { clearTimeout(fishTimer); fishTimer = null; }
    if (fishAITimer) { clearInterval(fishAITimer); fishAITimer = null; }
    if (fishGameTimer) { clearInterval(fishGameTimer); fishGameTimer = null; }
    fishRender();
    // 对方和我同时钓鱼：每 2.5 秒钓一次（有失手概率）
    fishAITimer = setInterval(() => {
        if (fishTimeLeft <= 0) return;
        if (Math.random() < 0.78) {
            const f = fishRand();
            fishTaScore += f.score;
            fishBagAdd(fishTaBag, f);
            // 15% 概率把刚钓到的鱼送给我
            if (Math.random() < 0.15) fishTaGiftFish(f);
        }
        fishUpdateTaSide();
    }, 2500);
    // 60 秒倒计时
    fishGameTimer = setInterval(() => {
        fishTimeLeft--;
        const el = document.getElementById('fish-time'); if (el) el.textContent = fishTimeLeft + 's';
        if (fishTimeLeft <= 0) fishEnd();
    }, 1000);
}
/* 只刷新对方侧（避免整页重绘打断我收竿） */
function fishUpdateTaSide() {
    const s = document.getElementById('fish-ta-score'); if (s) s.textContent = fishTaScore;
    const bag = document.getElementById('fish-ta-bag');
    if (bag) bag.innerHTML = fishBagHtml(fishTaBag, false);
}
function fishBagHtml(bag, mine) {
    const names = Object.keys(bag);
    if (!names.length) return '<span style="font-size:11px;color:var(--text-secondary);">还没有渔获</span>';
    return names.map(n => {
        const it = bag[n];
        const giftBtn = mine ? `<button onclick="fishGift('${n}')" title="送给Ta" style="border:none;background:var(--secondary-bg);border-radius:6px;cursor:pointer;font-size:11px;padding:2px 6px;color:var(--accent-color);">🎁送</button>` : '';
        return `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--secondary-bg);border-radius:8px;padding:3px 8px;font-size:12px;">${it.emoji} ${n} ×${it.count} ${giftBtn}</span>`;
    }).join(' ');
}
/* 把我的渔获送给对方 */
window.fishGift = function(name) {
    const item = fishBag[name];
    if (!item || item.count <= 0) return;
    item.count--;
    if (item.count <= 0) delete fishBag[name];
    gpData.fishGifts = gpData.fishGifts || [];
    gpData.fishGifts.unshift({ name, emoji: item.emoji, dir: 'me2ta', time: Date.now() });
    if (gpData.fishGifts.length > 20) gpData.fishGifts.length = 20;
    gpSave();
    try { pgChat('partner', `哇！你把钓到的${item.emoji}${name}送给我啦，晚上加餐！谢谢亲爱的～ 🐟❤️`); } catch (e) {}
    try { if (typeof playSound === 'function') playSound('favorite'); } catch (e) {}
    try { showNotification(`已把${item.emoji}${name}送给${gpName()}`, 'success'); } catch (e) {}
    fishRender();
};
/* 对方送鱼给我 */
function fishTaGiftFish(f) {
    gpData.fishGifts = gpData.fishGifts || [];
    gpData.fishGifts.unshift({ name: f.name, emoji: f.emoji, dir: 'ta2me', time: Date.now() });
    if (gpData.fishGifts.length > 20) gpData.fishGifts.length = 20;
    gpSave();
    try { pgChat('partner', `这条${f.emoji}${f.name}个子好看，送给你啦～ 🎁`); } catch (e) {}
    try { showNotification(`${gpName()} 送了你一条${f.emoji}${f.name} 🎁`, 'success', 4000); } catch (e) {}
}
function fishEnd() {
    if (fishGameTimer) { clearInterval(fishGameTimer); fishGameTimer = null; }
    if (fishAITimer) { clearInterval(fishAITimer); fishAITimer = null; }
    if (fishTimer) { clearTimeout(fishTimer); fishTimer = null; }
    const win = fishScore >= fishTaScore;
    if (win) gpData.fishWins = (gpData.fishWins || 0) + 1; gpSave();
    fishState = 'end';
    fishRender(`时间到！你 ${fishScore} : ${fishTaScore} ${gpName()} ${win ? '🎉 你赢了！' : '😢 Ta 赢了'}`);
    try { pgChat('partner', win ? '你钓鱼比我厉害…这些鱼分你一半～🎣' : '哈哈我钓得比你多～送你两条补补 🎣'); } catch (e) {}
}
function fishCast() {
    if (fishState !== 'idle') return;
    fishState = 'waiting';
    fishRender();
    const wait = 1500 + Math.random() * 3500;
    fishTimer = setTimeout(() => {
        fishCatch = fishRand();
        fishState = 'bite';
        fishRender();
        fishTimer = setTimeout(() => {
            if (fishState === 'bite') { fishState = 'escaped'; fishRender(); setTimeout(() => { if (fishState === 'escaped') { fishState = 'idle'; fishRender(); } }, 1200); }
        }, 1800);
    }, wait);
}
function fishReel() {
    if (fishState === 'bite') {
        if (fishTimer) clearTimeout(fishTimer);
        fishScore += fishCatch.score;
        fishBagAdd(fishBag, fishCatch);
        gpData.fishCaught = (gpData.fishCaught || 0) + 1;
        gpSave();
        fishState = 'caught';
        fishRender();
        setTimeout(() => { if (fishState === 'caught') { fishState = 'idle'; fishRender(); } }, 1500);
    } else if (fishState === 'waiting') {
        if (fishTimer) clearTimeout(fishTimer);
        fishState = 'idle'; fishRender();
    }
}
window.fishCast = fishCast;
window.fishReel = fishReel;
function fishRender(endMsg) {
    const wrap = document.getElementById('mg-view-fish');
    if (!wrap) return;
    let msg = '', btn = '';
    if (fishState === 'idle') { msg = '湖面平静，抛竿试试？（Ta 也在钓哦）'; btn = mgBtn('🎣 抛竿', 'fishCast()'); }
    else if (fishState === 'waiting') { msg = '⏳ 等待鱼儿上钩…'; btn = mgBtn('收竿(太早)', 'fishReel()', false); }
    else if (fishState === 'bite') { msg = '❗❗ 有鱼咬钩了！快收竿！'; btn = mgBtn('🎯 收竿！', 'fishReel()'); }
    else if (fishState === 'caught') { msg = `🎉 钓到了 ${fishCatch.emoji} ${fishCatch.name}！+${fishCatch.score}`; }
    else if (fishState === 'escaped') { msg = '😢 鱼跑了…'; }
    const gifts = gpData.fishGifts || [];
    wrap.innerHTML = mgHeader('🎣 钓鱼') + `
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;">
            <span>你：<b style="color:var(--accent-color);">${fishScore}</b></span>
            <span>时间：<b id="fish-time">${fishTimeLeft}s</b></span>
            <span>${gpName()}：<b id="fish-ta-score" style="color:#ff6b6b;">${fishTaScore}</b></span>
        </div>
        <div style="background:linear-gradient(180deg,#87ceeb,#4a90d9);border-radius:12px;padding:30px;text-align:center;margin-bottom:12px;">
            <div style="font-size:60px;">${fishState === 'caught' ? fishCatch.emoji : fishState === 'bite' ? '❗' : '🎣'}</div>
            <div style="color:#fff;font-size:14px;font-weight:600;margin-top:8px;">${endMsg || msg}</div>
        </div>
        <div style="margin-bottom:10px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:5px;">🎒 我的渔获 <span style="font-size:10px;color:var(--text-secondary);">（点 🎁 送给 Ta）</span></div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">${fishBagHtml(fishBag, true)}</div>
        </div>
        <div style="margin-bottom:10px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:5px;">🧺 ${gpName()} 的渔获</div>
            <div id="fish-ta-bag" style="display:flex;flex-wrap:wrap;gap:5px;">${fishBagHtml(fishTaBag, false)}</div>
        </div>
        ${gifts.length ? `<div style="margin-bottom:10px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:5px;">🎁 互赠记录</div>
            <div style="font-size:11px;color:var(--text-secondary);line-height:1.8;">${gifts.slice(0, 6).map(g => `${g.dir === 'me2ta' ? '我→Ta' : 'Ta→我'}：${g.emoji}${g.name}`).join(' · ')}</div>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:12px;">
            <span>累计钓鱼：<b>${gpData.fishCaught || 0}</b> 条</span>
        </div>
        <div style="text-align:center;">${btn} ${fishState !== 'idle' || endMsg ? mgBtn('🔄 重开', 'fishInit()', false) : ''}</div>
        <div style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px;">鱼上钩后要在 1.8 秒内点击「收竿」· 60 秒内和 ${gpName()} 同时垂钓比拼，钓到的鱼可以互相赠送 🎁</div>`;
}
