/**
 * extras.js - 功能百宝箱
 * 包含：红包、撤回消息、商城、问答、月经记录、时间状态、共读、留言板
 * 自包含模块：UI 动态构建，存储用 localforage + getStorageKey
 * 模式参考 envelope.js / mood.js
 */

/* ============ 数据层 ============ */
let exData = {
    coins: 1314,            // 我的金币（红包/商城共用）
    partnerCoins: 1314,     // 对方金币
    redpackets: [],         // 红包记录 {id, from, amount, message, time, opened, openedBy, expired}
    shopSent: [],           // 已送出的礼物 {id, itemKey, time, reply}
    qaHistory: [],          // 问答历史 {id, question, answer, time}
    periodLogs: {},         // 月经记录 { 'YYYY-MM-DD': {flow, symptoms, note} }
    periodCycle: 28,        // 平均周期天数
    reading: { books: [], currentId: null, partnerProgress: 0 },
    messageBoard: [],       // 留言板 {id, from, text, time}
    partnerTzOffset: 0,     // 对方时区偏移（小时）
    shopItems: null,        // 商城商品（null/空 → 用默认 SHOP_ITEMS）
    links: [],              // 分享链接 {id, url, title, platform, time, viewed, partnerComment}
    home: { grid: {}, cols: 6, rows: 4 },  // 共同的家：grid 是 {"r-c": 家具key}
    usageLimit: 8,          // 单功能最长使用分钟数（防发烫自动退出）
};

/* 加载数据 */
async function exLoad() {
    try {
        const saved = await localforage.getItem(getStorageKey('extrasData'));
        if (saved) Object.assign(exData, saved);
    } catch (e) {
        try {
            const raw = localStorage.getItem('extras_data_fallback');
            if (raw) Object.assign(exData, JSON.parse(raw));
        } catch (e2) {}
    }
    // 商城商品初始化（首次或为空时用默认）
    if (!exData.shopItems || !exData.shopItems.length) {
        exData.shopItems = SHOP_ITEMS.map(x => ({ ...x, custom:false }));
    }
    window.exData = exData;
}

/* 保存数据 */
function exSave() {
    try {
        localforage.setItem(getStorageKey('extrasData'), exData).catch(() => {});
    } catch (e) {
        try { localStorage.setItem('extras_data_fallback', JSON.stringify(exData)); } catch (e2) {}
    }
}

/* ============ 通用工具 ============ */
function exCoin(n) { return '🪙 ' + Number(n || 0).toLocaleString(); }
function exNow() { return new Date().toISOString(); }
function exFmtDate(d) {
    const dt = new Date(d);
    const p = x => String(x).padStart(2, '0');
    return `${dt.getFullYear()}/${p(dt.getMonth()+1)}/${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
function exFmtDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
}
function exEscape(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
/* 从字卡库生成对方回复（参考 envelope.js generateEnvelopeReplyText） */
function exGenerateReply(sentences) {
    const pool = (typeof customReplies !== 'undefined' && customReplies.length) ? customReplies :
                 (window._customReplies || []);
    if (!pool.length) return '（字卡库为空，对方暂时无言以对…）';
    const n = sentences || (Math.floor(Math.random()*3)+2);
    let out = '';
    for (let i=0; i<n; i++) {
        const s = pool[Math.floor(Math.random()*pool.length)];
        const punct = Math.random()<0.2 ? '！' : (Math.random()<0.2 ? '…' : '。');
        out += s + punct;
    }
    return out;
}
function exPartnerName() {
    return (typeof settings !== 'undefined' && settings.partnerName) ? settings.partnerName : '梦角';
}
function exMyName() {
    return (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
}

/* ============ 主入口：百宝箱 Hub ============ */
window.openExtrasHub = function() {
    exEnsureModal();
    exRenderHub();
    showModal(document.getElementById('extras-modal'));
    if (typeof playSound === 'function') playSound('mood');
};

function exEnsureModal() {
    if (document.getElementById('extras-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'extras-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px; max-height:90vh; overflow:hidden; display:flex; flex-direction:column;">
            <div id="extras-body" style="flex:1; overflow:auto; padding:18px;"></div>
            <div class="modal-buttons" style="border-top:1px solid var(--border-color); padding:12px 18px; margin:0;">
                <button class="modal-btn modal-btn-secondary" onclick="hideModal(document.getElementById('extras-modal'))">
                    <i class="fas fa-times"></i> 关闭
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal(modal);
    });
}

/* 渲染百宝箱主页（功能网格） */
function exRenderHub() {
    const body = document.getElementById('extras-body');
    if (!body) return;
    body.innerHTML = `
        <div style="text-align:center; margin-bottom:18px;">
            <div style="font-size:22px; font-weight:700; color:var(--text-primary);">✨ 功能百宝箱</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">与 ${exEscape(exPartnerName())} 的更多互动</div>
            <div style="margin-top:10px; display:inline-flex; gap:10px; font-size:13px;">
                <span style="background:var(--message-sent-bg); color:var(--text-primary); padding:5px 12px; border-radius:14px; cursor:pointer; border:1px dashed var(--border-color);" onclick="exEditCoins('me')" title="点击修改金币">我的 ${exCoin(exData.coins)} <i class="fas fa-pen" style="font-size:10px; opacity:0.6;"></i></span>
                <span style="background:var(--message-received-bg); color:var(--text-primary); padding:5px 12px; border-radius:14px; cursor:pointer; border:1px dashed var(--border-color);" onclick="exEditCoins('partner')" title="点击修改金币">${exEscape(exPartnerName())} ${exCoin(exData.partnerCoins)} <i class="fas fa-pen" style="font-size:10px; opacity:0.6;"></i></span>
            </div>
        </div>
        <div class="ex-hub-grid" id="ex-hub-grid"></div>
    `;
    const grid = document.getElementById('ex-hub-grid');
    const items = [
        { key:'redpacket', icon:'fa-gift', name:'红包', desc:'互发红包', color:'#FF6B6B' },
        { key:'recall', icon:'fa-undo', name:'撤回消息', desc:'撤回我发的消息', color:'#4D96FF' },
        { key:'shop', icon:'fa-shopping-bag', name:'礼物商城', desc:'给对方买东西', color:'#FF9A8B' },
        { key:'qa', icon:'fa-question-circle', name:'你问我答', desc:'提问与解答', color:'#8D9EFF' },
        { key:'period', icon:'fa-female', name:'月经记录', desc:'周期与预测', color:'#E0C3FC' },
        { key:'status', icon:'fa-clock', name:'时间状态', desc:'监测对方时辰', color:'#6BCB77' },
        { key:'reading', icon:'fa-book-open', name:'一起读书', desc:'共读与进度', color:'#FFD93D' },
        { key:'board', icon:'fa-sticky-note', name:'留言板', desc:'给对方留言', color:'#A8D8EA' },
        { key:'links', icon:'fa-link', name:'链接分享', desc:'小红书/抖音', color:'#FF6B9D' },
        { key:'home', icon:'fa-home', name:'我们的家', desc:'共同布置', color:'#F0932B' },
        { key:'xiangqi', icon:'fa-chess', name:'中国象棋', desc:'对弈一局', color:'#6C5CE7' },
        { key:'games', icon:'fa-gamepad', name:'游戏中心', desc:'双人小游戏', color:'#9C6FD4' },
    ];
    grid.innerHTML = items.map(it => `
        <div class="ex-hub-card" onclick="exOpen('${it.key}')" style="--card-color:${it.color};">
            <div class="ex-hub-icon"><i class="fas ${it.icon}"></i></div>
            <div class="ex-hub-name">${it.name}</div>
            <div class="ex-hub-desc">${it.desc}</div>
        </div>
    `).join('');
}

/* 金币随意修改（点击百宝箱顶部金币标签即可改） */
window.exEditCoins = function(who) {
    const isMe = who === 'me';
    const cur = isMe ? exData.coins : exData.partnerCoins;
    const name = isMe ? '我' : exPartnerName();
    const v = prompt('设置 ' + name + ' 的金币数量（可任意数值）', cur);
    if (v === null) return;
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 0) { showNotification('请输入非负整数', 'warning'); return; }
    if (isMe) exData.coins = n; else exData.partnerCoins = n;
    exSave();
    exRenderHub();
    showNotification(name + ' 的金币已设为 ' + n, 'success');
    if (typeof playSound === 'function') playSound('favorite');
};

/* 路由到各功能视图 */
window.exOpen = function(key) {
    if (typeof playSound === 'function') playSound('mood');
    const map = {
        redpacket: exViewRedpacket,
        recall: exViewRecall,
        shop: exViewShop,
        qa: exViewQa,
        period: exViewPeriod,
        status: exViewStatus,
        reading: exViewReading,
        board: exViewBoard,
        links: exViewLinks,
        home: exViewHome,
        xiangqi: () => {
            exStartUsage('xiangqi');
            hideModal(document.getElementById('extras-modal'));
            setTimeout(() => { if (typeof openXiangqi === 'function') openXiangqi(); }, 320);
        },
        games: () => { hideModal(document.getElementById('extras-modal')); setTimeout(() => { if (typeof openMiniGamesCenter === 'function') openMiniGamesCenter(); }, 320); }
    };
    if (map[key]) map[key]();
};

/* 通用视图头（返回按钮+标题） */
function exHeader(title, subtitle) {
    return `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
            <button class="ex-back-btn" onclick="window.openExtrasHub()"><i class="fas fa-arrow-left"></i></button>
            <div>
                <div style="font-size:17px; font-weight:700; color:var(--text-primary);">${title}</div>
                ${subtitle ? `<div style="font-size:11px; color:var(--text-secondary);">${subtitle}</div>` : ''}
            </div>
        </div>`;
}

function exSetBody(html) {
    const body = document.getElementById('extras-body');
    if (body) body.innerHTML = html;
}

/* ============ 1. 红包 ============ */
function exViewRedpacket() {
    exSetBody(exHeader('🧧 红包', '互发红包，传递心意') + `
        <div style="background:var(--message-sent-bg); border-radius:14px; padding:14px; margin-bottom:14px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:10px;">发红包给 ${exEscape(exPartnerName())}</div>
            <div style="display:flex; gap:8px; margin-bottom:8px;">
                <input id="ex-rp-amount" type="number" min="1" placeholder="金额" style="flex:1; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:14px;">
                <button class="ex-quick-btn" onclick="document.getElementById('ex-rp-amount').value=520">520</button>
                <button class="ex-quick-btn" onclick="document.getElementById('ex-rp-amount').value=1314">1314</button>
            </div>
            <input id="ex-rp-msg" type="text" maxlength="40" placeholder="祝福语（选填）" style="width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; margin-bottom:10px; box-sizing:border-box;">
            <button class="ex-primary-btn" style="width:100%;" onclick="exSendRedpacket()">🧧 发送红包</button>
        </div>
        <div style="background:var(--message-received-bg); border-radius:14px; padding:14px; margin-bottom:14px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:10px;">${exEscape(exPartnerName())} 发来的红包</div>
            <div id="ex-rp-inbox"></div>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin:14px 0 8px;">📜 红包记录</div>
        <div id="ex-rp-list"></div>
    `);
    exRenderRpInbox();
    exRenderRpList();
}

window.exSendRedpacket = function() {
    const amt = parseInt(document.getElementById('ex-rp-amount').value, 10);
    const msg = document.getElementById('ex-rp-msg').value.trim() || '一点心意，请笑纳。';
    if (!amt || amt <= 0) { showNotification('请输入有效金额', 'warning'); return; }
    if (amt > exData.coins) { showNotification('金币不足', 'error'); return; }
    exData.coins -= amt;
    const rp = { id:'rp_'+Date.now(), from:'me', amount:amt, message:msg, time:exNow(), opened:false };
    exData.redpackets.push(rp);
    exSave();
    // 同步到聊天
    if (typeof addMessage === 'function') {
        addMessage({ id: Date.now(), sender:'user', text:`【红包】🧧 ${amt} 金币\n${msg}`, timestamp:new Date(), status:'sent', type:'redpacket' });
    }
    // 对方自动回红包（概率）
    if (Math.random() < 0.5) {
        const replyAmt = Math.floor(amt * (0.8 + Math.random()*0.6));
        const replyRp = { id:'rp_'+Date.now()+1, from:'partner', amount:replyAmt, message:'回礼～收下吧', time:exNow(), opened:false };
        setTimeout(() => {
            exData.redpackets.push(replyRp);
            exData.partnerCoins -= replyAmt;
            exSave();
            exRenderRpInbox();
            if (typeof playSound === 'function') playSound('partner_message');
            showNotification(`${exPartnerName()} 回了你一个红包 🧧`, 'success', 4000);
        }, 2000 + Math.random()*3000);
    }
    exSave();
    exViewRedpacket();
    showNotification(`红包已送出 ${exCoin(amt)}`, 'success');
};

function exRenderRpInbox() {
    const el = document.getElementById('ex-rp-inbox');
    if (!el) return;
    const inbox = exData.redpackets.filter(r => r.from === 'partner' && !r.opened);
    if (!inbox.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:10px;">暂无未拆红包</div>`;
        return;
    }
    el.innerHTML = inbox.map(r => `
        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--primary-bg); border:1px solid var(--border-color); border-radius:10px; padding:10px 12px; margin-bottom:8px;">
            <div>
                <div style="font-size:13px; font-weight:600; color:var(--text-primary);">🧧 ${exCoin(r.amount)}</div>
                <div style="font-size:11px; color:var(--text-secondary);">${exEscape(r.message)}</div>
            </div>
            <button class="ex-primary-btn" style="padding:6px 14px; font-size:12px;" onclick="exOpenRedpacket('${r.id}')">拆开</button>
        </div>
    `).join('');
}

