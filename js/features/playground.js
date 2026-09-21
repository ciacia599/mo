/**
 * playground.js — 互动小屋（挂在画画界面入口）
 * 包含：优化红包（普通/拼手气/口令）、小黑屋、惩罚、自定义设置、
 *       梦角档案 & 我的档案、寻踪、对方主动（调查问卷/小问题/吐槽/邀请）
 * 模式参考 doodle.js / extras.js：自包含 UI + localforage 持久化 + 全局函数
 * 暴露：pgOpenRedpacket / pgOpenJail / pgOpenPunish / pgOpenProfile /
 *       pgOpenTrack / pgOpenSettings / pgOpenPlayground
 */

/* ==================== 数据层 ==================== */
let pgData = {
    settings: {
        proactive: 'medium',              // off | low | medium | high | custom
        proactiveCustomMin: 10,
        proactiveCustomMax: 25,
        enableSurvey: true,               // 调查问卷
        enableQuestion: true,             // 小问题
        enableComplaint: true,            // 吐槽
        enableInvite: true,               // 邀请
        customLocations: '',              // 每行一个
        customActions: ''                 // 每行一个
    },
    jail: { active: false, until: 0, reason: '', startedAt: 0, logs: [] },
    punishLib: [],                        // 自定义惩罚库
    punishments: [],                      // 惩罚任务 {id,text,status:'pending|done|fail',created,finished}
    profilePartner: { name:'', birthday:'', star:'', height:'', likes:'', dislikes:'', story:'', tags:'', anniv:'', note:'' },
    profileMine:    { name:'', birthday:'', star:'', height:'', likes:'', dislikes:'', story:'', tags:'', anniv:'', note:'' },
    surveys: [],                          // 已完成问卷 {title, answers, time}
    inviteLog: [],                        // 邀请记录
    proactiveLog: [],                     // 主动动态记录
    trackLog: []                          // 寻踪足迹 {t, loc, act, mood}
};
let pgLoaded = false;

async function pgLoadData() {
    if (pgLoaded) return;
    try {
        const saved = await localforage.getItem(getStorageKey('playgroundData'));
        if (saved && typeof saved === 'object') pgData = Object.assign({}, pgData, saved);
    } catch (e) {
        try {
            const raw = localStorage.getItem('pgFallback_playgroundData');
            if (raw) pgData = Object.assign({}, pgData, JSON.parse(raw));
        } catch (e2) {}
    }
    pgLoaded = true;
}
function pgSave() {
    try { localforage.setItem(getStorageKey('playgroundData'), pgData); }
    catch (e) {
        try { localStorage.setItem('pgFallback_playgroundData', JSON.stringify(pgData)); } catch (e2) {}
    }
}

