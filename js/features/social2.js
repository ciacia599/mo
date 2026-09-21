/* ============================================================
 * social2.js — 第二波互动增强
 * 心情系统 / 撤回(双方) / 陪伴邀请(主动) / 商城&心愿单 /
 * 问答(对方反问) / 收藏(主动) / 通话记录(双向统计) /
 * 我们的家(增强) / 头像昵称专区
 * 依赖：extras.js (exData, exSave, exCoin, exNow, exEscape, exPartnerName, exMyName, exSetBody, exHeader, showModal, hideModal, showNotification, addMessage, renderMessages, FURNITURE_ITEMS, SHOP_ITEMS)
 * ============================================================ */
(function () {
    'use strict';

    /* ---------- 工具 ---------- */
    const $ = (id) => document.getElementById(id);
    const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pn = () => { try { return exPartnerName(); } catch (e) { return (typeof settings !== 'undefined' && settings.partnerName) || '对方'; } };
    const mn = () => { try { return exMyName(); } catch (e) { return (typeof settings !== 'undefined' && settings.myName) || '我'; } };
    const now = () => new Date().toISOString();
    const fmt = (iso) => { try { const d = new Date(iso); const p = x => String(x).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; } catch (e) { return iso; } };
    const save = () => { try { exSave(); } catch (e) { } };
    const notify = (t, k) => { try { showNotification(t, k || 'info'); } catch (e) { } };
    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

    /* ============================================================
     * 1. 心情系统
     * ============================================================ */
    const MOODS = [
        { key: 'happy', emoji: '😊', name: '开心', kw: ['哈哈', '开心', '高兴', '喜欢', '嘻嘻', '好呀', '太棒了', '想你', '嘿嘿', '好的'] },
        { key: 'love', emoji: '🥰', name: '心动', kw: ['爱你', '亲亲', '抱抱', '宝贝', '亲爱的', '心跳', '心动', '吻', '老婆', '老公'] },
        { key: 'shy', emoji: '😳', name: '害羞', kw: ['害羞', '脸红', '不好意思', '讨厌啦', '不要啦', '哎呀'] },
        { key: 'sad', emoji: '😢', name: '难过', kw: ['难过', '伤心', '哭', '不开心', '失落', '想哭', '委屈', '难受'] },
        { key: 'angry', emoji: '😠', name: '生气', kw: ['生气', '哼', '讨厌你', '烦', '不理你', '气死', '可恶'] },
        { key: 'sleepy', emoji: '😴', name: '困了', kw: ['困', '睡', '晚安', '累', '打哈欠', '休息', '熬夜'] },
        { key: 'hungry', emoji: '🤤', name: '饿了', kw: ['饿', '吃', '饭', '馋', '零食', '美食'] },
        { key: 'calm', emoji: '😌', name: '平静', kw: ['嗯', '好', '可以', '行', '哦'] }
    ];
    const moodInit = () => { if (!exData.partnerMood) exData.partnerMood = { key: 'happy', emoji: '😊', name: '开心', since: now() }; };
    const setMood = (m) => { moodInit(); exData.partnerMood = { key: m.key, emoji: m.emoji, name: m.name, since: now() }; save(); };
    const getMood = () => { moodInit(); return exData.partnerMood; };

    function detectMood(text) {
        if (!text) return MOODS[0];
        for (const m of MOODS) { if (m.kw.length && m.kw.some(k => text.includes(k))) return m; }
        const pool = [MOODS[0], MOODS[0], MOODS[1], MOODS[7]];
        return pool[Math.floor(Math.random() * pool.length)];
    }
    window.s2DetectMood = detectMood;
    window.s2GetMood = getMood;

    // 钩住 addMessage：对方消息附心情
    function hookAddMessage() {
        if (typeof addMessage !== 'function' || addMessage.__s2Hooked) return;
        const orig = addMessage;
        const wrapped = function (msg) {
            if (msg && msg.sender === 'partner' && msg.text && msg.type !== 'system' && !msg.system) {
                const m = detectMood(msg.text);
                setMood(m);
                msg.mood = m.emoji;
                msg.moodName = m.name;
            }
            return orig.apply(this, arguments);
        };
        wrapped.__s2Hooked = true;
        window.addMessage = wrapped;
    }

    // 在对方消息气泡旁插入心情
    function moodWatch() {
        const c = (typeof DOMElements !== 'undefined' && DOMElements.chatContainer) || document.querySelector('.chat-container, #messages, [class*="chat"]');
        if (!c) { setTimeout(moodWatch, 1500); return; }
        const mark = () => {
            const msgs = (typeof messages !== 'undefined') ? messages : [];
            c.querySelectorAll('.message-wrapper.received').forEach(w => {
                if (w.dataset.moodInjected) return;
                const meta = w.querySelector('.message-meta');
                const cw = w.querySelector('.message-content-wrapper') || w;
                // 按消息 id 查找该条消息发送时的心情
                const mid = w.dataset.msgId || w.dataset.id;
                const mObj = mid ? msgs.find(x => String(x.id) === String(mid)) : null;
                const emoji = mObj && mObj.mood ? mObj.mood : getMood().emoji;
                const name = mObj && mObj.moodName ? mObj.moodName : getMood().name;
                const span = document.createElement('span');
                span.textContent = emoji;
                span.title = 'Ta 当时的心情：' + name;
                span.style.cssText = 'font-size:14px;margin-left:6px;vertical-align:middle;cursor:help;';
                if (meta) meta.appendChild(span); else cw.appendChild(span);
                w.dataset.moodInjected = '1';
            });
        };
        mark();
        try { new MutationObserver(mark).observe(c, { childList: true, subtree: true }); } catch (e) { }
    }

    /* ============================================================
     * 2. 撤回消息（双方都可撤回）
     * ============================================================ */
    // 对方随机撤回自己一条最近消息
    function partnerRecallOne() {
        if (typeof messages === 'undefined') return;
        const list = messages.filter(m => m.sender === 'partner' && !m.recalled && m.type !== 'system' && m.text);
        if (!list.length) return;
        const m = list[list.length - 1]; // 最近一条
        m.recalled = true;
        m.type = 'system';
        m.text = `${pn()} 撤回了一条消息`;
        if (typeof renderMessages === 'function') renderMessages(true);
        notify(`${pn()} 撤回了一条消息`, 'info');
    }
    window.s2PartnerRecall = partnerRecallOne;

    // 替换 exViewRecall：显示「我撤回 / Ta撤回」两个标签
    function s2ViewRecall() {
        const tab = s2ViewRecall._tab || 'me';
        const list = (typeof messages !== 'undefined' ? messages : []).filter(m => m.recalled);
        const mine = list.filter(m => m.sender === 'user');
        const ta = list.filter(m => m.sender === 'partner');
        const shown = tab === 'me' ? mine : ta;
        const html = `
        <div style="display:flex; gap:8px; margin-bottom:12px;">
            <button class="ex-quick-btn" style="flex:1;${tab === 'me' ? 'border-color:var(--accent-color);color:var(--accent-color);font-weight:600;' : ''}" onclick="window.s2ViewRecall('me')">我撤回的 (${mine.length})</button>
            <button class="ex-quick-btn" style="flex:1;${tab === 'ta' ? 'border-color:var(--accent-color);color:var(--accent-color);font-weight:600;' : ''}" onclick="window.s2ViewRecall('ta')">Ta 撤回的 (${ta.length})</button>
        </div>
        <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:12px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">让 ${esc(pn())} 也能撤回消息（模拟 Ta 主动撤回）</div>
            <button class="ex-primary-btn" style="width:100%;" onclick="window.s2PartnerRecall()">↩️ 让 Ta 撤回最近一条消息</button>
        </div>
        <div id="s2-recall-list"></div>`;
        try { exSetBody(exHeader('↩️ 撤回记录', '双方都可以撤回自己的消息') + html); } catch (e) { return; }
        const el = $('s2-recall-list');
        if (!el) return;
        if (!shown.length) {
            el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:12px;">暂无记录</div>`;
            return;
        }
        el.innerHTML = shown.map(m => `
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
                <div style="font-size:12px;color:var(--text-primary);">${esc(m.text)}</div>
                <div style="font-size:10px;color:var(--text-secondary);margin-top:4px;">${fmt(m.timestamp || m.time)}</div>
            </div>`).join('');
    }
    window.s2ViewRecall = function (t) { s2ViewRecall._tab = t || 'me'; s2ViewRecall(); };
    // 覆盖原入口
    if (typeof exViewRecall !== 'undefined') {
        window.exViewRecall = window.s2ViewRecall;
    }

    /* ============================================================
     * 3. 陪伴邀请（对方主动）
     * ============================================================ */
    // 复用 exPartnerInvite（已存在）。增加定时主动邀请
    function s2ScheduleInvite() {
        if (!exData.s2InviteEnabled) exData.s2InviteEnabled = true;
        if (exData.s2InviteEnabled && typeof exPartnerInvite === 'function') {
            const kinds = Object.keys(typeof EX_INVITE_SCENES !== 'undefined' ? EX_INVITE_SCENES : { work: { name: '工作' } });
            const k = rand(kinds);
            try { exPartnerInvite(k); } catch (e) { }
        }
    }
    window.s2ToggleInvite = (v) => { exData.s2InviteEnabled = !!v; save(); notify(v ? '对方会主动邀请你了' : '已关闭主动邀请'); };

    /* ============================================================
     * 4. 礼物商城 + 心愿单（对方可主动买 / 加入心愿单）
     * ============================================================ */
    function shopInit() {
        if (!Array.isArray(exData.wishlist)) exData.wishlist = [];
        if (!Array.isArray(exData.partnerBought)) exData.partnerBought = [];
    }
    function partnerBuyGift() {
        shopInit();
        const items = (typeof SHOP_ITEMS !== 'undefined') ? SHOP_ITEMS : [];
        if (!items.length) return;
        const it = rand(items);
        const rec = { id: 'pb_' + Date.now(), item: it, time: now(), from: 'partner' };
        exData.partnerBought.unshift(rec);
        if (exData.partnerBought.length > 100) exData.partnerBought.length = 100;
        save();
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now(), sender: 'partner', text: `🎁 我给你买了「${it.emoji} ${it.name}」，希望你喜欢～`, timestamp: new Date(), status: 'received', type: 'normal' });
        }
        notify(`${pn()} 送了你 ${it.emoji} ${it.name}`, 'success');
    }
    function partnerAddWishlist() {
        shopInit();
        const items = (typeof SHOP_ITEMS !== 'undefined') ? SHOP_ITEMS : [];
        if (!items.length) return;
        const it = rand(items);
        if (exData.wishlist.some(w => w.item.key === it.key)) return;
        exData.wishlist.unshift({ id: 'wl_' + Date.now(), item: it, time: now(), by: 'partner' });
        if (exData.wishlist.length > 50) exData.wishlist.length = 50;
        save();
        notify(`${pn()} 把 ${it.emoji} ${it.name} 加入了心愿单`, 'info');
    }
    window.s2PartnerBuyGift = partnerBuyGift;
    window.s2PartnerAddWishlist = partnerAddWishlist;
    window.s2TogglePartnerShop = (v) => { exData.s2ShopEnabled = !!v; save(); notify(v ? '对方会主动送礼物了' : '已关闭主动送礼'); };

    // 替换 exViewShop：增加心愿单 / Ta 送礼记录 / 模拟按钮
    function s2ViewShop() {
        shopInit();
        const tab = s2ViewShop._tab || 'shop';
        const items = (typeof SHOP_ITEMS !== 'undefined') ? SHOP_ITEMS : [];
        const wish = exData.wishlist;
        const bought = exData.partnerBought;
        let body = `
        <div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">
            <button class="ex-quick-btn" style="flex:1;min-width:70px;${tab === 'shop' ? 'border-color:var(--accent-color);color:var(--accent-color);font-weight:600;' : ''}" onclick="window.s2ViewShop('shop')">🛍 商城</button>
            <button class="ex-quick-btn" style="flex:1;min-width:70px;${tab === 'wish' ? 'border-color:var(--accent-color);color:var(--accent-color);font-weight:600;' : ''}" onclick="window.s2ViewShop('wish')">⭐ 心愿单 (${wish.length})</button>
            <button class="ex-quick-btn" style="flex:1;min-width:70px;${tab === 'got' ? 'border-color:var(--accent-color);color:var(--accent-color);font-weight:600;' : ''}" onclick="window.s2ViewShop('got')">🎁 收到的礼物 (${bought.length})</button>
        </div>`;
        if (tab === 'shop') {
            body += `
            <div style="background:var(--message-received-bg);border-radius:12px;padding:10px 12px;margin-bottom:12px;display:flex;gap:8px;align-items:center;justify-content:space-between;">
                <div style="font-size:12px;color:var(--text-secondary);">我 ${typeof exCoin === 'function' ? exCoin(exData.coins) : exData.coins} · Ta ${typeof exCoin === 'function' ? exCoin(exData.partnerCoins) : exData.partnerCoins}</div>
                <button class="ex-primary-btn" style="padding:6px 12px;font-size:12px;" onclick="window.s2PartnerBuyGift()">🎁 让 Ta 送我一件</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                ${items.map(it => `
                <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;text-align:center;">
                    <div style="font-size:36px;">${it.emoji}</div>
                    <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin:4px 0;">${esc(it.name)}</div>
                    <div style="font-size:12px;color:#FDCB6E;margin-bottom:8px;">💰 ${it.price}</div>
                    <div style="display:flex;gap:4px;">
                        <button class="ex-primary-btn" style="flex:1;padding:6px;font-size:11px;" onclick="window.s2BuyForPartner('${it.key}')">送 Ta</button>
                        <button class="ex-quick-btn" style="padding:6px 10px;font-size:11px;" onclick="window.s2AddWish('${it.key}')" title="加入心愿单">⭐</button>
                    </div>
                </div>`).join('')}
            </div>`;
        } else if (tab === 'wish') {
            body += `
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:10px 12px;margin-bottom:12px;display:flex;gap:8px;align-items:center;justify-content:space-between;">
                <div style="font-size:12px;color:var(--text-secondary);">心愿单里的东西，${esc(pn())} 也能看见并帮你实现～</div>
                <button class="ex-primary-btn" style="padding:6px 12px;font-size:12px;" onclick="window.s2PartnerAddWishlist()">✨ 让 Ta 加一件</button>
            </div>
            <div id="s2-wish-list"></div>`;
        } else {
            body += `<div id="s2-got-list"></div>`;
        }
        try { exSetBody(exHeader('🛍 礼物商城', `双向送礼 · 心愿单`) + body); } catch (e) { return; }
        if (tab === 'wish') {
            const el = $('s2-wish-list');
            if (!wish.length) el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:12px;">心愿单是空的，去商城加几件吧～</div>`;
            else el.innerHTML = wish.map(w => `
                <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
                    <div style="font-size:28px;">${w.item.emoji}</div>
                    <div style="flex:1;">
                        <div style="font-size:13px;color:var(--text-primary);font-weight:600;">${esc(w.item.name)}</div>
                        <div style="font-size:11px;color:var(--text-secondary);">💰 ${w.item.price} · ${w.by === 'partner' ? 'Ta 加的' : '我加的'} · ${fmt(w.time)}</div>
                    </div>
                    <button class="ex-danger-btn" style="padding:5px 8px;font-size:11px;" onclick="window.s2DelWish('${w.id}')">×</button>
                </div>`).join('');
        }
        if (tab === 'got') {
            const el = $('s2-got-list');
            if (!bought.length) el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:12px;">还没收到礼物～</div>`;
            else el.innerHTML = bought.map(b => `
                <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
                    <div style="font-size:28px;">${b.item.emoji}</div>
                    <div style="flex:1;">
                        <div style="font-size:13px;color:var(--text-primary);font-weight:600;">${esc(b.item.name)}</div>
                        <div style="font-size:11px;color:var(--text-secondary);">${esc(pn())} 送的 · ${fmt(b.time)}</div>
                    </div>
                </div>`).join('');
        }
    }
    window.s2ViewShop = function (t) { s2ViewShop._tab = t || 'shop'; s2ViewShop(); };
    window.s2BuyForPartner = (key) => {
        const it = (SHOP_ITEMS || []).find(x => x.key === key);
        if (!it) return;
        if (exData.coins < it.price) { notify('金币不足', 'warning'); return; }
        exData.coins -= it.price; save();
        if (typeof addMessage === 'function') addMessage({ id: Date.now(), sender: 'user', text: `【送礼】${it.emoji} ${it.name}`, timestamp: new Date(), status: 'sent', type: 'normal' });
        setTimeout(() => {
            if (typeof addMessage === 'function') addMessage({ id: Date.now() + 1, sender: 'partner', text: it.reply || '谢谢你，我很喜欢～', timestamp: new Date(), status: 'received', type: 'normal' });
        }, 1200);
        notify(`已送出 ${it.name}`, 'success');
    };
    window.s2AddWish = (key) => {
        shopInit();
        const it = (SHOP_ITEMS || []).find(x => x.key === key);
        if (!it) return;
        if (exData.wishlist.some(w => w.item.key === key)) { notify('已在心愿单', 'info'); return; }
        exData.wishlist.unshift({ id: 'wl_' + Date.now(), item: it, time: now(), by: 'me' });
        save(); notify('已加入心愿单', 'success');
    };
    window.s2DelWish = (id) => {
        exData.wishlist = exData.wishlist.filter(w => w.id !== id);
        save(); s2ViewShop();
    };
    if (typeof exViewShop !== 'undefined') window.exViewShop = window.s2ViewShop;

    /* ============================================================
     * 5. 问答（对方反问）
     * ============================================================ */
    const PARTNER_QUESTIONS = [
        '你今天最开心的事是什么呀？',
        '你最想去哪里旅行？',
        '你觉得我哪里最可爱？',
        '你有没有什么一直想做却没做的事？',
        '你最喜欢吃什么？',
        '你理想中的周末是什么样的？',
        '你最近在忙什么呀？',
        '如果只能留一样东西，你会留什么？',
        '你小时候的梦想是什么？',
        '你觉得我们之间最甜的瞬间是？'
    ];
    function partnerAskQuestion() {
        if (!Array.isArray(exData.qaHistory)) exData.qaHistory = [];
        const q = rand(PARTNER_QUESTIONS);
        const rec = { id: 'qa_' + Date.now(), question: q, mode: 'open', from: 'partner', answer: null, answered: false, time: now() };
        exData.qaHistory.unshift(rec);
        if (exData.qaHistory.length > 200) exData.qaHistory.length = 200;
        save();
        if (typeof addMessage === 'function') {
            addMessage({ id: Date.now(), sender: 'partner', text: `❓ 我有个问题想问你：\n${q}`, timestamp: new Date(), status: 'received', type: 'qa' });
        }
        notify(`${pn()} 问了你一个问题`, 'info');
    }
    window.s2PartnerAsk = partnerAskQuestion;
    window.s2AnswerPartnerQ = (id, ans) => {
        const r = exData.qaHistory.find(x => x.id === id);
        if (!r) return;
        r.answer = ans; r.answered = true; r.answerTime = now(); save();
        if (typeof addMessage === 'function') addMessage({ id: Date.now(), sender: 'user', text: `回答：${ans}`, timestamp: new Date(), status: 'sent', type: 'normal' });
        notify('已回答', 'success');
        s2ViewQa();
    };

    // 替换 exViewQa：增加「Ta 问我的」标签
    function s2ViewQa() {
        if (!Array.isArray(exData.qaHistory)) exData.qaHistory = [];
        const tab = s2ViewQa._tab || 'mine';
        const mine = exData.qaHistory.filter(r => r.from !== 'partner');
        const ta = exData.qaHistory.filter(r => r.from === 'partner');
        const shown = tab === 'mine' ? mine : ta;
        let body = `
        <div style="display:flex;gap:6px;margin-bottom:12px;">
            <button class="ex-quick-btn" style="flex:1;${tab === 'mine' ? 'border-color:var(--accent-color);color:var(--accent-color);font-weight:600;' : ''}" onclick="window.s2ViewQa('mine')">我问 Ta (${mine.length})</button>
            <button class="ex-quick-btn" style="flex:1;${tab === 'ta' ? 'border-color:var(--accent-color);color:var(--accent-color);font-weight:600;' : ''}" onclick="window.s2ViewQa('ta')">Ta 问我 (${ta.length})</button>
        </div>`;
        if (tab === 'mine') {
            body += `
            <div style="background:var(--message-sent-bg);border-radius:14px;padding:14px;margin-bottom:14px;">
                <textarea id="s2-qa-input" placeholder="想问 ${esc(pn())} 什么…" style="width:100%;min-height:64px;padding:10px 12px;border:1px solid var(--border-color);border-radius:10px;background:var(--primary-bg);color:var(--text-primary);font-size:13px;box-sizing:border-box;"></textarea>
                <button class="ex-primary-btn" style="width:100%;margin-top:8px;" onclick="window.s2AskTa()">提问</button>
            </div>`;
        } else {
            body += `<div style="background:var(--message-received-bg);border-radius:14px;padding:12px;margin-bottom:14px;text-align:center;">
                <button class="ex-primary-btn" style="padding:8px 16px;font-size:13px;" onclick="window.s2PartnerAsk()">❓ 让 Ta 现在问我一个</button>
            </div>`;
        }
        body += `<div id="s2-qa-list"></div>`;
        try { exSetBody(exHeader('❓ 你问我答', '双向提问') + body); } catch (e) { return; }
        const el = $('s2-qa-list');
        if (!el) return;
        if (!shown.length) { el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:12px;">暂无记录</div>`; return; }
        el.innerHTML = shown.map(r => {
            const isTa = r.from === 'partner';
            return `
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:10px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">${fmt(r.time)} · ${isTa ? 'Ta 问我' : '我问 Ta'}</div>
                <div style="font-size:13px;color:var(--text-primary);margin-bottom:6px;"><span style="color:var(--accent-color);">${isTa ? 'Ta：' : '问：'}</span>${esc(r.question)}</div>
                ${r.answered
                    ? `<div style="font-size:13px;color:var(--text-primary);"><span style="color:#6BCB77;">${isTa ? '我答：' : 'Ta 答：'}</span>${esc(r.answer)}</div>`
                    : (isTa
                        ? `<div style="margin-top:6px;"><input id="ans_${r.id}" placeholder="回答 Ta…" style="width:100%;padding:7px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:12px;box-sizing:border-box;"><button class="ex-primary-btn" style="width:100%;margin-top:6px;font-size:12px;padding:6px;" onclick="window.s2AnswerPartnerQ('${r.id}',document.getElementById('ans_${r.id}').value)">回答</button></div>`
                        : `<div style="font-size:12px;color:var(--text-secondary);font-style:italic;">⏳ 思考中…</div>`)}
            </div>`;
        }).join('');
    }
    window.s2ViewQa = function (t) { s2ViewQa._tab = t || 'mine'; s2ViewQa(); };
    window.s2AskTa = () => {
        const q = ($('s2-qa-input') || {}).value;
        if (!q || !q.trim()) { notify('请输入问题', 'warning'); return; }
        const rec = { id: 'qa_' + Date.now(), question: q.trim(), mode: 'open', from: 'me', answer: null, answered: false, time: now() };
        exData.qaHistory.unshift(rec); save();
        if (typeof addMessage === 'function') addMessage({ id: Date.now(), sender: 'user', text: `【提问】❓ ${q}`, timestamp: new Date(), status: 'sent', type: 'qa' });
        $('s2-qa-input').value = '';
        s2ViewQa();
        setTimeout(() => {
            const pool = ['嗯，让我想想…', '这个问题嘛，', '我觉得呀，', '怎么说呢，'];
            rec.answer = rand(pool) + rand(['我也不太确定，但我会认真想的。', '当然是因为喜欢你呀。', '你猜～', '答案很长，要不要见面说？', '你希望我怎么回答呢？']);
            rec.answered = true; rec.answerTime = now(); save();
            if (typeof addMessage === 'function') addMessage({ id: Date.now() + 1, sender: 'partner', text: `【回答】${rec.answer}`, timestamp: new Date(), status: 'received', type: 'normal' });
            s2ViewQa();
        }, 1500 + Math.random() * 2000);
    };
    if (typeof exViewQa !== 'undefined') window.exViewQa = window.s2ViewQa;

    /* ============================================================
     * 6. 通话记录（双向统计）
     * ============================================================ */
    function s2ViewCallRecords() {
        if (!Array.isArray(exData.callRecords)) exData.callRecords = [];
        const recs = exData.callRecords;
        const incoming = recs.filter(r => r.from === 'partner');
        const outgoing = recs.filter(r => r.from === 'me');
        const inSec = incoming.reduce((s, r) => s + (r.durationSec || 0), 0);
        const outSec = outgoing.reduce((s, r) => s + (r.durationSec || 0), 0);
        const fmtDur = (sec) => { if (sec < 60) return sec + '秒'; const m = Math.floor(sec / 60), s = sec % 60; if (m < 60) return m + '分' + s + '秒'; return Math.floor(m / 60) + '时' + (m % 60) + '分'; };
        const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;text-align:center;">
                <div style="font-size:12px;color:var(--text-secondary);">📞 Ta 打给我</div>
                <div style="font-size:22px;font-weight:700;color:#2ecc71;margin:4px 0;">${incoming.length}</div>
                <div style="font-size:11px;color:var(--text-secondary);">累计 ${fmtDur(inSec)}</div>
            </div>
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;text-align:center;">
                <div style="font-size:12px;color:var(--text-secondary);">📞 我打给 Ta</div>
                <div style="font-size:22px;font-weight:700;color:var(--accent-color);margin:4px 0;">${outgoing.length}</div>
                <div style="font-size:11px;color:var(--text-secondary);">累计 ${fmtDur(outSec)}</div>
            </div>
        </div>
        <div id="s2-call-list"></div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            <button class="ex-quick-btn" style="flex:1;" onclick="if(typeof exExportJson==='function')exExportJson('callRecords','通话记录')">📤 导出</button>
            <button class="ex-quick-btn" style="flex:1;color:#ff6b6b;" onclick="window.s2ClearCalls()">🗑 清空</button>
        </div>`;
        try { exSetBody(exHeader('📞 通话记录', `双向记录 · 共 ${recs.length} 通`) + body); } catch (e) { return; }
        const el = $('s2-call-list');
        if (!el) return;
        if (!recs.length) { el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:12px;">还没有通话记录～</div>`; return; }
        el.innerHTML = recs.slice(0, 100).map(r => {
            const icon = r.type === 'video' ? '📹' : '📞';
            const dir = r.from === 'partner' ? 'Ta → 我' : '我 → Ta';
            const colorMap = { connected: '#2ecc71', ended: '#3498db', missed: '#e74c3c', rejected: '#e67e22', canceled: '#95a5a6' };
            const resultText = { connected: '接通', ended: '已结束', missed: '未接', rejected: '拒接', canceled: '取消' }[r.result] || r.result;
            return `
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:13px;color:var(--text-primary);font-weight:600;">${icon} ${dir} · ${r.type === 'video' ? '视频' : '语音'}</div>
                        <div style="font-size:11px;color:var(--text-secondary);">${fmt(r.startedAt)} · ${fmtDur(r.durationSec || 0)}</div>
                    </div>
                    <div style="font-size:11px;color:${colorMap[r.result] || '#888'};">${resultText}</div>
                </div>
            </div>`;
        }).join('');
    }
    window.s2ViewCallRecords = s2ViewCallRecords;
    window.s2ClearCalls = () => { exData.callRecords = []; save(); s2ViewCallRecords(); notify('已清空', 'success'); };
    if (typeof exViewCallRecords !== 'undefined') window.exViewCallRecords = s2ViewCallRecords;

    /* ============================================================
     * 7. 我们的家（增强）
     * ============================================================ */
    const HOME_THEMES = [
        { key: 'warm', name: '暖色调', bg: 'linear-gradient(135deg,#fde68a,#fca5a5)' },
        { key: 'cool', name: '冷色调', bg: 'linear-gradient(135deg,#bfdbfe,#a5f3fc)' },
        { key: 'pink', name: '粉色甜梦', bg: 'linear-gradient(135deg,#fbcfe8,#f9a8d4)' },
        { key: 'night', name: '夜色', bg: 'linear-gradient(135deg,#312e81,#1e1b4b)' },
        { key: 'forest', name: '森林', bg: 'linear-gradient(135deg,#bbf7d0,#86efac)' }
    ];
    function homeInit() {
        if (!exData.home) exData.home = { grid: {}, cols: 6, rows: 4, lastEditor: '', lastTime: '' };
        if (!exData.home.cols) exData.home.cols = 6;
        if (!exData.home.rows) exData.home.rows = 4;
        if (!exData.home.grid) exData.home.grid = {};
        if (!exData.home.theme) exData.home.theme = 'warm';
        if (!Array.isArray(exData.home.log)) exData.home.log = [];
    }
    function s2ViewHome() {
        homeInit();
        const h = exData.home;
        const items = (typeof FURNITURE_ITEMS !== 'undefined') ? FURNITURE_ITEMS : [];
        const theme = HOME_THEMES.find(t => t.key === h.theme) || HOME_THEMES[0];
        const cells = [];
        for (let r = 0; r < h.rows; r++) for (let c = 0; c < h.cols; c++) cells.push({ r, c, key: r + '-' + c });
        let body = `
        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
            <span style="font-size:12px;color:var(--text-secondary);align-self:center;">房间：</span>
            <button class="ex-quick-btn" style="font-size:11px;padding:4px 8px;" onclick="window.s2HomeSize(4,3)">小 4×3</button>
            <button class="ex-quick-btn" style="font-size:11px;padding:4px 8px;" onclick="window.s2HomeSize(6,4)">中 6×4</button>
            <button class="ex-quick-btn" style="font-size:11px;padding:4px 8px;" onclick="window.s2HomeSize(8,5)">大 8×5</button>
            <span style="font-size:12px;color:var(--text-secondary);align-self:center;margin-left:6px;">主题：</span>
            ${HOME_THEMES.map(t => `<button class="ex-quick-btn" style="font-size:11px;padding:4px 8px;${h.theme === t.key ? 'border-color:var(--accent-color);' : ''}" onclick="window.s2HomeTheme('${t.key}')">${t.name}</button>`).join('')}
        </div>
        <div style="background:${theme.bg};border-radius:16px;padding:12px;margin-bottom:12px;">
            <div style="display:grid;grid-template-columns:repeat(${h.cols},1fr);gap:4px;">
                ${cells.map(cell => {
                    const f = h.grid[cell.key];
                    return `<div onclick="window.s2HomeCell('${cell.key}')" style="aspect-ratio:1;background:rgba(255,255,255,.35);border:1px dashed rgba(255,255,255,.6);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:${Math.max(16, 32 - h.cols)}px;cursor:pointer;">${f ? f.emoji : ''}</div>`;
                }).join('')}
            </div>
            <div style="font-size:11px;color:rgba(0,0,0,.55);text-align:center;margin-top:8px;">上次布置：${h.lastEditor || '—'} · ${h.lastTime ? fmt(h.lastTime) : ''}</div>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">🛋 家具库</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px;">
            ${items.map(it => `<button class="ex-quick-btn" style="padding:10px 4px;font-size:20px;" onclick="window.s2HomePick('${it.key}')" title="${esc(it.name)}">${it.emoji}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button class="ex-primary-btn" style="flex:1;" onclick="window.s2HomePartnerArrange()">🧚 让 Ta 来布置</button>
            <button class="ex-quick-btn" style="flex:1;color:#ff6b6b;" onclick="window.s2HomeClear()">🧹 清空</button>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">📝 布置日志</div>
        <div id="s2-home-log"></div>`;
        try { exSetBody(exHeader('🏠 我们的家', '一起布置小窝') + body); } catch (e) { return; }
        const el = $('s2-home-log');
        if (el) {
            const log = (h.log || []).slice(0, 10);
            el.innerHTML = log.length ? log.map(l => `<div style="font-size:11px;color:var(--text-secondary);padding:3px 0;">${esc(l.who)} ${esc(l.act)} · ${fmt(l.time)}</div>`).join('') : `<div style="font-size:11px;color:var(--text-secondary);">还没有记录</div>`;
        }
    }
    window.s2ViewHome = s2ViewHome;
    window.s2HomeSize = (cols, rows) => { homeInit(); exData.home.cols = cols; exData.home.rows = rows; save(); s2ViewHome(); };
    window.s2HomeTheme = (k) => { homeInit(); exData.home.theme = k; save(); s2ViewHome(); };
    window.s2HomePick = (key) => { s2ViewHome._pick = key; notify('选中家具，点格子放置', 'info'); };
    window.s2HomeCell = (key) => {
        homeInit(); const h = exData.home;
        const pick = s2ViewHome._pick;
        if (!pick) {
            if (h.grid[key]) { delete h.grid[key]; h.log.unshift({ who: mn(), act: '移除了一格家具', time: now() }); if (h.log.length > 50) h.log.length = 50; save(); s2ViewHome(); }
            return;
        }
        const it = (FURNITURE_ITEMS || []).find(x => x.key === pick);
        if (!it) return;
        h.grid[key] = { key: it.key, emoji: it.emoji, name: it.name };
        h.lastEditor = mn(); h.lastTime = now();
        h.log.unshift({ who: mn(), act: `放了 ${it.emoji} ${it.name}`, time: now() });
        if (h.log.length > 50) h.log.length = 50;
        save(); s2ViewHome();
    };
    window.s2HomeClear = () => { homeInit(); exData.home.grid = {}; exData.home.log.unshift({ who: mn(), act: '清空了房间', time: now() }); save(); s2ViewHome(); };
    window.s2HomePartnerArrange = () => {
        homeInit(); const h = exData.home; const items = FURNITURE_ITEMS || [];
        if (!items.length) return;
        const n = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
            const it = rand(items);
            const c = Math.floor(Math.random() * h.cols), r = Math.floor(Math.random() * h.rows);
            h.grid[r + '-' + c] = { key: it.key, emoji: it.emoji, name: it.name };
        }
        h.lastEditor = pn(); h.lastTime = now();
        h.log.unshift({ who: pn(), act: `布置了 ${n} 件家具`, time: now() });
        if (h.log.length > 50) h.log.length = 50;
        save(); s2ViewHome();
        notify(`${pn()} 帮你布置了小窝 ✨`, 'success');
    };
    if (typeof exViewHome !== 'undefined') window.exViewHome = s2ViewHome;

    /* ============================================================
     * 8. 头像 & 昵称专区
     * ============================================================ */
    const AVATAR_EMOJIS = ['😀', '😎', '🥰', '🤩', '😴', '🤔', '😇', '🥳', '🦊', '🐰', '🐱', '🐶', '🐼', '🐻', '🦁', '🐸', '🐵', '🐧', '🌸', '🌙', '⭐', '🍓', '🍀', '🔥', '💎', '🎀', '🦄', '🐙'];
    const NICKNAMES = ['梦角', '宝贝', '亲爱的', '老公', '老婆', '小可爱', '大笨蛋', '小心肝', '主人', '小猫咪', '兔兔', '熊熊', '星星', '月亮', '糖糖', '果果'];

    // 头像池 / 昵称候选池（我上传/设定，供 Ta 挑选）
    function poolInit() {
        if (!Array.isArray(exData.s2AvatarPool)) exData.s2AvatarPool = [];
        if (!Array.isArray(exData.s2NicknamePool)) exData.s2NicknamePool = [];
    }
    function idOpen() {
        poolInit();
        const curPAvatar = (typeof settings !== 'undefined') ? settings._s2PartnerAvatarEmoji || '😀' : '😀';
        const curMAvatar = (typeof settings !== 'undefined') ? settings._s2MyAvatarEmoji || '😀' : '😀';
        const avPool = exData.s2AvatarPool;
        const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;text-align:center;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">Ta 的头像</div>
                <div id="s2-pa-cur" style="font-size:48px;">${curPAvatar}</div>
            </div>
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;text-align:center;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">我的头像</div>
                <div id="s2-ma-cur" style="font-size:48px;">${curMAvatar}</div>
            </div>
        </div>

        <div style="background:var(--message-received-bg);border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">📤 添加头像（和添加表情包一样，传上去随时能用）</div>
            <input type="file" id="s2-av-upload" accept="image/*" multiple style="display:none;" onchange="window.s2UploadAvatar(event)">
            <div style="display:flex;gap:8px;align-items:center;">
                <button class="ex-primary-btn" style="flex:1;padding:8px;font-size:12px;" onclick="document.getElementById('s2-av-upload').click()">📷 上传图片（可多选）</button>
                <button class="ex-quick-btn" style="flex:1;padding:8px;font-size:12px;" onclick="window.s2PartnerPickFromPool()">🎨 让 Ta 从头像库挑</button>
            </div>
            ${avPool.length ? `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:10px;">
                ${avPool.map((a, i) => `<div style="position:relative;"><img src="${a}" style="width:100%;aspect-ratio:1;border-radius:8px;object-fit:cover;cursor:pointer;" onclick="window.s2SetAvatarImg('partner','${i}')" oncontextmenu="event.preventDefault();window.s2SetAvatarImg('me','${i}')" title="左键设为Ta的头像 · 右键设为我的"><button onclick="event.stopPropagation();window.s2DelAvPool(${i})" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#ff6b6b;color:#fff;border:none;font-size:11px;cursor:pointer;">×</button></div>`).join('')}
            </div>
            <div style="font-size:10px;color:var(--text-secondary);margin-top:6px;">点图片=设为Ta的头像 · 右键图片=设为我的头像</div>` : '<div style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:8px;">头像库还是空的，传几张进来吧（最多存 30 张）</div>'}
        </div>

        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">🎨 emoji 头像（左键→Ta / 右键→我）</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:14px;">
            ${AVATAR_EMOJIS.map(e => `<button class="ex-quick-btn" style="padding:8px;font-size:22px;" onclick="window.s2SetAvatar('partner','${e}')" oncontextmenu="event.preventDefault();window.s2SetAvatar('me','${e}')">${e}</button>`).join('')}
        </div>

        <div style="background:var(--message-received-bg);border-radius:12px;padding:12px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">让 Ta 来给我换头像</div>
            <div style="display:flex;gap:8px;">
                <button class="ex-primary-btn" style="flex:1;" onclick="window.s2PartnerPickAvatar()">🎨 Ta 帮我选头像</button>
                <button class="ex-quick-btn" style="flex:1;" onclick="idOpenNickname()">✏️ 去设置昵称 →</button>
            </div>
        </div>`;
        try {
            exSetBody(exHeader('🖼 头像', '上传·emoji·互相挑选') + body);
        } catch (e) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
            modal.innerHTML = `<div style="background:var(--primary-bg,#fff);border-radius:16px;padding:18px;width:100%;max-width:420px;max-height:90vh;overflow:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-size:16px;font-weight:700;">🖼 头像</div>
                    <button onclick="this.closest('.modal').remove()">✕</button>
                </div>${body}</div>`;
            document.body.appendChild(modal);
            modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        }
    }
    window.idOpen = idOpen;

    /* 昵称独立视图 */
    function idOpenNickname() {
        poolInit();
        const curPName = pn();
        const curMName = mn();
        const nkPool = exData.s2NicknamePool;
        const body = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;text-align:center;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">Ta 的昵称</div>
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);" id="s2-pn-cur">${esc(curPName)}</div>
            </div>
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;text-align:center;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">我的昵称</div>
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);" id="s2-mn-cur">${esc(curMName)}</div>
            </div>
        </div>

        <div style="background:var(--message-sent-bg);border-radius:12px;padding:12px;margin-bottom:14px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">✏️ 添加昵称候选（Ta 会从这里挑一个叫你）</div>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <input id="s2-nk-input" placeholder="输入一个昵称…" style="flex:1;padding:7px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--primary-bg);color:var(--text-primary);font-size:12px;" onkeydown="if(event.key==='Enter')window.s2AddNicknamePool()">
                <button class="ex-primary-btn" style="padding:7px 12px;font-size:12px;" onclick="window.s2AddNicknamePool()">添加</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${nkPool.length ? nkPool.map((n, i) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:var(--primary-bg);border-radius:6px;font-size:12px;">${esc(n)}<button onclick="window.s2DelNkPool(${i})" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:11px;">×</button></span>`).join('') : '<span style="font-size:11px;color:var(--text-secondary);">还没有候选昵称</span>'}
            </div>
            <div style="margin-top:8px;">
                <button class="ex-quick-btn" style="width:100%;padding:7px;font-size:12px;" onclick="window.s2PartnerPickNameFromPool()">🎲 让 Ta 从候选里选一个叫我</button>
            </div>
        </div>

        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">快捷昵称 <span style="font-size:10px;color:var(--text-secondary);">（点一下立即生效）</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
            ${NICKNAMES.map(n => `<button class="ex-quick-btn" style="font-size:12px;padding:6px 10px;" onclick="window.s2SetName('partner','${n}')">Ta：${esc(n)}</button>`).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
            ${NICKNAMES.map(n => `<button class="ex-quick-btn" style="font-size:12px;padding:6px 10px;" onclick="window.s2SetName('me','${n}')">我：${esc(n)}</button>`).join('')}
        </div>

        <div style="background:var(--message-received-bg);border-radius:12px;padding:12px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">让 Ta 来给我起昵称</div>
            <div style="display:flex;gap:8px;">
                <button class="ex-primary-btn" style="flex:1;" onclick="window.s2PartnerPickName()">✏️ Ta 帮我起昵称</button>
                <button class="ex-quick-btn" style="flex:1;" onclick="idOpen()">🖼 去设置头像 →</button>
            </div>
        </div>`;
        try {
            exSetBody(exHeader('✏️ 昵称', '候选·快捷·Ta来起名') + body);
        } catch (e) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
            modal.innerHTML = `<div style="background:var(--primary-bg,#fff);border-radius:16px;padding:18px;width:100%;max-width:420px;max-height:90vh;overflow:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-size:16px;font-weight:700;">✏️ 昵称</div>
                    <button onclick="this.closest('.modal').remove()">✕</button>
                </div>${body}</div>`;
            document.body.appendChild(modal);
            modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        }
    }
    window.idOpenNickname = idOpenNickname;

    function emojiAvatarDataURL(e) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#fde68a"/><text x="64" y="88" font-size="80" text-anchor="middle">${e}</text></svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }
    function setAvatarOn(who, emoji) {
        const isPartner = who === 'partner';
        const src = emojiAvatarDataURL(emoji);
        if (typeof settings !== 'undefined') {
            if (isPartner) settings._s2PartnerAvatarEmoji = emoji; else settings._s2MyAvatarEmoji = emoji;
        }
        try {
            const el = isPartner ? DOMElements.partner.avatar : DOMElements.me.avatar;
            if (el) el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } catch (e) { }
        try { localforage.setItem(getStorageKey(isPartner ? 'partnerAvatar' : 'myAvatar'), src); } catch (e) { }
        if (typeof saveData === 'function') saveData(); else if (typeof throttledSaveData === 'function') throttledSaveData();
    }
    function setAvatarImgOn(who, src) {
        const isPartner = who === 'partner';
        try {
            const el = isPartner ? DOMElements.partner.avatar : DOMElements.me.avatar;
            if (el) el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } catch (e) { }
        try { localforage.setItem(getStorageKey(isPartner ? 'partnerAvatar' : 'myAvatar'), src); } catch (e) { }
        if (typeof saveData === 'function') saveData(); else if (typeof throttledSaveData === 'function') throttledSaveData();
    }
    window.s2SetAvatar = (who, e) => { setAvatarOn(who, e); notify(`${who === 'partner' ? pn() : mn()} 的头像已更新`, 'success'); const cur = $(who === 'partner' ? 's2-pa-cur' : 's2-ma-cur'); if (cur) cur.innerHTML = `<img src="${emojiAvatarDataURL(e)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`; };
    window.s2SetAvatarImg = (who, idx) => {
        poolInit(); const src = exData.s2AvatarPool[idx]; if (!src) return;
        setAvatarImgOn(who, src);
        notify(`${who === 'partner' ? pn() : mn()} 的头像已更新`, 'success');
        const cur = $(who === 'partner' ? 's2-pa-cur' : 's2-ma-cur');
        if (cur) cur.innerHTML = `<img src="${src}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`;
    };
    window.s2UploadAvatar = (e) => {
        const files = Array.from(e.target.files || []); if (!files.length) return;
        let pending = files.length;
        files.slice(0, 10).forEach(f => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                poolInit();
                exData.s2AvatarPool.push(ev.target.result);
                while (exData.s2AvatarPool.length > 30) exData.s2AvatarPool.shift();
                if (--pending === 0) { save(); idOpen(); notify('图片已加入头像库', 'success'); }
            };
            reader.readAsDataURL(f);
        });
        e.target.value = '';
    };
    window.s2DelAvPool = (i) => { poolInit(); exData.s2AvatarPool.splice(i, 1); save(); idOpen(); };
    window.s2AddNicknamePool = () => {
        const el = $('s2-nk-input'); const v = (el?.value || '').trim();
        if (!v) return;
        poolInit(); if (!exData.s2NicknamePool.includes(v)) exData.s2NicknamePool.push(v);
        save(); idOpen();
    };
    window.s2DelNkPool = (i) => { poolInit(); exData.s2NicknamePool.splice(i, 1); save(); idOpen(); };
    window.s2PartnerPickFromPool = () => {
        poolInit();
        if (!exData.s2AvatarPool.length) { notify('候选池是空的，先上传几张图片吧', 'warning'); return; }
        const src = rand(exData.s2AvatarPool);
        setAvatarImgOn('partner', src);
        const cur = $('s2-pa-cur');
        if (cur) cur.innerHTML = `<img src="${src}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`;
        notify(`${pn()} 从你上传的图里挑了一张当头像`, 'success');
    };
    window.s2PartnerPickNameFromPool = () => {
        poolInit();
        if (!exData.s2NicknamePool.length) { notify('候选池是空的，先添加几个昵称吧', 'warning'); return; }
        const n = rand(exData.s2NicknamePool);
        if (typeof settings !== 'undefined') {
            settings.myName = n;
            try { DOMElements.me.name.textContent = n; } catch (e) { }
            if (typeof saveData === 'function') saveData(); else if (typeof throttledSaveData === 'function') throttledSaveData();
        }
        const cur = $('s2-mn-cur'); if (cur) cur.textContent = n;
        notify(`${pn()} 决定叫你「${n}」`, 'success');
    };
    window.s2SetName = (who, name) => {
        if (typeof settings === 'undefined') return;
        if (who === 'partner') {
            settings.partnerName = name;
            try { DOMElements.partner.name.textContent = name; } catch (e) { }
        } else {
            settings.myName = name;
            try { DOMElements.me.name.textContent = name; } catch (e) { }
        }
        if (typeof saveData === 'function') saveData(); else if (typeof throttledSaveData === 'function') throttledSaveData();
        notify(`${who === 'partner' ? 'Ta' : '我'} 的昵称改为「${name}」`, 'success');
        const cur = $(who === 'partner' ? 's2-pn-cur' : 's2-mn-cur'); if (cur) cur.textContent = name;
    };
    window.s2PartnerPickAvatar = () => {
        const e = rand(AVATAR_EMOJIS);
        setAvatarOn('me', e);
        const cur = $('s2-ma-cur'); if (cur) cur.innerHTML = `<img src="${emojiAvatarDataURL(e)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`;
        notify(`${pn()} 给你选了头像 ${e}`, 'success');
    };
    window.s2PartnerPickName = () => {
        const n = rand(NICKNAMES);
        if (typeof settings !== 'undefined') {
            settings.myName = n;
            try { DOMElements.me.name.textContent = n; } catch (e) { }
            if (typeof saveData === 'function') saveData(); else if (typeof throttledSaveData === 'function') throttledSaveData();
        }
        const cur = $('s2-mn-cur'); if (cur) cur.textContent = n;
        notify(`${pn()} 叫你「${n}」`, 'success');
    };

    /* ============================================================
     * 9. 调查问卷（对方主动发，我来答）
     * ============================================================ */
    const SURVEY_BANK = [
        { title: '关于我们的小调查', questions: [
            { q: '你觉得我们之间最甜蜜的瞬间是？', type: 'text' },
            { q: '你最喜欢我身上哪个特质？', type: 'text' },
            { q: '如果一起去旅行，你最想去哪里？', type: 'text' },
            { q: '你希望我多做些什么？', type: 'text' }
        ]},
        { title: '心情小问卷', questions: [
            { q: '今天的心情怎么样？', type: 'choice', opts: ['😊 很开心', '😌 平静', '😴 有点累', '🥺 有点低落'] },
            { q: '今天有没有想我？', type: 'choice', opts: ['一直都在想', '想到好几次', '偶尔想到', '太忙没想'] },
            { q: '现在最想做的事？', type: 'text' }
        ]},
        { title: '恋爱默契度测试', questions: [
            { q: '我最喜欢的食物是？', type: 'text' },
            { q: '我最讨厌别人对我做什么？', type: 'text' },
            { q: '我最近一次开心是因为什么？', type: 'text' },
            { q: '如果用一个词形容我，你会选？', type: 'text' }
        ]}
    ];
    function surveyInit() {
        if (!Array.isArray(exData.s2Surveys)) exData.s2Surveys = [];
        if (!Array.isArray(exData.s2CustomQuestions)) exData.s2CustomQuestions = [];
    }
    // 获取可用题目池：内置 + 我自定义的
    function surveyQuestionPool() {
        surveyInit();
        const builtin = [];
        SURVEY_BANK.forEach(t => t.questions.forEach(q => builtin.push(q)));
        const custom = exData.s2CustomQuestions.map(q => ({ q, type: 'text' }));
        return builtin.concat(custom);
    }
    window.s2OpenSurvey = () => {
        surveyInit();
        const list = exData.s2Surveys.slice().reverse();
        const cq = exData.s2CustomQuestions;
        const body = `
        <div style="background:var(--message-received-bg);border-radius:12px;padding:12px;margin-bottom:12px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${pn()} 会偶尔给你发小问卷，你也可以自己出题让 Ta 随机问你</div>
            <button class="ex-primary-btn" style="width:100%;" onclick="window.s2SendSurvey()">📋 模拟 ${pn()} 发一份问卷</button>
        </div>
        <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">✏️ 我来出题（Ta 会随机从这里挑问题问你）</div>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <input id="s2-cq-input" placeholder="输入一个你想被问到的问题…" style="flex:1;padding:7px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:12px;" onkeydown="if(event.key==='Enter')window.s2AddCustomQuestion()">
                <button class="ex-primary-btn" style="padding:7px 12px;font-size:12px;" onclick="window.s2AddCustomQuestion()">添加</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${cq.length ? cq.map((q, i) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:var(--secondary-bg);border-radius:6px;font-size:11px;max-width:100%;">${esc(q)}<button onclick="window.s2DelCustomQuestion(${i})" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:11px;">×</button></span>`).join('') : '<span style="font-size:11px;color:var(--text-secondary);">还没有自定义题目，Ta 会用内置题库</span>'}
            </div>
        </div>
        <div id="s2-survey-list"></div>`;
        try { exSetBody(exHeader('📋 调查问卷', 'Ta 问你答，记录心意') + body); } catch (e) { return; }
        const el = $('s2-survey-list');
        if (!el) return;
        if (!list.length) { el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:12px;">还没有收到问卷</div>'; return; }
        el.innerHTML = list.map(s => `
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:10px;">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">${esc(s.title)}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">${fmt(s.time)} · ${s.answered ? '✅ 已作答' : '⏳ 待回答'}</div>
                ${s.answered ? s.questions.map((q, i) => `
                    <div style="font-size:12px;margin-bottom:6px;">
                        <div style="color:var(--text-primary);font-weight:600;">${i + 1}. ${esc(q.q)}</div>
                        <div style="color:var(--text-secondary);padding:4px 0 0 10px;">${esc(q.a || '（未填写）')}</div>
                    </div>`).join('') : `<button class="ex-quick-btn" style="width:100%;" onclick="window.s2AnswerSurvey('${s.id}')">✏️ 开始作答</button>`}
            </div>`).join('');
    };
    window.s2AddCustomQuestion = () => {
        const el = $('s2-cq-input'); const v = (el?.value || '').trim();
        if (!v) return;
        surveyInit();
        if (!exData.s2CustomQuestions.includes(v)) exData.s2CustomQuestions.push(v);
        save(); s2OpenSurvey();
    };
    window.s2DelCustomQuestion = (i) => {
        surveyInit(); exData.s2CustomQuestions.splice(i, 1); save(); s2OpenSurvey();
    };
    window.s2SendSurvey = () => {
        surveyInit();
        const pool = surveyQuestionPool();
        // 随机抽 3-5 题，自定义题优先混入
        const count = Math.min(pool.length, 3 + Math.floor(Math.random() * 3));
        const shuffled = pool.slice().sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, count);
        const tpl = rand(SURVEY_BANK);
        const s = {
            id: 'sv_' + Date.now(),
            title: tpl.title,
            time: now(),
            answered: false,
            questions: picked.map(q => ({ q: q.q, type: q.type, opts: q.opts || [], a: '' }))
        };
        exData.s2Surveys.push(s);
        save();
        if (typeof addMessage === 'function') {
            addMessage({ id: 'msg_' + Date.now(), sender: 'partner', text: `📋 我刚写了一份问卷想问问你，有空帮我填一下嘛～\n「${s.title}」`, timestamp: new Date(), status: 'received', type: 'normal' });
        }
        notify(`${pn()} 给你发了一份问卷`, 'success');
        s2OpenSurvey();
    };
    window.s2AnswerSurvey = (id) => {
        surveyInit();
        const s = exData.s2Surveys.find(x => x.id === id);
        if (!s) return;
        const body = `
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:12px;">📋 ${esc(s.title)}</div>
        ${s.questions.map((q, i) => `
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:10px;padding:10px;margin-bottom:10px;">
                <div style="font-size:13px;color:var(--text-primary);font-weight:600;margin-bottom:8px;">${i + 1}. ${esc(q.q)}</div>
                ${q.type === 'choice' ? `<div style="display:flex;flex-direction:column;gap:6px;">
                    ${q.opts.map(o => `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--secondary-bg);border-radius:8px;cursor:pointer;font-size:12px;"><input type="radio" name="sv-q-${i}" value="${esc(o)}" onchange="window._svAns[${i}]=this.value">${esc(o)}</label>`).join('')}
                </div>` : `<textarea id="sv-q-${i}" rows="2" placeholder="写下你的回答…" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:12px;resize:vertical;"></textarea>`}
            </div>`).join('')}
        <button class="ex-primary-btn" style="width:100%;" onclick="window.s2SubmitSurvey('${id}')">💌 提交答案</button>`;
        try { exSetBody(exHeader('📝 作答问卷', '认真填哦，Ta 会看到') + body); } catch (e) { return; }
        window._svAns = {};
    };
    window.s2SubmitSurvey = (id) => {
        surveyInit();
        const s = exData.s2Surveys.find(x => x.id === id);
        if (!s) return;
        s.questions.forEach((q, i) => {
            if (q.type === 'choice') q.a = window._svAns[i] || '';
            else { const el = $('sv-q-' + i); q.a = el ? el.value.trim() : ''; }
        });
        s.answered = true;
        save();
        notify(`答案已提交给 ${pn()}`, 'success');
        if (typeof addMessage === 'function') {
            addMessage({ id: 'msg_' + Date.now(), sender: 'partner', text: '收到你的回答啦～我会好好珍藏的 ❤️', timestamp: new Date(), status: 'received', type: 'normal' });
        }
        s2OpenSurvey();
    };

    /* ============================================================
     * 10. 对方主动引擎（统一调度）
     * ============================================================ */
    function s2ProactiveTick() {
        const r = Math.random();
        // 30% 触发一次随机主动行为
        if (r < 0.3) {
            const actions = [];
            if (exData.s2InviteEnabled !== false) actions.push('invite');
            if (exData.s2ShopEnabled !== false) { actions.push('buy'); actions.push('wish'); }
            actions.push('ask'); actions.push('fav'); actions.push('recall'); actions.push('mood'); actions.push('survey');
            const a = rand(actions);
            if (a === 'invite') s2ScheduleInvite();
            else if (a === 'buy') partnerBuyGift();
            else if (a === 'wish') partnerAddWishlist();
            else if (a === 'ask') partnerAskQuestion();
            else if (a === 'fav') { try { if (typeof exPartnerFavNow === 'function') exPartnerFavNow(true); } catch (e) { } }
            else if (a === 'recall') partnerRecallOne();
            else if (a === 'mood') { const m = rand(MOODS); setMood(m); }
            else if (a === 'survey') { window.s2SendSurvey(); }
        }
    }
    let s2ProTimer = null;
    function startProactive() {
        if (s2ProTimer) return;
        s2ProTimer = setInterval(s2ProactiveTick, 60000); // 每分钟一次机会
    }

    /* ============================================================
     * 启动
     * ============================================================ */
    function init() {
        if (typeof exData === 'undefined') { setTimeout(init, 500); return; }
        moodInit();
        homeInit();
        shopInit();
        if (!Array.isArray(exData.qaHistory)) exData.qaHistory = [];
        hookAddMessage();
        moodWatch();
        startProactive();
        // 暴露到 window 供工具栏调用
        window.s2OpenRecall = () => { if (typeof exViewRecall === 'function') exViewRecall(); else s2ViewRecall(); };
        window.s2OpenShop = () => { if (typeof exViewShop === 'function') exViewShop(); else s2ViewShop(); };
        window.s2OpenQa = () => { if (typeof exViewQa === 'function') exViewQa(); else s2ViewQa(); };
        window.s2OpenCalls = () => { if (typeof exViewCallRecords === 'function') exViewCallRecords(); else s2ViewCallRecords(); };
        window.s2OpenHome = () => { if (typeof exViewHome === 'function') exViewHome(); else s2ViewHome(); };
        window.s2OpenInvite = () => { try { exViewInvitations(); } catch (e) { } };
        window.s2OpenFavs = () => { try { exViewPartnerFavs(); } catch (e) { } };
        window.s2OpenSurvey = s2OpenSurvey;
        window.s2ShowMood = () => {
            const m = getMood();
            const rows = MOODS.map(mo => `<div onclick="window.s2SetMoodByKey('${mo.key}')" style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:${m.key===mo.key?'var(--accent-color)':'var(--secondary-bg)'};color:${m.key===mo.key?'#fff':'var(--text-primary)'};border-radius:8px;cursor:pointer;font-size:13px;"><span style="font-size:20px;">${mo.emoji}</span><span>${mo.name}</span></div>`).join('');
            const body = `
            <div style="background:var(--message-received-bg);border-radius:14px;padding:16px;text-align:center;margin-bottom:12px;">
                <div style="font-size:56px;">${m.emoji}</div>
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-top:6px;">${esc(pn())} 当前心情：${m.name}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">持续自 ${fmt(m.since)}</div>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">点一下手动设置 Ta 的心情</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">${rows}</div>`;
            try { exSetBody(exHeader('😊 心情', 'Ta 的喜怒哀乐') + body); } catch (e) { }
        };
        window.s2SetMoodByKey = (k) => { const mo = MOODS.find(x => x.key === k); if (mo) { setMood(mo); notify(`${pn()} 的心情：${mo.name}`, 'info'); if (typeof s2ShowMood === 'function') s2ShowMood(); } };
        console.log('[social2] 互动增强已加载');
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