window.exOpenRedpacket = function(id) {
    const rp = exData.redpackets.find(r => r.id === id);
    if (!rp || rp.opened) return;
    rp.opened = true;
    rp.openedBy = 'me';
    exData.coins += rp.amount;
    exSave();
    exRenderRpInbox();
    exRenderRpList();
    showNotification(`拆开红包，获得 ${exCoin(rp.amount)} ✨`, 'success');
    if (typeof playSound === 'function') playSound('favorite');
};

function exRenderRpList() {
    const el = document.getElementById('ex-rp-list');
    if (!el) return;
    const list = exData.redpackets.slice().reverse().slice(0, 10);
    if (!list.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:10px;">还没有红包记录</div>`;
        return;
    }
    el.innerHTML = list.map(r => {
        const from = r.from === 'me' ? `我 → ${exPartnerName()}` : `${exPartnerName()} → 我`;
        const status = r.from === 'me' ? (r.opened ? '已收' : '待领') : (r.opened ? '已拆' : '未拆');
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid var(--border-color); font-size:12px;">
                <div>
                    <span style="color:var(--text-primary); font-weight:500;">${from}</span>
                    <span style="color:var(--accent-color); margin-left:6px;">${exCoin(r.amount)}</span>
                </div>
                <span style="color:var(--text-secondary); font-size:11px;">${status} · ${exFmtDate(r.time).slice(5)}</span>
            </div>
        `;
    }).join('');
}

/* ============ 2. 撤回消息 ============ */
function exViewRecall() {
    exSetBody(exHeader('↩ 撤回消息', '撤回你已发送的消息') + `
        <div style="font-size:12px; color:var(--text-secondary); background:var(--primary-bg); border-radius:10px; padding:10px 12px; margin-bottom:14px;">
            <i class="fas fa-info-circle"></i> 撤回后，聊天中会显示"你撤回了一条消息"。仅可撤回你发送的消息。
        </div>
        <div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:13px; font-weight:600; color:var(--text-primary);">最近发送的消息</span>
            <span style="font-size:11px; color:var(--text-secondary);">点击撤回</span>
        </div>
        <div id="ex-recall-list"></div>
    `);
    exRenderRecallList();
}

function exRenderRecallList() {
    const el = document.getElementById('ex-recall-list');
    if (!el) return;
    let msgs = [];
    try { msgs = (typeof messages !== 'undefined' ? messages : []).filter(m => m.sender === 'user' && !m.recalled); } catch(e) {}
    if (!msgs.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:20px;">暂无可撤回的消息</div>`;
        return;
    }
    el.innerHTML = msgs.slice().reverse().slice(0, 15).map(m => {
        const text = (m.text || '').replace(/\n/g,' ').slice(0, 40);
        return `
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--message-sent-bg); border-radius:10px; padding:10px 12px; margin-bottom:8px;">
                <div style="min-width:0; flex:1; margin-right:10px;">
                    <div style="font-size:11px; color:var(--text-secondary);">${exFmtDate(m.timestamp)}</div>
                    <div style="font-size:13px; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${exEscape(text)}</div>
                </div>
                <button class="ex-danger-btn" style="padding:6px 12px; font-size:12px;" onclick="exRecallOne(${m.id})">撤回</button>
            </div>
        `;
    }).join('');
}

window.exRecallOne = function(id) {
    if (!confirm('确定撤回这条消息吗？')) return;
    try {
        const m = messages.find(x => x.id === id);
        if (!m) { showNotification('消息不存在', 'error'); return; }
        // 保留原内容便于潜在恢复，将消息渲染为系统提示
        m._originalType = m.type;
        m._originalText = m.text;
        m._originalSender = m.sender;
        m.recalled = true;
        m.recalledAt = exNow();
        m.type = 'system';
        m.text = '你撤回了一条消息';
        if (typeof throttledSaveData === 'function') throttledSaveData();
        if (typeof renderMessages === 'function') renderMessages(true);
        showNotification('已撤回', 'success');
        exRenderRecallList();
    } catch(e) { showNotification('撤回失败', 'error'); }
};

/* ============ 3. 礼物商城 ============ */
const SHOP_ITEMS = [
    { key:'rose', name:'玫瑰花', emoji:'🌹', price:99, reply:'谢谢你，好喜欢～' },
    { key:'cake', name:'小蛋糕', emoji:'🍰', price:188, reply:'看起来好好吃，一起吃吧！' },
    { key:'ring', name:'戒指', emoji:'💍', price:5200, reply:'……嗯，我会一直戴着它的。' },
    { key:'necklace', name:'项链', emoji:'📿', price:1314, reply:'很漂亮，谢谢你的心意。' },
    { key:'bear', name:'玩偶熊', emoji:'🧸', price:266, reply:'软软的，我会好好抱着它睡。' },
    { key:'chocolate', name:'巧克力', emoji:'🍫', price:120, reply:'甜甜的，像你一样。' },
    { key:'flowers', name:'花束', emoji:'💐', price:299, reply:'好香好美，我会养起来的。' },
    { key:'star', name:'星星', emoji:'⭐', price:50, reply:'送我一整个夜空吗？' },
    { key:'moon', name:'月亮', emoji:'🌙', price:9999, reply:'……你是认真的吗？那我收下了。' },
    { key:'cat', name:'小猫', emoji:'🐈', price:520, reply:'喵～我们一起养它吧。' },
    { key:'icecream', name:'冰淇淋', emoji:'🍦', price:66, reply:'下次见面一起吃！' },
    { key:'letter', name:'情书', emoji:'💌', price:1, reply:'我也想给你写一封……' },
];

function exViewShop() {
    exStartUsage();
    exSetBody(exHeader('🛍 礼物商城', `给 ${exEscape(exPartnerName())} 买东西 · 我的 ${exCoin(exData.coins)}`) + `
        <div style="background:var(--message-received-bg); border:1px dashed var(--accent-color); border-radius:12px; padding:10px 12px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div style="font-size:12px; color:var(--text-secondary);">商品可自由添加/编辑/删除</div>
            <button class="ex-primary-btn" style="padding:6px 14px; font-size:12px;" onclick="exShopEditForm()"><i class="fas fa-plus"></i> 添加</button>
        </div>
        <div class="ex-shop-grid" id="ex-shop-grid"></div>
        <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin:18px 0 8px;">🎁 已送出的礼物</div>
        <div id="ex-shop-sent"></div>
    `);
    const grid = document.getElementById('ex-shop-grid');
    const items = exData.shopItems || [];
    grid.innerHTML = items.map(it => {
        const afford = exData.coins >= it.price;
        return `
            <div class="ex-shop-card" style="${afford?'':'opacity:0.5;'} position:relative;">
                <div style="position:absolute; top:3px; right:4px; display:flex; gap:2px;">
                    <button class="ex-quick-btn" style="padding:1px 5px; font-size:9px; line-height:1.2;" title="编辑" onclick="exShopEditForm('${it.key}')"><i class="fas fa-pen"></i></button>
                    ${it.custom?`<button class="ex-danger-btn" style="padding:1px 5px; font-size:9px; line-height:1.2;" title="删除" onclick="exShopDel('${it.key}')"><i class="fas fa-times"></i></button>`:''}
                </div>
                <div style="font-size:30px; text-align:center; margin-bottom:6px;">${it.emoji}</div>
                <div style="font-size:13px; font-weight:600; color:var(--text-primary); text-align:center;">${exEscape(it.name)}</div>
                <div style="font-size:11px; color:var(--accent-color); text-align:center; margin:4px 0 8px;">${exCoin(it.price)}</div>
                <button class="ex-primary-btn" style="width:100%; padding:6px 0; font-size:12px;" ${afford?'':'disabled'} onclick="exBuyGift('${it.key}')">送给Ta</button>
            </div>
        `;
    }).join('');
    exRenderShopSent();
}

window.exBuyGift = function(key) {
    const it = (exData.shopItems || []).find(i => i.key === key);
    if (!it) return;
    if (exData.coins < it.price) { showNotification('金币不足', 'error'); return; }
    exData.coins -= it.price;
    const record = { id:'gift_'+Date.now(), itemKey:key, itemName:it.name, emoji:it.emoji, price:it.price, time:exNow(), reply:it.reply };
    exData.shopSent.push(record);
    exSave();
    if (typeof addMessage === 'function') {
        addMessage({ id: Date.now(), sender:'user', text:`【送礼物】${it.emoji} 送给 ${exPartnerName()} 一个 ${it.name}`, timestamp:new Date(), status:'sent', type:'gift' });
    }
    setTimeout(() => {
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now()+1, sender:'partner', text:`${it.emoji} ${it.reply}`, timestamp:new Date(), status:'received', type:'normal' });
        }
        if (typeof playSound === 'function') playSound('partner_message');
    }, 1500 + Math.random()*1500);
    exViewShop();
    showNotification(`已送出 ${it.emoji} ${it.name}`, 'success');
};

