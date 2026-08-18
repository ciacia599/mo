/* ============================================================
 * xiangqi.js — 中国象棋（自包含模块）
 * 依赖全局：localforage, getStorageKey, showNotification, playSound,
 *           showModal, hideModal, settings
 * 暴露：window.openXiangqi, window.initXiangqi
 * 引入方式：在 index.html 中添加一行：
 *   <script src="js/features/xiangqi.js"></script>
 * 接入游戏中心：在游戏中心卡片 onclick 调用 openXiangqi()
 * ============================================================ */

/* ======================== 数据与存储层 ======================== */

// 持久化数据（胜场记录）
let xqData = { wins: 0, losses: 0 };
let xqDataLoaded = false;

// 懒加载数据：openXiangqi 内部调用，确保即使 initXiangqi 未被调用也能工作
async function xqLoadData() {
    if (xqDataLoaded) return;
    try {
        // 优先使用 localforage + getStorageKey（依赖 SESSION_ID）
        const key = getStorageKey('xiangqiData');
        const saved = await localforage.getItem(key);
        if (saved && typeof saved === 'object') {
            xqData = Object.assign({}, xqData, saved);
        }
    } catch (e) {
        // SESSION_ID 未初始化等异常 → 降级用 localStorage
        try {
            const raw = localStorage.getItem('xiangqi_' + 'xiangqiData');
            if (raw) xqData = Object.assign({}, xqData, JSON.parse(raw));
        } catch (e2) { /* 静默失败 */ }
    }
    xqDataLoaded = true;
}

function xqSaveData() {
    try {
        localforage.setItem(getStorageKey('xiangqiData'), xqData);
    } catch (e) {
        try {
            localStorage.setItem('xiangqi_' + 'xiangqiData', JSON.stringify(xqData));
        } catch (e2) { /* 静默失败 */ }
    }
}

/* ======================== 棋盘常量与初始化 ======================== */

// 9 列 × 10 行；棋子放在交叉点
// 行 0-4 为黑方区域（上方），行 5-9 为红方区域（下方），楚河汉界在第 4、5 行之间
// 棋子类型：K 帅/将，A 仕/士，B 相/象，N 马，R 车，C 炮，P 兵/卒
// 颜色：'r' 红（玩家，下方，先手），'b' 黑（AI，上方）

