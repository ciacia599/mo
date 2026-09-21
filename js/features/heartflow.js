/* ============================================================
 * heartflow.js — 心流链接（融合拾心界 + 度念 美观功能）
 * 依赖全局：localforage, getStorageKey, showNotification, playSound, showModal, hideModal
 *           exPartnerName(), exData.partnerManualTime, exData.partnerTzOffset, anniversaries, addMessage
 * 暴露：window.openHeartFlow
 * 引入方式：在 index.html 中添加：
 *   <script src="js/features/heartflow.js?v=1"></script>
 * ============================================================ */

/* ======================== 数据与存储 ======================== */
let hfData = {
    metDate: null,          // 相识日 YYYY-MM-DD
    partnerMoodToday: null, // {date, emoji, label}
    dailyLetter: null,      // {date, text}
};
let hfDataLoaded = false;

async function hfLoadData() {
    if (hfDataLoaded) return;
    try {
        const saved = await localforage.getItem(getStorageKey('heartflowData'));
        if (saved && typeof saved === 'object') hfData = Object.assign({}, hfData, saved);
    } catch (e) {
        try {
            const raw = localStorage.getItem('heartflow_data_fallback');
            if (raw) hfData = Object.assign({}, hfData, JSON.parse(raw));
        } catch (e2) {}
    }
    hfDataLoaded = true;
}

function hfSaveData() {
    try { localforage.setItem(getStorageKey('heartflowData'), hfData); }
    catch (e) { try { localStorage.setItem('heartflow_data_fallback', JSON.stringify(hfData)); } catch (e2) {} }
}

/* ======================== 主入口 ======================== */
let hfModal = null;
let hfClockTimer = null;