/* 商品添加/编辑表单 */
window.exShopEditForm = function(key) {
    const it = key ? (exData.shopItems||[]).find(i=>i.key===key) : null;
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.style.zIndex = '10010';
    const f = (id,label,type,val,ph) => `
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">${label}</div>
        <input id="${id}" type="${type}" value="${val}" placeholder="${ph}" style="width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; margin-bottom:12px; box-sizing:border-box;">`;
    overlay.innerHTML = `
        <div class="modal-content" style="max-width:340px; padding:18px;">
            <div style="font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:14px;">${it?'✏️ 编辑商品':'➕ 添加商品'}</div>
            ${f('ex-shop-emoji','图标（emoji）','text', it?exEscape(it.emoji):'🎁', '🎁')}
            ${f('ex-shop-name','名称','text', it?exEscape(it.name):'', '礼物名')}
            ${f('ex-shop-price','价格（金币）','number', it?it.price:'', '100')}
            ${f('ex-shop-reply','对方收到后的话','text', it?exEscape(it.reply):'', '谢谢你～')}
            <div style="display:flex; gap:8px; margin-top:6px;">
                <button class="modal-btn modal-btn-secondary" style="flex:1;" onclick="this.closest('.modal').remove()">取消</button>
                <button class="modal-btn modal-btn-primary" style="flex:1;" onclick="exShopSave('${key||''}', this)">保存</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    showModal(overlay);
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
};

window.exShopSave = function(key, btn) {
    const emoji = (document.getElementById('ex-shop-emoji').value.trim() || '🎁').slice(0,4);
    const name = document.getElementById('ex-shop-name').value.trim();
    const price = parseInt(document.getElementById('ex-shop-price').value, 10);
    const reply = document.getElementById('ex-shop-reply').value.trim() || '谢谢～';
    if (!name) { showNotification('请输入名称', 'warning'); return; }
    if (isNaN(price) || price < 0) { showNotification('请输入有效价格', 'warning'); return; }
    if (key) {
        const it = (exData.shopItems||[]).find(i=>i.key===key);
        if (it) { it.emoji=emoji; it.name=name; it.price=price; it.reply=reply; }
    } else {
        exData.shopItems.push({ key:'shop_'+Date.now(), emoji, name, price, reply, custom:true });
    }
    exSave();
    btn.closest('.modal').remove();
    exViewShop();
    showNotification('已保存', 'success');
};

window.exShopDel = function(key) {
    if (!confirm('删除该商品？')) return;
    exData.shopItems = (exData.shopItems||[]).filter(i=>i.key!==key);
    exSave();
    exViewShop();
    showNotification('已删除', 'success');
};

function exRenderShopSent() {
    const el = document.getElementById('ex-shop-sent');
    if (!el) return;
    const list = exData.shopSent.slice().reverse().slice(0, 8);
    if (!list.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:10px;">还没送出过礼物</div>`;
        return;
    }
    el.innerHTML = list.map(g => `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--border-color); font-size:12px;">
            <span style="font-size:20px;">${g.emoji}</span>
            <div style="flex:1; min-width:0;">
                <div style="color:var(--text-primary); font-weight:500;">${exEscape(g.itemName)} <span style="color:var(--accent-color);">${exCoin(g.price)}</span></div>
                <div style="color:var(--text-secondary); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${exEscape(g.reply)}</div>
            </div>
            <span style="color:var(--text-secondary); font-size:10px;">${exFmtDate(g.time).slice(5)}</span>
        </div>
    `).join('');
}

/* ============ 4. 你问我答 ============ */
let exQaMode = 'open';          // 'open' 开放问答 | 'choice' 选择题
let exQaOptions = ['', ''];     // 选择题选项

function exViewQa() {
    exStartUsage();
    exSetBody(exHeader('❓ 你问我答', `向 ${exEscape(exPartnerName())} 提问，等待解答`) + `
        <div style="background:var(--message-sent-bg); border-radius:14px; padding:14px; margin-bottom:14px;">
            <div style="display:flex; gap:6px; margin-bottom:10px;">
                <button class="ex-quick-btn" id="ex-qa-mode-open" style="flex:1; ${exQaMode==='open'?'border-color:var(--accent-color); font-weight:600; color:var(--accent-color);':''}" onclick="exQaSetMode('open')">💬 开放问答</button>
                <button class="ex-quick-btn" id="ex-qa-mode-choice" style="flex:1; ${exQaMode==='choice'?'border-color:var(--accent-color); font-weight:600; color:var(--accent-color);':''}" onclick="exQaSetMode('choice')">📋 选择题</button>
            </div>
            <textarea id="ex-qa-input" placeholder="想问 ${exPartnerName()} 什么…" style="width:100%; min-height:64px; padding:10px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; box-sizing:border-box; resize:vertical;"></textarea>
            <div id="ex-qa-options-wrap" style="${exQaMode==='choice'?'':'display:none;'} margin-top:8px;"></div>
            <button class="ex-primary-btn" style="width:100%; margin-top:8px;" onclick="exAskQuestion()">提问</button>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin:14px 0 8px;">💭 历史问答</div>
        <div id="ex-qa-list"></div>
    `);
    exRenderQaOptions();
    exRenderQaList();
}

window.exQaSetMode = function(m) {
    exQaMode = m;
    if (m === 'choice' && exQaOptions.length < 2) exQaOptions = ['', ''];
    exViewQa();
};

function exRenderQaOptions() {
    const wrap = document.getElementById('ex-qa-options-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">选项（2~4 个，${exEscape(exPartnerName())} 会从中选一个）</div>
        ${exQaOptions.map((opt, i) => `
            <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                <span style="font-size:13px; color:var(--accent-color); font-weight:600; width:18px; flex-shrink:0;">${String.fromCharCode(65+i)}.</span>
                <input type="text" value="${exEscape(opt)}" placeholder="选项 ${i+1}" oninput="exQaOptions[${i}]=this.value" style="flex:1; min-width:0; padding:7px 10px; border:1px solid var(--border-color); border-radius:8px; background:var(--primary-bg); color:var(--text-primary); font-size:12px;">
                ${exQaOptions.length>2?`<button class="ex-danger-btn" style="padding:5px 8px; font-size:11px;" onclick="exQaDelOpt(${i})">×</button>`:''}
            </div>
        `).join('')}
        ${exQaOptions.length<4?`<button class="ex-quick-btn" style="font-size:11px; margin-top:4px;" onclick="exQaAddOpt()"><i class="fas fa-plus"></i> 添加选项</button>`:''}
    `;
}

window.exQaAddOpt = function() { if (exQaOptions.length < 4) { exQaOptions.push(''); exRenderQaOptions(); } };
window.exQaDelOpt = function(i) { if (exQaOptions.length > 2) { exQaOptions.splice(i, 1); exRenderQaOptions(); } };

window.exAskQuestion = function() {
    const q = document.getElementById('ex-qa-input').value.trim();
    if (!q) { showNotification('请输入问题', 'warning'); return; }
    const opts = exQaMode === 'choice' ? exQaOptions.map(s=>s.trim()).filter(s=>s) : null;
    if (exQaMode === 'choice' && (!opts || opts.length < 2)) { showNotification('至少填 2 个选项', 'warning'); return; }
    const rec = { id:'qa_'+Date.now(), question:q, mode:exQaMode, options:opts, answer:null, time:exNow(), answered:false };
    exData.qaHistory.push(rec);
    exSave();
    if (typeof addMessage === 'function') {
        const qText = `【提问】❓ ${q}${opts? '\n'+opts.map((o,i)=>String.fromCharCode(65+i)+'. '+o).join('\n'):''}`;
        addMessage({ id: Date.now(), sender:'user', text:qText, timestamp:new Date(), status:'sent', type:'qa' });
    }
    exRenderQaList();
    document.getElementById('ex-qa-input').value = '';
    showNotification('问题已发出，等待解答…', 'info');
    const delay = 1500 + Math.random()*2500;
    setTimeout(() => {
        if (opts) {
            rec.answer = opts[Math.floor(Math.random()*opts.length)];
            rec.answerMode = 'choice';
        } else {
            rec.answer = exGenerateReply(2);
            rec.answerMode = 'open';
        }
        rec.answered = true;
        rec.answerTime = exNow();
        exSave();
        if (typeof addMessage === 'function') {
            const atext = opts ? `我选「${rec.answer}」` : `【回答】${rec.answer}`;
            addMessage({ id: Date.now()+1, sender:'partner', text:atext, timestamp:new Date(), status:'received', type:'normal' });
        }
        if (typeof playSound === 'function') playSound('partner_message');
        exRenderQaList();
    }, delay);
};

function exRenderQaList() {
    const el = document.getElementById('ex-qa-list');
    if (!el) return;
    const list = exData.qaHistory.slice().reverse().slice(0, 10);
    if (!list.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:20px;">还没有提问记录</div>`;
        return;
    }
    el.innerHTML = list.map(r => {
        const optsHtml = r.options && r.options.length ? `<div style="margin:6px 0; padding-left:8px; border-left:2px solid var(--border-color); font-size:12px; color:var(--text-secondary);">${r.options.map((o,i)=>`<div>${String.fromCharCode(65+i)}. ${exEscape(o)} ${r.answered && r.answerMode==='choice' && r.answer===o?'<span style="color:var(--accent-color);">✓</span>':''}</div>`).join('')}</div>` : '';
        return `
            <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:10px;">
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">${exFmtDate(r.time)} · ${r.mode==='choice'?'📋 选择题':'💬 开放问答'}</div>
                <div style="font-size:13px; color:var(--text-primary); margin-bottom:4px;"><span style="color:var(--accent-color);">问：</span>${exEscape(r.question)}</div>
                ${optsHtml}
                ${r.answered ? `<div style="font-size:13px; color:var(--text-primary); margin-top:6px;"><span style="color:#6BCB77;">答：</span>${exEscape(r.answer)}</div>` : `<div style="font-size:12px; color:var(--text-secondary); font-style:italic; margin-top:6px;">⏳ ${exEscape(exPartnerName())} 正在思考…</div>`}
            </div>
        `;
    }).join('');
}

