/**
 * extras.js - 功能百宝箱
 * 包含：红包、撤回消息、商城、问答、月经记录、时间状态、共读、留言板
 * 自包含模块：UI 动态构建，存储用 localforage + getStorageKey
 * 模式参考 envelope.js / mood.js
 */

/* ============ 数据层 ============ */

/* 回复速度档位（全局使用，定义在顶部供所有视图引用） */
const EX_REPLY_SPEEDS = {
    instant: { label: '秒回', min: 300, max: 800 },
    fast:    { label: '迅速', min: 1500, max: 3000 },
    normal:  { label: '正常', min: 3000, max: 7000 },
    slow:    { label: '慢',   min: 8000, max: 15000 },
    snail:   { label: '极慢', min: 20000, max: 45000 },
};
let exData = {
    coins: 1314,            // 我的金币（红包/商城共用）
    partnerCoins: 1314,     // 对方金币
    redpackets: [],         // 红包记录 {id, from, amount, message, time, opened, openedBy, openedAt, expired, expiredAt}
                            // opened=true → 已领取；expired=true → 24h未领自动退回给发送者
    shopSent: [],           // 已送出的礼物 {id, itemKey, time, reply}
    qaHistory: [],          // 问答历史 {id, question, answer, time}
    periodLogs: {},         // 月经记录 { 'YYYY-MM-DD': {flow, symptoms, note} }
    periodCycle: 28,        // 平均周期天数
    reading: { books: [], currentId: null, partnerProgress: 0 },
    messageBoard: [],       // 留言板 {id, from, text, time}
    partnerTzOffset: 0,     // 对方时区偏移（小时）
    partnerManualTime: null, // 手动设置的对方时间 {iso:'2026-08-18T20:00:00', offsetHours:8}
    shopItems: null,        // 商城商品（null/空 → 用默认 SHOP_ITEMS）
    links: [],              // 分享链接 {id, url, title, platform, time, viewed, partnerComment}
    home: { grid: {}, cols: 6, rows: 4 },  // 共同的家：grid 是 {"r-c": 家具key}
    usageLimit: 8,          // 单功能最长使用分钟数（防发烫自动退出）
    replySpeed: 'normal',   // 对方回复速度: 'instant'即时 / 'fast'快 / 'normal'正常 / 'slow'慢 / 'snail'极慢
    linkStatus: { online: true, lastSeen: null, signal: 0 },  // 链接监测：在线状态/最后在线时间/信号强度
    distance: { physicalKm: 0, heartScore: 80 },  // 距离模拟：物理距离(km) / 心理亲密度(0-100)
    checkin: { enabled: false, intervalMin: 30, lastCheck: null, alertOnlyIdle: true },  // 查岗设置
    partnerFavs: [],        // 对方收藏的消息 {id, text, time}
    bgPush: { enabled: false, sound: true, intervalSec: 30 },  // 后台消息推送
    checkinHistory: [],     // 查岗历史记录 {id, time, result, detail, activity}
    partnerCheckins: [],    // 对方对我的查岗记录 {id, time, whatDoing, result}
    journals: [],           // 觉察日志 {id, title, content, reflection, mood, tags, time}
    aiConfig: { apiKey: '', apiUrl: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
    aiHistory: [],          // AI 对话历史 {id, type:'reading'|'analysis', input, output, time}
    customSounds: [],       // 自定义声音 {id, name, data, time}
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
    // 检查红包过期退回（24h 未领取 → 自动退给发送者）
    exCheckRedpacketExpiry();
    window.exData = exData;
}

/* 24 小时未领取的红包自动退回给发送者（参考微信红包规则） */
function exCheckRedpacketExpiry() {
    if (!exData.redpackets || !exData.redpackets.length) return;
    const now = Date.now();
    const EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 小时
    let changed = false;
    exData.redpackets.forEach(rp => {
        if (rp.opened || rp.expired) return; // 已领 / 已退跳过
        const sentAt = new Date(rp.time).getTime();
        if (now - sentAt >= EXPIRE_MS) {
            rp.expired = true;
            rp.expiredAt = new Date().toISOString();
            // 金币退回给发送者
            if (rp.from === 'me') exData.partnerCoins = (exData.partnerCoins || 0) + rp.amount;
            else exData.coins = (exData.coins || 0) + rp.amount;
            changed = true;
        }
    });
    if (changed) exSave();
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
        { key:'link', icon:'fa-wifi', name:'链接监测', desc:'在线/距离/心跳', color:'#00B894' },
        { key:'checkin', icon:'fa-bell', name:'查岗', desc:'定时监测对方', color:'#E17055' },
        { key:'fav', icon:'fa-star', name:'对方收藏', desc:'Ta 的珍藏对话', color:'#FDCB6E' },
        { key:'push', icon:'fa-broadcast-tower', name:'后台推送', desc:'消息实时提醒', color:'#0984E3' },
        { key:'journal', icon:'fa-feather', name:'觉察日志', desc:'反思与成长', color:'#00CEC9' },
        { key:'ai', icon:'fa-wand-magic-sparkles', name:'AI 解牌', desc:'塔罗+AI分析', color:'#A29BFE' },
        { key:'sound', icon:'fa-volume-up', name:'自定义声音', desc:'录制/上传音效', color:'#FD79A8' },
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
        games: () => { hideModal(document.getElementById('extras-modal')); setTimeout(() => { if (typeof openMiniGamesCenter === 'function') openMiniGamesCenter(); }, 320); },
        link: exViewLinkStatus,
        checkin: exViewCheckin,
        fav: exViewPartnerFavs,
        push: exViewBgPush,
        journal: exViewJournal,
        ai: exViewAI,
        sound: exViewSound,
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
    const rp = { id:'rp_'+Date.now(), from:'me', amount:amt, message:msg, time:exNow(), opened:false, expired:false };
    exData.redpackets.push(rp);
    exSave();
    // 同步到聊天（红包卡片可点开）
    if (typeof addMessage === 'function') {
        addMessage({ id: Date.now(), sender:'user', text:`【红包】🧧 ${amt} 金币\n${msg}`, timestamp:new Date(), status:'sent', type:'redpacket', redpacketId: rp.id });
    }
    // 对方自动回红包（概率）
    if (Math.random() < 0.5) {
        const replyAmt = Math.floor(amt * (0.8 + Math.random()*0.6));
        const replyRp = { id:'rp_'+Date.now()+1, from:'partner', amount:replyAmt, message:'回礼～收下吧', time:exNow(), opened:false, expired:false };
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
    // 收件箱：对方发来 + 未领取（过期的不显示在这里，已在记录里标"已退回"）
    const inbox = exData.redpackets.filter(r => r.from === 'partner' && !r.opened && !r.expired);
    if (!inbox.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:10px;">暂无未领取的红包</div>`;
        return;
    }
    el.innerHTML = inbox.map(r => {
        const remain = exRpRemainText(r);
        return `
        <div onclick="exOpenRedpacket('${r.id}')" style="display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg,#E54D4D,#FA5752); border-radius:12px; padding:12px 14px; margin-bottom:8px; cursor:pointer; color:#fff;">
            <div>
                <div style="font-size:15px; font-weight:700;">🧧 ${exCoin(r.amount)}</div>
                <div style="font-size:11px; opacity:0.9; margin-top:2px;">${exEscape(r.message)}</div>
                <div style="font-size:10px; opacity:0.75; margin-top:3px;">⏰ ${remain}</div>
            </div>
            <div style="background:rgba(255,255,255,0.22); border:1px solid rgba(255,255,255,0.55); color:#FFE082; font-weight:700; padding:6px 16px; border-radius:50px; font-size:13px;">開</div>
        </div>`;
    }).join('');
}

/* 计算红包剩余倒计时文本 */
function exRpRemainText(rp) {
    const sentAt = new Date(rp.time).getTime();
    const expireAt = sentAt + 24 * 60 * 60 * 1000;
    const remain = expireAt - Date.now();
    if (remain <= 0) return '即将退回';
    const h = Math.floor(remain / 3600000);
    const m = Math.floor((remain % 3600000) / 60000);
    return `${h}小时${m}分后未领退回`;
}

/* 微信风格开红包全屏弹窗 */
window.exOpenRedpacket = function(id) {
    const rp = exData.redpackets.find(r => r.id === id);
    if (!rp) return;
    if (rp.opened) { showNotification('红包已领取过', 'info'); return; }
    if (rp.expired) { showNotification('红包已退回给' + (rp.from === 'me' ? exPartnerName() : '我'), 'info'); return; }

    // 移除旧弹窗
    const old = document.getElementById('ex-rp-open-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'ex-rp-open-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:modalBgFadeIn 0.3s ease;';
    const senderName = rp.from === 'me' ? '我' : exPartnerName();
    modal.innerHTML = `
        <div style="width:280px;background:linear-gradient(180deg,#E54D4D 0%,#C0392B 100%);border-radius:18px;padding:24px 20px 28px;text-align:center;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,0.45);position:relative;overflow:hidden;">
            <div style="font-size:11px;opacity:0.85;margin-bottom:6px;">${exEscape(senderName)} 发的红包</div>
            <div style="font-size:13px;opacity:0.95;margin-bottom:18px;">${exEscape(rp.message)}</div>
            <div id="ex-rp-open-btn" style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#FFD580,#F5B041);color:#8B3A1A;font-size:30px;font-weight:700;line-height:72px;margin:0 auto 14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.35),inset 0 -3px 0 rgba(0,0,0,0.18);border:2px solid rgba(255,255,255,0.55);user-select:none;">開</div>
            <div id="ex-rp-result" style="min-height:60px;font-size:13px;opacity:0;">
                <div style="font-size:26px;font-weight:700;color:#FFE082;margin-bottom:2px;">${exCoin(rp.amount)}</div>
                <div style="font-size:11px;opacity:0.85;">已存入金币账户</div>
            </div>
            <div style="position:absolute;top:14px;right:14px;font-size:18px;opacity:0.6;cursor:pointer;" onclick="document.getElementById('ex-rp-open-modal').remove();">✕</div>
        </div>
    `;
    document.body.appendChild(modal);

    // 点击"開"按钮：金币飞出动画 + 入账
    const openBtn = document.getElementById('ex-rp-open-btn');
    openBtn.onclick = function() {
        openBtn.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s';
        openBtn.style.transform = 'scale(1.35) rotate(180deg)';
        openBtn.style.opacity = '0';
        // 金币飞出粒子
        exSpawnCoins(openBtn);
        // 入账
        rp.opened = true;
        rp.openedBy = 'me';
        rp.openedAt = new Date().toISOString();
        exData.coins += rp.amount;
        exSave();
        if (typeof playSound === 'function') playSound('favorite');
        // 0.5 秒后显示结果
        setTimeout(() => {
            const res = document.getElementById('ex-rp-result');
            if (res) { res.style.transition = 'opacity 0.4s'; res.style.opacity = '1'; }
        }, 450);
        // 2.2 秒后自动关闭弹窗 + 刷新列表
        setTimeout(() => {
            const m = document.getElementById('ex-rp-open-modal');
            if (m) { m.style.transition = 'opacity 0.3s'; m.style.opacity = '0'; setTimeout(() => m.remove(), 300); }
            exRenderRpInbox();
            exRenderRpList();
            showNotification(`拆开红包，获得 ${exCoin(rp.amount)} ✨`, 'success');
        }, 2200);
    };
};

/* 金币飞出粒子动画 */
function exSpawnCoins(originEl) {
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 14; i++) {
        const coin = document.createElement('div');
        coin.textContent = '🪙';
        coin.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;font-size:${18 + Math.random()*14}px;z-index:10000;pointer-events:none;transition:transform 1s cubic-bezier(0.18,0.89,0.32,1),opacity 1s;`;
        document.body.appendChild(coin);
        const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.3;
        const dist = 80 + Math.random() * 90;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 60 - Math.random() * 40;
        requestAnimationFrame(() => {
            coin.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random()*720-360}deg)`;
            coin.style.opacity = '0';
        });
        setTimeout(() => coin.remove(), 1100);
    }
}