const XQ_CHAR = {
    r: { K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵' },
    b: { K: '将', A: '士', B: '象', N: '马', R: '车', C: '炮', P: '卒' }
};

// 棋子价值表（用于 AI 评估）
const XQ_VALUE = { K: 10000, R: 9, N: 4, C: 4.5, A: 2, B: 2, P: 1 };

// 画布尺寸（CSS 像素，会按容器宽度等比缩放）
const XQ_CELL = 38;          // 单元格边长
const XQ_PAD = 22;           // 棋盘四周留白
const XQ_CANVAS_W = 8 * XQ_CELL + 2 * XQ_PAD; // 8 个间隔 + 双边留白
const XQ_CANVAS_H = 9 * XQ_CELL + 2 * XQ_PAD; // 9 个间隔 + 双边留白

// 运行时状态
let xqBoard = null;          // 10×9 二维数组，元素为 null 或 {t:类型, c:颜色}
let xqTurn = 'r';            // 当前轮到哪方
let xqSelected = null;       // 选中的己方棋子 [r,c]
let xqLegalTargets = [];     // 选中棋子的合法落子点
let xqHistory = [];          // 走子历史 {from,to,captured} 用于悔棋
let xqLastMove = null;       // 上一手 {from,to}，用于高亮
let xqGameOver = false;      // 是否结束
let xqResultText = '';       // 结束文案
let xqLocked = false;        // 锁定输入（动画/思考中）
let xqAnim = null;           // 当前移动动画 {from,to,piece,start,duration}
let xqActive = false;        // 模态框是否打开（防止关闭后异步回调误操作）

// DOM / Canvas 引用
let xqModal = null;
let xqCanvas = null;
let xqCtx = null;

// 初始棋盘布局
function xqInitialBoard() {
    const b = Array.from({ length: 10 }, () => Array(9).fill(null));
    const back = ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R'];
    // 黑方（上方）
    for (let c = 0; c < 9; c++) b[0][c] = { t: back[c], c: 'b' };
    b[2][1] = { t: 'C', c: 'b' }; b[2][7] = { t: 'C', c: 'b' };
    for (let c = 0; c < 9; c += 2) b[3][c] = { t: 'P', c: 'b' };
    // 红方（下方）
    for (let c = 0; c < 9; c++) b[9][c] = { t: back[c], c: 'r' };
    b[7][1] = { t: 'C', c: 'r' }; b[7][7] = { t: 'C', c: 'r' };
    for (let c = 0; c < 9; c += 2) b[6][c] = { t: 'P', c: 'r' };
    return b;
}

// 交叉点坐标 → 画布像素坐标
function xqXY(r, c) { return [XQ_PAD + c * XQ_CELL, XQ_PAD + r * XQ_CELL]; }

/* ======================== 走法生成（各棋子规则） ======================== */

// 生成单枚棋子的伪合法走法（不含"走完是否被将军"过滤）
function xqGenPseudoMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const moves = [];
    const color = piece.c;
    const enemy = color === 'r' ? 'b' : 'r';
    const inBoard = (nr, nc) => nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8;

    switch (piece.t) {
        case 'K': {
            // 帅/将：九宫内一步直行
            const palR = color === 'r' ? [7, 9] : [0, 2];
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;
                if (nr >= palR[0] && nr <= palR[1] && nc >= 3 && nc <= 5) {
                    const t = board[nr][nc];
                    if (!t || t.c === enemy) moves.push([nr, nc]);
                }
            }
            break;
        }
        case 'A': {
            // 仕/士：九宫内一步斜行
            const palR = color === 'r' ? [7, 9] : [0, 2];
            const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;
                if (nr >= palR[0] && nr <= palR[1] && nc >= 3 && nc <= 5) {
                    const t = board[nr][nc];
                    if (!t || t.c === enemy) moves.push([nr, nc]);
                }
            }
            break;
        }
        case 'B': {
            // 相/象：田字步，不过河，蹩腿判否
            const dirs = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;
                if (!inBoard(nr, nc)) continue;
                // 不能过河
                if (color === 'r' && nr < 5) continue;
                if (color === 'b' && nr > 4) continue;
                // 蹩象腿：田字中心有子则不能走
                const mr = r + dr / 2, mc = c + dc / 2;
                if (board[mr][mc]) continue;
                const t = board[nr][nc];
                if (!t || t.c === enemy) moves.push([nr, nc]);
            }
            break;
        }
        case 'N': {
            // 马：日字步，蹩马腿判否
            // [dr, dc, 腿dr, 腿dc]
            const candidates = [
                [-2, -1, -1, 0], [-2, 1, -1, 0],
                [2, -1, 1, 0], [2, 1, 1, 0],
                [-1, -2, 0, -1], [1, -2, 0, -1],
                [-1, 2, 0, 1], [1, 2, 0, 1]
            ];
            for (const [dr, dc, lr, lc] of candidates) {
                const nr = r + dr, nc = c + dc;
                if (!inBoard(nr, nc)) continue;
                if (board[r + lr][c + lc]) continue; // 蹩马腿
                const t = board[nr][nc];
                if (!t || t.c === enemy) moves.push([nr, nc]);
            }
            break;
        }
        case 'R': {
            // 车：直线任意距离，不能越子
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dr, dc] of dirs) {
                let nr = r + dr, nc = c + dc;
                while (inBoard(nr, nc)) {
                    const t = board[nr][nc];
                    if (!t) { moves.push([nr, nc]); }
                    else { if (t.c === enemy) moves.push([nr, nc]); break; }
                    nr += dr; nc += dc;
                }
            }
            break;
        }
        case 'C': {
            // 炮：直线移动同车；吃子需隔且仅隔一子（炮架）
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dr, dc] of dirs) {
                let nr = r + dr, nc = c + dc;
                // 阶段一：空格可直接移动
                while (inBoard(nr, nc) && !board[nr][nc]) {
                    moves.push([nr, nc]);
                    nr += dr; nc += dc;
                }
                // 遇到炮架，跨过寻找目标
                if (inBoard(nr, nc)) {
                    nr += dr; nc += dc;
                    while (inBoard(nr, nc)) {
                        const t = board[nr][nc];
                        if (t) { if (t.c === enemy) moves.push([nr, nc]); break; }
                        nr += dr; nc += dc;
                    }
                }
            }
            break;
        }
        case 'P': {
            // 兵/卒：过河前只能前进，过河后可左右
            const forward = color === 'r' ? -1 : 1;
            const crossed = color === 'r' ? r <= 4 : r >= 5;
            const fr = r + forward;
            if (fr >= 0 && fr <= 9) {
                const t = board[fr][c];
                if (!t || t.c === enemy) moves.push([fr, c]);
            }
            if (crossed) {
                for (const dc of [-1, 1]) {
                    const nc = c + dc;
                    if (nc >= 0 && nc <= 8) {
                        const t = board[r][nc];
                        if (!t || t.c === enemy) moves.push([r, nc]);
                    }
                }
            }
            break;
        }
    }
    return moves;
}