/* ============ 5. 月经记录 ============ */
let exPeriodCursor = new Date();

function exViewPeriod() {
    exSetBody(exHeader('🌸 月经记录', '记录周期，预测下次') + `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
            <button class="ex-nav-btn" onclick="exPeriodMonth(-1)"><i class="fas fa-chevron-left"></i></button>
            <div id="ex-period-label" style="font-size:14px; font-weight:600; color:var(--text-primary);"></div>
            <button class="ex-nav-btn" onclick="exPeriodMonth(1)"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="ex-period-weekdays"><div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div></div>
        <div class="ex-period-grid" id="ex-period-grid"></div>
        <div style="margin-top:14px;" id="ex-period-predict"></div>
        <div style="margin-top:14px; font-size:12px; color:var(--text-secondary); background:var(--primary-bg); border-radius:10px; padding:10px 12px;">
            <div style="margin-bottom:6px; color:var(--text-primary); font-weight:500;">图例</div>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <span><span class="ex-legend" style="background:#FF6B6B;"></span> 经期</span>
                <span><span class="ex-legend" style="background:#FFD93D;"></span> 易孕期</span>
                <span><span class="ex-legend" style="background:#A8D8EA;"></span> 安全期</span>
            </div>
        </div>
    `);
    exRenderPeriod();
}

window.exPeriodMonth = function(dir) {
    const y = exPeriodCursor.getFullYear();
    const m = exPeriodCursor.getMonth();
    exPeriodCursor = new Date(y, m + dir, 1);
    exRenderPeriod();
};

function exRenderPeriod() {
    const label = document.getElementById('ex-period-label');
    const grid = document.getElementById('ex-period-grid');
    if (!label || !grid) return;
    const y = exPeriodCursor.getFullYear();
    const m = exPeriodCursor.getMonth();
    label.textContent = `${y}年 ${m+1}月`;
    grid.innerHTML = '';
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    // 计算经期与易孕期
    const periodDays = Object.keys(exData.periodLogs).filter(k => exData.periodLogs[k].flow).sort();
    let lastPeriodStart = null;
    if (periodDays.length) lastPeriodStart = periodDays[periodDays.length-1];
    for (let i=0; i<firstDay; i++) grid.innerHTML += `<div class="ex-period-cell empty"></div>`;
    for (let d=1; d<=daysInMonth; d++) {
        const dateObj = new Date(y, m, d);
        const ds = exFmtDateStr(dateObj);
        const log = exData.periodLogs[ds];
        let cls = 'ex-period-cell';
        let dot = '';
        if (log && log.flow) { cls += ' period'; }
        else if (lastPeriodStart) {
            const lastStart = new Date(lastPeriodStart);
            const diffDays = Math.round((dateObj - lastStart) / (1000*60*60*24));
            if (diffDays >= 0 && diffDays < exData.periodCycle) {
                // 排卵日约周期-14
                const ovulation = exData.periodCycle - 14;
                if (diffDays >= ovulation-3 && diffDays <= ovulation+3) cls += ' fertile';
                else if (diffDays < 5) cls += ' period-end'; // 经期末尾
                else cls += ' safe';
            }
        }
        const today = new Date();
        if (exFmtDateStr(today) === ds) cls += ' today';
        grid.innerHTML += `<div class="${cls}" onclick="exPeriodEdit('${ds}')"><span>${d}</span>${dot}</div>`;
    }
    exRenderPeriodPredict();
}

function exRenderPeriodPredict() {
    const el = document.getElementById('ex-period-predict');
    if (!el) return;
    const periodDays = Object.keys(exData.periodLogs).filter(k => exData.periodLogs[k].flow).sort();
    if (!periodDays.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); background:var(--message-received-bg); border-radius:10px; padding:10px 12px;">还没有记录，点击日期开始记录经期。</div>`;
        return;
    }
    // 计算平均周期
    const starts = [];
    const sorted = [...periodDays].sort();
    for (let i=0; i<sorted.length; i++) {
        // 简化：把每个有记录的经期第一天视为起点（实际应聚合连续段）
        if (i===0 || new Date(sorted[i]) - new Date(sorted[i-1]) > 2) starts.push(new Date(sorted[i]));
    }
    if (starts.length >= 2) {
        let total = 0;
        for (let i=1; i<starts.length; i++) total += (starts[i]-starts[i-1])/(1000*60*60*24);
        exData.periodCycle = Math.round(total / (starts.length-1));
    }
    const lastStart = starts[starts.length-1];
    const nextStart = new Date(lastStart.getTime() + exData.periodCycle*24*60*60*1000);
    const daysLeft = Math.ceil((nextStart - new Date()) / (1000*60*60*24));
    exSave();
    el.innerHTML = `
        <div style="font-size:12px; color:var(--text-secondary); background:var(--message-received-bg); border-radius:10px; padding:10px 12px;">
            <div style="margin-bottom:4px;">📊 平均周期：<span style="color:var(--accent-color); font-weight:600;">${exData.periodCycle} 天</span></div>
            <div style="margin-bottom:4px;">🌸 上次经期：${exFmtDate(lastStart).slice(0,10)}</div>
            <div>📅 预计下次：<span style="color:var(--accent-color); font-weight:600;">${exFmtDate(nextStart).slice(0,10)}</span>（还剩 ${daysLeft>0?daysLeft:0} 天）</div>
        </div>
    `;
}