/* 微信风格红包卡片（聊天消息流用） */
window.exRedpacketCardHtml = function(rpId) {
    const rp = exData.redpackets.find(r => r.id === rpId);
    if (!rp) return '';
    const isMine = rp.from === 'me';
    let body, tagText;
    if (rp.opened) {
        body = `<div style="font-size:11px;opacity:0.75;margin-top:4px;">${exCoin(rp.amount)} · 已领取</div>`;
        tagText = '已领取';
    } else if (rp.expired) {
        body = `<div style="font-size:11px;opacity:0.75;margin-top:4px;">${exCoin(rp.amount)} · 已退回</div>`;
        tagText = '已退回';
    } else {
        body = `<div style="font-size:11px;opacity:0.9;margin-top:4px;">${exEscape(rp.message)}</div>
                <div style="font-size:10px;opacity:0.75;margin-top:2px;">${exRpRemainText(rp)}</div>`;
        tagText = '待领取';
    }
    const clickable = (!rp.opened && !rp.expired) ? `onclick="exOpenRedpacket('${rp.id}')"` : '';
    return `<div ${clickable} style="background:linear-gradient(135deg,#E54D4D,#FA5752);color:#fff;border-radius:12px;padding:12px 14px;width:220px;cursor:pointer;${(!rp.opened && !rp.expired)?'':'opacity:0.85;'}">
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:22px;">🧧</span>
            <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;">${isMine ? ('我发给' + exPartnerName()) : (exPartnerName() + '发来的')} 红包</div>
                ${body}
            </div>
        </div>
    </div>`;
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
        let status;
        if (r.opened) status = '已领取';
        else if (r.expired) status = '已退回';
        else status = '待领取';
        const statusColor = r.opened ? 'var(--accent-color)' : (r.expired ? 'var(--text-secondary)' : '#FA5752');
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid var(--border-color); font-size:12px;">
                <div>
                    <span style="color:var(--text-primary); font-weight:500;">${from}</span>
                    <span style="color:var(--accent-color); margin-left:6px;">${exCoin(r.amount)}</span>
                </div>
                <span style="color:${statusColor}; font-size:11px;">${status} · ${exFmtDate(r.time).slice(5)}</span>
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
    const now = new Date();
    const p = x => String(x).padStart(2,'0');
    const localStr = `${p(now.getHours())}:${p(now.getMinutes())}`;
    exSetBody(exHeader('🕐 时间状态', `监测 ${exEscape(exPartnerName())} 的当前时辰`) + `
        <div style="background:var(--message-received-bg); border-radius:14px; padding:18px; margin-bottom:14px; text-align:center;">
            <div id="ex-status-emoji" style="font-size:54px; margin-bottom:8px;">🌙</div>
            <div id="ex-status-time" style="font-size:24px; font-weight:700; color:var(--text-primary);">--:--</div>
            <div id="ex-status-activity" style="font-size:13px; color:var(--text-secondary); margin-top:6px;">—</div>
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:14px;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">🌍 对方时间设置</div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                <label style="display:flex; align-items:center; gap:4px; font-size:12px; color:var(--text-primary);">
                    <input type="radio" name="ex-time-mode" value="auto" ${!exData.partnerManualTime?'checked':''} onchange="exSetTimeMode('auto')"> 自动（按时区推算）
                </label>
                <label style="display:flex; align-items:center; gap:4px; font-size:12px; color:var(--text-primary);">
                    <input type="radio" name="ex-time-mode" value="manual" ${exData.partnerManualTime?'checked':''} onchange="exSetTimeMode('manual')"> 手动（直接设置对方当前时间）
                </label>
            </div>
            <div id="ex-tz-row" style="${exData.partnerManualTime?'display:none':''}">
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">时区偏移（相对 UTC+8）</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input id="ex-tz-input" type="number" value="${exData.partnerTzOffset}" min="-12" max="14" style="flex:1; padding:8px; border:1px solid var(--border-color); border-radius:8px; background:var(--secondary-bg); color:var(--text-primary);">
                    <button class="ex-primary-btn" style="padding:8px 14px; font-size:12px;" onclick="exSaveTz()">设置</button>
                </div>
                <div style="display:flex; gap:4px; margin-top:6px; flex-wrap:wrap;">
                    ${[{v:8,l:'北京'},{v:0,l:'伦敦'},{v:-5,l:'纽约'},{v:9,l:'东京'},{v:10,l:'悉尼'}].map(t=>`<button onclick="exSetTz(${t.v})" class="ex-quick-btn" style="font-size:10px;padding:4px 8px;">${t.l}${t.v>=0?'+':''}${t.v}</button>`).join('')}
                </div>
            </div>
            <div id="ex-manual-row" style="${exData.partnerManualTime?'':'display:none'}">
                <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">直接设置对方「此刻」的时间</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input id="ex-manual-time" type="time" value="${exData.partnerManualTime ? exData.partnerManualTime.iso.slice(11,16) : localStr}" style="flex:1; padding:8px; border:1px solid var(--border-color); border-radius:8px; background:var(--secondary-bg); color:var(--text-primary);">
                    <button class="ex-primary-btn" style="padding:8px 14px; font-size:12px;" onclick="exSaveManualTime()">保存</button>
                </div>
                <div style="font-size:10px; color:var(--text-secondary); margin-top:6px;">💡 设置后即使你改手机时间，对方时间也不受影响</div>
            </div>
            <div style="font-size:10px; color:var(--text-secondary); margin-top:8px;">你现在的本地时间：${localStr}</div>
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:14px;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">⚡ 对方回复速度</div>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                ${Object.entries(EX_REPLY_SPEEDS).map(([k,v]) => `<button class="ex-quick-btn ${exData.replySpeed===k?'active':''}" onclick="exApplyReplySpeed('${k}')" style="flex:1;min-width:60px;${exData.replySpeed===k?'background:var(--accent-color);color:#fff;border-color:var(--accent-color);':''}">${v.label}</button>`).join('')}
            </div>
            <div style="font-size:10px; color:var(--text-secondary); margin-top:6px;">当前：${EX_REPLY_SPEEDS[exData.replySpeed]?.label || '正常'} (${EX_REPLY_SPEEDS[exData.replySpeed]?.min || 3000}-${EX_REPLY_SPEEDS[exData.replySpeed]?.max || 7000}ms)</div>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin:14px 0 8px;">📋 一日作息表</div>
        <div id="ex-status-schedule"></div>
    `);
    exRenderStatusSchedule();
    exUpdateStatus();
    if (exStatusTimer) { if (window.__PerfManager) window.__PerfManager.unregisterTimer(exStatusTimer); else clearInterval(exStatusTimer); }
    if (window.__PerfManager) {
        exStatusTimer = window.__PerfManager.registerTimer(exUpdateStatus, 1000, 'interval');
    } else {
        exStatusTimer = setInterval(exUpdateStatus, 1000);
    }
    const modal = document.getElementById('extras-modal');
    const cleanup = () => { if (exStatusTimer) { if (window.__PerfManager) window.__PerfManager.unregisterTimer(exStatusTimer); else clearInterval(exStatusTimer); exStatusTimer = null; } };
    if (modal) {
        const onHide = () => setTimeout(() => { if (modal.style.display === 'none') cleanup(); }, 400);
        const obs = new MutationObserver(() => { if (modal.style.display === 'none') onHide(); });
        obs.observe(modal, { attributes:true, attributeFilter:['style'] });
    }
}