/* ======================== 合法性 / 将军 / 飞将 ======================== */

function xqFindKing(board, color) {
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.t === 'K' && p.c === color) return [r, c];
    }
    return null;
}

// 飞将：两王同列且中间无子
function xqKingsFace(board) {
    const rk = xqFindKing(board, 'r');
    const bk = xqFindKing(board, 'b');
    if (!rk || !bk) return false;
    if (rk[1] !== bk[1]) return false;
    const col = rk[1];
    const r1 = Math.min(rk[0], bk[0]), r2 = Math.max(rk[0], bk[0]);
    for (let r = r1 + 1; r < r2; r++) if (board[r][col]) return false;
    return true;
}

// `color` 方是否被将军（含飞将）
function xqIsInCheck(board, color) {
    if (xqKingsFace(board)) return true;
    const king = xqFindKing(board, color);
    if (!king) return true; // 将/帅已被吃
    const enemy = color === 'r' ? 'b' : 'r';
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.c === enemy) {
            const ms = xqGenPseudoMoves(board, r, c);
            for (const [nr, nc] of ms) {
                if (nr === king[0] && nc === king[1]) return true;
            }
        }
    }
    return false;
}

// 走子后自身是否安全（不被将军、不暴露飞将）
function xqIsLegalMove(board, from, to) {
    const piece = board[from[0]][from[1]];
    const captured = board[to[0]][to[1]];
    board[to[0]][to[1]] = piece;
    board[from[0]][from[1]] = null;
    const inCheck = xqIsInCheck(board, piece.c);
    // 还原
    board[from[0]][from[1]] = piece;
    board[to[0]][to[1]] = captured;
    return !inCheck;
}

// 指定棋子的合法走法（已过滤自伤）
function xqLegalMovesFor(pos) {
    const [r, c] = pos;
    const ms = xqGenPseudoMoves(xqBoard, r, c);
    return ms.filter(([nr, nc]) => xqIsLegalMove(xqBoard, [r, c], [nr, nc]));
}

// 某方全部合法走法
function xqAllLegalMoves(board, color) {
    const all = [];
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.c === color) {
            const ms = xqGenPseudoMoves(board, r, c);
            for (const [nr, nc] of ms) {
                if (xqIsLegalMove(board, [r, c], [nr, nc])) {
                    all.push({ from: [r, c], to: [nr, nc] });
                }
            }
        }
    }
    return all;
}

