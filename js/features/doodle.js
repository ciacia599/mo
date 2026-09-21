/**
 * doodle.js - 涂鸦画板
 * 在聊天主页画涂鸦，发给对方（发到聊天消息流），对方概率回一幅
 * 模式参考 envelope.js：自包含 UI + localforage 持久化 + 全局函数暴露
 * 利用现有 createMessageFragment 对 msg.image 的原生支持，无需改 core.js
 */

/* ============ 状态 ============ */
let ddCanvas = null;       // 画布元素
let ddCtx = null;          // 2d context
let ddDrawing = false;     // 是否正在绘制
let ddLast = null;         // 上一笔坐标
let ddHistory = [];        // 撤销快照（dataURL）
let ddColor = '#1976d2';   // 当前颜色
let ddSize = 4;            // 笔触粗细
let ddMode = 'pen';        // 'pen' | 'eraser'

/* 取对方名（兼容 extras.js 未加载的情况） */
function ddPartnerName() {
    try { if (typeof exPartnerName === 'function') return exPartnerName(); } catch(e) {}
    try { if (typeof settings !== 'undefined' && settings.partnerName) return settings.partnerName; } catch(e) {}
    return '梦角';
}

/* 互动小屋功能按钮 */
function ddFeatureBtn(icon, label, onclick) {
    return `<button type="button" onclick="ddLaunchFeature(function(){${onclick}})"
        style="display:flex; flex-direction:column; align-items:center; gap:3px; padding:8px 2px; border-radius:12px;
        border:1px solid var(--border-color); background:var(--primary-bg); cursor:pointer;">
        <span style="font-size:18px; line-height:1;">${icon}</span>
        <span style="font-size:10px; color:var(--text-secondary);">${label}</span>
    </button>`;
}

window.ddLaunchFeature = function (openFeature) {
    const modal = document.getElementById('doodle-modal');
    if (modal && typeof hideModal === 'function') hideModal(modal);
    else if (modal) modal.style.display = 'none';
    window.setTimeout(() => {
        try {
            if (typeof openFeature === 'function') openFeature();
        } catch (error) {
            console.error('互动小屋功能打开失败', error);
            if (typeof showNotification === 'function') showNotification('功能打开失败，请重试', 'error');
        }
    }, 260);
};

/* ============ 主入口 ============ */
window.openDoodle = function() {
    ddEnsureModal();
    showModal(document.getElementById('doodle-modal'));
    if (typeof playSound === 'function') playSound('mood');
    // 等 modal 显示后初始化画布
    setTimeout(initDoodleCanvas, 60);
};