window.exSetTimeMode = function(mode) {
    const tzRow = document.getElementById('ex-tz-row');
    const manualRow = document.getElementById('ex-manual-row');
    if (mode === 'auto') {
        exData.partnerManualTime = null;
        if (tzRow) tzRow.style.display = '';
        if (manualRow) manualRow.style.display = 'none';
    } else {
        if (tzRow) tzRow.style.display = 'none';
        if (manualRow) manualRow.style.display = '';
    }
    exSave();
    exUpdateStatus();
};

window.exSetTz = function(v) {
    document.getElementById('ex-tz-input').value = v;
    exSaveTz();
};

window.exSaveManualTime = function() {
    const v = document.getElementById('ex-manual-time').value;
    if (!v) { showNotification('请选择时间', 'warning'); return; }
    const now = new Date();
    const localMinutes = now.getHours() * 60 + now.getMinutes();
    const [h, m] = v.split(':').map(Number);
    const targetMinutes = h * 60 + m;
    let diff = targetMinutes - localMinutes;
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    const offsetHours = Math.round(diff / 60 * 10) / 10;
    exData.partnerManualTime = { iso: new Date().toISOString(), offsetHours };
    exSave();
    showNotification(`已保存：对方时间 ${v}，时区偏移 ${offsetHours>=0?'+':''}${offsetHours}h`, 'success');
    exUpdateStatus();
};

window.exSaveTz = function() {
    const v = parseInt(document.getElementById('ex-tz-input').value, 10);
    if (isNaN(v)) { showNotification('请输入有效数字', 'warning'); return; }
    exData.partnerTzOffset = Math.max(-12, Math.min(14, v));
    exData.partnerManualTime = null;
    exSave();
    exUpdateStatus();
    showNotification('时区已设置', 'success');
};

function exPartnerNow() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset()*60000;
    let offset;
    if (exData.partnerManualTime) {
        offset = exData.partnerManualTime.offsetHours;
    } else {
        const localOffset = -now.getTimezoneOffset() / 60;
        offset = localOffset + exData.partnerTzOffset;
    }
    return new Date(utc + offset*3600000);
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

let _exLastStatusTime = '';
let _exLastStatusEmoji = '';
let _exLastStatusActivity = '';