// (r,c) 是否被 byColor 方攻击（用于 AI 判断挂子）
function xqIsAttacked(board, r, c, byColor) {
    for (let rr = 0; rr < 10; rr++) for (let cc = 0; cc < 9; cc++) {
        const p = board[rr][cc];
        if (p && p.c === byColor) {
            const ms = xqGenPseudoMoves(board, rr, cc);
            for (const [nr, nc] of ms) if (nr === r && nc === c) return true;
        }
    }
    return false;
}

/* ======================== AI（简单评估 + 防挂子 + 随机化） ======================== */

// 子力评估（color 视角）
function xqEvaluate(board, color) {
    let score = 0;
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p) score += (p.c === color ? XQ_VALUE[p.t] : -XQ_VALUE[p.t]);
    }
    return score;
}

function xqAIMove() {
    if (!xqActive) return;
    const moves = xqAllLegalMoves(xqBoard, 'b');
    if (moves.length === 0) {
        // 黑方无路可走 → 黑方负
        xqEndGame('r');
        return;
    }
    let best = -Infinity;
    const scored = [];
    for (const m of moves) {
        const cap = xqBoard[m.to[0]][m.to[1]];
        const gain = cap ? XQ_VALUE[cap.t] : 0;
        const movingPiece = xqBoard[m.from[0]][m.from[1]];
        // 试走
        xqBoard[m.to[0]][m.to[1]] = movingPiece;
        xqBoard[m.from[0]][m.from[1]] = null;
        // 落子后是否被红方攻击（挂子风险）
        let risk = 0;
        if (xqIsAttacked(xqBoard, m.to[0], m.to[1], 'r')) risk = XQ_VALUE[movingPiece.t];
        // 是否将军红方
        const checkBonus = xqIsInCheck(xqBoard, 'r') ? 0.6 : 0;
        // 简单位置倾向：兵过河推进、马炮向中路靠拢
        let pos = 0;
        if (movingPiece.t === 'P') {
            pos += m.to[0] * 0.08;
            if (m.to[0] >= 5) pos += 0.4;
        }
        if (movingPiece.t === 'N' || movingPiece.t === 'C') {
            pos += (4 - Math.abs(m.to[1] - 4)) * 0.05;
        }
        const score = gain - risk * 0.9 + checkBonus + pos + xqEvaluate(xqBoard, 'b') * 0.04 + Math.random() * 0.4;
        // 还原
        xqBoard[m.from[0]][m.from[1]] = movingPiece;
        xqBoard[m.to[0]][m.to[1]] = cap;
        scored.push({ m, score });
        if (score > best) best = score;
    }
    // 在最高分附近随机挑一个，避免每局完全雷同
    const top = scored.filter(s => s.score >= best - 0.6);
    const pick = top[Math.floor(Math.random() * top.length)];
    xqApplyMove(pick.m.from, pick.m.to);
}

/* ======================== 走子 / 动画 / 回合 ======================== */

// 应用一步走子（带滑动动画）
function xqApplyMove(from, to) {
    xqLocked = true;
    const piece = xqBoard[from[0]][from[1]];
    xqAnim = { from, to, piece, start: performance.now(), duration: 220 };
    requestAnimationFrame(xqAnimTick);
}

function xqAnimTick() {
    if (!xqActive || document.hidden) { xqAnim = null; return; }
    xqDrawBoard();
    if (performance.now() - xqAnim.start < xqAnim.duration) {
        requestAnimationFrame(xqAnimTick);
    } else {
        xqCommitMove();
    }
}

