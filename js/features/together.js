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

async function openTogetherMode(renderHub) {
    await tgLoadData();
    const existing = document.getElementById('tg-modal');
    if (existing) { existing.remove(); }

    const modal = document.createElement('div');
    modal.id = 'tg-modal';
    modal.className = 'modal';
    modal.style.zIndex = '9100';
    modal.innerHTML = `<div class="modal-content" style="max-width:480px;width:100%;padding:0;overflow:hidden;max-height:92vh;display:flex;flex-direction:column;" id="tg-modal-inner"></div>`;
    document.body.appendChild(modal);
    tgModal = modal;
    modal.addEventListener('click', (e) => { if (e.target === modal) tgFinish(window.currentTgRecord, false); });
    if (renderHub !== false) tgRenderHub();
    // 关键修复：调用全局 showModal() 才会真正把 modal 从 display:none → display:flex
    try { if (typeof showModal === 'function') showModal(modal); else modal.style.display = 'flex'; } catch (_) { modal.style.display = 'flex'; }
    return modal;
}

window.openTogetherMode = openTogetherMode;

/* 邀请接受后的统一跳转入口：togLaunch(场景, 分钟)
 * extras.js 场景: work/study/exercise/sleep → 映射到本文件 work/study/sport/sleep */
window.togLaunch = async function(type, durationMin) {
    await tgLoadData();
    const map = { exercise: 'sport' };
    const key = map[type] || type;
    tgSelectedScene = TG_SCENES.find(s => s.key === key);
    if (!tgSelectedScene) return;
    if (!document.getElementById('tg-modal')) {
        await openTogetherMode(false);
    }
    tgStart(parseInt(durationMin, 10) || 30);
};

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
    // 运行时状态：消息列表 + 背景
    tgRunMsgs = [{ from: 'partner', text: tgWelcome(tgSelectedScene.key), time: Date.now() }];
    tgRunBg = tgData.lastBg || tgSelectedScene.bg;
    tgRenderRunning(record);
}

window.tgStart = tgStart;

let tgInterval = null;
let tgRunMsgs = [];
let tgRunBg = null;