function exUpdateStatus() {
    const now = exPartnerNow();
    const h = now.getHours();
    const p = x => String(x).padStart(2,'0');
    const timeStr = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    const act = exActivityForHour(h);
    const emoji = act.emoji;
    const activityHtml = `<span style="color:var(--accent-color); font-weight:600;">${exEscape(exPartnerName())}</span> · ${exEscape(act.activity)}<br><span style="font-size:11px;">${exEscape(act.desc)}</span>`;
    const modal = document.getElementById('extras-modal');
    if (!modal || modal.style.display === 'none') return;
    const tEl = document.getElementById('ex-status-time');
    const eEl = document.getElementById('ex-status-emoji');
    const aEl = document.getElementById('ex-status-activity');
    if (tEl && timeStr !== _exLastStatusTime) { tEl.textContent = timeStr; _exLastStatusTime = timeStr; }
    if (eEl && emoji !== _exLastStatusEmoji) { eEl.textContent = emoji; _exLastStatusEmoji = emoji; }
    if (aEl && activityHtml !== _exLastStatusActivity) { aEl.innerHTML = activityHtml; _exLastStatusActivity = activityHtml; }
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

/* ============ 11. 链接监测 & 距离 ============ */
let exLinkTimer = null;

function exViewLinkStatus() {
    exSetBody(exHeader('📡 链接监测', '时刻感知 Ta 的存在') + `
        <div style="background:var(--message-received-bg); border-radius:14px; padding:18px; margin-bottom:14px; text-align:center;">
            <div id="ex-link-emoji" style="font-size:48px; margin-bottom:6px;">📡</div>
            <div id="ex-link-status" style="font-size:20px; font-weight:700; color:var(--text-primary);">—</div>
            <div id="ex-link-detail" style="font-size:12px; color:var(--text-secondary); margin-top:4px;">—</div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
            <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; text-align:center;">
                <div style="font-size:11px; color:var(--text-secondary);">🌍 物理距离</div>
                <div id="ex-dist-km" style="font-size:20px; font-weight:700; color:var(--text-primary);">0 km</div>
                <div id="ex-dist-city" style="font-size:10px; color:var(--text-secondary); margin-top:2px;">同城</div>
            </div>
            <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; text-align:center;">
                <div style="font-size:11px; color:var(--text-secondary);">💗 亲密度</div>
                <div id="ex-heart-score" style="font-size:20px; font-weight:700; color:#FF6B6B;">80</div>
                <div id="ex-heart-label" style="font-size:10px; color:var(--text-secondary); margin-top:2px;">温暖</div>
            </div>
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:14px;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">设置物理距离 (km)</div>
            <div style="display:flex; gap:6px; align-items:center;">
                <input id="ex-dist-input" type="number" min="0" max="10000" value="${exData.distance.physicalKm}" style="flex:1; padding:8px; border:1px solid var(--border-color); border-radius:8px; background:var(--secondary-bg); color:var(--text-primary);">
                <button class="ex-quick-btn" onclick="exSetDistance()">设置</button>
                <button class="ex-quick-btn" onclick="exSetDistance('rand')">随机</button>
            </div>
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:14px;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">调整亲密度 (0-100)</div>
            <input id="ex-heart-slider" type="range" min="0" max="100" value="${exData.distance.heartScore}" style="width:100%;" oninput="document.getElementById('ex-heart-val').textContent=this.value">
            <div style="font-size:12px; text-align:center; margin-top:4px;">当前: <span id="ex-heart-val">${exData.distance.heartScore}</span> / 100</div>
        </div>
        <button class="ex-primary-btn" style="width:100%;" onclick="exPingPartner()">📶 测一下心跳</button>
    `);
    exUpdateLinkStatus();
    if (exLinkTimer) { if (window.__PerfManager) window.__PerfManager.unregisterTimer(exLinkTimer); else clearInterval(exLinkTimer); }
    if (window.__PerfManager) {
        exLinkTimer = window.__PerfManager.registerTimer(exUpdateLinkStatus, 3000, 'interval');
    } else {
        exLinkTimer = setInterval(exUpdateLinkStatus, 3000);
    }
}

function exUpdateLinkStatus() {
    const modal = document.getElementById('extras-modal');
    if (!modal || modal.style.display === 'none') return;
    if (!exData.linkStatus.lastSeen || Date.now() - new Date(exData.linkStatus.lastSeen).getTime() > 30000) {
        exData.linkStatus.signal = Math.round(60 + Math.random() * 40);
        exData.linkStatus.online = true;
        exData.linkStatus.lastSeen = new Date().toISOString();
        exSave();
    }
    const el1 = document.getElementById('ex-link-emoji');
    if (!el1) return;
    const sig = exData.linkStatus.signal;
    const el2 = document.getElementById('ex-link-status');
    const el3 = document.getElementById('ex-link-detail');
    if (sig >= 75) { el1.textContent = '🟢'; el2.textContent = '在线'; el2.style.color = '#00B894'; el3.textContent = '信号良好 · Ta 就在身边'; }
    else if (sig >= 40) { el1.textContent = '🟡'; el2.textContent = '在线'; el2.style.color = '#FDCB6E'; el3.textContent = '信号一般 · 偶尔卡顿'; }
    else { el1.textContent = '🔴'; el2.textContent = '离线'; el2.style.color = '#E17055'; el3.textContent = '信号弱 · Ta 可能忙'; }
    const kmEl = document.getElementById('ex-dist-km');
    const cityEl = document.getElementById('ex-dist-city');
    if (kmEl) { kmEl.textContent = exData.distance.physicalKm + ' km'; }
    if (cityEl) { cityEl.textContent = exData.distance.physicalKm < 1 ? '同城 🏙️' : (exData.distance.physicalKm < 100 ? '同省 🌿' : (exData.distance.physicalKm < 1000 ? '跨省 ✈️' : '跨国 🌏')); }
    const hsEl = document.getElementById('ex-heart-score');
    const hlEl = document.getElementById('ex-heart-label');
    if (hsEl) { hsEl.textContent = exData.distance.heartScore; hsEl.style.color = exData.distance.heartScore >= 70 ? '#FF6B6B' : (exData.distance.heartScore >= 40 ? '#FDCB6E' : '#B2BEC3'); }
    if (hlEl) { hlEl.textContent = exData.distance.heartScore >= 80 ? '甜蜜' : (exData.distance.heartScore >= 50 ? '温暖' : (exData.distance.heartScore >= 20 ? '冷淡' : '疏远')); }
}

window.exSetDistance = function(mode) {
    if (mode === 'rand') {
        exData.distance.physicalKm = Math.floor(Math.random() * 5000);
    } else {
        const v = parseInt(document.getElementById('ex-dist-input').value, 10);
        if (isNaN(v) || v < 0) { showNotification('请输入有效距离', 'warning'); return; }
        exData.distance.physicalKm = v;
    }
    exSave();
    exUpdateLinkStatus();
    showNotification('距离已更新', 'success');
};

window.exPingPartner = function() {
    showNotification('正在探测心跳…', 'info', 2000);
    setTimeout(() => {
        exData.linkStatus.signal = Math.round(70 + Math.random() * 30);
        exData.linkStatus.online = true;
        exData.linkStatus.lastSeen = new Date().toISOString();
        exData.distance.heartScore = Math.min(100, exData.distance.heartScore + Math.floor(Math.random()*5));
        exSave();
        exUpdateLinkStatus();
        const sig = exData.linkStatus.signal;
        showNotification(`💓 心跳 ${sig}% · Ta 想你了～`, 'success', 3000);
    }, 1500);
};

/* ============ 12. 查岗功能 ============ */
let exCheckinTimer = null;

function exViewCheckin() {
    exSetBody(exHeader('🔔 查岗', '双向监测对方动态') + `
        <div style="background:var(--message-received-bg); border-radius:14px; padding:16px; margin-bottom:14px; text-align:center;">
            <div id="ex-checkin-icon" style="font-size:44px; margin-bottom:6px;">🔍</div>
            <div id="ex-checkin-status" style="font-size:18px; font-weight:700; color:var(--text-primary);">未开启</div>
            <div id="ex-checkin-activity" style="font-size:14px; color:var(--accent-color); margin-top:4px; font-weight:600;"></div>
            <div id="ex-checkin-detail" style="font-size:12px; color:var(--text-secondary); margin-top:4px;">—</div>
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:14px;">
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">查岗间隔 (分钟)</div>
            <input id="ex-checkin-interval" type="number" min="1" max="1440" value="${exData.checkin.intervalMin}" style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:8px; background:var(--secondary-bg); color:var(--text-primary); box-sizing:border-box;">
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:14px;">
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-primary);">
                <input id="ex-checkin-idle" type="checkbox" ${exData.checkin.alertOnlyIdle ? 'checked' : ''}>
                仅在对方空闲时提醒我
            </label>
        </div>
        <div style="display:flex; gap:8px; margin-bottom:14px;">
            <button class="ex-primary-btn" style="flex:1;" onclick="exCheckinStart()">${exData.checkin.enabled ? '⏸ 暂停查岗' : '▶ 开始查岗'}</button>
            <button class="ex-quick-btn" onclick="exCheckinDo()" style="padding:8px 14px;">🔍 立即查一次</button>
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-size:13px; font-weight:600; color:var(--text-primary);">👀 对方也在查你</div>
                <button onclick="exPartnerCheckinOnce()" class="ex-quick-btn" style="font-size:10px;">模拟Ta查岗</button>
            </div>
            <div id="ex-partner-checkins"></div>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin:14px 0 8px;">📜 查岗历史</div>
        <div id="ex-checkin-history"></div>
    `);
    exRenderCheckinHistory();
    exRenderPartnerCheckins();
    exUpdateCheckinStatus();
}

function exUpdateCheckinStatus() {
    const icon = document.getElementById('ex-checkin-icon');
    const status = document.getElementById('ex-checkin-status');
    const activity = document.getElementById('ex-checkin-activity');
    const detail = document.getElementById('ex-checkin-detail');
    if (!icon) return;
    if (exData.checkin.enabled) {
        icon.textContent = '🔍';
        status.textContent = '查岗进行中';
        status.style.color = '#00B894';
        const now = exPartnerNow();
        const act = exActivityForHour(now.getHours());
        activity.textContent = `${act.emoji} ${act.activity}`;
        detail.textContent = `每 ${exData.checkin.intervalMin} 分钟监测 · 上次：${exData.checkin.lastCheck ? exFmtDate(exData.checkin.lastCheck).slice(5) : '—'}`;
    } else {
        icon.textContent = '💤';
        status.textContent = '未开启';
        status.style.color = 'var(--text-secondary)';
        activity.textContent = '';
        detail.textContent = '开启后将定时监测对方活跃度';
    }
}

window.exCheckinStart = function() {
    exData.checkin.enabled = !exData.checkin.enabled;
    if (exData.checkin.enabled) {
        const interval = parseInt(document.getElementById('ex-checkin-interval').value, 10) || 30;
        exData.checkin.intervalMin = Math.max(1, Math.min(1440, interval));
        const idleOnly = document.getElementById('ex-checkin-idle');
        exData.checkin.alertOnlyIdle = idleOnly ? idleOnly.checked : true;
        exCheckinDo();
        if (exCheckinTimer) { if (window.__PerfManager) window.__PerfManager.unregisterTimer(exCheckinTimer); else clearInterval(exCheckinTimer); }
        if (window.__PerfManager) {
            exCheckinTimer = window.__PerfManager.registerTimer(exCheckinDo, exData.checkin.intervalMin * 60 * 1000, 'interval');
        } else {
            exCheckinTimer = setInterval(exCheckinDo, exData.checkin.intervalMin * 60 * 1000);
        }
        showNotification('🔍 查岗已开启', 'success');
    } else {
        if (exCheckinTimer) {
            if (window.__PerfManager) window.__PerfManager.unregisterTimer(exCheckinTimer);
            else clearInterval(exCheckinTimer);
            exCheckinTimer = null;
        }
        showNotification('查岗已暂停', 'info');
    }
    exSave();
    exUpdateCheckinStatus();
};

window.exCheckinDo = function() {
    let lastMsgTime = null;
    try {
        if (typeof messages !== 'undefined' && messages.length) {
            const partnerMsgs = messages.filter(m => m.sender === 'partner');
            if (partnerMsgs.length) lastMsgTime = partnerMsgs[partnerMsgs.length - 1].timestamp;
        }
    } catch(e) {}
    const now = Date.now();
    const pNow = exPartnerNow();
    const act = exActivityForHour(pNow.getHours());
    let result, detail;
    if (lastMsgTime) {
        const gap = (now - new Date(lastMsgTime).getTime()) / 60000;
        if (gap < 5) { result = '🟢 活跃在线'; detail = `5分钟内有消息 · ${act.emoji} ${act.activity}`; }
        else if (gap < 30) { result = '🟡 较活跃'; detail = `${Math.floor(gap)}分钟前有消息 · ${act.emoji} ${act.activity}`; }
        else if (gap < 120) { result = '😴 可能在忙'; detail = `${Math.floor(gap)}分钟前最后消息 · ${act.emoji} ${act.activity}`; }
        else { result = '💤 长时间无消息'; detail = `${Math.floor(gap)}分钟前最后消息，可能休息了 · ${act.emoji} ${act.activity}`; }
    } else {
        result = '❓ 无记录'; detail = `${act.emoji} ${act.activity} · 对方还没发过消息`;
    }
    exData.checkin.lastCheck = new Date().toISOString();
    exData.checkinHistory.unshift({ id:'ck_'+Date.now(), time:new Date().toISOString(), result, detail, activity: act });
    if (exData.checkinHistory.length > 50) exData.checkinHistory = exData.checkinHistory.slice(0, 50);
    exSave();
    exUpdateCheckinStatus();
    exRenderCheckinHistory();
    if (exData.checkin.enabled) {
        showNotification('🔍 查岗：' + result + ' · ' + act.activity, result.includes('🟢') ? 'success' : 'warning', 3500);
    }
};

function exRenderCheckinHistory() {
    const el = document.getElementById('ex-checkin-history');
    if (!el) return;
    if (!exData.checkinHistory.length) {
        el.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:10px;">暂无查岗记录</div>`;
        return;
    }
    el.innerHTML = exData.checkinHistory.slice(0, 15).map(c => {
        const act = c.activity || exActivityForHour(0);
        return `
        <div style="padding:8px 10px; border-bottom:1px solid var(--border-color); font-size:12px;">
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:16px;">${act.emoji}</span>
                <span style="color:var(--text-primary); font-weight:500;">${c.result}</span>
            </div>
            <div style="color:var(--text-secondary); font-size:11px; margin-top:2px;">${exEscape(c.detail)}</div>
            <div style="color:var(--text-secondary); font-size:10px; margin-top:2px;">${exFmtDate(c.time).slice(5)} · ${act.desc || ''}</div>
        </div>`;
    }).join('');
}

window.exPartnerCheckinOnce = function() {
    const scenarios = [
        { whatDoing: '在看手机', result: '🟢 你在线' },
        { whatDoing: '在回消息', result: '🟢 你在回消息' },
        { whatDoing: '在看视频', result: '🟡 你在看视频' },
        { whatDoing: '在忙', result: '😴 你在忙' },
        { whatDoing: '在休息', result: '💤 你在休息' },
        { whatDoing: '在玩游戏', result: '🟡 你在玩游戏' },
        { whatDoing: '在学习', result: '🟢 你在学习' },
        { whatDoing: '在吃饭', result: '🟡 你在吃饭' },
        { whatDoing: '在运动', result: '🟢 你在运动' },
        { whatDoing: '在睡觉', result: '💤 你在睡觉' },
    ];
    const s = scenarios[Math.floor(Math.random() * scenarios.length)];
    const now = new Date();
    const myAct = exActivityForHour(now.getHours());
    exData.partnerCheckins.unshift({
        id:'pc_'+Date.now(),
        time: now.toISOString(),
        whatDoing: s.whatDoing,
        result: s.result,
        myActivity: myAct.activity,
    });
    if (exData.partnerCheckins.length > 30) exData.partnerCheckins = exData.partnerCheckins.slice(0, 30);
    exSave();
    exRenderPartnerCheckins();
    showNotification(`👀 Ta 查岗：${s.result}（你在${s.whatDoing}）`, 'info', 4000);
};

function exRenderPartnerCheckins() {
    const el = document.getElementById('ex-partner-checkins');
    if (!el) return;
    if (!exData.partnerCheckins.length) {
        el.innerHTML = `<div style="font-size:11px; color:var(--text-secondary); text-align:center; padding:6px;">暂无对方查岗记录</div>`;
        return;
    }
    el.innerHTML = exData.partnerCheckins.slice(0, 10).map(c => `
        <div style="padding:6px 8px; border-bottom:1px solid var(--border-color); font-size:11px; display:flex; align-items:center; gap:6px;">
            <span style="font-size:14px;">👀</span>
            <div style="flex:1;">
                <div style="color:var(--text-primary); font-weight:500;">Ta 查你：${c.result}</div>
                <div style="color:var(--text-secondary); font-size:10px;">你在：${c.whatDoing} · ${exFmtDate(c.time).slice(5)}</div>
            </div>
        </div>
    `).join('');
}

/* ============ 13. 对方收藏的对话 ============ */
function exViewPartnerFavs() {
    // 从消息里找对方收藏的（用 favorited 字段，模拟对方视角）
    let favMsgs = [];
    try {
        if (typeof messages !== 'undefined' && messages.length) {
            favMsgs = messages.filter(m => m.favorited && m.sender === 'partner');
        }
    } catch(e) {}
    // 如果没有对方收藏的，模拟一些
    if (!favMsgs.length) {
        favMsgs = [
            { id:'pf_1', text:'今天真的好想你…', time: new Date(Date.now()-3600000).toISOString() },
            { id:'pf_2', text:'你说过的话我都记得哦', time: new Date(Date.now()-7200000).toISOString() },
            { id:'pf_3', text:'「在一起的每一秒都想定格」', time: new Date(Date.now()-86400000).toISOString() },
        ];
    }
    exData.partnerFavs = favMsgs;
    exSave();
    exSetBody(exHeader('⭐ ' + exEscape(exPartnerName()) + ' 的珍藏', 'Ta 收藏的每一句话都是心跳') + `
        <div style="background:var(--message-received-bg); border-radius:14px; padding:16px; margin-bottom:14px; text-align:center;">
            <div style="font-size:36px;">💝</div>
            <div style="font-size:13px; color:var(--text-primary); margin-top:4px;">${exEscape(exPartnerName())} 收藏了 <b>${favMsgs.length}</b> 条对话</div>
        </div>
        <div id="ex-fav-list"></div>
    `);
    const list = document.getElementById('ex-fav-list');
    if (!list) return;
    list.innerHTML = favMsgs.map(m => `
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px 14px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                <div style="flex:1; font-size:14px; color:var(--text-primary); line-height:1.5;">${exEscape(m.text)}</div>
                <span style="color:#FDCB6E; font-size:16px;">⭐</span>
            </div>
            <div style="font-size:10px; color:var(--text-secondary); margin-top:6px;">${exFmtDate(m.time).slice(5)}</div>
        </div>
    `).join('');
}

/* ============ 14. 后台消息推送 ============ */
let exPushTimer = null;

function exViewBgPush() {
    exSetBody(exHeader('📡 后台推送', '消息实时提醒不错过') + `
        <div style="background:var(--message-received-bg); border-radius:14px; padding:18px; margin-bottom:14px; text-align:center;">
            <div id="ex-push-icon" style="font-size:44px; margin-bottom:6px;">📬</div>
            <div id="ex-push-status" style="font-size:18px; font-weight:700; color:var(--text-primary);">未开启</div>
            <div id="ex-push-detail" style="font-size:12px; color:var(--text-secondary); margin-top:4px;">开启后即使切到后台也能收到消息</div>
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:14px;">
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-primary); margin-bottom:10px;">
                <input id="ex-push-enabled" type="checkbox" ${exData.bgPush.enabled ? 'checked' : ''}>
                启用后台消息推送
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-primary); margin-bottom:10px;">
                <input id="ex-push-sound" type="checkbox" ${exData.bgPush.sound ? 'checked' : ''}>
                推送时播放声音
            </label>
            <div style="font-size:12px; color:var(--text-secondary); margin:8px 0 6px;">推送检查间隔 (秒)</div>
            <input id="ex-push-interval" type="number" min="5" max="300" value="${exData.bgPush.intervalSec}" style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:8px; background:var(--secondary-bg); color:var(--text-primary); box-sizing:border-box;">
        </div>
        <div style="display:flex; gap:8px; margin-bottom:14px;">
            <button class="ex-primary-btn" style="flex:1;" onclick="exPushSave()">💾 保存设置</button>
            <button class="ex-quick-btn" onclick="exPushTest()">🔔 测试推送</button>
        </div>
        <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px; font-size:11px; color:var(--text-secondary); line-height:1.6;">
            <b style="color:var(--text-primary);">💡 提示：</b> 浏览器通知需在浏览器设置里允许。开启后会定时检查新消息，即使切到其他标签页也能收到桌面通知。
        </div>
    `);
    exUpdatePushStatus();
}

function exUpdatePushStatus() {
    const icon = document.getElementById('ex-push-icon');
    const status = document.getElementById('ex-push-status');
    if (!icon) return;
    if (exData.bgPush.enabled) {
        icon.textContent = '📬';
        status.textContent = '推送已开启';
        status.style.color = '#0984E3';
    } else {
        icon.textContent = '🔕';
        status.textContent = '推送未开启';
        status.style.color = 'var(--text-secondary)';
    }
}

window.exPushSave = function() {
    exData.bgPush.enabled = document.getElementById('ex-push-enabled').checked;
    exData.bgPush.sound = document.getElementById('ex-push-sound').checked;
    exData.bgPush.intervalSec = Math.max(5, Math.min(300, parseInt(document.getElementById('ex-push-interval').value, 10) || 30));
    exSave();
    exUpdatePushStatus();
    if (exData.bgPush.enabled) {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(perm => {
                showNotification(perm === 'granted' ? '🔔 推送已授权' : '⚠️ 推送未授权，请在浏览器设置里允许通知', perm === 'granted' ? 'success' : 'warning', 4000);
            });
        }
        exStartPushLoop();
    } else {
        if (exPushTimer) { clearInterval(exPushTimer); exPushTimer = null; }
    }
    showNotification('推送设置已保存', 'success');
};

