/* ============================================================
 * together.js — 陪伴模式（一起工作/学习/睡觉/运动）
 * 依赖全局：localforage, getStorageKey, showNotification, playSound, APP_PREFIX
 * 暴露：window.openTogetherMode, window.initTogether
 * 引入方式：在 index.html 中添加：
 *   <script src="js/features/together.js?v=1"></script>
 * ============================================================ */

/* ======================== 数据与存储 ======================== */
let tgData = {
    history: [],          // 陪伴历史 {id, scene, minutes, startAt, endAt, finished}
    totalMinutes: 0,      // 累计陪伴分钟
};
let tgDataLoaded = false;

async function tgLoadData() {
    if (tgDataLoaded) return;
    try {
        const key = getStorageKey('togetherData');
        const saved = await localforage.getItem(key);
        if (saved && typeof saved === 'object') {
            tgData = Object.assign({}, tgData, saved);
        }
    } catch (e) {
        try {
            const raw = localStorage.getItem('together_togetherData');
            if (raw) tgData = Object.assign({}, tgData, JSON.parse(raw));
        } catch (e2) { /* 静默 */ }
    }
    tgDataLoaded = true;
}

function tgSaveData() {
    try {
        localforage.setItem(getStorageKey('togetherData'), tgData);
    } catch (e) {
        try { localStorage.setItem('together_togetherData', JSON.stringify(tgData)); } catch (e2) {}
    }
}

/* ======================== 场景定义 ======================== */
const TG_SCENES = [
    { key: 'work',    icon: '💼', name: '一起工作', color: '#4D96FF', bg: 'linear-gradient(135deg,#4D96FF,#6BCB77)', desc: '专注高效，互不打扰', tip: '深度工作中，请勿打扰' },
    { key: 'study',   icon: '📚', name: '一起学习', color: '#FFD93D', bg: 'linear-gradient(135deg,#FFD93D,#FF9A8B)', desc: '共同进步，互相鼓励', tip: '正在充电中，一起加油' },
    { key: 'sleep',   icon: '🌙', name: '一起睡觉', color: '#6C5CE7', bg: 'linear-gradient(135deg,#2D3561,#6C5CE7)', desc: '不挂电话，相拥入眠', tip: '已经睡着啦，晚安～' },
    { key: 'sport',   icon: '🏃', name: '一起运动', color: '#FF6B6B', bg: 'linear-gradient(135deg,#FF6B6B,#EE5A6F)', desc: '燃烧卡路里，互相监督', tip: '正在挥汗如雨中' },
];

const TG_PRESET_MINUTES = [5, 10, 15, 20, 25, 30];

/* ======================== 主入口：陪伴中心 ======================== */
let tgModal = null;

async function openTogetherMode() {
    await tgLoadData();
    const existing = document.getElementById('tg-modal');
    if (existing) { existing.remove(); }

    const modal = document.createElement('div');
    modal.id = 'tg-modal';
    modal.className = 'modal';
    modal.style.zIndex = '9100';
    modal.innerHTML = `<div class="modal-content" style="max-width:480px;padding:0;overflow:hidden;" id="tg-modal-inner"></div>`;
    document.body.appendChild(modal);
    tgModal = modal;
    modal.addEventListener('click', (e) => { if (e.target === modal) tgClose(); });
    tgRenderHub();
    // 关键修复：调用全局 showModal() 才会真正把 modal 从 display:none → display:flex
    try { if (typeof showModal === 'function') showModal(modal); else modal.style.display = 'flex'; } catch (_) { modal.style.display = 'flex'; }
}

window.openTogetherMode = openTogetherMode;

function tgClose() {
    if (!tgModal) return;
    try { if (typeof hideModal === 'function') hideModal(tgModal); else tgModal.style.display = 'none'; } catch (_) { tgModal.style.display = 'none'; }
    const toRemove = tgModal;
    setTimeout(() => { try { toRemove.remove(); } catch(_) {} if (tgModal === toRemove) tgModal = null; }, 320);
}

function tgSetBody(html) {
    const inner = document.getElementById('tg-modal-inner');
    if (inner) inner.innerHTML = html;
}