// 动画结束后正式落子
function xqCommitMove() {
    const { from, to } = xqAnim;
    const captured = xqBoard[to[0]][to[1]];
    xqBoard[to[0]][to[1]] = xqBoard[from[0]][from[1]];
    xqBoard[from[0]][from[1]] = null;
    xqHistory.push({ from: [from[0], from[1]], to: [to[0], to[1]], captured });
    xqLastMove = { from: [from[0], from[1]], to: [to[0], to[1]] };
    xqAnim = null;
    xqTurn = (xqTurn === 'r') ? 'b' : 'r';
    xqSelected = null;
    xqLegalTargets = [];
    xqDrawBoard();
    xqUpdateStatus();
    if (xqAfterMove()) { xqLocked = true; return; } // 已结束
    if (xqTurn === 'b') {
        // 轮到 AI
        setTimeout(() => { if (xqActive) xqAIMove(); }, 280);
    } else {
        xqLocked = false; // 轮到玩家
    }
}

// 落子后判定结束 / 将军提示
function xqAfterMove() {
    const moves = xqAllLegalMoves(xqBoard, xqTurn);
    if (moves.length === 0) {
        // 无路可走判负（含将死与困毙）
        const winner = xqTurn === 'r' ? 'b' : 'r';
        xqEndGame(winner);
        return true;
    }
    if (xqIsInCheck(xqBoard, xqTurn)) {
        if (typeof playSound === 'function') playSound('message');
        if (typeof showNotification === 'function') showNotification('将军！', 'warning', 1100);
    }
    return false;
}

function xqEndGame(winner) {
    xqGameOver = true;
    xqLocked = true;
    if (winner === 'r') {
        xqData.wins = (xqData.wins || 0) + 1;
        xqResultText = '🎉 你赢了！';
        if (typeof playSound === 'function') playSound('message');
    } else {
        xqData.losses = (xqData.losses || 0) + 1;
        xqResultText = '你输了～再来一局吧';
    }
    xqSaveData();
    xqDrawBoard();
    xqUpdateStatus();
}

/* ======================== 玩家交互 ======================== */

function xqHandleClick(r, c) {
    if (xqLocked || xqGameOver || !xqActive) return;
    if (xqTurn !== 'r') return; // 不是玩家回合
    const piece = xqBoard[r][c];
    if (xqSelected) {
        // 落子？
        const hit = xqLegalTargets.some(t => t[0] === r && t[1] === c);
        if (hit) {
            xqApplyMove([xqSelected[0], xqSelected[1]], [r, c]);
            return;
        }
        // 改选另一枚己方棋子
        if (piece && piece.c === 'r') {
            xqSelected = [r, c];
            xqLegalTargets = xqLegalMovesFor([r, c]);
            xqDrawBoard();
            return;
        }
        // 取消选中
        xqSelected = null;
        xqLegalTargets = [];
        xqDrawBoard();
    } else {
        if (piece && piece.c === 'r') {
            xqSelected = [r, c];
            xqLegalTargets = xqLegalMovesFor([r, c]);
            xqDrawBoard();
        }
    }
}

function xqOnCanvasClick(e) {
    if (!xqCanvas || xqLocked || xqGameOver) return;
    const rect = xqCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * XQ_CANVAS_W;
    const y = (e.clientY - rect.top) / rect.height * XQ_CANVAS_H;
    const c = Math.round((x - XQ_PAD) / XQ_CELL);
    const r = Math.round((y - XQ_PAD) / XQ_CELL);
    if (r < 0 || r > 9 || c < 0 || c > 8) return;
    // 容差：点击需接近交叉点
    const [ix, iy] = xqXY(r, c);
    if (Math.hypot(x - ix, y - iy) > XQ_CELL * 0.5) return;
    xqHandleClick(r, c);
}

/* ======================== 绘制（Canvas） ======================== */

// 读取 CSS 变量，失败给回退值
function xqCss(name, fallback) {
    try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    } catch (e) { return fallback; }
}