function exStartPushLoop() {
    if (exPushTimer) {
        if (window.__PerfManager) window.__PerfManager.unregisterTimer(exPushTimer);
        else clearInterval(exPushTimer);
        exPushTimer = null;
    }
    const loop = () => {
        if (!exData.bgPush.enabled) {
            if (window.__PerfManager && exPushTimer) { window.__PerfManager.unregisterTimer(exPushTimer); }
            else if (exPushTimer) clearInterval(exPushTimer);
            exPushTimer = null;
            return;
        }
        exCheckNewMessages();
    };
    if (window.__PerfManager) {
        exPushTimer = window.__PerfManager.registerTimer(loop, exData.bgPush.intervalSec * 1000, 'interval');
    } else {
        exPushTimer = setInterval(loop, exData.bgPush.intervalSec * 1000);
    }
}

function exCheckNewMessages() {
    // 检查是否有新的对方消息
    if (typeof messages === 'undefined' || !messages.length) return;
    const key = 'ex_push_last_id';
    const lastId = parseInt(localStorage.getItem(key) || '0', 10);
    const partnerMsgs = messages.filter(m => m.sender === 'partner');
    const newMsgs = partnerMsgs.filter(m => m.id > lastId);
    if (newMsgs.length > 0) {
        const last = newMsgs[newMsgs.length - 1];
        localStorage.setItem(key, last.id);
        const preview = (last.text || '新消息').slice(0, 30);
        // 桌面通知
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('📬 传讯新消息', {
                    body: preview,
                    icon: 'manifest.webmanifest',
                    tag: 'ex-msg-' + last.id,
                    requireInteraction: false,
                });
            } catch(e) {}
        }
        // 声音
        if (exData.bgPush.sound && typeof playSound === 'function') playSound('partner_message');
        // 页面通知（即使在前台也提醒）
        showNotification('📬 新消息：' + preview, 'info', 3000);
    }
}