/* 渲染主页面：场景选择 */
function tgRenderHub() {
    const totalH = Math.floor(tgData.totalMinutes / 60);
    const totalM = tgData.totalMinutes % 60;
    tgSetBody(`
        <div style="padding:20px 18px 22px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <div style="font-size:20px;font-weight:700;">💛 陪伴模式</div>
                    <div style="font-size:11px;opacity:0.9;margin-top:2px;">和 Ta 共度专注时光</div>
                </div>
                <button onclick="tgClose()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;">✕</button>
            </div>
            <div style="margin-top:14px;background:rgba(255,255,255,0.15);border-radius:10px;padding:10px 14px;font-size:12px;">
                ⏱ 累计陪伴：<b>${totalH}小时${totalM}分</b> · 共 ${tgData.history.length} 次
            </div>
        </div>
        <div style="padding:18px;">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">选择陪伴场景</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                ${TG_SCENES.map(s => `
                    <div onclick="tgPickScene('${s.key}')" style="background:${s.bg};border-radius:14px;padding:16px 14px;color:#fff;cursor:pointer;transition:transform 0.2s;position:relative;overflow:hidden;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <div style="font-size:32px;margin-bottom:6px;">${s.icon}</div>
                        <div style="font-size:14px;font-weight:700;">${s.name}</div>
                        <div style="font-size:10px;opacity:0.9;margin-top:3px;">${s.desc}</div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:16px;font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">📜 最近陪伴</div>
            <div id="tg-history-list"></div>
        </div>
    `);
    tgRenderHistory();
}

function tgRenderHistory() {
    const el = document.getElementById('tg-history-list');
    if (!el) return;
    if (!tgData.history.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:12px;">还没有陪伴记录</div>`;
        return;
    }
    el.innerHTML = tgData.history.slice(-8).reverse().map(h => {
        const s = TG_SCENES.find(x => x.key === h.scene);
        if (!s) return '';
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--border-color);font-size:12px;">
                <span style="font-size:18px;">${s.icon}</span>
                <div style="flex:1;">
                    <div style="color:var(--text-primary);font-weight:500;">${s.name} · ${h.minutes}分钟</div>
                    <div style="color:var(--text-secondary);font-size:10px;">${new Date(h.startAt).toLocaleString('zh-CN').slice(5,17)} ${h.finished ? '✅ 已完成' : '⏸ 未完成'}</div>
                </div>
            </div>`;
    }).join('');
}

/* 选择场景后 → 选择时长 */
let tgSelectedScene = null;

function tgPickScene(sceneKey) {
    tgSelectedScene = TG_SCENES.find(s => s.key === sceneKey);
    if (!tgSelectedScene) return;
    tgSetBody(`
        <div style="padding:20px 18px 22px;background:${tgSelectedScene.bg};color:#fff;">
            <div style="display:flex;align-items:center;gap:10px;">
                <button onclick="tgRenderHub()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;">←</button>
                <div>
                    <div style="font-size:24px;">${tgSelectedScene.icon}</div>
                    <div style="font-size:17px;font-weight:700;">${tgSelectedScene.name}</div>
                </div>
            </div>
            <div style="font-size:12px;opacity:0.9;margin-top:10px;">${tgSelectedScene.desc}</div>
        </div>
        <div style="padding:18px;">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">选择陪伴时长</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
                ${TG_PRESET_MINUTES.map(m => `
                    <button onclick="tgStart(${m})" style="background:var(--primary-bg);border:1px solid var(--border-color);color:var(--text-primary);padding:12px 6px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent-color)';this.style.color='var(--accent-color)'" onmouseout="this.style.borderColor='var(--border-color)';this.style.color='var(--text-primary)'">${m}<span style="font-size:10px;font-weight:400;">分</span></button>
                `).join('')}
            </div>
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">⏱ 自定义时长（1-180 分钟）</div>
                <div style="display:flex;gap:6px;">
                    <input id="tg-custom-min" type="number" min="1" max="180" placeholder="自定义分钟" style="flex:1;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);">
                    <button onclick="tgStartCustom()" class="ex-primary-btn" style="padding:8px 16px;font-size:12px;">开始</button>
                </div>
            </div>
        </div>
    `);
}

window.tgPickScene = tgPickScene;

function tgStartCustom() {
    const v = parseInt(document.getElementById('tg-custom-min').value, 10);
    if (isNaN(v) || v < 1 || v > 180) {
        if (typeof showNotification === 'function') showNotification('请输入 1-180 之间的分钟数', 'warning');
        return;
    }
    tgStart(v);
}

function tgStart(minutes) {
    if (!tgSelectedScene) return;
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + minutes * 60000);
    const record = { id: 'tg_' + Date.now(), scene: tgSelectedScene.key, minutes, startAt: startAt.toISOString(), endAt: endAt.toISOString(), finished: false };
    tgData.history.push(record);
    if (tgData.history.length > 100) tgData.history = tgData.history.slice(-100);
    tgSaveData();
    tgRenderRunning(record);
}

window.tgStart = tgStart;

let tgInterval = null;

function tgRenderRunning(record) {
    const scene = TG_SCENES.find(s => s.key === record.scene);
    if (!scene) return;
    function update() {
        const now = Date.now();
        const end = new Date(record.endAt).getTime();
        const remain = end - now;
        if (remain <= 0) {
            tgFinish(record, true);
            return;
        }
        const min = Math.floor(remain / 60000);
        const sec = Math.floor((remain % 60000) / 1000);
        const p = String(min).padStart(2, '0');
        const s = String(sec).padStart(2, '0');
        const progress = Math.min(100, ((record.minutes * 60000 - remain) / (record.minutes * 60000)) * 100);
        const timerEl = document.getElementById('tg-timer');
        const progEl = document.getElementById('tg-progress-bar');
        const tipEl = document.getElementById('tg-tip');
        if (timerEl) timerEl.textContent = `${p}:${s}`;
        if (progEl) progEl.style.width = progress + '%';
        // 状态切换提示
        if (tipEl) {
            if (min === 0 && sec <= 30 && sec > 0) tipEl.textContent = '马上结束啦～';
            else if (min === 1 && sec === 0) tipEl.textContent = '还剩 1 分钟，准备收尾';
        }
    }
    tgSetBody(`
        <div style="padding:30px 18px 26px;background:${scene.bg};color:#fff;text-align:center;">
            <div style="font-size:52px;margin-bottom:10px;">${scene.icon}</div>
            <div style="font-size:18px;font-weight:700;margin-bottom:4px;">${scene.name}</div>
            <div id="tg-tip" style="font-size:12px;opacity:0.9;margin-bottom:18px;">${scene.tip}</div>
            <div id="tg-timer" style="font-size:56px;font-weight:700;font-family:'Courier New',monospace;letter-spacing:2px;text-shadow:0 2px 12px rgba(0,0,0,0.25);">--:--</div>
            <div style="background:rgba(255,255,255,0.18);border-radius:50px;height:6px;margin-top:18px;overflow:hidden;">
                <div id="tg-progress-bar" style="background:#fff;height:100%;width:0%;transition:width 1s linear;"></div>
            </div>
            <div style="margin-top:14px;font-size:11px;opacity:0.85;">共 ${record.minutes} 分钟 · 开始于 ${new Date(record.startAt).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <div style="padding:18px;">
            <div style="background:var(--message-received-bg);border-radius:12px;padding:14px;text-align:center;font-size:12px;color:var(--text-secondary);line-height:1.6;margin-bottom:14px;">
                陪伴进行中…<br>专注此刻，享受彼此的存在
            </div>
            <button onclick="tgFinish(currentTgRecord, false)" class="ex-primary-btn" style="width:100%;padding:10px;background:#E17055;">⏹ 提前结束</button>
        </div>
    `);
    window.currentTgRecord = record;
    update();
    if (tgInterval) clearInterval(tgInterval);
    tgInterval = setInterval(update, 1000);
}

function tgFinish(record, autoFinish) {
    if (tgInterval) { clearInterval(tgInterval); tgInterval = null; }
    record.finished = autoFinish;
    record.endAt = new Date().toISOString();
    // 累计陪伴时长（按实际陪伴分钟计）
    const actualMs = new Date(record.endAt).getTime() - new Date(record.startAt).getTime();
    const actualMin = Math.round(actualMs / 60000);
    tgData.totalMinutes += actualMin;
    // 更新历史
    const idx = tgData.history.findIndex(h => h.id === record.id);
    if (idx >= 0) tgData.history[idx] = record;
    tgSaveData();
    if (typeof showNotification === 'function') {
        showNotification(autoFinish ? `🎉 陪伴完成！${record.minutes} 分钟专注时光` : '陪伴已结束', autoFinish ? 'success' : 'info', 3500);
    }
    if (typeof playSound === 'function') playSound('favorite');
    // 同步到聊天（可选）
    if (typeof addMessage === 'function') {
        const scene = TG_SCENES.find(s => s.key === record.scene);
        if (scene) addMessage({ id: Date.now(), sender:'user', text:`${scene.icon} ${scene.name} · ${actualMin}分钟${autoFinish?'已完成':'已结束'}`, timestamp:new Date(), status:'sent', type:'normal' });
    }
    tgRenderHub();
}

window.tgFinish = tgFinish;

/* ======================== 初始化 ======================== */
window.initTogether = async function() { await tgLoadData(); };
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try { window.initTogether(); } catch(e) { console.warn('together 初始化失败', e); } }, 900);
});