window.exPeriodEdit = function(ds) {
    const existing = exData.periodLogs[ds] || {};
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.style.zIndex = '10010';
    const [y,mo,d] = ds.split('-');
    overlay.innerHTML = `
        <div class="modal-content" style="max-width:360px; padding:18px;">
            <div style="font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:14px;">🌸 ${mo}月${d}日 记录</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">流量</div>
            <select id="ex-period-flow" style="width:100%; padding:9px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); margin-bottom:12px; box-sizing:border-box;">
                <option value="">无</option>
                <option value="light" ${existing.flow==='light'?'selected':''}>少量</option>
                <option value="medium" ${existing.flow==='medium'?'selected':''}>中等</option>
                <option value="heavy" ${existing.flow==='heavy'?'selected':''}>大量</option>
            </select>
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">症状</div>
            <input id="ex-period-sym" type="text" value="${exEscape(existing.symptoms||'')}" placeholder="如：痛经、疲惫、情绪波动" style="width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); margin-bottom:12px; box-sizing:border-box;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">备注</div>
            <textarea id="ex-period-note" style="width:100%; min-height:60px; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); margin-bottom:14px; box-sizing:border-box; resize:vertical;">${exEscape(existing.note||'')}</textarea>
            <div style="display:flex; gap:8px;">
                <button class="modal-btn modal-btn-secondary" style="flex:1;" onclick="this.closest('.modal').remove()">取消</button>
                <button class="modal-btn modal-btn-primary" style="flex:1;" onclick="exPeriodSave('${ds}', this)">保存</button>
            </div>
            ${existing.flow ? `<button class="ex-danger-btn" style="width:100%; margin-top:10px; padding:8px;" onclick="exPeriodDelete('${ds}', this)">删除记录</button>` : ''}
        </div>
    `;
    document.body.appendChild(overlay);
    showModal(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
};

window.exPeriodSave = function(ds, btn) {
    const flow = document.getElementById('ex-period-flow').value;
    const sym = document.getElementById('ex-period-sym').value.trim();
    const note = document.getElementById('ex-period-note').value.trim();
    if (!flow && !sym && !note) { delete exData.periodLogs[ds]; }
    else { exData.periodLogs[ds] = { flow, symptoms:sym, note }; }
    exSave();
    btn.closest('.modal').remove();
    exRenderPeriod();
    showNotification('已记录', 'success');
    if (typeof playSound === 'function') playSound('mood');
};

window.exPeriodDelete = function(ds, btn) {
    if (!confirm('删除这一天的记录？')) return;
    delete exData.periodLogs[ds];
    exSave();
    btn.closest('.modal').remove();
    exRenderPeriod();
    showNotification('已删除', 'success');
};

/* ============ 6. 时间状态监测 ============ */
let exStatusTimer = null;

function exViewStatus() {
    exSetBody(exHeader('🕐 时间状态', `监测 ${exEscape(exPartnerName())} 的当前时辰`) + `
        <div style="background:var(--message-received-bg); border-radius:14px; padding:18px; margin-bottom:14px; text-align:center;">
            <div id="ex-status-emoji" style="font-size:54px; margin-bottom:8px;">🌙</div>
            <div id="ex-status-time" style="font-size:24px; font-weight:700; color:var(--text-primary);">--:--</div>
            <div id="ex-status-activity" style="font-size:13px; color:var(--text-secondary); margin-top:6px;">—</div>
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:14px;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">对方时区（相对 UTC+8 的偏移小时）</div>
            <div style="display:flex; gap:8px; align-items:center;">
                <input id="ex-tz-input" type="number" value="${exData.partnerTzOffset}" min="-12" max="14" style="flex:1; padding:8px; border:1px solid var(--border-color); border-radius:8px; background:var(--secondary-bg); color:var(--text-primary);">
                <button class="ex-primary-btn" style="padding:8px 14px; font-size:12px;" onclick="exSaveTz()">设置</button>
            </div>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin:14px 0 8px;">📋 一日作息表</div>
        <div id="ex-status-schedule"></div>
    `);
    exRenderStatusSchedule();
    exUpdateStatus();
    if (exStatusTimer) clearInterval(exStatusTimer);
    exStatusTimer = setInterval(exUpdateStatus, 1000);
    // 离开时清理
    const modal = document.getElementById('extras-modal');
    const cleanup = () => { if (exStatusTimer) { clearInterval(exStatusTimer); exStatusTimer = null; } };
    if (modal) {
        const onHide = () => setTimeout(() => {
            if (modal.style.display === 'none') cleanup();
        }, 400);
        const obs = new MutationObserver(() => { if (modal.style.display === 'none') onHide(); });
        obs.observe(modal, { attributes:true, attributeFilter:['style'] });
    }
}

window.exSaveTz = function() {
    const v = parseInt(document.getElementById('ex-tz-input').value, 10);
    if (isNaN(v)) { showNotification('请输入有效数字', 'warning'); return; }
    exData.partnerTzOffset = Math.max(-12, Math.min(14, v));
    exSave();
    exUpdateStatus();
    showNotification('时区已设置', 'success');
};

function exPartnerNow() {
    // 本地时间 + (对方偏移 - 本地偏移)
    const now = new Date();
    const localOffset = -now.getTimezoneOffset() / 60; // 本地相对 UTC 小时
    const targetOffset = localOffset + exData.partnerTzOffset;
    const utc = now.getTime() + now.getTimezoneOffset()*60000;
    return new Date(utc + targetOffset*3600000);
}

function exActivityForHour(h) {
    if (h >= 0 && h < 6) return { emoji:'😴', activity:'熟睡中', desc:'嘘，Ta 正在做美梦' };
    if (h >= 6 && h < 8) return { emoji:'🌅', activity:'刚起床', desc:'清晨的第一缕阳光' };
    if (h >= 8 && h < 9) return { emoji:'🍳', activity:'吃早餐', desc:'一天活力的开始' };
    if (h >= 9 && h < 12) return { emoji:'💼', activity:'忙碌中', desc:'可能没法及时回复' };
    if (h >= 12 && h < 14) return { emoji:'🍱', activity:'午餐 & 休息', desc:'吃饱了才有力气' };
    if (h >= 14 && h < 17) return { emoji:'📚', activity:'专注中', desc:'沉浸在自己的世界' };
    if (h >= 17 && h < 19) return { emoji:'🌆', activity:'收工 / 晚餐', desc:'一天将尽的温柔' };
    if (h >= 19 && h < 22) return { emoji:'🌙', activity:'晚间放松', desc:'适合闲聊的时候' };
    return { emoji:'🛏', activity:'准备入睡', desc:'道一声晚安吧' };
}

function exUpdateStatus() {
    const now = exPartnerNow();
    const h = now.getHours();
    const p = x => String(x).padStart(2,'0');
    const timeStr = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    const act = exActivityForHour(h);
    const tEl = document.getElementById('ex-status-time');
    const eEl = document.getElementById('ex-status-emoji');
    const aEl = document.getElementById('ex-status-activity');
    if (tEl) tEl.textContent = timeStr;
    if (eEl) eEl.textContent = act.emoji;
    if (aEl) aEl.innerHTML = `<span style="color:var(--accent-color); font-weight:600;">${exEscape(exPartnerName())}</span> · ${exEscape(act.activity)}<br><span style="font-size:11px;">${exEscape(act.desc)}</span>`;
}

function exRenderStatusSchedule() {
    const el = document.getElementById('ex-status-schedule');
    if (!el) return;
    const now = exPartnerNow();
    const curH = now.getHours();
    const slots = [
        {h:'00-06', e:'😴', a:'熟睡中'},
        {h:'06-08', e:'🌅', a:'起床'},
        {h:'08-09', e:'🍳', a:'早餐'},
        {h:'09-12', e:'💼', a:'忙碌'},
        {h:'12-14', e:'🍱', a:'午餐'},
        {h:'14-17', e:'📚', a:'专注'},
        {h:'17-19', e:'🌆', a:'晚餐'},
        {h:'19-22', e:'🌙', a:'晚间'},
        {h:'22-24', e:'🛏', a:'准备睡'},
    ];
    el.innerHTML = slots.map(s => {
        const range = s.h.split('-').map(Number);
        const active = curH >= range[0] && curH < range[1];
        return `<div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; ${active?'background:var(--message-received-bg); border:1px solid var(--accent-color);':'border-bottom:1px solid var(--border-color);'} font-size:12px;">
            <span style="font-size:18px;">${s.e}</span>
            <span style="color:var(--text-secondary); min-width:60px;">${s.h}</span>
            <span style="color:var(--text-primary);">${s.a}</span>
            ${active?'<span style="margin-left:auto; color:var(--accent-color); font-size:10px;">●此刻</span>':''}
        </div>`;
    }).join('');
}

/* ============ 7. 一起读书 ============ */
function exViewReading() {
    exSetBody(exHeader('📖 一起读书', '与对方共读，记录进度') + `
        <div style="background:var(--message-received-bg); border:1px dashed var(--accent-color); border-radius:14px; padding:14px; margin-bottom:14px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:6px;">📁 从文件导入</div>
            <div style="font-size:11px; color:var(--text-secondary); margin-bottom:10px;">支持 .txt / .md / .epub，导入后可在此直接阅读并记录进度</div>
            <label class="ex-primary-btn" style="display:block; text-align:center; cursor:pointer;">
                <i class="fas fa-file-import"></i> 选择文件导入
                <input type="file" accept=".txt,.md,.text,.epub" style="display:none;" onchange="exImportBook(this)">
            </label>
            <div id="ex-rd-import-status" style="font-size:11px; color:var(--text-secondary); text-align:center; margin-top:8px;"></div>
        </div>
        <div style="background:var(--message-sent-bg); border-radius:14px; padding:14px; margin-bottom:14px;">
            <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:10px;">手动添加书目</div>
            <input id="ex-rd-title" type="text" placeholder="书名" style="width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; margin-bottom:8px; box-sizing:border-box;">
            <div style="display:flex; gap:8px; margin-bottom:8px;">
                <input id="ex-rd-author" type="text" placeholder="作者（选填）" style="flex:1; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:12px; box-sizing:border-box;">
                <input id="ex-rd-pages" type="number" placeholder="总页数" style="width:90px; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:12px; box-sizing:border-box;">
            </div>
            <button class="ex-primary-btn" style="width:100%;" onclick="exAddBook()">加入书单</button>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin:14px 0 8px;">📚 书单</div>
        <div id="ex-rd-list"></div>
    `);
    exRenderReadingList();
}

window.exAddBook = function() {
    const title = document.getElementById('ex-rd-title').value.trim();
    const author = document.getElementById('ex-rd-author').value.trim();
    const pages = parseInt(document.getElementById('ex-rd-pages').value, 10);
    if (!title) { showNotification('请输入书名', 'warning'); return; }
    const book = { id:'bk_'+Date.now(), title, author, pages:pages||0, myPage:0, partnerPage:Math.floor(Math.random()*30), finished:false, addedAt:exNow() };
    exData.reading.books.push(book);
    if (!exData.reading.currentId) exData.reading.currentId = book.id;
    exSave();
    exViewReading();
    showNotification('已加入书单', 'success');
};

/* 读取文件文本，自动识别 UTF-8 / GBK 编码 */
function exReadText(file, cb) {
    const reader = new FileReader();
    reader.onload = e => {
        const buf = e.target.result;
        let text;
        try {
            text = new TextDecoder('utf-8').decode(buf);
            if (text.indexOf('\uFFFD') !== -1) throw new Error('try gbk');
        } catch (err) {
            try { text = new TextDecoder('gbk').decode(buf); }
            catch (e2) { text = new TextDecoder('utf-8').decode(buf); }
        }
        cb(text);
    };
    reader.onerror = () => cb(null);
    reader.readAsArrayBuffer(file);
}

/* 解析 epub：用 JSZip 解压并提取所有 XHTML 文本 */
async function exParseEpub(file, statusEl) {
    if (typeof JSZip === 'undefined') {
        if (statusEl) statusEl.textContent = 'epub 解析需要 JSZip（未加载）';
        return null;
    }
    try {
        const zip = await JSZip.loadAsync(file);
        // 读取 container.xml 定位 opf（更精确），失败则直接扫描 xhtml
        let opfPath = null;
        try {
            const container = await zip.file('META-INF/container.xml').async('string');
            const m = container.match(/full-path="([^"]+\.opf)"/i);
            if (m) opfPath = m[1];
        } catch (e) {}
        // 找到 opf 所在目录，扫描其中的 xhtml/htm
        const baseDir = opfPath ? opfPath.replace(/[^/]+$/,'') : '';
        const htmlFiles = Object.keys(zip.files).filter(k =>
            !zip.files[k].dir && /\.(x?html?|htm)$/i.test(k)
        );
        htmlFiles.sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
        const contents = [];
        for (const k of htmlFiles) {
            const raw = await zip.files[k].async('string');
            // 提取 body 内容，去标签转文本
            const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            let body = bodyMatch ? bodyMatch[1] : raw;
            body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'')
                       .replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'')
                       .replace(/<br\s*\/?>/gi,'\n')
                       .replace(/<\/p>/gi,'\n\n')
                       .replace(/<[^>]+>/g,'')
                       .replace(/&nbsp;/g,' ')
                       .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
                       .replace(/\n{3,}/g,'\n\n')
                       .trim();
            if (body) contents.push(body);
        }
        return contents.join('\n\n');
    } catch (e) {
        if (statusEl) statusEl.textContent = 'epub 解析失败：' + (e.message||'');
        return null;
    }
}

window.exImportBook = function(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const statusEl = document.getElementById('ex-rd-import-status');
    const name = file.name.replace(/\.[^.]+$/, '');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    // 大小提示（>10MB 警告）
    const sizeMB = (file.size / 1048576).toFixed(2);
    if (statusEl) statusEl.textContent = `正在导入 ${name} （${sizeMB}MB）…`;
    if (typeof playSound === 'function') playSound('mood');
    if (ext === 'txt' || ext === 'md' || ext === 'text') {
        exReadText(file, text => {
            if (text === null) { if (statusEl) statusEl.textContent = '读取失败'; showNotification('读取失败', 'error'); return; }
            exAddImportedBook(name, '', text, 'txt');
        });
    } else if (ext === 'epub') {
        exParseEpub(file, statusEl).then(text => {
            if (!text) { showNotification('epub 解析失败', 'error'); return; }
            exAddImportedBook(name, '', text, 'epub');
        });
    } else {
        if (statusEl) statusEl.textContent = '暂仅支持 .txt / .md / .epub';
        showNotification('暂仅支持 .txt / .md / .epub', 'warning');
    }
    input.value = ''; // 重置以便重复导入同名文件
};