window.exPushTest = function() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') exDoPushTest();
            else showNotification('需要授权才能推送', 'warning');
        });
    } else {
        exDoPushTest();
    }
};

function exDoPushTest() {
    try {
        new Notification('📬 传讯测试推送', { body: '这是一条测试消息', icon: 'manifest.webmanifest' });
    } catch(e) {}
    showNotification('🔔 测试推送已发送', 'success');
}

/* ============ 15. 回复速度调整 ============ */
window.exApplyReplySpeed = function(speed) {
    if (!EX_REPLY_SPEEDS[speed]) return;
    exData.replySpeed = speed;
    const cfg = EX_REPLY_SPEEDS[speed];
    // 同步到全局 settings
    if (typeof settings !== 'undefined') {
        settings.replyDelayMin = cfg.min;
        settings.replyDelayMax = cfg.max;
        // 如果设置面板已打开，更新滑块
        try {
            const minSlider = document.getElementById('min-delay-slider');
            const maxSlider = document.getElementById('max-delay-slider');
            if (minSlider) { minSlider.value = cfg.min; minSlider.dispatchEvent(new Event('input')); }
            if (maxSlider) { maxSlider.value = cfg.max; maxSlider.dispatchEvent(new Event('input')); }
        } catch(e) {}
        if (typeof throttledSaveData === 'function') throttledSaveData();
    }
    exSave();
    showNotification(`回复速度已设为「${cfg.label}」`, 'success');
};

/* ============ 初始化 ============ */
/* ============ 14. 觉察日志 ============ */
const EX_JOURNAL_MOODS = [
    { key:'calm',   emoji:'😌', name:'平静',   color:'#6BCB77' },
    { key:'grateful',emoji:'🥰',name:'感恩',   color:'#FFD93D' },
    { key:'proud',  emoji:'😊', name:'自豪',   color:'#00B894' },
    { key:'curious',emoji:'🤔', name:'好奇',   color:'#8D9EFF' },
    { key:'frustrated',emoji:'😤',name:'挫败', color:'#FF6B6B' },
    { key:'tired',  emoji:'😴', name:'疲惫',   color:'#A29BFE' },
    { key:'confused',emoji:'😵',name:'困惑',   color:'#FD79A8' },
    { key:'hopeful',emoji:'🌟', name:'充满希望', color:'#F0932B' },
];

function exViewJournal() {
    exSetBody(exHeader('🪶 觉察日志', '记录、反思、成长') + `
        <div style="display:flex;gap:8px;margin-bottom:14px;">
            <button onclick="exJournalNew()" class="ex-primary-btn" style="flex:1;">✏️ 写一篇</button>
            <button onclick="exJournalExport()" class="ex-quick-btn" style="padding:8px 14px;">📤 导出</button>
        </div>
        <div id="ex-journal-list"></div>
    `);
    exJournalRender();
}

function exJournalRender() {
    const el = document.getElementById('ex-journal-list');
    if (!el) return;
    if (!exData.journals.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:20px;">还没有日志，开始记录吧～</div>`;
        return;
    }
    el.innerHTML = exData.journals.slice().reverse().map(j => {
        const mood = EX_JOURNAL_MOODS.find(m => m.key === j.mood) || EX_JOURNAL_MOODS[0];
        return `
        <div style="background:var(--primary-bg);border-left:4px solid ${mood.color};border-radius:0 12px 12px 0;padding:12px 14px;margin-bottom:10px;cursor:pointer;" onclick="exJournalView('${j.id}')">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-size:22px;">${mood.emoji}</span>
                <div style="flex:1;">
                    <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${exEscape(j.title || '无题')}</div>
                    <div style="font-size:10px;color:var(--text-secondary);">${exFmtDate(j.time).slice(5)} · ${mood.name}${j.tags && j.tags.length ? ' · ' + j.tags.map(t=>'#'+t).join(' ') : ''}</div>
                </div>
                <button onclick="event.stopPropagation();exJournalDel('${j.id}')" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:12px;">🗑</button>
            </div>
            <div style="font-size:12px;color:var(--text-primary);line-height:1.6;white-space:pre-wrap;max-height:60px;overflow:hidden;">${exEscape(j.content)}</div>
            ${j.reflection ? `<div style="margin-top:6px;padding:6px 8px;background:var(--message-received-bg);border-radius:6px;font-size:11px;color:var(--text-secondary);border-left:3px solid var(--accent-color);">💭 ${exEscape(j.reflection)}</div>` : ''}
        </div>`;
    }).join('');
}

window.exJournalNew = function() {
    exSetBody(exHeader('✏️ 写日志', '觉察当下') + `
        <div style="padding:14px;">
            <div style="margin-bottom:14px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">标题</div>
                <input id="ex-j-title" placeholder="给今天一个标题..." style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;">
            </div>
            <div style="margin-bottom:14px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">心情</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;" id="ex-j-mood-pick">
                    ${EX_JOURNAL_MOODS.map((m,i)=>`<div onclick="document.querySelectorAll('#ex-j-mood-pick > div').forEach(x=>x.style.outline='none');this.style.outline='2px solid ${m.color}';window._exJMood='${m.key}'" style="cursor:pointer;padding:6px 10px;border-radius:8px;background:${m.color}33;font-size:12px;${i===0?'outline:2px solid '+m.color:''}">${m.emoji} ${m.name}</div>`).join('')}
                </div>
            </div>
            <div style="margin-bottom:14px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">觉察（今天发生了什么？）</div>
                <textarea id="ex-j-content" placeholder="记录此刻的觉察..." style="width:100%;min-height:100px;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>
            </div>
            <div style="margin-bottom:14px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">💭 反思（从中看到了什么？可以怎么成长？）</div>
                <textarea id="ex-j-reflection" placeholder="我的思考和成长..." style="width:100%;min-height:60px;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>
            </div>
            <div style="margin-bottom:14px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">标签（空格分隔）</div>
                <input id="ex-j-tags" placeholder="如：工作 情绪 关系" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;">
            </div>
            <button onclick="exJournalSave()" class="ex-primary-btn" style="width:100%;">💾 保存日志</button>
        </div>
    `);
    window._exJMood = 'calm';
};

window.exJournalSave = function() {
    const title = document.getElementById('ex-j-title').value.trim();
    const content = document.getElementById('ex-j-content').value.trim();
    const reflection = document.getElementById('ex-j-reflection').value.trim();
    const tags = document.getElementById('ex-j-tags').value.trim().split(/\s+/).filter(Boolean);
    if (!content) { showNotification('请写点什么', 'warning'); return; }
    exData.journals.push({ id:'j_'+Date.now(), title, content, reflection, mood: window._exJMood || 'calm', tags, time:new Date().toISOString() });
    exSave();
    showNotification('日志已保存', 'success');
    exViewJournal();
};