function ddEnsureModal() {
    if (document.getElementById('doodle-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'doodle-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="font-size:16px; font-weight:700; color:var(--text-primary);">🎨 涂鸦画板</div>
                <button class="ex-back-btn" onclick="hideModal(document.getElementById('doodle-modal'))"><i class="fas fa-times"></i></button>
            </div>
            <div class="dd-toolbar">
                <input type="color" id="dd-color" value="#1976d2" title="颜色" class="dd-color-input">
                <button class="ex-quick-btn dd-mode-btn" id="dd-pen-btn" title="画笔" onclick="ddSetMode('pen')"><i class="fas fa-pen"></i></button>
                <button class="ex-quick-btn dd-mode-btn" id="dd-eraser-btn" title="橡皮" onclick="ddSetMode('eraser')"><i class="fas fa-eraser"></i></button>
                <span class="dd-label">粗细</span>
                <input type="range" id="dd-size" min="1" max="30" value="4" class="dd-size-input">
                <span id="dd-size-val" class="dd-label">4</span>
                <span style="flex:1;"></span>
                <button class="ex-quick-btn" title="撤销" onclick="ddUndo()"><i class="fas fa-undo"></i></button>
                <button class="ex-danger-btn" title="清空" style="padding:7px 10px;" onclick="ddClear()"><i class="fas fa-trash"></i></button>
            </div>
            <div class="dd-palette" id="dd-palette"></div>
            <div class="dd-canvas-wrap">
                <canvas id="dd-canvas" width="440" height="440"></canvas>
                <div id="dd-empty-hint" class="dd-empty-hint">在此画一笔开始创作 ✏️</div>
            </div>
            <div style="display:flex; gap:8px; margin-top:12px;">
                <button class="ex-primary-btn" style="flex:1;" onclick="ddSendToPartner()">📨 发给 ${ddPartnerName()}</button>
            </div>
            <div style="font-size:11px; color:var(--text-secondary); text-align:center; margin-top:8px;">发送后画作会出现在聊天中，对方可能回你一幅 🎨</div>
            <div style="margin-top:12px; background:var(--secondary-bg); border-radius:10px; padding:10px;">
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:6px;">🎨 对方画画频率</div>
                <div style="display:flex; gap:4px;">
                    ${['off','low','medium','high','custom'].map(f => {
                        const labels = {off:'关闭',low:'悠闲',medium:'普通',high:'热情',custom:'自定义'};
                        const cur = (typeof exData !== 'undefined' && exData.ddDrawFreq) || 'low';
                        return `<button onclick="ddSetDrawFreq('${f}')" style="flex:1;padding:5px;font-size:11px;border-radius:6px;border:1px solid ${cur===f?'var(--accent-color)':'var(--border-color)'};background:${cur===f?'var(--accent-color)':'var(--primary-bg)'};color:${cur===f?'#fff':'var(--text-primary)'};cursor:pointer;">${labels[f]}</button>`;
                    }).join('')}
                </div>
                <div id="dd-freq-custom-row" style="display:${((typeof exData !== 'undefined' && exData.ddDrawFreq) || 'low') === 'custom' ? 'flex' : 'none'}; gap:6px; align-items:center; margin-top:8px;">
                    <input id="dd-freq-min" type="number" min="1" max="720" placeholder="最短" value="${(exData && exData.ddDrawFreqCustom && exData.ddDrawFreqCustom[0]) || ''}" style="width:60px;padding:5px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--primary-bg);color:var(--text-primary);font-size:12px;">
                    <span style="font-size:11px;color:var(--text-secondary);">~</span>
                    <input id="dd-freq-max" type="number" min="1" max="720" placeholder="最长" value="${(exData && exData.ddDrawFreqCustom && exData.ddDrawFreqCustom[1]) || ''}" style="width:60px;padding:5px 8px;border:1px solid var(--border-color);border-radius:6px;background:var(--primary-bg);color:var(--text-primary);font-size:12px;">
                    <span style="font-size:11px;color:var(--text-secondary);">分钟</span>
                    <button class="ex-quick-btn" style="padding:5px 12px;font-size:11px;" onclick="ddApplyCustomFreq()">应用</button>
                </div>
            </div>
            <div style="margin-top:14px; border-top:1px dashed var(--border-color); padding-top:10px;">
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px;">💗 互动小屋 · 和 Ta 的更多玩法</div>
                <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:6px;">
                    ${ddFeatureBtn('🧧','红包','pgOpenRedpacket()')}
                    ${ddFeatureBtn('🔒','小黑屋','pgOpenJail()')}
                    ${ddFeatureBtn('⚖️','惩罚','pgOpenPunish()')}
                    ${ddFeatureBtn('🐾','宠物','pgOpenPet()')}
                    ${ddFeatureBtn('🧍','小人','openCompanion()')}
                    ${ddFeatureBtn('🌱','花园','pgOpenGarden()')}
                    ${ddFeatureBtn('📖','档案','pgOpenProfile()')}
                    ${ddFeatureBtn('📍','寻踪','pgOpenTrack()')}
                    ${ddFeatureBtn('☯️','易经','pgOpenIching()')}
                    ${ddFeatureBtn('🎮','游戏','openMiniGamesCenter()')}
                    ${ddFeatureBtn('⚙️','设置','pgOpenSettings()')}
                    ${ddFeatureBtn('👤','头像','idOpen()')}
                    ${ddFeatureBtn('✏️','昵称','idOpenNickname()')}
                    ${ddFeatureBtn('❓','问答','s2OpenQa()')}
                    ${ddFeatureBtn('📋','问卷','s2OpenSurvey()')}
                    ${ddFeatureBtn('🗒','留言','exOpenBoard()')}
                    ${ddFeatureBtn('🛍','商城','s2OpenShop()')}
                    ${ddFeatureBtn('🏠','我们的家','s2OpenHome()')}
                    ${ddFeatureBtn('📞','通话记录','s2OpenCalls()')}
                    ${ddFeatureBtn('↩️','撤回','s2OpenRecall()')}
                    ${ddFeatureBtn('⭐','Ta收藏','s2OpenFavs()')}
                    ${ddFeatureBtn('🤝','陪伴邀请','s2OpenInvite()')}
                    ${ddFeatureBtn('😊','心情','s2ShowMood()')}
                    ${ddFeatureBtn('📮','信箱','exViewMailbox && exViewMailbox()')}
                    ${ddFeatureBtn('💡','灵感','pgOpenNotes()')}
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) hideModal(modal); });
}