/* ==================== 通用工具 ==================== */
function pgPartnerName() {
    try { if (typeof exPartnerName === 'function') return exPartnerName(); } catch (e) {}
    try { if (typeof settings !== 'undefined' && settings.partnerName) return settings.partnerName; } catch (e) {}
    return '梦角';
}
function pgMyName() {
    try { if (typeof settings !== 'undefined' && settings.myName) return settings.myName; } catch (e) {}
    return '我';
}
function pgEscape(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function pgTimeText(iso) {
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function pgNotify(msg, type, dur) {
    if (typeof showNotification === 'function') showNotification(msg, type || 'info', dur || 3000);
}
function pgSound(k) { try { if (typeof playSound === 'function') playSound(k); } catch (e) {} }
function pgChat(sender, text) {
    if (typeof addMessage === 'function') {
        addMessage({ id: Date.now() + Math.floor(Math.random() * 999), sender, text, timestamp: new Date(), status: sender === 'user' ? 'sent' : 'received', type: 'normal' });
    }
}
/* 金币：优先复用 extras 的金币系统 */
function pgCoins() { try { if (typeof exData !== 'undefined' && exData && typeof exData.coins === 'number') return exData.coins; } catch (e) {} return (pgData.__coins = pgData.__coins || 2000); }
function pgAddCoins(n) {
    try { if (typeof exData !== 'undefined' && exData && typeof exData.coins === 'number') { exData.coins += n; if (typeof exSave === 'function') exSave(); return; } } catch (e) {}
    pgData.__coins = (pgData.__coins || 2000) + n; pgSave();
}

/* ==================== 模态框框架 ==================== */
function pgEnsureModal() {
    if (document.getElementById('pg-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'pg-modal';
    modal.style.zIndex = '9100';
    modal.innerHTML = `<div class="modal-content" style="max-width:500px; padding:16px; max-height:82vh; overflow-y:auto;">
        <div id="pg-body"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) pgClose(); });
}
function pgOpenModal() { pgEnsureModal(); showModal(document.getElementById('pg-modal')); }
function pgClose() { pgStopClock(); hideModal(document.getElementById('pg-modal')); }
function pgSetBody(html) { const b = document.getElementById('pg-body'); if (b) b.innerHTML = html; }
function pgHeader(title, subtitle) {
    return `<div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <button class="ex-back-btn" onclick="pgOpenHub()"><i class="fas fa-arrow-left"></i></button>
        <div>
            <div style="font-size:17px; font-weight:700; color:var(--text-primary);">${title}</div>
            ${subtitle ? `<div style="font-size:11px; color:var(--text-secondary);">${subtitle}</div>` : ''}
        </div>
    </div>`;
}
function pgCard(title, inner) {
    return `<div style="background:var(--secondary-bg); border:1px solid var(--border-color); border-radius:14px; padding:14px; margin-bottom:12px;">
        ${title ? `<div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:10px;">${title}</div>` : ''}${inner}
    </div>`;
}
function pgInput(id, placeholder, value, extra) {
    return `<input id="${id}" type="text" placeholder="${pgEscape(placeholder || '')}" value="${pgEscape(value || '')}" ${extra || ''}
        style="width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; box-sizing:border-box; margin-bottom:8px;">`;
}
function pgTextarea(id, placeholder, value, rows) {
    return `<textarea id="${id}" placeholder="${pgEscape(placeholder || '')}" rows="${rows || 3}"
        style="width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; box-sizing:border-box; margin-bottom:8px; resize:vertical;">${pgEscape(value || '')}</textarea>`;
}
function pgBtn(label, onclick, primary) {
    const bg = primary === false ? 'var(--primary-bg)' : 'var(--accent-color)';
    const color = primary === false ? 'var(--text-primary)' : '#fff';
    const border = primary === false ? '1px solid var(--border-color)' : 'none';
    return `<button onclick="${onclick}" style="padding:9px 14px; border-radius:10px; border:${border}; background:${bg}; color:${color}; font-size:13px; font-weight:600; cursor:pointer;">${label}</button>`;
}
window.pgOpenHub = async function () {
    await pgLoadData();
    pgStopClock();
    const items = [
        ['🧧', '红包', '优化版 · 三种红包', 'pgOpenRedpacket()', '#FF6B6B'],
        ['🔒', '小黑屋', '把 Ta 关进去', 'pgOpenJail()', '#8E7CC3'],
        ['⚖️', '惩罚', '罚 Ta 做任务', 'pgOpenPunish()', '#E67E22'],
        ['🐾', '宠物', '一起养只小可爱', 'pgOpenPet()', '#F39C12'],
        ['🌱', '花园', '种花种菜收获', 'pgOpenGarden()', '#2ECC71'],
        ['📖', '档案', '梦角 & 我的档案', 'pgOpenProfile()', '#3498DB'],
        ['📍', '寻踪', 'Ta 现在在哪干嘛', 'pgOpenTrack()', '#1ABC9C'],
        ['☯️', '易经', '六十四卦解卦', 'pgOpenIching()', '#7F8C8D'],
        ['⚙️', '设置', '自定义互动', 'pgOpenSettings()', '#95A5A6']
    ];
    pgSetBody(`
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
            <div style="font-size:17px; font-weight:800; color:var(--text-primary);">💗 互动小屋</div>
            <button onclick="pgClose()" style="width:30px; height:30px; border-radius:50%; border:1px solid var(--border-color); background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:16px;">×</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">
            ${items.map(([ic, nm, ds, fn, c]) => `
                <div onclick="${fn}" style="background:var(--primary-bg); border:1.5px solid var(--border-color); border-radius:14px; padding:14px 8px; cursor:pointer; text-align:center; transition:transform .15s;"
                    onmouseover="this.style.borderColor='${c}';this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='var(--border-color)';this.style.transform='';">
                    <div style="font-size:26px; line-height:1;">${ic}</div>
                    <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-top:6px;">${nm}</div>
                    <div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">${ds}</div>
                </div>`).join('')}
        </div>
        <div style="font-size:11px; color:var(--text-secondary); text-align:center; margin-top:12px; opacity:0.75;">入口在涂鸦画板底部 · 所有数据本地保存</div>
    `);
};

/* ==================== 1. 优化红包 ==================== */
const PG_RP_TEMPLATES = ['爱你哟，拿去花～', '一点心意，请笑纳', '今天也要开心呀', '给最爱的你', '买糖吃，甜一点', '奖励小可爱的', '天冷了喝奶茶', '想你了，收下吧'];
window.pgOpenRedpacket = async function () {
    await pgLoadData();
    pgOpenModal();
    pgViewRedpacket();
};
function pgViewRedpacket() {
    const rpList = (typeof exData !== 'undefined' && exData.redpackets) ? exData.redpackets : [];
    pgSetBody(pgHeader('🧧 红包 · 优化版', '普通 / 拼手气 / 口令 三种玩法') + `
        ${pgCard(`发红包给 ${pgEscape(pgPartnerName())}`, `
            <div id="pg-rp-types" style="display:flex; gap:6px; margin-bottom:10px;">
                ${[['normal', '🧧 普通'], ['lucky', '🎲 拼手气'], ['pass', '🔑 口令']].map(([k, t], i) => `
                    <button id="pg-rp-type-${k}" onclick="pgRpSetType('${k}')" style="flex:1; padding:8px 0; border-radius:10px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid ${i === 0 ? 'var(--accent-color)' : 'var(--border-color)'}; background:var(--primary-bg); color:var(--text-primary);">${t}</button>`).join('')}
            </div>
            <div style="display:flex; gap:8px; margin-bottom:8px;">
                <input id="pg-rp-amount" type="number" min="1" placeholder="金额（金币）" style="flex:1; padding:9px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:14px;">
                <span style="align-self:center; font-size:11px; color:var(--text-secondary); white-space:nowrap;">余额 ${pgCoins()}</span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
                ${[52, 99, 520, 1314].map(a => `<button class="ex-quick-btn" onclick="document.getElementById('pg-rp-amount').value=${a}">${a}</button>`).join('')}
            </div>
            <div id="pg-rp-pass-wrap" style="display:none;">
                ${pgInput('pg-rp-pass', '设置口令（如：我最爱的小猪）', '', 'maxlength="20"')}
            </div>
            ${pgInput('pg-rp-msg', '祝福语（点下面模板快速填）', '')}
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
                ${PG_RP_TEMPLATES.map(t => `<button class="ex-quick-btn" onclick="document.getElementById('pg-rp-msg').value='${t}'">${t}</button>`).join('')}
            </div>
            ${pgBtn('🧧 塞钱进红包', 'pgSendRedpacket()')}
            <div style="font-size:11px; color:var(--text-secondary); margin-top:8px;">🎲 拼手气：对方拆开后你们俩各自得随机一份；🔑 口令：Ta 猜对口令才能领，猜错会撒娇</div>
        `)}
        ${pgCard('🧧 红包小贴士', `
            <div style="font-size:11px;color:var(--text-secondary);">红包会以微信样式的卡片发送到聊天里，点击卡片即可拆开领取；24 小时未领取会自动退回。</div>
        `)}
        <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin:12px 0 8px;">📜 红包记录</div>
        <div id="pg-rp-list">${pgRpListHtml(rpList)}</div>
    `);
    pgRpType = 'normal';
}
/* 聊天里发一张微信风红包卡片（可点击拆开） */
function pgSendRpCard(rp, sender) {
    if (typeof addMessage === 'function') {
        addMessage({
            id: Date.now() + Math.floor(Math.random() * 999),
            sender,
            text: '',
            timestamp: new Date(),
            status: sender === 'user' ? 'sent' : 'received',
            type: 'redpacket',
            redpacketId: rp.id
        });
    }
}
let pgRpType = 'normal';
window.pgRpSetType = function (k) {
    pgRpType = k;
    ['normal', 'lucky', 'pass'].forEach(t => {
        const b = document.getElementById('pg-rp-type-' + t);
        if (b) b.style.borderColor = t === k ? 'var(--accent-color)' : 'var(--border-color)';
    });
    const pw = document.getElementById('pg-rp-pass-wrap');
    if (pw) pw.style.display = k === 'pass' ? 'block' : 'none';
};
window.pgSendRedpacket = function () {
    const amt = parseInt(document.getElementById('pg-rp-amount').value, 10);
    if (!amt || amt <= 0) { pgNotify('请输入有效金额', 'warning'); return; }
    if (amt > pgCoins()) { pgNotify('金币不足啦', 'error'); return; }
    const msg = document.getElementById('pg-rp-msg').value.trim() || '一点心意，请笑纳';
    const rp = { id: 'rp_' + Date.now(), from: 'me', amount: amt, message: msg, time: (typeof exNow === 'function' ? exNow() : new Date().toISOString()), opened: false, expired: false };
    if (pgRpType === 'pass') {
        const pass = document.getElementById('pg-rp-pass').value.trim();
        if (!pass) { pgNotify('口令红包需要设置口令哦', 'warning'); return; }
        rp.type = 'password'; rp.password = pass; rp.tries = 0;
    }
    if (pgRpType === 'lucky') {
        const partnerShare = Math.max(1, Math.floor(amt * (0.3 + Math.random() * 0.4)));
        rp.type = 'lucky'; rp.luckyMine = amt - partnerShare; rp.amount = partnerShare; rp.total = amt;
    }
    pgAddCoins(-amt);
    if (rp.type === 'lucky') pgAddCoins(rp.luckyMine); // 拼手气：我的份额立刻回账，净支出 = 对方那份
    if (typeof exData !== 'undefined' && exData.redpackets) { exData.redpackets.push(rp); if (typeof exSave === 'function') exSave(); }
    else { pgData.__myRps = pgData.__myRps || []; pgData.__myRps.push(rp); pgSave(); }
    pgSendRpCard(rp, 'user');
    pgSound('send');
    if (rp.type === 'lucky') pgNotify(`拼手气红包已送出，你的手气 ${pgCoin(rp.luckyMine)} 🪙`, 'success', 4000);
    else pgNotify('红包已送出 🧧', 'success');
    // 对方拆红包
    const delay = rp.type === 'pass' ? 6000 + Math.random() * 12000 : 3000 + Math.random() * 6000;
    setTimeout(() => pgPartnerOpenRp(rp), delay);
    pgViewRedpacket();
};
function pgCoin(n) { return '🪙 ' + Number(n || 0).toLocaleString(); }
function pgPartnerOpenRp(rp) {
    if (rp.type === 'pass') {
        rp.tries = (rp.tries || 0) + 1;
        const ok = Math.random() < 0.65;
        if (ok) {
            rp.opened = true;
            try { if (typeof exData !== 'undefined' && exData.partnerCoins !== undefined) { exData.partnerCoins += rp.amount; if (typeof exSave === 'function') exSave(); } } catch (e) {}
            pgChat('partner', `口令是「${rp.password}」！猜对啦，红包我收下咯 🧧`);
            pgNotify(`${pgPartnerName()} 猜对口令，领走了红包 🧧`, 'success', 4000);
        } else if (rp.tries >= 3) {
            // 猜错三次：红包退回给我
            rp.expired = true;
            pgAddCoins(rp.amount);
            pgChat('partner', `猜了三次都没猜中…红包退给你啦，哼，都怪口令太难！（提示：${rp.password.slice(0, 1)} 开头）`);
            pgNotify(`${pgPartnerName()} 没猜对口令，红包已退回`, 'info', 4000);
        } else {
            pgChat('partner', `（对着红包挠头）是不是…「${['小笨蛋', '永远在一起', '一起去看海', '今天也要开心'][Math.floor(Math.random() * 4)]}」？猜猜猜不出！`);
            pgNotify(`${pgPartnerName()} 猜错口令了（第 ${rp.tries}/3 次），再给 Ta 一点时间`, 'info');
            setTimeout(() => pgPartnerOpenRp(rp), 8000 + Math.random() * 10000);
        }
    } else {
        rp.opened = true;
        try { if (typeof exData !== 'undefined' && exData.partnerCoins !== undefined) { exData.partnerCoins += rp.amount; if (typeof exSave === 'function') exSave(); } } catch (e) {}
        const replies = ['哇，谢谢你的红包！最爱你了 ❤️', '收下啦！我也会好好疼你的～', '嘿嘿，被你宠到了 🧧', '这也太大方了吧，抱紧！'];
        pgChat('partner', replies[Math.floor(Math.random() * replies.length)]);
        pgNotify(`${pgPartnerName()} 领取了你的红包 🧧`, 'success');
        // 概率回一个红包
        if (Math.random() < 0.5) {
            setTimeout(() => pgPartnerSendRp(), 4000 + Math.random() * 6000);
        }
    }
    pgSave();
}
function pgPartnerSendRp() {
    const amt = [52, 66, 88, 99, 520][Math.floor(Math.random() * 5)];
    const rp = { id: 'rpp_' + Date.now(), from: 'partner', amount: amt, message: ['回礼～收下吧', '也给你一个，甜一下', '礼尚往来，爱你', '给你买奶茶喝'][Math.floor(Math.random() * 4)], time: (typeof exNow === 'function' ? exNow() : new Date().toISOString()), opened: false, expired: false };
    if (typeof exData !== 'undefined' && exData.redpackets) { exData.redpackets.push(rp); if (typeof exSave === 'function') exSave(); }
    pgSendRpCard(rp, 'partner');
    pgSound('partner_message');
    pgNotify(`${pgPartnerName()} 给你发了一个红包 🧧`, 'success', 3500);
}
function pgRpListHtml(list) {
    const arr = list.slice().reverse().slice(0, 12);
    if (!arr.length) return `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:10px;">还没有红包记录</div>`;
    return arr.map(r => {
        const mine = r.from === 'me';
        const st = r.expired ? '已退回' : r.opened ? (mine ? '已被领取' : '已领取') : '待领取';
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 4px; border-bottom:1px dashed var(--border-color); font-size:12px;">
            <div><b style="color:var(--text-primary);">${pgEscape(mine ? '我 → ' + pgPartnerName() : pgPartnerName() + ' → 我')}</b>
                <span style="color:var(--text-secondary); margin-left:6px;">${pgEscape(r.message || '')}</span>
                ${r.type === 'lucky' ? '<span style="color:var(--accent-color); margin-left:4px;">拼手气</span>' : ''}${r.type === 'password' ? '<span style="color:var(--accent-color); margin-left:4px;">口令</span>' : ''}</div>
            <div style="text-align:right;"><b style="color:#FF6B6B;">${pgCoin(r.amount)}</b><div style="color:var(--text-secondary); font-size:10px;">${st} · ${pgTimeText(r.time)}</div></div>
        </div>`;
    }).join('');
}

/* ==================== 2. 小黑屋 ==================== */
const PG_JAIL_BEGS = ['（扒着门缝）放我出去嘛…我知道错了…', '（蹲在角落画圈圈）你真的忍心吗…', '小黑屋好黑…我想你了，放我出去好不好…', '（隔着门喊）我错啦！再也不敢了！', '（小声）我给你背首诗你放我出去好不好…'];
window.pgOpenJail = async function () {
    await pgLoadData();
    pgOpenModal();
    pgViewJail();
};
function pgViewJail() {
    const j = pgData.jail;
    let inner;
    if (j.active && Date.now() < j.until) {
        const remainMs = j.until - Date.now();
        const mm = Math.floor(remainMs / 60000), ss = Math.floor((remainMs % 60000) / 1000);
        inner = `
            <div style="background:linear-gradient(160deg,#1a1a2e,#16213e); border-radius:14px; padding:22px 14px; text-align:center; margin-bottom:12px;">
                <div style="font-size:44px; line-height:1;">🕳️</div>
                <div style="font-size:15px; font-weight:700; color:#e0e0e0; margin-top:8px;">${pgEscape(pgPartnerName())} 正在小黑屋反省</div>
                <div style="font-size:26px; font-weight:800; color:#FF6B6B; margin-top:6px;" id="pg-jail-count">${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}</div>
                <div style="font-size:12px; color:#aaa; margin-top:6px;">关押原因：${pgEscape(j.reason || '未知')}</div>
                <div style="font-size:22px; margin-top:8px;">😿 🚪 🔒</div>
            </div>
            <div style="display:flex; gap:8px;">
                ${pgBtn('🔓 心软了，提前释放', 'pgJailRelease()')}
                ${pgBtn('➕ 加时 5 分钟', 'pgJailExtend()', false)}
            </div>`;
    } else {
        if (j.active) { j.active = false; pgSave(); }
        inner = `
            <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:14px; padding:16px; text-align:center; margin-bottom:12px;">
                <div style="font-size:38px;">🚪</div>
                <div style="font-size:13px; color:var(--text-secondary); margin-top:6px;">把 ${pgEscape(pgPartnerName())} 关进小黑屋，Ta 会隔门求饶、写检讨，释放后乖乖听话～</div>
            </div>
            ${pgCard('关押设置', `
                ${pgInput('pg-jail-reason', '关押原因（如：偷吃了我的小蛋糕）', '', 'maxlength="30"')}
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
                    ${[5, 10, 15, 30, 60].map((m, i) => `<button class="ex-quick-btn" id="pg-jail-dur-${m}" onclick="pgJailPickDur(${m})" style="${i === 1 ? 'border-color:var(--accent-color);' : ''}">${m}分钟</button>`).join('')}
                </div>
                ${pgBtn('🔒 关进小黑屋', 'pgJailLock()')}
            `)}
            <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin:12px 0 8px;">📜 关押记录</div>
            ${pgJailLogsHtml()}`;
    }
    pgSetBody(pgHeader('🔒 小黑屋', '闹别扭专用，小心 Ta 生气哦') + inner);
    if (j.active && Date.now() < j.until) pgStartJailClock();
}
let pgJailDur = 10;
window.pgJailPickDur = function (m) {
    pgJailDur = m;
    [5, 10, 15, 30, 60].forEach(x => {
        const b = document.getElementById('pg-jail-dur-' + x);
        if (b) b.style.borderColor = x === m ? 'var(--accent-color)' : 'var(--border-color)';
    });
};
window.pgJailLock = function () {
    const reason = document.getElementById('pg-jail-reason').value.trim() || '惹我生气了';
    pgData.jail = { active: true, until: Date.now() + pgJailDur * 60000, reason, startedAt: Date.now(), logs: pgData.jail.logs || [] };
    pgData.jail.logs.unshift({ t: new Date().toISOString(), text: `关进小黑屋 ${pgJailDur} 分钟 · 原因：${reason}` });
    pgSave();
    pgChat('user', `【小黑屋】🔒 ${pgPartnerName()} 因为「${reason}」被关进小黑屋 ${pgJailDur} 分钟！`);
    pgChat('partner', ['呜呜，我错了我错了，放我出去…', '哼，关就关，我才不怕…（声音越来越小）', '（被拖走）等等！我检讨还不行吗！'][Math.floor(Math.random() * 3)]);
    pgNotify(`${pgPartnerName()} 已被关进小黑屋 🔒`, 'success');
    pgSound('mood');
    pgViewJail();
};
window.pgJailRelease = function () {
    const mins = ((Date.now() - pgData.jail.startedAt) / 60000).toFixed(1);
    pgData.jail.active = false;
    pgData.jail.logs.unshift({ t: new Date().toISOString(), text: `提前释放（关了 ${mins} 分钟）` });
    pgSave();
    pgChat('partner', ['（扑过来）你果然最心疼我了！','（揉揉眼睛）我以后再也不敢了…抱！','重见天日啦！开心得转圈圈～'][Math.floor(Math.random() * 3)]);
    pgNotify('已释放，Ta 感动地扑了过来', 'success');
    pgStopJailClock();
    pgViewJail();
};
window.pgJailExtend = function () {
    pgData.jail.until += 5 * 60000;
    pgData.jail.logs.unshift({ t: new Date().toISOString(), text: '加时 5 分钟（罪加一等）' });
    pgSave();
    pgChat('partner', '啊啊啊怎么还加时！我检讨我检讨还不行吗！');
    pgViewJail();
};
let pgJailClockTimer = null;
function pgStartJailClock() {
    pgStopJailClock();
    pgJailClockTimer = setInterval(() => {
        const j = pgData.jail;
        const el = document.getElementById('pg-jail-count');
        if (!el || !j.active) { pgStopJailClock(); return; }
        const remain = j.until - Date.now();
        if (remain <= 0) { pgJailAutoRelease(); return; }
        el.textContent = `${String(Math.floor(remain / 60000)).padStart(2, '0')}:${String(Math.floor((remain % 60000) / 1000)).padStart(2, '0')}`;
    }, 1000);
}
function pgStopJailClock() { if (pgJailClockTimer) { clearInterval(pgJailClockTimer); pgJailClockTimer = null; } }
function pgJailAutoRelease() {
    pgData.jail.active = false;
    pgData.jail.logs.unshift({ t: new Date().toISOString(), text: '刑满释放' });
    pgSave();
    pgChat('partner', ['（门开了，灰头土脸地走出来）我反省好了…','刑满释放！以后都听你的！','（小声）我可是主动反省完的哦…'][Math.floor(Math.random() * 3)]);
    pgNotify(`${pgPartnerName()} 刑满释放啦`, 'info');
    pgStopJailClock();
    if (document.getElementById('pg-jail-count')) pgViewJail();
}
function pgJailLogsHtml() {
    const logs = pgData.jail.logs || [];
    if (!logs.length) return `<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:10px;">暂无记录</div>`;
    return `<div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:6px 12px; max-height:180px; overflow-y:auto;">
        ${logs.slice(0, 20).map(l => `<div style="padding:7px 0; border-bottom:1px dashed var(--border-color); font-size:12px; color:var(--text-secondary);">${pgEscape(l.text)} <span style="opacity:0.6;">· ${pgTimeText(l.t)}</span></div>`).join('')}
    </div>`;
}
/* 小黑屋后台：求饶 + 到时释放（不依赖弹窗打开） */
setInterval(() => {
    if (!pgLoaded) return;
    const j = pgData.jail;
    if (!j.active) return;
    if (Date.now() >= j.until) { pgJailAutoRelease(); return; }
    if (Math.random() < 0.25) pgChat('partner', PG_JAIL_BEGS[Math.floor(Math.random() * PG_JAIL_BEGS.length)]);
}, 120000);

/* ==================== 3. 惩罚 ==================== */
const PG_PUNISH_TPL = ['抄写「我爱你」100 遍', '写 500 字检讨书', '唱一首情歌（唱完汇报）', '说 10 句土味情话', '画一幅我的画像', '陪我聊到天亮', '当面撒娇道歉三连', '发一段真心话长文', '学小猫小狗叫五声', '描述一段跳给我看的舞'];
window.pgOpenPunish = async function () {
    await pgLoadData();
    pgOpenModal();
    pgViewPunish();
};
function pgViewPunish() {
    const pending = pgData.punishments.filter(p => p.status === 'pending');
    const done = pgData.punishments.filter(p => p.status !== 'pending').slice().reverse().slice(0, 10);
    pgSetBody(pgHeader('⚖️ 惩罚', 'Ta 做错事的小小代价') + `
        ${pgCard('布置新惩罚', `
            ${pgInput('pg-punish-text', '输入惩罚内容…', '', 'maxlength="50"')}
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
                ${PG_PUNISH_TPL.map(t => `<button class="ex-quick-btn" onclick="document.getElementById('pg-punish-text').value='${t}'">${t}</button>`).join('')}
            </div>
            ${pgBtn('⚖️ 布置惩罚', 'pgAddPunish()')}
        `)}
        ${pgCard(`进行中（${pending.length}）`, pending.length ? pending.map(p => `
            <div style="background:var(--primary-bg); border:1px solid var(--border-color); border-radius:12px; padding:10px 12px; margin-bottom:8px;">
                <div style="font-size:13px; color:var(--text-primary);">📌 ${pgEscape(p.text)}</div>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    ${pgBtn('✓ 完成了', `pgPunishSet('${p.id}','done')`)}
                    ${pgBtn('✗ 没做到', `pgPunishSet('${p.id}','fail')`, false)}
                </div>
            </div>`).join('') : '<div style="font-size:12px; color:var(--text-secondary);">暂时没有进行中的惩罚，Ta 表现很乖～</div>')}
        ${pgCard('历史记录', done.length ? done.map(p => `
            <div style="display:flex; justify-content:space-between; padding:8px 2px; border-bottom:1px dashed var(--border-color); font-size:12px;">
                <span style="color:var(--text-secondary);">${pgEscape(p.text)}</span>
                <span style="color:${p.status === 'done' ? '#2ECC71' : '#E74C3C'}; white-space:nowrap; margin-left:8px;">${p.status === 'done' ? '✓ 已完成' : '✗ 未完成'}</span>
            </div>`).join('') : '<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:8px;">暂无记录</div>')}
    `);
}
window.pgAddPunish = async function () {
    const text = document.getElementById('pg-punish-text').value.trim();
    if (!text) { pgNotify('先输入惩罚内容哦', 'warning'); return; }
    await pgLoadData();
    const p = { id: 'pu_' + Date.now(), text, status: 'pending', created: new Date().toISOString() };
    pgData.punishments.push(p);
    pgSave();
    pgChat('user', `【惩罚】⚖️ ${pgPartnerName()}，惩罚任务：${text}！`);
    pgChat('partner', ['呜…好严肃，我马上做！','遵命！做完求表扬！','（认命摊开纸笔）这就开始…'][Math.floor(Math.random() * 3)]);
    pgNotify('惩罚已布置，Ta 开始努力了…', 'success');
    // 对方延迟完成（85% 概率完成）
    setTimeout(() => {
        const cur = pgData.punishments.find(x => x.id === p.id);
        if (!cur || cur.status !== 'pending') return;
        if (Math.random() < 0.85) {
            cur.status = 'done'; cur.finished = new Date().toISOString(); pgSave();
            const proofs = [`（举着成果）做完啦！快检查！`, `叮！惩罚任务完成，请查收～`, `呼…终于写完了，手都酸了，夸我！`];
            pgChat('partner', proofs[Math.floor(Math.random() * proofs.length)]);
            pgNotify(`${pgPartnerName()} 完成了惩罚任务 ✓`, 'success', 4000);
        } else {
            pgChat('partner', '那个…这个任务好难嘛，可以打个折吗？（眨眼睛）');
            pgNotify(`${pgPartnerName()} 在求情，等你裁决`, 'info', 4000);
        }
    }, 3 * 60000 + Math.random() * 7 * 60000);
    pgViewPunish();
};
window.pgPunishSet = async function (id, st) {
    await pgLoadData();
    const p = pgData.punishments.find(x => x.id === id);
    if (p) { p.status = st; p.finished = new Date().toISOString(); pgSave(); }
    if (st === 'done') pgChat('partner', '耶！奖励我一个小红花吧～');
    else pgChat('partner', '呜…那我重新做，这次一定做好！');
    pgViewPunish();
};

/* ==================== 4. 档案（梦角 & 我的） ==================== */
const PG_PROFILE_FIELDS = [
    ['name', '昵称'], ['birthday', '生日'], ['star', '星座'], ['height', '身高 / 体重'],
    ['likes', '爱好'], ['dislikes', '讨厌的东西'], ['story', '故事情节设定'], ['tags', '性格标签'],
    ['persona', '人物设定'], ['worldview', '世界观'], ['relationships', '人物关系'], ['anniv', '纪念日'], ['note', '其他备注']
];
window.pgOpenProfile = async function () {
    await pgLoadData();
    pgOpenModal();
    pgViewProfile('partner');
};
window.pgProfileTab = function (tab) { pgViewProfile(tab); };
function pgViewProfile(tab) {
    const isP = tab === 'partner';
    const d = isP ? pgData.profilePartner : pgData.profileMine;
    pgSetBody(pgHeader('📖 档案馆', '把彼此都记在心里') + `
        <div style="display:flex; gap:8px; margin-bottom:14px;">
            <button onclick="pgProfileTab('partner')" style="flex:1; padding:9px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid ${isP ? 'var(--accent-color)' : 'var(--border-color)'}; background:var(--primary-bg); color:var(--text-primary);">💗 ${pgEscape(pgPartnerName())}的档案</button>
            <button onclick="pgProfileTab('mine')" style="flex:1; padding:9px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid ${!isP ? 'var(--accent-color)' : 'var(--border-color)'}; background:var(--primary-bg); color:var(--text-primary);">🌸 我的档案</button>
        </div>
        ${isP ? `<div style="margin-bottom:10px;display:flex;gap:8px;">${pgBtn('✨ 帮我自动生成', 'pgProfileAutoFill()', false)}${pgBtn('🧚 让 Ta 自己更新', 'pgProfilePartnerUpdate()', false)}</div>` : ''}
        ${PG_PROFILE_FIELDS.map(([k, label]) => {
            if (['story', 'persona', 'worldview', 'relationships'].includes(k)) return pgCard(label, pgTextarea('pg-prof-' + k, isP ? '写下 Ta 的背景、世界与关系设定…' : '写下你自己的设定…', d[k], 4));
            return pgCard(label, pgInput('pg-prof-' + k, label, d[k]));
        }).join('')}
        <div style="text-align:center; margin:6px 0 14px;">${pgBtn('💾 保存档案', `pgProfileSave('${tab}')`)}</div>
    `);
}
window.pgProfileAutoFill = function () {
    const stars = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
    const likes = ['深夜听歌、写东西、撸猫', '看星星、喝奶茶、拆盲盒', '打游戏、看电影、收集手办', '跑步、摄影、做饭给你吃'][Math.floor(Math.random() * 4)];
    const d = pgData.profilePartner;
    d.name = d.name || pgPartnerName();
    d.star = d.star || stars[Math.floor(Math.random() * 12)];
    d.likes = d.likes || likes;
    d.dislikes = d.dislikes || ['被误解、吵闹的环境', '香菜、敷衍的回复', '冷战、不被理解'][Math.floor(Math.random() * 3)];
    d.tags = d.tags || '温柔 · 占有欲 · 嘴硬心软 · 黏人';
    d.story = d.story || '（在这里写下你们的故事：怎么认识的、第一句话、最难忘的一晚、对未来的约定…）';
    pgSave();
    pgViewProfile('partner');
    pgNotify('已生成示例内容，可继续修改后保存', 'info');
};
window.pgProfilePartnerUpdate = function () {
    const d = pgData.profilePartner;
    const pools = {
        likes: ['深夜听歌、写东西、撸猫', '看星星、喝奶茶、拆盲盒', '打游戏、看电影、收集手办', '跑步、摄影、做饭给你吃', '发呆、晒太阳、读小说'],
        dislikes: ['被误解、吵闹的环境', '香菜、敷衍的回复', '冷战、不被理解', '早起、排队、苦瓜'],
        tags: ['温柔 · 占有欲 · 嘴硬心软 · 黏人', '傲娇 · 细心 · 爱吃醋 · 护短', '开朗 · 话痨 · 笑点低 · 爱撒娇', '高冷外表 · 温柔内心 · 专一'],
        story: ['在那个雨天的便利店相遇，你借了我一把伞，后来我们就再也没分开过。', '我们是青梅竹马，从小吵到大，却越吵越甜。', '网恋奔现，第一次见面你紧张到说错话的样子我现在还记得。']
    };
    const key = Object.keys(pools)[Math.floor(Math.random() * Object.keys(pools).length)];
    const old = d[key] || '';
    d[key] = pools[key][Math.floor(Math.random() * pools[key].length)];
    pgSave();
    pgChat('partner', `我刚刚更新了一下我的档案，你去看看有没有变化～（${key} 更新了）`);
    pgNotify(`${pgPartnerName()} 更新了自己的档案（${key}）`, 'info', 3000);
    pgViewProfile('partner');
};
window.pgProfileSave = async function (tab) {
    await pgLoadData();
    const d = tab === 'partner' ? pgData.profilePartner : pgData.profileMine;
    PG_PROFILE_FIELDS.forEach(([k]) => {
        const el = document.getElementById('pg-prof-' + k);
        if (el) d[k] = el.value.trim();
    });
    pgSave();
    pgNotify('档案已保存 📖', 'success');
};

/* ==================== 5. 寻踪 ==================== */
const PG_LOCS = ['家里的卧室', '客厅沙发上', '厨房里找吃的', '公司工位', '学校图书馆', '楼下便利店', '咖啡店窗边', '公园长椅', '通勤路上', '超市货架前', '健身房', '阳台吹风'];
const PG_ACTS = {
    dawn: ['刚睡醒伸懒腰', '迷迷糊糊刷牙', '赖床中，被闹钟轰炸', '洗漱完发呆'],
    morning: ['认真工作 / 上课中', '摸鱼刷手机（被抓包）', '开会偷偷回消息', '喝咖啡提神'],
    noon: ['干饭中，吃得很香', '午休趴着睡着', '和同事/同学闲聊', '饭后散步消食'],
    afternoon: ['忙得脚不沾地', '偷偷想你了', '整理文件 / 笔记', '下午茶时间'],
    dusk: ['下班 / 放学路上', '在想着晚饭吃什么', '看夕阳发呆', '顺便买了你爱吃的'],
    night: ['窝在被子里追剧', '打游戏上分中', '洗澡哼歌中', '写日记记录今天'],
    late: ['已经睡着，呼吸均匀', '失眠刷手机中', '熬夜看小说（明天后悔）', '抱着手机等你的消息']
};
const PG_MOODS = ['😊 好心情', '😌 平静', '🥰 有点想你', '😤 有点烦', '🥺 想被抱抱', '😴 困困', '🤩 兴奋中', '😢 委屈巴巴'];
let pgClockTimer = null;
window.pgOpenTrack = async function () {
    await pgLoadData();
    pgOpenModal();
    pgViewTrack();
    pgStartClock();
};
function pgStopClock() { if (pgClockTimer) { clearInterval(pgClockTimer); pgClockTimer = null; } }
function pgStartClock() {
    pgStopClock();
    pgClockTimer = setInterval(() => {
        if (!document.getElementById('pg-track-clock')) { pgStopClock(); return; }
        pgViewTrack(); pgStartClock();
    }, 60000);
}
function pgCurPeriod() {
    const h = new Date().getHours();
    if (h >= 5 && h < 8) return 'dawn';
    if (h < 12) return 'morning';
    if (h < 14) return 'noon';
    if (h < 18) return 'afternoon';
    if (h < 21) return 'dusk';
    if (h < 24) return 'night';
    return 'late';
}
function pgPick(objKey, poolKey) {
    const pool = (pgData.settings[objKey] || '').split('\n').map(s => s.trim()).filter(Boolean);
    const base = poolKey === 'loc' ? PG_LOCS : (PG_ACTS[pgCurPeriod()] || PG_ACTS.night);
    const all = base.concat(pool);
    return all[Math.floor(Math.random() * all.length)];
}
function pgViewTrack() {
    const now = new Date();
    const p = n => String(n).padStart(2, '0');
    const loc = pgPick('customLocations', 'loc');
    const act = pgPick('customActions', 'act');
    const mood = PG_MOODS[Math.floor(Math.random() * PG_MOODS.length)];
    const key = now.toISOString().slice(0, 10);
    const last = pgData.trackLog[0];
    if (!last || last.loc !== loc || last.act !== act) {
        pgData.trackLog.unshift({ t: now.toISOString(), loc, act, mood });
        if (pgData.trackLog.length > 60) pgData.trackLog.length = 60;
        pgSave();
    }
    const todayLogs = pgData.trackLog.filter(l => l.t.slice(0, 10) === key);
    pgSetBody(pgHeader('📍 寻踪', 'Ta 的时间 · 地点 · 动作') + `
        ${pgCard('', `
            <div style="text-align:center;">
                <div style="font-size:30px; font-weight:800; color:var(--text-primary);" id="pg-track-clock">${p(now.getHours())}:${p(now.getMinutes())}</div>
                <div style="font-size:11px; color:var(--text-secondary);">${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} 星期${'日一二三四五六'[now.getDay()]}</div>
                <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:12px;">
                    <span style="font-size:34px;">🐻</span>
                    <div style="text-align:left;">
                        <div style="font-size:14px; font-weight:700; color:var(--text-primary);">📍 ${pgEscape(pgPartnerName())} 正在「${pgEscape(loc)}」</div>
                        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">🎬 ${pgEscape(act)}</div>
                        <div style="font-size:12px; color:var(--text-secondary);">💭 心情：${mood}</div>
                    </div>
                </div>
                <div style="margin-top:10px;">${pgBtn('🔄 看看 Ta 在干嘛', 'pgViewTrack()')}</div>
            </div>
        `)}
        ${pgCard('🕐 今日足迹', todayLogs.length ? `
            <div style="max-height:260px; overflow-y:auto;">
                ${todayLogs.map(l => `<div style="display:flex; gap:10px; padding:7px 0; border-bottom:1px dashed var(--border-color); font-size:12px;">
                    <span style="color:var(--accent-color); white-space:nowrap;">${pgTimeText(l.t).slice(-5)}</span>
                    <span style="color:var(--text-secondary);">📍${pgEscape(l.loc)} · ${pgEscape(l.act)}</span>
                </div>`).join('')}
            </div>` : '<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:8px;">足迹会随着时间自动记录</div>')}
        <div style="font-size:11px; color:var(--text-secondary); text-align:center; opacity:0.7;">地点与动作可在「设置」里自定义</div>
    `);
}

/* ==================== 6. 自定义设置 ==================== */
window.pgOpenSettings = async function () {
    await pgLoadData();
    pgOpenModal();
    pgViewSettings();
};
function pgViewSettings() {
    const s = pgData.settings;
    const freqs = [['off', '关闭'], ['low', '悠闲 20-40分'], ['medium', '普通 10-25分'], ['high', '热情 4-10分'], ['custom', '自定义']];
    pgSetBody(pgHeader('⚙️ 互动设置', '一切按你的喜好来') + `
        ${pgCard('对方主动找你的频率', freqs.map(([k, t]) => `
            <label style="display:flex; align-items:center; gap:8px; padding:7px 0; font-size:13px; color:var(--text-primary); cursor:pointer;">
                <input type="radio" name="pg-freq" value="${k}" ${s.proactive === k ? 'checked' : ''} onchange="pgSaveSettings()"> ${t}
            </label>`).join(''))}
        ${pgCard('主动内容开关', [
            ['enableSurvey', '📋 调查问卷', '对方偶尔发问卷让你填'],
            ['enableQuestion', '❓ 小问题', '对方好奇的小提问'],
            ['enableComplaint', '😤 吐槽', '对方的小脾气抱怨'],
            ['enableInvite', '💌 邀请', '对方约你做点什么']
        ].map(([k, t, d]) => `
            <label style="display:flex; align-items:center; gap:8px; padding:7px 0; font-size:13px; color:var(--text-primary); cursor:pointer;">
                <input type="checkbox" id="pg-set-${k}" ${s[k] ? 'checked' : ''} onchange="pgSaveSettings()"> ${t}
                <span style="font-size:11px; color:var(--text-secondary); margin-left:auto;">${d}</span>
            </label>`).join(''))}
        ${pgCard('自定义地点库（寻踪用）', pgTextarea('pg-set-locs', '每行一个地点，如：\n天台吹风\n宠物店看猫', s.customLocations, 4))}
        ${pgCard('自定义动作库（寻踪用）', pgTextarea('pg-set-acts', '每行一个动作，如：\n给你织围巾\n练习表白台词', s.customActions, 4))}
        ${pgCard('自定义主动频率', `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);"><input id="pg-set-custom-min" type="number" min="1" max="720" value="${Number(s.proactiveCustomMin) || 10}" style="width:80px;padding:8px;border:1px solid var(--border-color);border-radius:9px;background:var(--primary-bg);color:var(--text-primary);"><span>到</span><input id="pg-set-custom-max" type="number" min="1" max="720" value="${Number(s.proactiveCustomMax) || 25}" style="width:80px;padding:8px;border:1px solid var(--border-color);border-radius:9px;background:var(--primary-bg);color:var(--text-primary);"><span>分钟一次</span></div>`)}
        ${pgCard('危险操作', pgBtn('🗑 清空互动数据', 'pgWipeData()', false))}
        <div style="text-align:center; margin-bottom:12px;">${pgBtn('💾 保存设置', 'pgSaveSettings()')}</div>
    `);
}
window.pgSaveSettings = async function () {
    await pgLoadData();
    const freq = document.querySelector('input[name="pg-freq"]:checked');
    if (freq) pgData.settings.proactive = freq.value;
    ['enableSurvey', 'enableQuestion', 'enableComplaint', 'enableInvite'].forEach(k => {
        const el = document.getElementById('pg-set-' + k);
        if (el) pgData.settings[k] = el.checked;
    });
    const locs = document.getElementById('pg-set-locs');
    if (locs) pgData.settings.customLocations = locs.value;
    const acts = document.getElementById('pg-set-acts');
    if (acts) pgData.settings.customActions = acts.value;
    const customMin = parseInt(document.getElementById('pg-set-custom-min')?.value, 10);
    const customMax = parseInt(document.getElementById('pg-set-custom-max')?.value, 10);
    if (Number.isFinite(customMin) && Number.isFinite(customMax)) {
        pgData.settings.proactiveCustomMin = Math.max(1, Math.min(customMin, customMax));
        pgData.settings.proactiveCustomMax = Math.min(720, Math.max(customMin, customMax));
    }
    pgSave();
    pgNotify('设置已保存 ⚙️', 'success');
};
window.pgWipeData = async function () {
    if (!confirm('确定清空互动小屋的全部数据？此操作不可恢复。')) return;
    await pgLoadData();
    const settings = pgData.settings;
    pgData = {
        settings, jail: { active: false, until: 0, reason: '', startedAt: 0, logs: [] },
        punishLib: [], punishments: [], profilePartner: { name: '', birthday: '', star: '', height: '', likes: '', dislikes: '', story: '', tags: '', anniv: '', note: '' },
        profileMine: { name: '', birthday: '', star: '', height: '', likes: '', dislikes: '', story: '', tags: '', anniv: '', note: '' },
        surveys: [], inviteLog: [], proactiveLog: [], trackLog: []
    };
    pgSave();
    pgNotify('已清空', 'success');
    pgOpenHub();
};

/* ==================== 7. 对方主动：问卷 / 小问题 / 吐槽 / 邀请 ==================== */
const PG_SURVEYS = [
    { title: '💞 恋人契合度小调查', qs: [['你更喜欢哪种约会？', ['看电影', '散步压马路', '宅家一起打游戏']], ['收到什么礼物最开心？', ['手写信', '小饰品', '实用的东西']], ['最想一起去的地方？', ['海边', '游乐园', '老家小镇']]] },
    { title: '🌈 今日心情问卷', qs: [['现在的心情是？', ['元气满满', '平平淡淡', '有点丧需要抱抱']], ['今天最开心的小事？', ['吃到了好吃的', '被人夸了', '收到你的消息']], ['需要我的抱抱吗？', ['要！立刻马上', '隔着屏幕抱', '不需要（嘴硬）']]] },
    { title: '🏠 未来畅想问卷', qs: [['以后想养什么宠物？', ['猫咪', '狗狗', '都要！']], ['理想的小家在哪里？', ['市区小公寓', '郊外带院子', '海边小屋']], ['周末最想一起做什么？', ['睡到自然醒', '一起做饭', '出门野餐']]] },
    { title: '🍜 味觉大调查', qs: [['你是甜党还是咸党？', ['甜党', '咸党', '全都要']], ['最爱的家常菜？', ['番茄炒蛋', '红烧肉', '妈妈牌一切']], ['能吃辣吗？', ['无辣不欢', '微辣即可', '一点都不能吃']]] },
    { title: '🌙 作息观察报告', qs: [['平时几点睡？', ['23点前', '0点左右', '凌晨修仙']], ['起床困难吗？', ['秒起', '挣扎5分钟', '闹钟8连击']], ['周末一般干嘛？', ['补觉', '出门玩', '宅家充电']]] }
];
const PG_QUESTIONS = ['你今天有没有想我呀？说实话哦', '如果用一种颜色形容我，你觉得是什么颜色？', '你觉得我什么时候最好看？', '如果我生病了你第一反应是什么？', '下辈子还想遇见我吗？', '你手机里给我的备注是什么？', '你觉得我像什么小动物？为什么？', '说一个你偷偷喜欢我的瞬间'];
const PG_COMPLAINTS = ['哼，你今天都没怎么理我，罚你抱我十分钟！', '说好一起看的剧，你是不是自己偷偷往前看了？老实交代！', '你回消息的速度像树懒，我等成雕像了你知道吗！', '今天心情不好，都怪你太可爱害我走神！', '刚刚梦到你不要我了，气死，快哄！', '别人都有对象陪吃饭，虽然我也有，但你长得太好吃了…不是，太好看'];
const PG_INVITES = [['一起看场电影吧', ' popcorn 已备好，就差你了'], ['晚饭后散散步？', '听说晚风和你都很温柔'], ['来双排打游戏！', '我保护你，你负责躺赢'], ['视频通话好不好？', '想看看你的脸'], ['一起做顿饭吧', '你洗菜我掌勺，翻车了也算美味'], ['深夜电台开播', '今晚我讲故事哄你睡']];
const PG_FREQ_MIN = { off: 0, low: [20, 40], medium: [10, 25], high: [4, 10] };
let pgProactiveTimer = null;
window.pgStartProactive = function () {
    if (pgProactiveTimer) return;
    const loop = () => {
        const currentFrequency = (pgData && pgData.settings && pgData.settings.proactive) || 'medium';
        let range = currentFrequency === 'custom'
            ? (typeof getSiteFrequencyRange === 'function' ? getSiteFrequencyRange('proactiveMin', 'proactiveMax', 10, 25) : [Number(pgData.settings.proactiveCustomMin) || 10, Number(pgData.settings.proactiveCustomMax) || 25])
            : PG_FREQ_MIN[currentFrequency];
        let next = 12 * 60000;
        if (range) next = (range[0] + Math.random() * (range[1] - range[0])) * 60000;
        pgProactiveTimer = setTimeout(async () => {
            pgProactiveTimer = null;
            try {
                await pgLoadData();
                if (!pgData.jail.active) pgProactiveTick();
            } catch (e) {}
            loop();
        }, next);
    };
    loop();
};
function pgProactiveTick() {
    const s = pgData.settings;
    const opts = [];
    if (s.enableSurvey) opts.push('survey');
    if (s.enableQuestion) opts.push('question');
    if (s.enableComplaint) opts.push('complaint');
    if (s.enableInvite) opts.push('invite');
    if (!opts.length) return;
    const type = opts[Math.floor(Math.random() * opts.length)];
    if (type === 'complaint') {
        pgChat('partner', PG_COMPLAINTS[Math.floor(Math.random() * PG_COMPLAINTS.length)]);
        pgSound('partner_message');
        pgNotify(`${pgPartnerName()} 朝你发起了吐槽 😤`, 'info', 3500);
        return;
    }
    // 弹出气泡，点击进入互动
    pgProactivePopup(type);
}
function pgProactivePopup(type) {
    const old = document.getElementById('pg-proactive-popup');
    if (old) old.remove();
    const meta = { survey: ['📋', `${pgPartnerName()} 给你发来一份调查问卷`, '快去看看 Ta 想知道什么～'], question: ['❓', `${pgPartnerName()} 有个小问题想问你`, '据说答好有奖励'], invite: ['💌', `${pgPartnerName()} 向你发来一个邀请`, '不要让人家等太久哦'] }[type];
    const popup = document.createElement('div');
    popup.id = 'pg-proactive-popup';
    popup.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:20px;padding:16px 18px;z-index:8500;max-width:320px;width:88%;box-shadow:0 8px 32px rgba(0,0,0,0.18);animation:pgSlideUpNotif 0.4s cubic-bezier(0.22,1,0.36,1);';
    popup.innerHTML = `
        <style>@keyframes pgSlideUpNotif{from{opacity:0;transform:translateX(-50%) translateY(24px) scale(0.9)}60%{transform:translateX(-50%) translateY(-4px) scale(1.02)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}</style>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <span style="font-size:24px;">${meta[0]}</span>
            <div><div style="font-size:13px;font-weight:700;color:var(--text-primary);">${pgEscape(meta[1])}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${pgEscape(meta[2])}</div></div>
        </div>
        <div style="display:flex;gap:8px;">
            <button onclick="this.closest('#pg-proactive-popup').remove();" style="flex:1;padding:8px 0;border-radius:12px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);font-size:13px;cursor:pointer;">稍后</button>
            <button onclick="this.closest('#pg-proactive-popup').remove();pgOpenProactive('${type}');" style="flex:2;padding:8px 0;border-radius:12px;border:none;background:var(--accent-color);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">去互动 💗</button>
        </div>`;
    document.body.appendChild(popup);
    setTimeout(() => { if (popup.parentNode) popup.remove(); }, 15000);
}
window.pgOpenProactive = async function (type) {
    await pgLoadData();
    pgOpenModal();
    if (type === 'survey') pgViewSurvey();
    else if (type === 'question') pgViewQuestion();
    else if (type === 'invite') pgViewInvite();
};
function pgViewSurvey() {
    const t = PG_SURVEYS[Math.floor(Math.random() * PG_SURVEYS.length)];
    pgSetBody(pgHeader('📋 调查问卷', `来自 ${pgEscape(pgPartnerName())} 的认真提问`) + `
        ${pgCard(t.title, t.qs.map(([q, opts], qi) => `
            <div style="margin-bottom:12px;">
                <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:6px;">Q${qi + 1}. ${pgEscape(q)}</div>
                ${opts.map((o, oi) => `
                    <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; margin-bottom:4px; border:1px solid var(--border-color); border-radius:10px; font-size:12px; color:var(--text-primary); cursor:pointer;">
                        <input type="radio" name="pg-sv-${qi}" value="${pgEscape(o)}" ${oi === 0 ? 'checked' : ''}> ${pgEscape(o)}
                    </label>`).join('')}
            </div>`).join(''))}
        <div style="text-align:center;">${pgBtn('📨 提交问卷', 'pgSubmitSurvey()')}</div>
    `);
    window.__pgCurSurvey = t;
}
window.pgSubmitSurvey = async function () {
    const t = window.__pgCurSurvey;
    if (!t) return;
    const answers = t.qs.map(([q], qi) => {
        const sel = document.querySelector(`input[name="pg-sv-${qi}"]:checked`);
        return `${q} → ${sel ? sel.value : '未答'}`;
    });
    await pgLoadData();
    pgData.surveys.unshift({ title: t.title, answers, time: new Date().toISOString() });
    if (pgData.surveys.length > 20) pgData.surveys.length = 20;
    pgData.proactiveLog.unshift({ t: new Date().toISOString(), text: `填写了问卷「${t.title}」` });
    pgSave();
    pgChat('user', `【问卷提交】📋 ${t.title}\n${answers.join('\n')}`);
    pgChat('partner', ['收到的！全部记在小本本上了 📝', '嗯嗯，我都了解了，会记住的！', '调查完毕！你已经被我更彻底地拿捏了 😌'][Math.floor(Math.random() * 3)]);
    pgNotify('问卷已提交，对方认真记下啦', 'success');
    pgOpenHub();
};
function pgViewQuestion() {
    const q = PG_QUESTIONS[Math.floor(Math.random() * PG_QUESTIONS.length)];
    window.__pgCurQuestion = q;
    pgSetBody(pgHeader('❓ 小问题', `${pgEscape(pgPartnerName())} 好奇地问你`) + `
        ${pgCard('', `
            <div style="font-size:15px; font-weight:700; color:var(--text-primary); text-align:center; padding:8px 0 14px;">「${pgEscape(q)}」</div>
            ${pgTextarea('pg-q-ans', '认真回答（会发送到聊天）…', '', 3)}
            <div style="text-align:center;">${pgBtn('💬 回答', 'pgAnswerQuestion()')}</div>
        `)}`);
}
window.pgAnswerQuestion = async function () {
    const ans = document.getElementById('pg-q-ans').value.trim();
    if (!ans) { pgNotify('先写点什么吧', 'warning'); return; }
    await pgLoadData();
    pgData.proactiveLog.unshift({ t: new Date().toISOString(), text: `回答了小问题「${window.__pgCurQuestion}」` });
    pgSave();
    pgChat('user', ans);
    pgChat('partner', ['（认真听完）嗯，记住了，一辈子那种。', '这个答案我给满分 💯', '嘿嘿，我猜也是这样～', '（悄悄截图收藏）'][Math.floor(Math.random() * 4)]);
    pgSound('send');
    pgOpenHub();
};
function pgViewInvite() {
    const [title, desc] = PG_INVITES[Math.floor(Math.random() * PG_INVITES.length)];
    window.__pgCurInvite = title;
    pgSetBody(pgHeader('💌 邀请', `来自 ${pgEscape(pgPartnerName())}`) + `
        ${pgCard('', `
            <div style="text-align:center; padding:8px 0;">
                <div style="font-size:40px;">💌</div>
                <div style="font-size:16px; font-weight:800; color:var(--text-primary); margin-top:8px;">${pgEscape(title)}</div>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${pgEscape(desc)}</div>
                <div style="display:flex; gap:10px; justify-content:center; margin-top:16px;">
                    ${pgBtn('💗 接受', "pgAnswerInvite(true)")}
                    ${pgBtn('🥺 改天吧', "pgAnswerInvite(false)", false)}
                </div>
            </div>
        `)}`);
}
window.pgAnswerInvite = async function (ok) {
    await pgLoadData();
    const title = window.__pgCurInvite || '邀请';
    pgData.inviteLog.unshift({ t: new Date().toISOString(), title, ok });
    pgData.proactiveLog.unshift({ t: new Date().toISOString(), text: `${ok ? '接受了' : '婉拒了'}邀请「${title}」` });
    pgSave();
    pgChat('user', ok ? `我接受你的邀请：${title}！` : `这次先改天吧，${title} 下回一定！`);
    pgChat('partner', ok ? ['太好啦！那我先去准备～', '耶！说到做到，不许放我鸽子！', '（偷偷开心）那说好了哦！'][Math.floor(Math.random() * 3)]
        : ['好吧…那你欠我一次，记在账上了！', '呜，那下次不许推辞了！', '行吧，宽限你～利息是一次抱抱'][Math.floor(Math.random() * 3)]);
    pgSound(ok ? 'send' : 'mood');
    pgOpenHub();
};

/* ==================== 启动 ==================== */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try { pgStartProactive(); } catch (e) {} }, 15000);
});