window.exJournalView = function(id) {
    const j = exData.journals.find(x => x.id === id);
    if (!j) return;
    const mood = EX_JOURNAL_MOODS.find(m => m.key === j.mood) || EX_JOURNAL_MOODS[0];
    exSetBody(exHeader('📖 日志详情', exFmtDate(j.time)) + `
        <div style="padding:14px;">
            <div style="background:var(--primary-bg);border-left:4px solid ${mood.color};border-radius:0 12px 12px 0;padding:14px;margin-bottom:14px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <span style="font-size:28px;">${mood.emoji}</span>
                    <div>
                        <div style="font-size:15px;font-weight:700;color:var(--text-primary);">${exEscape(j.title || '无题')}</div>
                        <div style="font-size:11px;color:var(--text-secondary);">${mood.name}${j.tags && j.tags.length ? ' · ' + j.tags.map(t=>'#'+t).join(' ') : ''}</div>
                    </div>
                </div>
                <div style="font-size:13px;color:var(--text-primary);line-height:1.8;white-space:pre-wrap;">${exEscape(j.content)}</div>
                ${j.reflection ? `<div style="margin-top:12px;padding:10px;background:var(--message-received-bg);border-radius:8px;font-size:12px;color:var(--text-primary);border-left:3px solid var(--accent-color);line-height:1.6;"><b>💭 反思：</b><br>${exEscape(j.reflection)}</div>` : ''}
            </div>
            <button onclick="exJournalDel('${j.id}');exViewJournal()" class="ex-quick-btn" style="width:100%;color:#FF6B6B;">🗑 删除这篇日志</button>
        </div>
    `);
};

window.exJournalDel = function(id) {
    if (!confirm('删除这篇日志？')) return;
    exData.journals = exData.journals.filter(j => j.id !== id);
    exSave();
    exJournalRender();
};

window.exJournalExport = function() {
    if (!exData.journals.length) { showNotification('暂无日志可导出', 'warning'); return; }
    let txt = '🪶 觉察日志导出\n\n';
    exData.journals.forEach(j => {
        txt += `📖 ${j.title || '无题'} | ${exFmtDate(j.time)}\n`;
        txt += `${j.content}\n`;
        if (j.reflection) txt += `💭 ${j.reflection}\n`;
        txt += '---\n';
    });
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `觉察日志_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('日志已导出', 'success');
};

/* ============ 15. AI 解牌 / 分析 ============ */
const EX_TAROT_CARDS = [
    '愚者', '魔术师', '女祭司', '皇后', '皇帝', '教皇', '恋人', '战车', '力量', '隐士',
    '命运之轮', '正义', '倒吊人', '死神', '节制', '恶魔', '高塔', '星星', '太阳', '审判', '世界',
];
const EX_TAROT_EMOJIS = { '愚者':'🤡','魔术师':'🎩','女祭司':'🌙','皇后':'👑','皇帝':'⚔️','教皇':'📜','恋人':'💕','战车':'🏇','力量':'🦁','隐士':'🕯️','命运之轮':'🎡','正义':'⚖️','倒吊人':'🙃','死神':'💀','节制':'🕊️','恶魔':'😈','高塔':'🗼','星星':'⭐','太阳':'☀️','审判':'📯','世界':'🌍' };

function exViewAI() {
    exSetBody(exHeader('🔮 AI 解牌', '塔罗 + AI 智能分析') + `
        <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">🔑 AI API 配置</div>
            <div style="font-size:10px;color:var(--text-secondary);margin-bottom:4px;">API Key（用于 AI 分析，存储在本地）</div>
            <input id="ex-ai-key" type="password" value="${exData.aiConfig.apiKey}" placeholder="sk-..." style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;margin-bottom:8px;font-size:12px;">
            <div style="font-size:10px;color:var(--text-secondary);margin-bottom:4px;">API 地址</div>
            <input id="ex-ai-url" type="text" value="${exData.aiConfig.apiUrl}" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;margin-bottom:8px;font-size:11px;">
            <div style="font-size:10px;color:var(--text-secondary);margin-bottom:4px;">模型</div>
            <input id="ex-ai-model" type="text" value="${exData.aiConfig.model}" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;margin-bottom:8px;font-size:11px;">
            <button onclick="exAISaveConfig()" class="ex-quick-btn" style="width:100%;font-size:11px;">💾 保存配置</button>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin:14px 0 8px;">🔮 塔罗三张牌</div>
        <div style="background:var(--message-received-bg);border-radius:12px;padding:14px;text-align:center;margin-bottom:14px;">
            <div id="ex-tarot-cards" style="display:flex;gap:10px;justify-content:center;margin-bottom:10px;"></div>
            <button onclick="exTarotDraw()" class="ex-primary-btn" style="width:100%;">🎴 抽三张牌</button>
        </div>
        <div id="ex-ai-tarot-result"></div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin:14px 0 8px;">🤖 AI 自由分析</div>
        <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:14px;">
            <input id="ex-ai-question" placeholder="问点什么... 如：我最近的工作状态？" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;margin-bottom:8px;font-size:12px;">
            <button onclick="exAIQuery()" class="ex-primary-btn" style="width:100%;">✨ AI 分析</button>
        </div>
        <div id="ex-ai-history"></div>
    `);
    exTarotRenderCards();
    exAIRenderHistory();
}

window.exAISaveConfig = function() {
    exData.aiConfig.apiKey = document.getElementById('ex-ai-key').value.trim();
    exData.aiConfig.apiUrl = document.getElementById('ex-ai-url').value.trim();
    exData.aiConfig.model = document.getElementById('ex-ai-model').value.trim();
    exSave();
    showNotification('AI 配置已保存', 'success');
};

let exTarotDrawn = [];

function exTarotRenderCards() {
    const el = document.getElementById('ex-tarot-cards');
    if (!el) return;
    if (!exTarotDrawn.length) {
        el.innerHTML = [0,1,2].map(() => `<div style="width:50px;height:70px;background:linear-gradient(135deg,#6C5CE7,#A29BFE);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;">🎴</div>`).join('');
        return;
    }
    el.innerHTML = exTarotDrawn.map(c => {
        const emoji = EX_TAROT_EMOJIS[c.name] || '🎴';
        return `<div style="width:50px;height:70px;background:${c.reversed?'linear-gradient(135deg,#E17055,#FDCB6E)':'linear-gradient(135deg,#6C5CE7,#A29BFE)'};border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:#fff;">
            <div style="font-size:22px;">${emoji}</div>
            <div style="margin-top:2px;">${c.name}</div>
            <div style="font-size:8px;opacity:0.8;">${c.reversed?'逆位':'正位'}</div>
        </div>`;
    }).join('');
}

window.exTarotDraw = function() {
    const positions = ['过去', '现在', '未来'];
    exTarotDrawn = positions.map(pos => {
        const name = EX_TAROT_CARDS[Math.floor(Math.random() * EX_TAROT_CARDS.length)];
        const reversed = Math.random() < 0.3;
        return { position: pos, name, reversed };
    });
    exTarotRenderCards();
    const resultEl = document.getElementById('ex-ai-tarot-result');
    if (!resultEl) return;
    resultEl.innerHTML = `<div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;font-size:12px;color:var(--text-primary);line-height:1.8;">
        <b>🔮 三张牌解读：</b><br>
        ${exTarotDrawn.map(c => `<b>${c.position}：</b>${EX_TAROT_EMOJIS[c.name]||'🎴'} ${c.name}（${c.reversed?'逆位':'正位'}）`).join('<br>')}
    </div>`;
    if (exData.aiConfig.apiKey) {
        setTimeout(() => exAIAnalyzeTarot(), 500);
    }
};

async function exAIAnalyzeTarot() {
    if (!exData.aiConfig.apiKey) return;
    const resultEl = document.getElementById('ex-ai-tarot-result');
    if (!resultEl) return;
    resultEl.innerHTML += '<div id="ex-ai-loading" style="text-align:center;padding:10px;font-size:12px;color:var(--text-secondary);">🪄 AI 正在解读...</div>';
    const prompt = `请作为塔罗牌师，解读以下三张牌的含义，结合"过去-现在-未来"的阵位：\n${exTarotDrawn.map(c=>`${c.position}：${c.name}（${c.reversed?'逆位':'正位'}）`).join('\n')}\n请给出温柔、有洞察力的解读，包括每一张牌的含义和整体建议。`;
    try {
        const resp = await fetch(exData.aiConfig.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + exData.aiConfig.apiKey },
            body: JSON.stringify({ model: exData.aiConfig.model, messages: [{role:'user', content: prompt}], max_tokens: 800 }),
        });
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || 'AI 暂时无法解读';
        const loadEl = document.getElementById('ex-ai-loading');
        if (loadEl) loadEl.remove();
        resultEl.innerHTML += `<div style="margin-top:10px;padding:10px;background:#FFF9E6;border:1px solid #FFD93D;border-radius:10px;font-size:12px;color:var(--text-primary);line-height:1.8;"><b>🤖 AI 解读：</b><br>${text.replace(/\n/g,'<br>')}</div>`;
        exData.aiHistory.unshift({ id:'ai_'+Date.now(), type:'reading', input: exTarotDrawn.map(c=>c.name).join('、'), output: text, time:new Date().toISOString() });
        if (exData.aiHistory.length > 30) exData.aiHistory = exData.aiHistory.slice(0, 30);
        exSave();
    } catch(e) {
        const loadEl = document.getElementById('ex-ai-loading');
        if (loadEl) loadEl.innerHTML = '<span style="color:#FF6B6B;">❌ AI 调用失败：' + e.message + '</span>';
    }
}

window.exAIQuery = async function() {
    const q = document.getElementById('ex-ai-question').value.trim();
    if (!q) { showNotification('请输入问题', 'warning'); return; }
    if (!exData.aiConfig.apiKey) { showNotification('请先配置 AI API Key', 'warning'); return; }
    const hist = document.getElementById('ex-ai-history');
    if (hist) hist.innerHTML += `<div style="padding:8px;border-bottom:1px solid var(--border-color);font-size:12px;"><b style="color:var(--accent-color);">我：</b>${exEscape(q)}</div>`;
    try {
        const resp = await fetch(exData.aiConfig.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + exData.aiConfig.apiKey },
            body: JSON.stringify({ model: exData.aiConfig.model, messages: [{role:'user', content: q}], max_tokens: 800 }),
        });
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || 'AI 暂时无法回答';
        if (hist) hist.innerHTML += `<div style="padding:8px;border-bottom:1px solid var(--border-color);font-size:12px;background:var(--message-received-bg);border-radius:6px;"><b style="color:#00B894;">AI：</b>${exEscape(text).replace(/\n/g,'<br>')}</div>`;
        exData.aiHistory.unshift({ id:'ai_'+Date.now(), type:'analysis', input: q, output: text, time:new Date().toISOString() });
        if (exData.aiHistory.length > 30) exData.aiHistory = exData.aiHistory.slice(0, 30);
        exSave();
    } catch(e) {
        if (hist) hist.innerHTML += `<div style="padding:8px;font-size:12px;color:#FF6B6B;">❌ ${e.message}</div>`;
    }
};

function exAIRenderHistory() {
    const el = document.getElementById('ex-ai-history');
    if (!el) return;
    if (!exData.aiHistory.length) return;
    el.innerHTML = `<div style="font-size:11px;color:var(--text-secondary);margin-top:10px;font-weight:600;">📜 AI 历史</div>` +
        exData.aiHistory.slice(0, 5).map(h => `<div style="padding:6px 0;border-bottom:1px solid var(--border-color);font-size:11px;color:var(--text-secondary);">${h.type==='reading'?'🔮':'🤖'} ${exEscape(h.input).slice(0,30)} · ${exFmtDate(h.time).slice(5)}</div>`).join('');
}

/* ============ 16. 自定义声音 ============ */
function exViewSound() {
    exSetBody(exHeader('🔊 自定义声音', '上传或录制专属音效') + `
        <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">📤 上传音频文件</div>
            <input id="ex-sound-upload" type="file" accept="audio/*" style="font-size:11px;width:100%;margin-bottom:8px;">
            <input id="ex-sound-name" placeholder="声音名称（如：专属提示音）" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;margin-bottom:8px;font-size:12px;">
            <button onclick="exSoundUpload()" class="ex-primary-btn" style="width:100%;font-size:12px;">💾 保存声音</button>
        </div>
        <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">🎙 在线录制</div>
            <div style="display:flex;gap:8px;">
                <button id="ex-rec-start" onclick="exRecStart()" class="ex-quick-btn" style="flex:1;">● 开始录音</button>
                <button id="ex-rec-stop" onclick="exRecStop()" class="ex-quick-btn" style="flex:1;display:none;">■ 停止录音</button>
            </div>
            <div id="ex-rec-status" style="font-size:10px;color:var(--text-secondary);margin-top:6px;"></div>
            <audio id="ex-rec-player" controls style="width:100%;margin-top:6px;display:none;"></audio>
            <input id="ex-rec-name" placeholder="录音名称" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;margin-top:8px;font-size:12px;display:none;">
            <button id="ex-rec-save" onclick="exRecSave()" class="ex-primary-btn" style="width:100%;margin-top:6px;font-size:12px;display:none;">💾 保存录音</button>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin:14px 0 8px;">🔔 我的声音库</div>
        <div id="ex-sound-list"></div>
    `);
    exSoundRender();
}

function exSoundRender() {
    const el = document.getElementById('ex-sound-list');
    if (!el) return;
    if (!exData.customSounds.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:10px;">还没有自定义声音</div>`;
        return;
    }
    el.innerHTML = exData.customSounds.map(s => `
        <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:10px;padding:10px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-size:18px;">🔊</span>
                <div style="flex:1;font-size:13px;font-weight:600;color:var(--text-primary);">${exEscape(s.name)}</div>
                <button onclick="exSoundPlay('${s.id}')" class="ex-quick-btn" style="font-size:10px;">▶ 播放</button>
                <button onclick="exSoundDel('${s.id}')" class="ex-quick-btn" style="font-size:10px;color:#FF6B6B;">🗑</button>
            </div>
            <audio id="ex-sound-player-${s.id}" src="${s.data}" preload="auto" style="display:none;"></audio>
            <div style="font-size:10px;color:var(--text-secondary);">${exFmtDate(s.time).slice(5)}</div>
        </div>
    `).join('');
}