async function openHeartFlow() {
    await hfLoadData();
    // 自动从纪念日中取相识日
    if (!hfData.metDate && typeof anniversaries !== 'undefined' && Array.isArray(anniversaries)) {
        const ann = anniversaries.find(a => a && a.type === 'anniversary') || anniversaries.find(a => a && /相识|在一起|认识|相恋|恋爱/.test(a.title||''));
        if (ann && ann.date) hfData.metDate = String(ann.date).slice(0, 10);
    }
    hfEnsureDaily();

    const existing = document.getElementById('hf-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'hf-modal';
    modal.className = 'modal';
    modal.style.zIndex = '9300';
    modal.innerHTML = `<div class="modal-content" style="max-width:440px;padding:0;overflow:hidden;" id="hf-modal-inner"></div>`;
    document.body.appendChild(modal);
    hfModal = modal;
    modal.addEventListener('click', (e) => { if (e.target === modal) hfClose(); });
    hfRender();
    try { if (typeof showModal === 'function') showModal(modal); else modal.style.display = 'flex'; } catch (_) { modal.style.display = 'flex'; }
    if (hfClockTimer) clearInterval(hfClockTimer);
    hfClockTimer = setInterval(hfRefreshClocks, 1000);
}
window.openHeartFlow = openHeartFlow;

function hfClose() {
    if (hfClockTimer) { clearInterval(hfClockTimer); hfClockTimer = null; }
    if (!hfModal) return;
    try { if (typeof hideModal === 'function') hideModal(hfModal); else hfModal.style.display = 'none'; } catch (_) { hfModal.style.display = 'none'; }
    const toRemove = hfModal;
    setTimeout(() => { try { toRemove.remove(); } catch(_) {} if (hfModal === toRemove) hfModal = null; }, 320);
}

function hfSetBody(html) {
    const inner = document.getElementById('hf-modal-inner');
    if (inner) inner.innerHTML = html;
}

function hfEscape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function hfPartnerName() {
    try { if (typeof exPartnerName === 'function') return exPartnerName(); } catch(_) {}
    return 'Ta';
}

/* ======================== 静态文案池 ======================== */
const HF_POEMS = [
    '思念若有了频率 便能跨越维度',
    '星河滚烫，你是人间理想',
    '想和你一起，看遍世间所有的日出日落',
    '此心昭昭，唯有你在心上',
    '山海自有归期，风雨自有相逢',
    '愿与你共度这漫长又温柔的岁月',
    '心有所爱，行有所归',
    '风起的时候 想起你的笑',
    '愿你眼中有光，心中有暖',
    '万物皆有裂痕，那是光照进来的地方'
];
const HF_MOOD_POOL = [
    {emoji:'🥰', label:'甜蜜'}, {emoji:'🥺', label:'想念'},
    {emoji:'😌', label:'安心'}, {emoji:'😊', label:'开心'},
    {emoji:'😴', label:'困倦'}, {emoji:'🤭', label:'想逗你'},
    {emoji:'🥹', label:'感动'}, {emoji:'🫶', label:'爱意满满'},
    {emoji:'🥳', label:'雀跃'}, {emoji:'🌙', label:'入梦'}
];
const HF_LETTERS = [
    '今天也好好过了，记得照顾好自己。',
    '想你了，没有什么特别的理由，就是想。',
    '把今天的好心情打包，发给你一半。',
    '如果我也在你的城市，那该多好。',
    '晚安，今天的梦里要有我哦。',
    '早点睡，明天还会见到你。',
    '抱抱，今天辛苦了。',
    '你笑起来真好看，多笑笑。',
    '念念不忘，必有回响——我在这里。',
    '你是我平凡日子里的小奇迹。',
    '记得吃饭，别只顾着忙。',
    '无论今天如何，我都在你身边。'
];

function hfTodayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function hfEnsureDaily() {
    const today = hfTodayStr();
    if (!hfData.partnerMoodToday || hfData.partnerMoodToday.date !== today) {
        const m = HF_MOOD_POOL[Math.floor(Math.random() * HF_MOOD_POOL.length)];
        hfData.partnerMoodToday = { date: today, emoji: m.emoji, label: m.label };
        hfSaveData();
    }
    if (!hfData.dailyLetter || hfData.dailyLetter.date !== today) {
        const t = HF_LETTERS[Math.floor(Math.random() * HF_LETTERS.length)];
        hfData.dailyLetter = { date: today, text: t };
        hfSaveData();
    }
}

function hfGreeting() {
    const h = new Date().getHours();
    if (h < 5)  return { text:'夜深了',  emoji:'🌙' };
    if (h < 11) return { text:'上午好',  emoji:'🌅' };
    if (h < 13) return { text:'中午好',  emoji:'☀️' };
    if (h < 18) return { text:'下午好',  emoji:'🍃' };
    if (h < 22) return { text:'晚上好',  emoji:'🌆' };
    return { text:'夜深了', emoji:'🌙' };
}

function hfMetDays() {
    if (!hfData.metDate) return null;
    const d = new Date(hfData.metDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    const diff = Math.floor((today.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
    return Math.max(0, diff);
}

function hfMyTimeStr() {
    const d = new Date();
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function hfPartnerTimeStr() {
    let extraOffset = 0;
    try {
        if (typeof exData !== 'undefined' && exData) {
            if (exData.partnerManualTime && exData.partnerManualTime.offsetHours != null) {
                extraOffset = exData.partnerManualTime.offsetHours - 8;
            } else if (exData.partnerTzOffset) {
                extraOffset = exData.partnerTzOffset;
            }
        }
    } catch(_) {}
    const myUtcOffset = -new Date().getTimezoneOffset() / 60;
    const partnerOffset = myUtcOffset + extraOffset;
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const partner = new Date(utcMs + partnerOffset * 3600000);
    return String(partner.getHours()).padStart(2,'0') + ':' + String(partner.getMinutes()).padStart(2,'0');
}

/* ======================== 主界面渲染 ======================== */
function hfRender() {
    const poem = HF_POEMS[Math.floor(Math.random() * HF_POEMS.length)];
    const greet = hfGreeting();
    const days = hfMetDays();
    const mood = hfData.partnerMoodToday || {emoji:'🥰', label:'甜蜜'};
    const letter = (hfData.dailyLetter && hfData.dailyLetter.text) || '...';
    const myT = hfMyTimeStr();
    const pT = hfPartnerTimeStr();
    const pName = hfEscape(hfPartnerName());

    hfSetBody(`
    <div style="position:relative;background:linear-gradient(135deg,#2D3561 0%,#6C5CE7 45%,#A29BFE 100%);color:#fff;padding:22px 18px 18px;overflow:hidden;">
        <button onclick="hfClose()" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.18);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;">×</button>

        <div style="text-align:center;font-size:11px;letter-spacing:3px;opacity:0.7;">HEARTFLOW LINK</div>
        <div style="text-align:center;font-size:22px;font-weight:700;margin-top:4px;">心流链接</div>
        <div style="text-align:center;font-size:12px;opacity:0.9;margin-top:6px;line-height:1.6;">「${hfEscape(poem)}」</div>

        <div style="text-align:center;margin-top:14px;">
            <div style="font-size:13px;opacity:0.95;">${greet.emoji} ${greet.text}，${pName} 在想你</div>
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:18px 0 12px;">
            <div style="text-align:center;">
                <div style="font-size:10px;opacity:0.75;">我这边</div>
                <div id="hf-my-time" style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;">${myT}</div>
            </div>
            <div style="font-size:14px;animation:hfBeat 1.4s ease-in-out infinite;display:inline-block;white-space:nowrap;">♥︎ 连接中 ♥︎</div>
            <div style="text-align:center;">
                <div style="font-size:10px;opacity:0.75;">${pName} 那边</div>
                <div id="hf-partner-time" style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;">${pT}</div>
            </div>
        </div>

        <div style="background:rgba(255,255,255,0.12);border-radius:14px;padding:12px 14px;margin-top:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <div style="flex:1;">
                    <div style="font-size:11px;opacity:0.8;">💜 我们相识</div>
                    <div style="font-size:20px;font-weight:700;margin-top:2px;">${days==null ? '— 天' : days + ' 天'}</div>
                    ${days==null
                        ? `<button onclick="hfEditMet()" style="margin-top:4px;font-size:10px;background:rgba(255,255,255,0.2);border:none;color:#fff;padding:3px 9px;border-radius:9px;cursor:pointer;">点击设置</button>`
                        : `<div style="font-size:10px;opacity:0.75;">从 ${hfEscape(hfData.metDate)} 起 · <a href="#" onclick="hfEditMet();return false;" style="color:#fff;opacity:0.9;">编辑</a></div>`}
                </div>
                <div style="text-align:right;">
                    <div style="font-size:11px;opacity:0.8;">TA今日心情</div>
                    <div style="font-size:32px;margin-top:2px;">${mood.emoji}</div>
                    <div style="font-size:11px;opacity:0.9;">${hfEscape(mood.label)}</div>
                </div>
            </div>
        </div>

        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:14px;padding:12px 14px;margin-top:10px;">
            <div style="font-size:11px;opacity:0.85;margin-bottom:5px;">💌 ${pName} 今天想对你说</div>
            <div style="font-size:13px;line-height:1.65;">${hfEscape(letter)}</div>
            <button onclick="hfRerollLetter()" style="margin-top:8px;font-size:10px;background:rgba(255,255,255,0.18);border:none;color:#fff;padding:4px 10px;border-radius:10px;cursor:pointer;">换一句 ↻</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
            <button onclick="hfSendLetter()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:10px;border-radius:11px;cursor:pointer;font-size:12px;">💌 发给 Ta</button>
            <button onclick="hfEditMet()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:10px;border-radius:11px;cursor:pointer;font-size:12px;">📅 编辑相识日</button>
        </div>

        <style>
            @keyframes hfBeat {
                0%, 100% { transform: scale(1); opacity: 0.85; }
                50%      { transform: scale(1.18); opacity: 1; }
            }
        </style>
    </div>
    `);
}

function hfRefreshClocks() {
    const my = document.getElementById('hf-my-time');
    const pT = document.getElementById('hf-partner-time');
    if (my) my.textContent = hfMyTimeStr();
    if (pT) pT.textContent = hfPartnerTimeStr();
}

/* ======================== 交互 ======================== */
window.hfEditMet = function() {
    const cur = hfData.metDate || '';
    const promptFn = (typeof lfPrompt === 'function') ? lfPrompt
                   : (typeof exPrompt === 'function') ? exPrompt : null;
    if (typeof promptFn !== 'function') {
        const v = window.prompt('相识日 (YYYY-MM-DD)，留空清除', cur);
        if (v !== null) hfApplyMetDate(v);
        return;
    }
    promptFn('相识日 (YYYY-MM-DD)，留空清除', cur, function(v) {
        if (v === null) return;
        if (!v || !v.trim()) { hfData.metDate = null; hfSaveData(); hfRender(); return; }
        hfApplyMetDate(v);
    });
};
function hfApplyMetDate(v) {
    const m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(String(v).trim());
    if (!m) { if (typeof showNotification === 'function') showNotification('格式应为 YYYY-MM-DD', 'warning'); return; }
    const iso = m[1] + '-' + m[2].padStart(2,'0') + '-' + m[3].padStart(2,'0');
    hfData.metDate = iso;
    hfSaveData();
    hfRender();
    if (typeof showNotification === 'function') showNotification('相识日已设置为 ' + iso, 'success');
}

window.hfRerollLetter = function() {
    const t = HF_LETTERS[Math.floor(Math.random() * HF_LETTERS.length)];
    hfData.dailyLetter = { date: hfTodayStr(), text: t };
    hfSaveData();
    hfRender();
};

window.hfSendLetter = function() {
    const letter = (hfData.dailyLetter && hfData.dailyLetter.text) || '';
    if (!letter) return;
    const msg = '💌 ' + letter;
    try {
        if (typeof addMessage === 'function') {
            addMessage(msg, 'received');
            if (typeof playSound === 'function') playSound('partner_message');
            if (typeof showNotification === 'function') showNotification('已发送给 Ta', 'success');
            return;
        }
    } catch(e) {}
    if (typeof showNotification === 'function') showNotification('已复制到剪贴板', 'info');
    try { navigator.clipboard.writeText(msg); } catch(_) {}
};