/* ============ 画布初始化 ============ */
function initDoodleCanvas() {
    ddCanvas = document.getElementById('dd-canvas');
    if (!ddCanvas) return;
    ddCtx = ddCanvas.getContext('2d');
    // 白底
    ddCtx.fillStyle = '#ffffff';
    ddCtx.fillRect(0, 0, ddCanvas.width, ddCanvas.height);
    ddCtx.lineCap = 'round';
    ddCtx.lineJoin = 'round';
    ddHistory = [];
    ddSaveHistory();
    ddDrawing = false;

    // 鼠标
    ddCanvas.addEventListener('mousedown', ddStart);
    ddCanvas.addEventListener('mousemove', ddMove);
    window.addEventListener('mouseup', ddEnd);
    // 触摸
    ddCanvas.addEventListener('touchstart', ddStart, { passive: false });
    ddCanvas.addEventListener('touchmove', ddMove, { passive: false });
    ddCanvas.addEventListener('touchend', ddEnd);

    // 工具
    const colorInput = document.getElementById('dd-color');
    if (colorInput) colorInput.addEventListener('input', e => {
        ddColor = e.target.value;
        ddMode = 'pen';
        ddUpdateModeBtns();
    });
    const sizeInput = document.getElementById('dd-size');
    if (sizeInput) sizeInput.addEventListener('input', e => {
        ddSize = parseInt(e.target.value, 10);
        const v = document.getElementById('dd-size-val');
        if (v) v.textContent = ddSize;
    });
    ddUpdateModeBtns();
    ddRenderPalette();
}

/* ============ 色板：各种颜色预设 ============ */
const DD_PALETTE_COLORS = [
    // 黑白灰
    '#000000', '#3a3a3a', '#7a7a7a', '#b8b8b8', '#ffffff',
    // 红粉系
    '#e74c3c', '#ff4757', '#ff6b9d', '#e84393', '#fd79a8',
    // 橙黄系
    '#e67e22', '#f39c12', '#fdcb6e', '#ffa502', '#feca57',
    // 绿系
    '#2ecc71', '#00b894', '#55efc4', '#a8d8ea', '#26de81',
    // 蓝青系
    '#1976d2', '#3498db', '#0984e3', '#4834d4', '#6c5ce7',
    // 紫棕系
    '#9b59b6', '#a29bfe', '#8e44ad', '#6d4c41', '#5d4037'
];