window.exSoundUpload = function() {
    const file = document.getElementById('ex-sound-upload').files[0];
    const name = document.getElementById('ex-sound-name').value.trim();
    if (!file) { showNotification('请选择音频文件', 'warning'); return; }
    if (!name) { showNotification('请填写声音名称', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        exData.customSounds.push({ id:'s_'+Date.now(), name, data: e.target.result, time:new Date().toISOString() });
        exSave();
        showNotification('声音已保存', 'success');
        exSoundRender();
    };
    reader.readAsDataURL(file);
};

let exRecMediaRecorder = null;
let exRecChunks = [];
let exRecBlobUrl = null;

window.exRecStart = function() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotification('浏览器不支持录音', 'error'); return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        exRecChunks = [];
        exRecMediaRecorder = new MediaRecorder(stream);
        exRecMediaRecorder.ondataavailable = e => { if (e.data.size > 0) exRecChunks.push(e.data); };
        exRecMediaRecorder.onstop = () => {
            const blob = new Blob(exRecChunks, { type: 'audio/webm' });
            exRecBlobUrl = URL.createObjectURL(blob);
            const player = document.getElementById('ex-rec-player');
            if (player) { player.src = exRecBlobUrl; player.style.display = 'block'; }
            document.getElementById('ex-rec-name').style.display = 'block';
            document.getElementById('ex-rec-save').style.display = 'block';
            document.getElementById('ex-rec-status').textContent = '录音完成！填写名称后保存。';
            stream.getTracks().forEach(t => t.stop());
        };
        exRecMediaRecorder.start();
        document.getElementById('ex-rec-start').style.display = 'none';
        document.getElementById('ex-rec-stop').style.display = 'block';
        document.getElementById('ex-rec-status').textContent = '● 正在录音...';
    }).catch(() => { showNotification('无法访问麦克风', 'error'); });
};

window.exRecStop = function() {
    if (exRecMediaRecorder && exRecMediaRecorder.state === 'recording') exRecMediaRecorder.stop();
    document.getElementById('ex-rec-start').style.display = 'block';
    document.getElementById('ex-rec-stop').style.display = 'none';
};

window.exRecSave = function() {
    const name = document.getElementById('ex-rec-name').value.trim();
    if (!name) { showNotification('请填写录音名称', 'warning'); return; }
    if (!exRecBlobUrl) { showNotification('没有可保存的录音', 'warning'); return; }
    fetch(exRecBlobUrl).then(r => r.blob()).then(blob => {
        const reader = new FileReader();
        reader.onload = (e) => {
            exData.customSounds.push({ id:'s_'+Date.now(), name, data: e.target.result, time:new Date().toISOString() });
            exSave();
            showNotification('录音已保存', 'success');
            exSoundRender();
            document.getElementById('ex-rec-player').style.display = 'none';
            document.getElementById('ex-rec-name').style.display = 'none';
            document.getElementById('ex-rec-save').style.display = 'none';
            document.getElementById('ex-rec-status').textContent = '';
            if (exRecBlobUrl) { URL.revokeObjectURL(exRecBlobUrl); exRecBlobUrl = null; }
        };
        reader.readAsDataURL(blob);
    });
};

window.exSoundPlay = function(id) {
    const el = document.getElementById('ex-sound-player-' + id);
    if (el) { el.currentTime = 0; el.play(); }
};

window.exSoundDel = function(id) {
    if (!confirm('删除这个声音？')) return;
    exData.customSounds = exData.customSounds.filter(s => s.id !== id);
    exSave();
    exSoundRender();
};

window.initExtras = async function() {
    await exLoad();
    // 应用回复速度到全局设置
    if (typeof settings !== 'undefined') {
        const cfg = EX_REPLY_SPEEDS[exData.replySpeed] || EX_REPLY_SPEEDS.normal;
        settings.replyDelayMin = cfg.min;
        settings.replyDelayMax = cfg.max;
    }
    // 如果后台推送已开启，启动轮询
    if (exData.bgPush.enabled) exStartPushLoop();
};
// 启动时自动加载（容错）
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        try { window.initExtras(); } catch(e) { console.warn('extras 初始化失败', e); }
    }, 800);
});