/* 新增：导入文件后创建书目（含正文） */
function exAddImportedBook(title, author, content, sourceType) {
    if (!content || !content.trim()) { showNotification('文件内容为空', 'warning'); return; }
    // 按 ~800 字/页估算页数
    const pages = Math.max(1, Math.ceil(content.length / 800));
    const book = {
        id: 'bk_' + Date.now(),
        title, author,
        pages,
        myPage: 0,
        partnerPage: Math.floor(Math.random() * Math.min(20, pages)),
        finished: false,
        addedAt: exNow(),
        sourceType: sourceType || 'file',  // 'file' 或 'manual'
        content,                            // 正文文本
        position: 0,                        // 阅读位置（字符索引）
        scrollTop: 0,                       // 阅读器滚动位置
        fileSize: content.length
    };
    exData.reading.books.push(book);
    if (!exData.reading.currentId) exData.reading.currentId = book.id;
    exSave();
    exViewReading();
    const statusEl = document.getElementById('ex-rd-import-status');
    if (statusEl) statusEl.textContent = `✓ 已导入《${title}》（约 ${pages} 页）`;
    showNotification(`已导入《${title}》（${pages}页）`, 'success');
}

function exRenderReadingList() {
    const el = document.getElementById('ex-rd-list');
    if (!el) return;
    const books = exData.reading.books;
    if (!books.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:20px;">书单空空，加一本吧～</div>`;
        return;
    }
    el.innerHTML = books.slice().reverse().map(b => {
        const myPct = b.pages ? Math.min(100, Math.round(b.myPage/b.pages*100)) : 0;
        const pPct = b.pages ? Math.min(100, Math.round(b.partnerPage/b.pages*100)) : 0;
        const isCurrent = exData.reading.currentId === b.id;
        return `
            <div style="background:var(--primary-bg); border:1px solid ${isCurrent?'var(--accent-color)':'var(--border-color)'}; border-radius:12px; padding:12px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; font-weight:600; color:var(--text-primary);">${exEscape(b.title)} ${b.finished?'✓':''} ${b.content?`<span style="font-size:9px; background:rgba(var(--accent-color-rgb,197,164,126),0.15); color:var(--accent-color); padding:1px 6px; border-radius:5px; margin-left:4px;">📁导入</span>`:''}</div>
                        ${b.author?`<div style="font-size:11px; color:var(--text-secondary);">${exEscape(b.author)}</div>`:''}
                    </div>
                    <button class="ex-danger-btn" style="padding:3px 8px; font-size:10px;" onclick="exDelBook('${b.id}')">×</button>
                </div>
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">我 · ${b.myPage}/${b.pages||'?'}页 · ${myPct}%</div>
                <div class="ex-progress"><div class="ex-progress-fill" style="width:${myPct}%; background:var(--accent-color);"></div></div>
                <div style="font-size:11px; color:var(--text-secondary); margin:6px 0 4px;">${exEscape(exPartnerName())} · ${b.partnerPage}/${b.pages||'?'}页 · ${pPct}%</div>
                <div class="ex-progress"><div class="ex-progress-fill" style="width:${pPct}%; background:#FF6B6B;"></div></div>
                <div style="display:flex; gap:6px; margin-top:8px; align-items:center; flex-wrap:wrap;">
                    ${b.content?`<button class="ex-primary-btn" style="padding:6px 10px; font-size:11px;" onclick="exReadBook('${b.id}')">📖 阅读</button>`:''}
                    <button class="ex-quick-btn" onclick="exBookPage('${b.id}', -10)">-10</button>
                    <button class="ex-quick-btn" onclick="exBookPage('${b.id}', -1)">-1</button>
                    <input id="ex-bk-input-${b.id}" type="number" value="${b.myPage}" style="flex:1; min-width:60px; padding:6px 8px; border:1px solid var(--border-color); border-radius:8px; background:var(--secondary-bg); color:var(--text-primary); font-size:11px;">
                    <button class="ex-quick-btn" onclick="exBookPage('${b.id}', 1)">+1</button>
                    <button class="ex-quick-btn" onclick="exBookPage('${b.id}', 10)">+10</button>
                </div>
            </div>
        `;
    }).join('');
}

window.exBookPage = function(id, delta) {
    const b = exData.reading.books.find(x => x.id === id);
    if (!b) return;
    const direct = parseInt((document.getElementById('ex-bk-input-'+id)||{}).value, 10);
    if (!isNaN(direct) && delta === 0) b.myPage = Math.max(0, direct);
    else b.myPage = Math.max(0, b.myPage + delta);
    if (b.pages && b.myPage >= b.pages) { b.myPage = b.pages; b.finished = true; showNotification(`《${b.title}》读完了！🎉`, 'success'); }
    else b.finished = false;
    // 对方也读一点
    if (Math.random() < 0.4) b.partnerPage = Math.min(b.pages||9999, b.partnerPage + Math.floor(Math.random()*5));
    exData.reading.currentId = id;
    exSave();
    exRenderReadingList();
};

window.exDelBook = function(id) {
    if (!confirm('从书单移除？')) return;
    exData.reading.books = exData.reading.books.filter(b => b.id !== id);
    if (exData.reading.currentId === id) exData.reading.currentId = exData.reading.books[0]?.id || null;
    exSave();
    exRenderReadingList();
    showNotification('已移除', 'success');
};

/* ============ 7b. 内置阅读器（阅读导入的正文） ============ */
let exReaderCurId = null;

window.exReadBook = function(id) {
    const b = exData.reading.books.find(x => x.id === id);
    if (!b) return;
    if (!b.content) { showNotification('该书无正文，仅可手动记录页数', 'warning'); return; }
    exData.reading.currentId = id;
    exReaderCurId = id;
    exSave();
    const fromPct = b.position && b.content.length ? Math.min(100, Math.round(b.position / b.content.length * 100)) : 0;
    const body = document.getElementById('extras-body');
    if (!body) return;
    body.innerHTML = exHeader('📖 ' + b.title, `共 ${b.pages} 页 · 已读 ${fromPct}%`) + `
        <div style="display:flex; gap:8px; margin-bottom:10px; align-items:center; flex-wrap:wrap;">
            <button class="ex-quick-btn" onclick="exReaderFont(-1)">A-</button>
            <span style="font-size:11px; color:var(--text-secondary);">字号</span>
            <button class="ex-quick-btn" onclick="exReaderFont(1)">A+</button>
            <label style="display:flex; align-items:center; gap:4px; font-size:11px; color:var(--text-secondary); cursor:pointer;">
                <input type="checkbox" id="ex-reader-night" onchange="exReaderNight(this.checked)" ${document.body.classList.contains('night-mode')?'checked':''}> 夜间
            </label>
            <span style="flex:1;"></span>
            <span id="ex-reader-pct" style="font-size:11px; color:var(--accent-color); font-weight:600;">${fromPct}%</span>
        </div>
        <div class="ex-progress" style="margin-bottom:10px;"><div id="ex-reader-bar" class="ex-progress-fill" style="width:${fromPct}%; background:var(--accent-color);"></div></div>
        <div id="ex-reader-content" class="ex-reader-content" style="font-size:15px; line-height:1.85;">${exReaderFormat(b.content)}</div>
        <div style="display:flex; justify-content:space-between; gap:8px; margin:14px 0 4px;">
            <button class="ex-quick-btn" onclick="exReaderScroll(-1)">↑ 上翻</button>
            <button class="ex-primary-btn" onclick="exReaderSaveAndBack()">保存并返回</button>
            <button class="ex-quick-btn" onclick="exReaderScroll(1)">下翻 ↓</button>
        </div>
    `;
    const el = document.getElementById('ex-reader-content');
    if (el) {
        // 恢复上次滚动位置
        setTimeout(() => { try { el.scrollTop = b.scrollTop || 0; } catch(e) {} }, 60);
        // 滚动时实时更新进度条，并节流保存位置
        let scrollTimer = null;
        el.addEventListener('scroll', () => {
            const max = el.scrollHeight - el.clientHeight;
            const ratio = max > 0 ? el.scrollTop / max : 0;
            const pct = Math.round(ratio * 100);
            const bar = document.getElementById('ex-reader-bar');
            const pctEl = document.getElementById('ex-reader-pct');
            if (bar) bar.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct + '%';
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                b.scrollTop = el.scrollTop;
                b.position = Math.floor(ratio * b.content.length);
                b.myPage = Math.min(b.pages, Math.ceil((b.position / b.content.length) * b.pages) || 0);
                exSave();
            }, 600);
        });
    }
    if (typeof playSound === 'function') playSound('mood');
};

/* 转义 HTML 并保留段落空白 */
function exReaderFormat(text) {
    return '<div style="white-space:pre-wrap; word-break:break-word;">' + exEscape(text) + '</div>';
}

window.exReaderScroll = function(dir) {
    const el = document.getElementById('ex-reader-content');
    if (!el) return;
    el.scrollBy({ top: dir * (el.clientHeight * 0.85), behavior: 'smooth' });
};

window.exReaderFont = function(delta) {
    const el = document.getElementById('ex-reader-content');
    if (!el) return;
    let size = parseInt(el.style.fontSize) || 15;
    size = Math.max(12, Math.min(24, size + delta));
    el.style.fontSize = size + 'px';
};

window.exReaderNight = function(on) {
    const el = document.getElementById('ex-reader-content');
    if (!el) return;
    if (on) { el.style.background = '#2b2b2b'; el.style.color = '#c8c8c8'; }
    else { el.style.background = ''; el.style.color = ''; }
};