function ddRenderPalette() {
    const pal = document.getElementById('dd-palette');
    if (!pal) return;
    pal.innerHTML = DD_PALETTE_COLORS.map(c =>
        `<button type="button" title="${c}" data-color="${c}" class="dd-swatch" style="background:${c};"></button>`
    ).join('');
    pal.querySelectorAll('.dd-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
            const c = btn.getAttribute('data-color');
            ddColor = c;
            ddMode = 'pen';
            const inp = document.getElementById('dd-color');
            if (inp) inp.value = c;
            ddUpdateModeBtns();
            pal.querySelectorAll('.dd-swatch').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}
function ddPos(e) {
    const rect = ddCanvas.getBoundingClientRect();
    const sx = ddCanvas.width / rect.width;
    const sy = ddCanvas.height / rect.height;
    let cx, cy;
    if (e.touches && e.touches.length) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
    else { cx = e.clientX; cy = e.clientY; }
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
}

function ddStart(e) {
    e.preventDefault();
    ddDrawing = true;
    ddLast = ddPos(e);
    // 隐藏空白提示
    const hint = document.getElementById('dd-empty-hint');
    if (hint) hint.style.display = 'none';
    // 画一个点（点击不拖动也能留痕）
    ddCtx.beginPath();
    ddCtx.fillStyle = ddMode === 'eraser' ? '#fff' : ddColor;
    ddCtx.arc(ddLast.x, ddLast.y, (ddMode === 'eraser' ? ddSize * 1.25 : ddSize / 2), 0, Math.PI * 2);
    ddCtx.fill();
}

function ddMove(e) {
    if (!ddDrawing) return;
    e.preventDefault();
    const p = ddPos(e);
    ddCtx.beginPath();
    ddCtx.moveTo(ddLast.x, ddLast.y);
    ddCtx.lineTo(p.x, p.y);
    ddCtx.strokeStyle = ddMode === 'eraser' ? '#ffffff' : ddColor;
    ddCtx.lineWidth = ddMode === 'eraser' ? ddSize * 2.5 : ddSize;
    ddCtx.stroke();
    ddLast = p;
}

function ddEnd() {
    if (ddDrawing) { ddDrawing = false; ddSaveHistory(); }
}

window.ddSetMode = function(m) { ddMode = m; ddUpdateModeBtns(); };

function ddUpdateModeBtns() {
    const pen = document.getElementById('dd-pen-btn');
    const era = document.getElementById('dd-eraser-btn');
    if (pen) pen.style.borderColor = ddMode === 'pen' ? 'var(--accent-color)' : 'var(--border-color)';
    if (era) era.style.borderColor = ddMode === 'eraser' ? 'var(--accent-color)' : 'var(--border-color)';
}

function ddSaveHistory() {
    try {
        ddHistory.push(ddCanvas.toDataURL('image/png'));
        if (ddHistory.length > 30) ddHistory.shift();
    } catch (e) {}
}

window.ddUndo = function() {
    if (!ddHistory || ddHistory.length < 2) return;
    ddHistory.pop();
    const last = ddHistory[ddHistory.length - 1];
    const img = new Image();
    img.onload = () => {
        ddCtx.clearRect(0, 0, ddCanvas.width, ddCanvas.height);
        ddCtx.drawImage(img, 0, 0);
    };
    img.src = last;
};

window.ddClear = function() {
    if (!confirm('清空画布？')) return;
    ddCtx.fillStyle = '#ffffff';
    ddCtx.fillRect(0, 0, ddCanvas.width, ddCanvas.height);
    ddHistory = [];
    ddSaveHistory();
    const hint = document.getElementById('dd-empty-hint');
    if (hint) hint.style.display = '';
};

/* ============ 发送到聊天 ============ */
window.ddSendToPartner = function() {
    if (!ddCanvas) return;
    if (ddHistory.length < 2) { showNotification('画布是空的，先画点什么吧 ✏️', 'warning'); return; }
    const dataURL = ddCanvas.toDataURL('image/png');
    if (typeof addMessage === 'function') {
        addMessage({
            id: Date.now(),
            sender: 'user',
            text: '',
            image: dataURL,
            timestamp: new Date(),
            status: 'sent',
            type: 'normal'
        });
    }
    if (typeof playSound === 'function') playSound('send');
    hideModal(document.getElementById('doodle-modal'));
    showNotification('涂鸦已发送给 ' + ddPartnerName(), 'success');
    // 对方不一定回——"不是我画一个就必须回一个"
    // 约 40% 概率延迟回复（对方也在随便画），其余不回
    if (Math.random() < 0.4) {
        setTimeout(() => {
            ddPartnerSendRandomDoodle(true);
        }, 5000 + Math.random() * 15000);
    }
};

/* 对方主动/随机画画：时间/数量/内容随意画（不绑定我的操作） */
let ddPartnerDrawTimer = null;
// 画画频率：off=关闭, low=5-15分, medium=3-8分, high=1-4分, custom=自定义分钟区间
function ddDrawFreqRange() {
    const f = (typeof exData !== 'undefined' && exData.ddDrawFreq) ? exData.ddDrawFreq : 'low';
    if (f === 'off') return null;
    if (f === 'high') return [60000, 240000];
    if (f === 'medium') return [180000, 480000];
    if (f === 'custom') {
        const c = (exData.ddDrawFreqCustom && exData.ddDrawFreqCustom.length === 2) ? exData.ddDrawFreqCustom : [10, 30];
        let min = Math.max(1, parseInt(c[0], 10) || 10);
        let max = Math.max(min, parseInt(c[1], 10) || min);
        return [min * 60000, max * 60000];
    }
    if (typeof getSiteFrequencyRange === 'function') {
        const range = getSiteFrequencyRange('doodleMin', 'doodleMax', 5, 15);
        return [range[0] * 60000, range[1] * 60000];
    }
    return [300000, 900000]; // low: 5-15 分钟
}
function ddPartnerStartIdleDraws() {
    if (ddPartnerDrawTimer) return;
    const range = ddDrawFreqRange();
    if (!range) return; // 关闭
    const [min, max] = range;
    const loop = () => {
        const next = min + Math.random() * (max - min);
        if (window.__PerfManager) {
            ddPartnerDrawTimer = window.__PerfManager.registerTimer(() => {
                if (window.__PerfManager.isPaused) return;
                ddPartnerSendRandomDoodle(false);
                if (window.__PerfManager && ddPartnerDrawTimer) window.__PerfManager.unregisterTimer(ddPartnerDrawTimer);
                ddPartnerDrawTimer = null;
                ddPartnerStartIdleDraws();
            }, next, 'timeout');
        } else {
            ddPartnerDrawTimer = setTimeout(() => {
                ddPartnerSendRandomDoodle(false);
                ddPartnerDrawTimer = null;
                ddPartnerStartIdleDraws();
            }, next);
        }
    };
    loop();
}
window.ddSetDrawFreq = function(f) {
    if (typeof exData !== 'undefined') { exData.ddDrawFreq = f; if (typeof exSave === 'function') exSave(); }
    if (ddPartnerDrawTimer) {
        if (window.__PerfManager) window.__PerfManager.unregisterTimer(ddPartnerDrawTimer);
        else clearTimeout(ddPartnerDrawTimer);
        ddPartnerDrawTimer = null;
    }
    if (f !== 'off') ddPartnerStartIdleDraws();
    const row = document.getElementById('dd-freq-custom-row');
    if (row) row.style.display = f === 'custom' ? 'flex' : 'none';
    showNotification('画画频率：' + ({off:'关闭',low:'悠闲 5-15分',medium:'普通 3-8分',high:'热情 1-4分',custom:'自定义区间'}[f] || f), 'info', 2500);
};
window.ddApplyCustomFreq = function() {
    const a = parseInt((document.getElementById('dd-freq-min') || {}).value, 10);
    const b = parseInt((document.getElementById('dd-freq-max') || {}).value, 10);
    if (!a || a < 1) { showNotification('请输入有效的最短分钟数', 'warning'); return; }
    const min = a, max = Math.max(a, b || a);
    if (typeof exData !== 'undefined') {
        exData.ddDrawFreqCustom = [min, max];
        exData.ddDrawFreq = 'custom';
        if (typeof exSave === 'function') exSave();
    }
    if (ddPartnerDrawTimer) {
        if (window.__PerfManager) window.__PerfManager.unregisterTimer(ddPartnerDrawTimer);
        else clearTimeout(ddPartnerDrawTimer);
        ddPartnerDrawTimer = null;
    }
    ddPartnerStartIdleDraws();
    showNotification(`画画频率已自定义：每 ${min}~${max} 分钟一幅 🎨`, 'success', 3000);
};
window.ddPartnerSendRandomDoodle = function(isReply) {
    const replyURL = ddGeneratePartnerDoodle();
    if (typeof addMessage === 'function') {
        addMessage({
            id: Date.now() + Math.floor(Math.random() * 999),
            sender: 'partner',
            text: isReply ? '' : '（想画点什么给你～）',
            image: replyURL,
            timestamp: new Date(),
            status: 'received',
            type: 'normal'
        });
    }
    if (typeof playSound === 'function') playSound('partner_message');
    showNotification(ddPartnerName() + (isReply ? ' 回了你一幅涂鸦 🎨' : ' 画了一幅画给你 🎨'), 'success', 4000);
};

/* ============ 生成对方涂鸦（抽象随机画作） ============ */
function ddGeneratePartnerDoodle() {
    const c = document.createElement('canvas');
    c.width = 440; c.height = 440;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 440, 440);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const palette = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e84393', '#fdcb6e'];
    // 随机曲线
    const strokes = 6 + Math.floor(Math.random() * 8);
    for (let i = 0; i < strokes; i++) {
        ctx.strokeStyle = palette[Math.floor(Math.random() * palette.length)];
        ctx.lineWidth = 2 + Math.random() * 10;
        ctx.globalAlpha = 0.7 + Math.random() * 0.3;
        ctx.beginPath();
        let x = Math.random() * 440, y = Math.random() * 440;
        ctx.moveTo(x, y);
        const segs = 2 + Math.floor(Math.random() * 3);
        for (let j = 0; j < segs; j++) {
            const x2 = Math.random() * 440, y2 = Math.random() * 440;
            const cx1 = x + (Math.random() - 0.5) * 220, cy1 = y + (Math.random() - 0.5) * 220;
            const cx2 = x2 - (Math.random() - 0.5) * 220, cy2 = y2 - (Math.random() - 0.5) * 220;
            ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
            x = x2; y = y2;
        }
        ctx.stroke();
    }
    // 随机圆点
    const dots = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < dots; i++) {
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        ctx.globalAlpha = 0.35 + Math.random() * 0.45;
        ctx.beginPath();
        ctx.arc(Math.random() * 440, Math.random() * 440, 8 + Math.random() * 32, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    return c.toDataURL('image/png');
}

/* ============ 绑定主页画笔按钮 + 启动对方主动画画机制 ============ */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const btn = document.getElementById('doodle-btn');
        if (btn) btn.addEventListener('click', () => window.openDoodle());
    }, 1000);
    setTimeout(() => { try { ddPartnerStartIdleDraws(); } catch (e) {} }, 12000);
});