function xqDrawPiece(ctx, x, y, p) {
    const rad = XQ_CELL * 0.42;
    // 投影
    ctx.beginPath();
    ctx.arc(x, y + 1.5, rad, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    // 棋子底色
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 2 * Math.PI);
    ctx.fillStyle = xqCss('--secondary-bg', '#efe2c4');
    ctx.fill();
    // 内圈与外圈（红/黑棋子使用固定颜色，其余走主题变量）
    const pieceColor = p.c === 'r' ? '#c0392b' : '#1a1a1a';
    ctx.strokeStyle = pieceColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, rad - 2.5, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 2 * Math.PI);
    ctx.stroke();
    // 文字
    ctx.fillStyle = pieceColor;
    ctx.font = 'bold ' + Math.round(rad * 1.15) + 'px "STKaiti","KaiTi","SimSun",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(XQ_CHAR[p.c][p.t], x, y + 1);
}

// 在交叉点画一圈高亮
function xqHighlightCell(ctx, r, c) {
    const [x, y] = xqXY(r, c);
    ctx.beginPath();
    ctx.arc(x, y, XQ_CELL * 0.48, 0, 2 * Math.PI);
    ctx.stroke();
}

// 交叉点的"兵卒/炮"角标
function xqDrawBracket(ctx, x, y, leftEdge, rightEdge) {
    const d = 4, len = 5;
    const corners = [
        { dx: -1, dy: -1, skip: leftEdge },
        { dx: 1, dy: -1, skip: rightEdge },
        { dx: -1, dy: 1, skip: leftEdge },
        { dx: 1, dy: 1, skip: rightEdge }
    ];
    for (const corn of corners) {
        if (corn.skip) continue;
        const bx = x + corn.dx * d, by = y + corn.dy * d;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - corn.dx * len, by);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by - corn.dy * len);
        ctx.stroke();
    }
}