window.exReaderSaveAndBack = function() {
    const id = exReaderCurId;
    if (id) {
        const b = exData.reading.books.find(x => x.id === id);
        if (b) {
            const el = document.getElementById('ex-reader-content');
            if (el) {
                const max = el.scrollHeight - el.clientHeight;
                const ratio = max > 0 ? el.scrollTop / max : 0;
                b.scrollTop = el.scrollTop;
                b.position = Math.floor(ratio * b.content.length);
                b.myPage = Math.min(b.pages, Math.ceil((b.position / b.content.length) * b.pages) || 0);
                if (ratio >= 0.99) {
                    b.position = b.content.length;
                    b.myPage = b.pages;
                    b.finished = true;
                    showNotification(`《${b.title}》读完了！🎉`, 'success');
                } else {
                    b.finished = false;
                }
            }
            exSave();
        }
        exReaderCurId = null;
    }
    exViewReading();
};

/* ============ 8. 留言板 ============ */
function exViewBoard() {
    exSetBody(exHeader('🗒 留言板', `给 ${exEscape(exPartnerName())} 留言`) + `
        <div style="background:var(--message-sent-bg); border-radius:14px; padding:14px; margin-bottom:14px;">
            <textarea id="ex-bd-input" placeholder="想对 ${exPartnerName()} 说的话…" style="width:100%; min-height:70px; padding:10px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; box-sizing:border-box; resize:vertical;"></textarea>
            <div style="display:flex; gap:8px; margin-top:8px;">
                <button class="ex-quick-btn" style="flex:1;" onclick="exBoardPost('note')">📌 留言</button>
                <button class="ex-quick-btn" style="flex:1;" onclick="exBoardPost('chat')">💬 留言并发送</button>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:13px; font-weight:600; color:var(--text-primary);">📋 留言墙</span>
            <button class="ex-quick-btn" style="font-size:11px;" onclick="exBoardReply()">让 ${exEscape(exPartnerName())} 回复</button>
        </div>
        <div id="ex-bd-list"></div>
    `);
    exRenderBoardList();
}

window.exBoardPost = function(mode) {
    const text = document.getElementById('ex-bd-input').value.trim();
    if (!text) { showNotification('请输入留言', 'warning'); return; }
    const post = { id:'bd_'+Date.now(), from:'me', text, time:exNow() };
    exData.messageBoard.push(post);
    exSave();
    if (mode === 'chat' && typeof addMessage === 'function') {
        addMessage({ id: Date.now(), sender:'user', text:`【留言】📌 ${text}`, timestamp:new Date(), status:'sent', type:'board' });
    }
    document.getElementById('ex-bd-input').value = '';
    exRenderBoardList();
    showNotification('留言已贴上', 'success');
};

window.exBoardReply = function() {
    // 对方回复一条
    const reply = exGenerateReply(2);
    const post = { id:'bd_'+Date.now(), from:'partner', text:reply, time:exNow() };
    exData.messageBoard.push(post);
    exSave();
    exRenderBoardList();
    if (typeof playSound === 'function') playSound('partner_message');
    showNotification(`${exPartnerName()} 回复了`, 'success');
};

function exRenderBoardList() {
    const el = document.getElementById('ex-bd-list');
    if (!el) return;
    const list = exData.messageBoard.slice().reverse();
    if (!list.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:20px;">留言墙空空如也</div>`;
        return;
    }
    el.innerHTML = list.map(p => {
        const isMe = p.from === 'me';
        const name = isMe ? exMyName() : exPartnerName();
        const bg = isMe ? 'var(--message-sent-bg)' : 'var(--message-received-bg)';
        const align = isMe ? 'flex-end' : 'flex-start';
        return `
            <div style="display:flex; justify-content:${align}; margin-bottom:10px;">
                <div style="max-width:80%; background:${bg}; border:1px solid var(--border-color); border-radius:14px; padding:10px 14px; ${isMe?'border-bottom-right-radius:4px':'border-bottom-left-radius:4px'}">
                    <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">${exEscape(name)} · ${exFmtDate(p.time).slice(5)}</div>
                    <div style="font-size:13px; color:var(--text-primary); white-space:pre-wrap; word-break:break-word;">${exEscape(p.text)}</div>
                </div>
            </div>
        `;
    }).join('');
}

/* ============ 9. 链接分享（小红书 / 抖音） ============ */
/* exData.links: { id, url, title, platform, time, from, viewed, partnerComment } */

function exDetectPlatform(url) {
    const u = (url || '').toLowerCase();
    if (u.includes('xiaohongshu.com') || u.includes('xhslink.com')) return 'xiaohongshu';
    if (u.includes('douyin.com') || u.includes('iesdouyin.com') || u.includes('v.douyin')) return 'douyin';
    if (u.includes('bilibili.com') || u.includes('b23.tv')) return 'bilibili';
    if (u.includes('weibo.com') || u.includes('t.cn')) return 'weibo';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    return 'other';
}

const EX_PLATFORM_META = {
    xiaohongshu: { name:'小红书', icon:'📕', color:'#FF2442' },
    douyin:      { name:'抖音',   icon:'🎵', color:'#000000' },
    bilibili:    { name:'哔哩哔哩', icon:'📺', color:'#FB7299' },
    weibo:       { name:'微博',   icon:'🌐', color:'#E6162D' },
    youtube:     { name:'YouTube', icon:'▶️', color:'#FF0000' },
    other:       { name:'链接',   icon:'🔗', color:'#888888' }
};

function exViewLinks() {
    exStartUsage('links');
    exSetBody(exHeader('🔗 链接分享', `粘贴小红书/抖音链接，${exEscape(exPartnerName())} 可点击查看`) + `
        <div style="background:var(--message-sent-bg); border-radius:14px; padding:14px; margin-bottom:14px;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">支持 小红书 / 抖音 / 哔哩哔哩 / 微博 / YouTube 等链接</div>
            <input id="ex-link-url" type="text" placeholder="粘贴分享链接…" style="width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; margin-bottom:8px; box-sizing:border-box;">
            <input id="ex-link-title" type="text" maxlength="40" placeholder="备注（选填）" style="width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; margin-bottom:10px; box-sizing:border-box;">
            <button class="ex-primary-btn" style="width:100%;" onclick="exShareLink()">📤 分享给 ${exEscape(exPartnerName())}</button>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin:14px 0 8px;">📚 已分享链接</div>
        <div id="ex-link-list"></div>
    `);
    exRenderLinks();
}

window.exShareLink = function() {
    const url = document.getElementById('ex-link-url').value.trim();
    if (!url) { showNotification('请粘贴链接', 'warning'); return; }
    if (!/^https?:\/\//i.test(url) && !/^www\./i.test(url)) {
        showNotification('请粘贴有效的 http(s) 链接', 'warning'); return;
    }
    const title = document.getElementById('ex-link-title').value.trim();
    const platform = exDetectPlatform(url);
    const rec = {
        id: 'link_' + Date.now(),
        url: url,
        title: title,
        platform: platform,
        time: exNow(),
        from: 'me',
        viewed: false,
        partnerComment: null
    };
    exData.links.unshift(rec);
    exSave();
    // 在聊天中展示一张"链接卡片"
    if (typeof addMessage === 'function') {
        const meta = EX_PLATFORM_META[platform];
        const card = `【链接分享】${meta.icon} ${meta.name}\n${title ? title + '\n' : ''}${url}`;
        addMessage({ id: Date.now(), sender:'user', text: card, timestamp:new Date(), status:'sent', type:'link', linkUrl: url, linkPlatform: platform });
    }
    exViewLinks();
    showNotification('已分享给 ' + exPartnerName(), 'success');
    // 模拟对方"已查看"
    setTimeout(() => {
        rec.viewed = true;
        exSave();
        exRenderLinks();
        if (typeof addMessage === 'function' && typeof playSound === 'function') playSound('partner_message');
    }, 2500 + Math.random() * 2500);
};

window.exLinkOpen = function(id) {
    const r = (exData.links || []).find(l => l.id === id);
    if (!r) return;
    try { window.open(r.url, '_blank', 'noopener,noreferrer'); } catch(e) {}
    if (!r.viewed) { r.viewed = true; exSave(); exRenderLinks(); }
};

window.exLinkDel = function(id) {
    if (!confirm('删除该链接？')) return;
    exData.links = (exData.links || []).filter(l => l.id !== id);
    exSave();
    exRenderLinks();
    showNotification('已删除', 'success');
};

function exRenderLinks() {
    const el = document.getElementById('ex-link-list');
    if (!el) return;
    const list = (exData.links || []).slice(0, 30);
    if (!list.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:20px;">还没有分享过链接</div>`;
        return;
    }
    el.innerHTML = list.map(r => {
        const meta = EX_PLATFORM_META[r.platform] || EX_PLATFORM_META.other;
        const host = (function(){ try { return new URL(r.url).hostname.replace(/^www\./,''); } catch(e){ return r.url; } })();
        return `
            <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:10px 12px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <span style="font-size:18px;">${meta.icon}</span>
                    <span style="font-size:12px; font-weight:600; color:${meta.color};">${exEscape(meta.name)}</span>
                    <span style="font-size:10px; color:var(--text-secondary); margin-left:auto;">${exFmtDate(r.time).slice(5)}</span>
                </div>
                ${r.title ? `<div style="font-size:13px; color:var(--text-primary); margin-bottom:4px; font-weight:500;">${exEscape(r.title)}</div>` : ''}
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px; word-break:break-all;">${exEscape(host)}</div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="ex-primary-btn" style="flex:1; padding:6px 0; font-size:12px;" onclick="exLinkOpen('${r.id}')">前往查看</button>
                    <button class="ex-danger-btn" style="padding:6px 10px; font-size:11px;" onclick="exLinkDel('${r.id}')"><i class="fas fa-trash"></i></button>
                </div>
                <div style="font-size:11px; margin-top:6px; color:${r.viewed?'var(--accent-color)':'var(--text-secondary)'};">
                    ${r.viewed ? '✓ ' + exEscape(exPartnerName()) + ' 已查看' : '⏳ 等待 ' + exEscape(exPartnerName()) + ' 查看…'}
                </div>
            </div>
        `;
    }).join('');
}

/* ============ 10. 我们的家（共同布置房间） ============ */
/* exData.home: { grid: {"r-c": 家具key}, cols, rows }
 * 家具库 FURNITURE_ITEMS：可由双方修改/扩展 */