/* 场景欢迎语 & 回复语库 */
function tgWelcome(key) {
    return ({
        work: '好，开始工作吧，我在你旁边陪着你 💻',
        study: '一起加油！有不会的可以和我讨论 📚',
        sleep: '晚安啦，抱着你一起睡 🌙',
        sport: '动起来！我在旁边给你加油 🏃'
    })[key] || '开始吧，我陪着你 ❤️';
}
const TG_REPLY_POOL = {
    work: ['工作辛苦了，等下给你倒杯水 ☕', '效率不错嘛，继续保持 💻', '嗯…我也在忙，一起专心', '累了就歇一分钟，我给你捏捏肩'],
    study: ['这道题…我觉得再想想？🤔', '认真学习的样子真好看 📚', '学到了记得教我哦', '加油，你一定可以的 💪'],
    sleep: ['嘘，快睡吧，我在呢 🌙', '晚安，做个有我的好梦', '被子盖好，别着凉', '…我偷偷亲你一下，你没发现吧'],
    sport: ['加油！再坚持一下 💪', '慢点运动，注意别受伤', '出汗的样子真有活力 ✨', '休息一下喝口水，我等你']
};
const TG_REPLY_GENERAL = ['嗯嗯，我一直在你身边 ❤️', '加油哦，我陪着你', '想你了，悄悄看你一眼 😊', '专心的你最迷人了', '好，一起坚持到最后！', '收到～我也爱你 🫶'];
function tgEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 背景预设 */
const TG_BG_PRESETS = [
    ['梦幻紫', 'linear-gradient(135deg,#667eea,#764ba2)'],
    ['蜜桃粉', 'linear-gradient(135deg,#f093fb,#f5576c)'],
    ['海洋蓝', 'linear-gradient(135deg,#4facfe,#00f2fe)'],
    ['薄荷绿', 'linear-gradient(135deg,#43e97b,#38f9d7)'],
    ['暖橙', 'linear-gradient(135deg,#fa709a,#fee140)'],
    ['星空', 'linear-gradient(135deg,#30cfd0,#330867)'],
    ['深夜', 'linear-gradient(135deg,#2D3561,#6C5CE7)'],
    ['烈焰', 'linear-gradient(135deg,#FF6B6B,#EE5A6F)']
];

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
        if (tipEl) {
            if (min === 0 && sec <= 30 && sec > 0) tipEl.textContent = '马上结束啦～';
            else if (min === 1 && sec === 0) tipEl.textContent = '还剩 1 分钟，准备收尾';
        }
    }
    tgSetBody(`
        <div id="tg-hero" style="background:${tgRunBg};color:#fff;padding:14px 16px 16px;flex-shrink:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <button onclick="tgFinish(currentTgRecord,false)" title="提前结束回聊天" style="background:rgba(255,255,255,0.22);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;">✕</button>
                <div style="font-size:12px;font-weight:600;opacity:0.95;">${scene.icon} ${scene.name}中</div>
                <button onclick="tgTogglePanel('tg-bg-panel')" title="更换背景" style="background:rgba(255,255,255,0.22);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;">🎨</button>
            </div>
            <div id="tg-bg-panel" style="display:none;background:rgba(0,0,0,0.25);border-radius:10px;padding:10px;margin-bottom:10px;">
                <div style="font-size:11px;margin-bottom:7px;opacity:0.9;">选择背景（自动记住）</div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">
                    ${TG_BG_PRESETS.map(b => `<button onclick="tgApplyBg(this,'${b[1]}')" title="${b[0]}" style="height:26px;border:2px solid rgba(255,255,255,0.5);border-radius:6px;background:${b[1]};cursor:pointer;"></button>`).join('')}
                </div>
                <input type="file" id="tg-bg-upload" accept="image/*" style="display:none;" onchange="tgBgUpload(event)">
                <button onclick="document.getElementById('tg-bg-upload').click()" style="width:100%;padding:6px;font-size:11px;background:rgba(255,255,255,0.9);color:#444;border:none;border-radius:7px;cursor:pointer;">📷 上传自己的背景图片</button>
            </div>
            <div style="text-align:center;">
                <div id="tg-timer" style="font-size:48px;font-weight:700;font-family:'Courier New',monospace;letter-spacing:2px;text-shadow:0 2px 12px rgba(0,0,0,0.3);">--:--</div>
                <div style="background:rgba(255,255,255,0.2);border-radius:50px;height:6px;margin-top:12px;overflow:hidden;">
                    <div id="tg-progress-bar" style="background:#fff;height:100%;width:0%;transition:width 1s linear;"></div>
                </div>
                <div id="tg-tip" style="font-size:11px;opacity:0.9;margin-top:9px;">${scene.tip}</div>
                <div style="font-size:10px;opacity:0.8;margin-top:3px;">共 ${record.minutes} 分钟 · ${new Date(record.startAt).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})} 开始</div>
            </div>
        </div>

        <div id="tg-msgs" style="flex:1;overflow-y:auto;min-height:110px;max-height:230px;padding:10px 12px;background:var(--secondary-bg);"></div>

        <div style="display:flex;gap:6px;padding:8px 10px;background:var(--primary-bg);border-top:1px solid var(--border-color);flex-shrink:0;">
            <input id="tg-msg-input" placeholder="边陪伴边聊天…" onkeydown="if(event.key==='Enter')tgSendMsg()" style="flex:1;padding:8px 12px;border:1px solid var(--border-color);border-radius:20px;background:var(--secondary-bg);color:var(--text-primary);font-size:12px;">
            <button onclick="tgSendMsg()" style="padding:0 16px;border:none;border-radius:20px;background:var(--accent-color);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">发送</button>
        </div>

        <div style="padding:9px 10px 12px;background:var(--primary-bg);flex-shrink:0;">
            <div style="display:flex;gap:8px;">
                <button onclick="tgFinish(currentTgRecord,false)" style="flex:1;padding:9px;font-size:12px;font-weight:600;border:none;border-radius:9px;background:#E17055;color:#fff;cursor:pointer;">⏹ 提前结束</button>
                <button onclick="tgTogglePanel('tg-extend-row')" style="flex:1;padding:9px;font-size:12px;font-weight:600;border:none;border-radius:9px;background:#6c5ce7;color:#fff;cursor:pointer;">⏱ 延长时间</button>
            </div>
            <div id="tg-extend-row" style="display:none;gap:6px;margin-top:7px;">
                ${[5, 10, 15].map(m => `<button onclick="tgExtend(${m})" style="flex:1;padding:7px;font-size:11px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);cursor:pointer;">+${m} 分钟</button>`).join('')}
            </div>
        </div>
    `);
    window.currentTgRecord = record;
    const msgWrap = document.getElementById('tg-msgs');
    if (msgWrap) {
        msgWrap.innerHTML = tgRunMsgs.map(m => tgMsgHtml(m)).join('');
        msgWrap.scrollTop = msgWrap.scrollHeight;
    }
    update();
    if (tgInterval) clearInterval(tgInterval);
    tgInterval = setInterval(update, 1000);
}
function tgMsgHtml(m) {
    const mine = m.from === 'me';
    const t = new Date(m.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return `<div style="display:flex;justify-content:${mine ? 'flex-end' : 'flex-start'};margin-bottom:7px;">
        <div style="max-width:78%;padding:7px 11px;border-radius:12px;font-size:12px;line-height:1.5;background:${mine ? 'var(--accent-color)' : 'var(--primary-bg)'};color:${mine ? '#fff' : 'var(--text-primary)'};box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            ${tgEsc(m.text)}
            <div style="font-size:9px;opacity:0.65;margin-top:2px;text-align:${mine ? 'right' : 'left'};">${t}</div>
        </div></div>`;
}
function tgAppendMsg(m) {
    const wrap = document.getElementById('tg-msgs');
    if (!wrap) return;
    wrap.insertAdjacentHTML('beforeend', tgMsgHtml(m));
    wrap.scrollTop = wrap.scrollHeight;
}
/* 发消息 + 对方概率回复 */
window.tgSendMsg = function() {
    const input = document.getElementById('tg-msg-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;
    const m = { from: 'me', text, time: Date.now() };
    tgRunMsgs.push(m);
    tgAppendMsg(m);
    input.value = '';
    if (Math.random() < 0.78) setTimeout(tgPartnerReply, 1400 + Math.random() * 3200);
};
function tgPartnerReply() {
    if (!document.getElementById('tg-msgs') || !window.currentTgRecord) return;
    const key = window.currentTgRecord.scene;
    const pool = (TG_REPLY_POOL[key] || []).concat(TG_REPLY_GENERAL);
    const text = pool[Math.floor(Math.random() * pool.length)];
    const m = { from: 'partner', text, time: Date.now() };
    tgRunMsgs.push(m);
    tgAppendMsg(m);
    try { if (typeof playSound === 'function') playSound('partner_message'); } catch (e) {}
}
/* 面板展开/收起（互斥） */
window.tgTogglePanel = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const show = el.style.display === 'none';
    document.getElementById('tg-bg-panel').style.display = 'none';
    document.getElementById('tg-extend-row').style.display = 'none';
    el.style.display = show ? (id === 'tg-extend-row' ? 'flex' : 'block') : 'none';
};
/* 背景：预设 / 上传 */
window.tgApplyBg = function(btn, css) {
    tgRunBg = css;
    tgData.lastBg = css; tgSaveData();
    const hero = document.getElementById('tg-hero');
    if (hero) hero.style.background = css;
    try { if (typeof showNotification === 'function') showNotification('背景已更换 🎨', 'success', 2000); } catch (e) {}
};
window.tgBgUpload = function(e) {
    const f = (e.target.files || [])[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        const css = 'url("' + ev.target.result + '") center/cover no-repeat';
        tgApplyBg(null, css);
    };
    reader.readAsDataURL(f);
    e.target.value = '';
};
/* 延长时间 */
window.tgExtend = function(addMin) {
    const r = window.currentTgRecord;
    if (!r) return;
    r.endAt = new Date(new Date(r.endAt).getTime() + addMin * 60000).toISOString();
    r.minutes += addMin;
    const idx = tgData.history.findIndex(h => h.id === r.id);
    if (idx >= 0) tgData.history[idx] = r;
    tgSaveData();
    document.getElementById('tg-extend-row').style.display = 'none';
    const tip = document.getElementById('tg-tip');
    if (tip) tip.textContent = '好，再陪你 ' + addMin + ' 分钟 ❤️';
    try { if (typeof showNotification === 'function') showNotification('已延长 ' + addMin + ' 分钟 ⏱', 'success', 2500); } catch (e) {}
};

function tgFinish(record, autoFinish) {
    if (!record) { tgClose(); return; }
    if (tgInterval) { clearInterval(tgInterval); tgInterval = null; }
    record.finished = autoFinish;
    record.endAt = new Date().toISOString();
    // 累计陪伴时长（按实际陪伴分钟计）
    const actualMs = new Date(record.endAt).getTime() - new Date(record.startAt).getTime();
    const actualMin = Math.max(1, Math.round(actualMs / 60000));
    tgData.totalMinutes += actualMin;
    const idx = tgData.history.findIndex(h => h.id === record.id);
    if (idx >= 0) tgData.history[idx] = record;
    tgSaveData();
    window.currentTgRecord = null;
    if (typeof showNotification === 'function') {
        showNotification(autoFinish ? `🎉 陪伴完成！共陪伴 ${actualMin} 分钟` : `陪伴已结束 · ${actualMin} 分钟`, autoFinish ? 'success' : 'info', 3500);
    }
    if (typeof playSound === 'function') playSound('favorite');
    // 发一条消息到聊天并退出计时界面，回到聊天
    if (typeof addMessage === 'function') {
        const scene = TG_SCENES.find(s => s.key === record.scene);
        if (scene) addMessage({ id: Date.now(), sender: 'user', text: `${scene.icon} ${scene.name} · ${actualMin}分钟${autoFinish ? '已完成' : '已结束'}`, timestamp: new Date(), status: 'sent', type: 'normal' });
    }
    tgClose();
}

window.tgFinish = tgFinish;

/* ======================== 初始化 ======================== */
window.initTogether = async function() { await tgLoadData(); };
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try { window.initTogether(); } catch(e) { console.warn('together 初始化失败', e); } }, 900);
});