function xqDrawBoard() {
    if (!xqCtx || !xqBoard) return;
    const ctx = xqCtx;
    const W = XQ_CANVAS_W, H = XQ_CANVAS_H;
    ctx.clearRect(0, 0, W, H);

    // 棋盘底
    ctx.fillStyle = xqCss('--primary-bg', '#f5ecd6');
    ctx.fillRect(0, 0, W, H);

    const lineCol = xqCss('--text-secondary', '#5a4a32');
    ctx.strokeStyle = lineCol;
    ctx.fillStyle = lineCol;
    ctx.lineWidth = 1;

    // 横线（10 条）
    for (let r = 0; r < 10; r++) {
        const [x1, y1] = xqXY(r, 0), [x2, y2] = xqXY(r, 8);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // 竖线：边线贯穿，中间各列被楚河汉界断开
    for (let c = 0; c < 9; c++) {
        if (c === 0 || c === 8) {
            const [x1, y1] = xqXY(0, c), [x2, y2] = xqXY(9, c);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        } else {
            const [x1, y1] = xqXY(0, c), [x2, y2] = xqXY(4, c);
            const [x3, y3] = xqXY(5, c), [x4, y4] = xqXY(9, c);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
        }
    }
    // 九宫斜线
    ctx.beginPath();
    ctx.moveTo(...xqXY(0, 3)); ctx.lineTo(...xqXY(2, 5));
    ctx.moveTo(...xqXY(0, 5)); ctx.lineTo(...xqXY(2, 3));
    ctx.moveTo(...xqXY(7, 3)); ctx.lineTo(...xqXY(9, 5));
    ctx.moveTo(...xqXY(7, 5)); ctx.lineTo(...xqXY(9, 3));
    ctx.stroke();

    // 楚河汉界
    ctx.font = 'bold 16px "STKaiti","KaiTi",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const midY = (xqXY(4, 0)[1] + xqXY(5, 0)[1]) / 2;
    ctx.fillText('楚  河', (xqXY(4, 1)[0] + xqXY(4, 3)[0]) / 2, midY);
    ctx.fillText('漢  界', (xqXY(4, 5)[0] + xqXY(4, 7)[0]) / 2, midY);

    // 兵卒/炮位角标
    const spots = [[2, 1], [2, 7], [7, 1], [7, 7],
                   [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
                   [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]];
    for (const [r, c] of spots) {
        const [x, y] = xqXY(r, c);
        xqDrawBracket(ctx, x, y, c === 0, c === 8);
    }

    const accent = xqCss('--accent-color', '#d28a00');

    // 上一手高亮
    if (xqLastMove) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        xqHighlightCell(ctx, xqLastMove.from[0], xqLastMove.from[1]);
        xqHighlightCell(ctx, xqLastMove.to[0], xqLastMove.to[1]);
        ctx.lineWidth = 1;
    }
    // 选中棋子高亮
    if (xqSelected) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        xqHighlightCell(ctx, xqSelected[0], xqSelected[1]);
        ctx.lineWidth = 1;
    }
    // 合法落子提示
    if (xqLegalTargets.length) {
        for (const [r, c] of xqLegalTargets) {
            const [x, y] = xqXY(r, c);
            if (xqBoard[r][c]) {
                // 吃子：目标外圈
                ctx.strokeStyle = accent;
                ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.arc(x, y, XQ_CELL * 0.46, 0, 2 * Math.PI); ctx.stroke();
                ctx.lineWidth = 1;
            } else {
                // 空位：小圆点
                ctx.fillStyle = accent;
                ctx.globalAlpha = 0.55;
                ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    }

    // 棋子（动画中的源点暂不画，改画为浮动）
    for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
        const p = xqBoard[r][c];
        if (!p) continue;
        if (xqAnim && xqAnim.from[0] === r && xqAnim.from[1] === c) continue;
        const [x, y] = xqXY(r, c);
        xqDrawPiece(ctx, x, y, p);
    }
    // 动画中的浮动棋子
    if (xqAnim) {
        const t = Math.min(1, (performance.now() - xqAnim.start) / xqAnim.duration);
        const [fx, fy] = xqXY(xqAnim.from[0], xqAnim.from[1]);
        const [tx, ty] = xqXY(xqAnim.to[0], xqAnim.to[1]);
        xqDrawPiece(ctx, fx + (tx - fx) * t, fy + (ty - fy) * t, xqAnim.piece);
    }
}

/* ======================== 模态框 / UI ======================== */

function xqPartnerName() {
    try {
        if (typeof settings !== 'undefined' && settings && settings.partnerName) return settings.partnerName;
    } catch (e) {}
    return 'Ta';
}

function xqSetupCanvas() {
    const cv = xqCanvas;
    const dpr = window.devicePixelRatio || 1;
    cv.width = XQ_CANVAS_W * dpr;
    cv.height = XQ_CANVAS_H * dpr;
    // CSS 自适应：宽度上限 XQ_CANVAS_W，窄屏自动缩小，高度等比
    cv.style.width = '100%';
    cv.style.maxWidth = XQ_CANVAS_W + 'px';
    cv.style.height = 'auto';
    cv.style.display = 'block';
    cv.style.touchAction = 'manipulation';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    xqCtx = ctx;
}

function xqEnsureModal() {
    if (xqModal) return xqModal;
    const modal = document.createElement('div');
    modal.id = 'xq-modal';
    modal.className = 'modal';
    modal.style.zIndex = '9000';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:430px; padding:16px 16px 18px; box-sizing:border-box; max-height:94vh; overflow:auto;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <div style="font-size:16px; font-weight:800; color:var(--text-primary);">♟ 中国象棋</div>
                <button onclick="xqClose()" style="width:30px;height:30px;border-radius:50%;border:1px solid var(--border-color);
                    background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;font-size:16px;line-height:1;">×</button>
            </div>
            <div id="xq-status" style="text-align:center; font-size:13px; color:var(--text-primary); margin-bottom:8px; min-height:20px;"></div>
            <div style="display:flex; justify-content:center; margin-bottom:12px;">
                <canvas id="xq-canvas"></canvas>
            </div>
            <div style="display:flex; gap:10px; justify-content:center; margin-bottom:10px;">
                <button onclick="xqNewGame()" style="flex:1; padding:9px 0; border-radius:12px; border:none;
                    background:var(--accent-color); color:#fff; font-size:13px; font-weight:600; cursor:pointer;">重新开始</button>
                <button onclick="xqUndo()" style="flex:1; padding:9px 0; border-radius:12px; border:1px solid var(--border-color);
                    background:var(--primary-bg); color:var(--text-primary); font-size:13px; font-weight:600; cursor:pointer;">悔棋</button>
            </div>
            <div style="text-align:center; font-size:12px; color:var(--text-secondary);">
                <span id="xq-score"></span> · 你执红先手，点击棋子选择再点目标处落子
            </div>
        </div>`;
    modal.addEventListener('click', (e) => { if (e.target === modal) xqClose(); });
    document.body.appendChild(modal);
    xqModal = modal;
    xqCanvas = document.getElementById('xq-canvas');
    xqCanvas.addEventListener('click', xqOnCanvasClick);
    xqSetupCanvas();
    return modal;
}

function xqUpdateStatus() {
    const el = document.getElementById('xq-status');
    if (!el) return;
    let txt;
    if (xqGameOver) {
        txt = xqResultText;
    } else if (xqTurn === 'r') {
        txt = '轮到你（红方）';
    } else {
        txt = xqPartnerName() + ' 思考中…（黑方）';
    }
    if (!xqGameOver && xqIsInCheck(xqBoard, xqTurn)) {
        txt += ' · 将军！';
    }
    el.innerHTML = txt;
    const sc = document.getElementById('xq-score');
    if (sc) sc.textContent = '胜 ' + (xqData.wins || 0) + ' · 负 ' + (xqData.losses || 0);
}

function xqNewGame() {
    xqBoard = xqInitialBoard();
    xqTurn = 'r';
    xqSelected = null;
    xqLegalTargets = [];
    xqHistory = [];
    xqLastMove = null;
    xqGameOver = false;
    xqResultText = '';
    xqLocked = false;
    xqAnim = null;
    xqDrawBoard();
    xqUpdateStatus();
}

function xqUndo() {
    if (xqLocked || xqAnim) { if (typeof showNotification === 'function') showNotification('请稍候', 'warning', 800); return; }
    if (xqHistory.length < 2) {
        if (typeof showNotification === 'function') showNotification('没有可悔棋的步数', 'warning', 900);
        return;
    }
    // 撤销玩家 + AI 各一步
    for (let i = 0; i < 2; i++) {
        const h = xqHistory.pop();
        xqBoard[h.from[0]][h.from[1]] = xqBoard[h.to[0]][h.to[1]];
        xqBoard[h.to[0]][h.to[1]] = h.captured;
    }
    xqTurn = 'r';
    xqSelected = null;
    xqLegalTargets = [];
    xqGameOver = false;
    xqResultText = '';
    if (xqHistory.length) {
        const last = xqHistory[xqHistory.length - 1];
        xqLastMove = { from: last.from, to: last.to };
    } else {
        xqLastMove = null;
    }
    xqDrawBoard();
    xqUpdateStatus();
    if (typeof showNotification === 'function') showNotification('已悔棋', 'success', 900);
}

/* ======================== 暴露入口 ======================== */

window.openXiangqi = async function () {
    await xqLoadData();
    xqEnsureModal();
    xqActive = true;
    xqNewGame();
    showModal(xqModal);
};

// 关闭模态框
window.xqClose = function () {
    xqActive = false;
    xqAnim = null;
    if (xqModal) hideModal(xqModal);
};

// 重新开始 / 悔棋（供按钮 onclick 调用）
window.xqNewGame = xqNewGame;
window.xqUndo = xqUndo;

// 初始化钩子（供 app.js 调用，可不调用——内部懒加载）
window.initXiangqi = async function () {
    await xqLoadData();
};