const FURNITURE_ITEMS = [
    { key:'bed',        name:'床',     emoji:'🛏️', w:2, h:2 },
    { key:'sofa',       name:'沙发',   emoji:'🛋️', w:2, h:1 },
    { key:'table',      name:'桌子',   emoji:'🪑',  w:1, h:1 },
    { key:'desk',       name:'书桌',   emoji:'🖥️', w:2, h:1 },
    { key:'lamp',       name:'台灯',   emoji:'💡',  w:1, h:1 },
    { key:'plant',      name:'绿植',   emoji:'🪴',  w:1, h:1 },
    { key:'rug',        name:'地毯',   emoji:'🟫',  w:3, h:2 },
    { key:'tv',         name:'电视',   emoji:'📺',  w:2, h:1 },
    { key:'cat',        name:'小猫',   emoji:'🐈',  w:1, h:1 },
    { key:'dog',        name:'小狗',   emoji:'🐕',  w:1, h:1 },
    { key:'bookshelf',  name:'书架',   emoji:'📚',  w:2, h:1 },
    { key:'fridge',     name:'冰箱',   emoji:'🧊',  w:1, h:2 },
    { key:'window',     name:'窗户',   emoji:'🪟',  w:2, h:1 },
    { key:'painting',   name:'画框',   emoji:'🖼️', w:1, h:1 },
    { key:'fireplace',  name:'壁炉',   emoji:'🔥',  w:1, h:2 },
    { key:'clock',      name:'挂钟',   emoji:'🕰️', w:1, h:1 }
];

function exViewHome() {
    exStartUsage('home');
    // 确保数据结构存在
    if (!exData.home) exData.home = { grid: {}, cols: 6, rows: 4 };
    if (!exData.home.grid) exData.home.grid = {};
    exSetBody(exHeader('🏠 我们的家', `双方可一起布置 · 点击格子放置/移除家具`) + `
        <div style="background:var(--message-received-bg); border:1px dashed var(--accent-color); border-radius:12px; padding:10px 12px; margin-bottom:12px; font-size:12px; color:var(--text-secondary);">
            <div style="margin-bottom:6px; color:var(--text-primary); font-weight:500;">布置说明</div>
            ① 选家具 → ② 点房间格子放置 → ③ 可拖拽/再点删除<br>
            双方修改都会自动保存，对方下次进入即可看到。
        </div>
        <div style="display:flex; gap:8px; margin-bottom:12px;">
            <button class="ex-quick-btn" style="flex:1; ${exHomeMode==='place'?'border-color:var(--accent-color); color:var(--accent-color); font-weight:600;':''}" onclick="exHomeSetMode('place')">🪑 放置</button>
            <button class="ex-quick-btn" style="flex:1; ${exHomeMode==='remove'?'border-color:var(--accent-color); color:var(--accent-color); font-weight:600;':''}" onclick="exHomeSetMode('remove')">🧹 移除</button>
            <button class="ex-danger-btn" style="padding:6px 10px;" onclick="exHomeClear()" title="清空"><i class="fas fa-trash"></i></button>
        </div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">家具库（点击选中）</div>
        <div id="ex-home-furniture" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;"></div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">房间（${exData.home.cols}×${exData.home.rows}）</div>
        <div id="ex-home-grid" style="display:grid; gap:4px;"></div>
        <div style="font-size:11px; color:var(--text-secondary); text-align:center; margin-top:10px;">
            最近修改：${exEscape(exHomeLastEditor())}
        </div>
    `);
    exHomeRenderFurnitureList();
    exHomeRenderGrid();
}

let exHomeMode = 'place';        // 'place' | 'remove'
let exHomeSelected = null;      // 选中的家具 key

function exHomeLastEditor() {
    const keys = Object.keys(exData.home.grid || {});
    if (!keys.length) return '尚未布置，快开始吧～';
    return (exData.home.lastEditor || exMyName()) + ' · ' + exFmtDate(exData.home.lastTime || exNow()).slice(5);
}

window.exHomeSetMode = function(m) {
    exHomeMode = m;
    exViewHome();
};

window.exHomeSelectFurniture = function(key) {
    exHomeSelected = key;
    exHomeMode = 'place';
    exHomeRenderFurnitureList();
};

window.exHomeClear = function() {
    if (!confirm('清空房间所有家具？')) return;
    exData.home.grid = {};
    exData.home.lastEditor = exMyName();
    exData.home.lastTime = exNow();
    exSave();
    exViewHome();
    showNotification('房间已清空', 'success');
};

function exHomeRenderFurnitureList() {
    const el = document.getElementById('ex-home-furniture');
    if (!el) return;
    el.innerHTML = FURNITURE_ITEMS.map(f => `
        <button type="button" class="ex-quick-btn" title="${exEscape(f.name)} (${f.w}×${f.h})" data-fk="${f.key}"
            style="position:relative; padding:8px 10px; font-size:18px; line-height:1; ${exHomeSelected===f.key?'border-color:var(--accent-color); background:rgba(var(--accent-color-rgb),0.15);':''}"
            onclick="exHomeSelectFurniture('${f.key}')">
            ${f.emoji}
            <span style="position:absolute; bottom:1px; right:3px; font-size:8px; color:var(--text-secondary);">${f.w}×${f.h}</span>
        </button>
    `).join('');
}

function exHomeRenderGrid() {
    const el = document.getElementById('ex-home-grid');
    if (!el) return;
    const cols = exData.home.cols || 6;
    const rows = exData.home.rows || 4;
    el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const k = r + '-' + c;
            const fkey = exData.home.grid[k];
            const f = fkey ? FURNITURE_ITEMS.find(x => x.key === fkey) : null;
            const bg = f ? 'rgba(var(--accent-color-rgb),0.18)' : 'var(--primary-bg)';
            cells.push(`
                <div class="ex-home-cell" data-rc="${k}" onclick="exHomeCellClick('${k}')"
                    style="aspect-ratio:1; background:${bg}; border:1px solid var(--border-color); border-radius:8px;
                    display:flex; align-items:center; justify-content:center; font-size:22px; cursor:pointer; min-height:44px; user-select:none;">
                    ${f ? f.emoji : ''}
                </div>
            `);
        }
    }
    el.innerHTML = cells.join('');
}

window.exHomeCellClick = function(rcKey) {
    const [r, c] = rcKey.split('-').map(Number);
    if (exHomeMode === 'remove') {
        if (exData.home.grid[rcKey]) {
            delete exData.home.grid[rcKey];
            exData.home.lastEditor = exMyName();
            exData.home.lastTime = exNow();
            exSave();
        }
    } else {
        // 放置模式
        if (!exHomeSelected) { showNotification('请先选一个家具', 'info'); return; }
        const f = FURNITURE_ITEMS.find(x => x.key === exHomeSelected);
        if (!f) return;
        // 简化版：只占单格，避免越界复杂逻辑；多格家具以左上角放置，仅显示 emoji
        exData.home.grid[rcKey] = exHomeSelected;
        exData.home.lastEditor = exMyName();
        exData.home.lastTime = exNow();
        exSave();
    }
    exHomeRenderGrid();
    // 同步刷新底部最近修改
    const head = document.querySelector('#extras-body div[style*="text-align:center"]');
    if (head) head.textContent = '最近修改：' + exHomeLastEditor();
};

/* ============ 长时间使用：自动退出 / 发烫提示 ============ */
/*
 * 思路：
 *  - 进入某个功能视图时调用 exStartUsage(key) 记录开始时间
 *  - 在 usageLimit * 60 * 0.75 时弹出"发烫"提示（但仍可继续）
 *  - 在 usageLimit * 60 时强制退出该视图（关闭模态框/返回主页）
 *  - 退出百宝箱或切换视图时调用 exStopUsage 清理计时器
 */
let exUsageTimer = null;        // 主计时器（到点自动退出）
let exUsageWarnTimer = null;    // 发烫提示计时器
let exUsageStart = 0;           // 开始时间戳
let exUsageKey = null;          // 当前使用中的功能 key
let exUsageWarned = false;      // 是否已发烫提示过

/* 当前已使用分钟数 */
function exUsageMinutes() {
    if (!exUsageStart) return 0;
    return (Date.now() - exUsageStart) / 60000;
}

/* 启动使用计时：到 limit 分钟自动退出，到 75% 时发烫提示 */
window.exStartUsage = function(key) {
    exStopUsage();
    exUsageKey = key || 'view';
    exUsageStart = Date.now();
    exUsageWarned = false;
    const limitMs = Math.max(1, Number(exData.usageLimit) || 8) * 60 * 1000;
    // 75% 处先发烫提示
    exUsageWarnTimer = setTimeout(() => {
        exUsageWarned = true;
        if (typeof showNotification === 'function') {
            showNotification('🌡️ 用了一会儿啦，设备可能有点发热，记得歇一歇～', 'warning');
        }
        if (typeof playSound === 'function') playSound('warning');
    }, Math.floor(limitMs * 0.75));
    // 到点自动退出
    exUsageTimer = setTimeout(() => {
        exForceExit();
    }, limitMs);
};

/* 强制退出当前功能视图：返回百宝箱主页或关闭模态框 */
window.exForceExit = function() {
    const reason = exUsageWarned ? '为防止设备过热' : '使用时间到了';
    if (typeof showNotification === 'function') {
        showNotification('⏰ ' + reason + '，已自动退出当前功能，休息一下吧～', 'warning');
    }
    try { if (typeof hideModal === 'function' && document.getElementById('extras-modal')) hideModal(document.getElementById('extras-modal')); } catch(e) {}
    try { if (document.getElementById('doodle-modal')) hideModal(document.getElementById('doodle-modal')); } catch(e) {}
    try { if (typeof xqClose === 'function') xqClose(); } catch(e) {}
    try { if (typeof mgCloseCenter === 'function') mgCloseCenter(); } catch(e) {}
    exStopUsage();
};

window.exStopUsage = function() {
    if (exUsageTimer) { clearTimeout(exUsageTimer); exUsageTimer = null; }
    if (exUsageWarnTimer) { clearTimeout(exUsageWarnTimer); exUsageWarnTimer = null; }
    exUsageStart = 0;
    exUsageKey = null;
    exUsageWarned = false;
};

/* 关闭百宝箱时清理计时器（绑定到 extras-modal 遮罩点击） */
(function _bindUsageCleanup() {
    const attach = () => {
        const m = document.getElementById('extras-modal');
        if (m && !m._exUsageBound) {
            m._exUsageBound = true;
            m.addEventListener('click', (e) => { if (e.target === m) exStopUsage(); });
        }
    };
    document.addEventListener('DOMContentLoaded', attach);
    setTimeout(attach, 500);
})();

/* ============ 初始化 ============ */
window.initExtras = async function() {
    await exLoad();
};
// 启动时自动加载（容错）
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        try { window.initExtras(); } catch(e) { console.warn('extras 初始化失败', e); }
    }, 800);
});
