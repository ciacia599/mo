/**
 * life.js — 互动小屋 · 生活篇
 * 包含：饲养宠物互动（喂食/玩耍/洗澡/睡觉/升级）+ 花园种植小游戏（买种/浇水/收获）
 * 依赖：playground.js 的 pgLoadData 风格自包含存储；金币复用 extras / pg 金币
 * 暴露：pgOpenPet / pgOpenGarden
 */

/* ==================== 数据层 ==================== */
let lfData = {
    pet: null,   // {species,name,level,exp,hunger,mood,clean,energy,lastTick,bornAt}
    garden: { plots: [null, null, null, null, null, null] }, // {seed, plantedAt, waters}
    gardenLog: [],
    flowers: [],      // 花瓶 {seedId, count}
    flowerGifts: [],  // 互赠记录 {dir:'me2ta'|'ta2me', icon, name, time}
    notes: []         // 灵感笔记 {id, text, time}
};
let lfLoaded = false;

async function lfLoadData() {
    if (lfLoaded) return;
    try {
        const saved = await localforage.getItem(getStorageKey('lifeData'));
        if (saved && typeof saved === 'object') lfData = Object.assign({}, lfData, saved);
    } catch (e) {
        try {
            const raw = localStorage.getItem('lfFallback_lifeData');
            if (raw) lfData = Object.assign({}, lfData, JSON.parse(raw));
        } catch (e2) {}
    }
    lfLoaded = true;
}
function lfSave() {
    try { localforage.setItem(getStorageKey('lifeData'), lfData); }
    catch (e) { try { localStorage.setItem('lfFallback_lifeData', JSON.stringify(lfData)); } catch (e2) {} }
}

/* ==================== 模态框 ==================== */
function lfEnsureModal() {
    if (document.getElementById('pg-life-modal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'pg-life-modal';
    modal.style.zIndex = '9100';
    modal.innerHTML = `<div class="modal-content" style="max-width:480px; padding:16px; max-height:82vh; overflow-y:auto;">
        <div id="pg-life-body"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) lfClose(); });
}
function lfOpenModal() { lfEnsureModal(); showModal(document.getElementById('pg-life-modal')); }
function lfClose() { hideModal(document.getElementById('pg-life-modal')); }
function lfTabs(cur) {
    return `<div style="display:flex; align-items:center; gap:6px; margin-bottom:14px;">
        <button onclick="pgOpenPet()" style="flex:1; padding:9px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid ${cur === 'pet' ? 'var(--accent-color)' : 'var(--border-color)'}; background:var(--primary-bg); color:var(--text-primary);">🐾 宠物</button>
        <button onclick="pgOpenGarden()" style="flex:1; padding:9px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid ${cur === 'garden' ? 'var(--accent-color)' : 'var(--border-color)'}; background:var(--primary-bg); color:var(--text-primary);">🌱 花园</button>
        <button onclick="pgOpenNotes()" style="flex:1; padding:9px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:1.5px solid ${cur === 'notes' ? 'var(--accent-color)' : 'var(--border-color)'}; background:var(--primary-bg); color:var(--text-primary);">💡 灵感</button>
        <button onclick="lfClose()" style="width:30px; height:30px; border-radius:50%; border:1px solid var(--border-color); background:var(--primary-bg); color:var(--text-secondary); cursor:pointer; font-size:16px;">×</button>
    </div>`;
}
function lfCard(title, inner) {
    return `<div style="background:var(--secondary-bg); border:1px solid var(--border-color); border-radius:14px; padding:14px; margin-bottom:12px;">
        ${title ? `<div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:10px;">${title}</div>` : ''}${inner}
    </div>`;
}
function lfBtn(label, onclick, primary) {
    const bg = primary === false ? 'var(--primary-bg)' : 'var(--accent-color)';
    const color = primary === false ? 'var(--text-primary)' : '#fff';
    const border = primary === false ? '1px solid var(--border-color)' : 'none';
    return `<button onclick="${onclick}" style="padding:9px 14px; border-radius:10px; border:${border}; background:${bg}; color:${color}; font-size:13px; font-weight:600; cursor:pointer;">${label}</button>`;
}
function lfBar(label, val, color) {
    const v = Math.max(0, Math.min(100, Math.round(val)));
    return `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <span style="font-size:11px; color:var(--text-secondary); width:34px;">${label}</span>
        <div style="flex:1; height:8px; background:var(--primary-bg); border-radius:4px; overflow:hidden;">
            <div style="width:${v}%; height:100%; background:${color}; transition:width .4s;"></div>
        </div>
        <span style="font-size:11px; color:var(--text-secondary); width:30px; text-align:right;">${v}</span>
    </div>`;
}

/* ==================== 宠物 ==================== */
const LF_SPECIES = [['🐱', '小猫咪'], ['🐶', '小狗勾'], ['🐰', '小兔几'], ['🦊', '小狐狸'], ['🐲', '小龙宝'], ['🐹', '小仓鼠']];
const LF_FEED_COST = 10;
function lfNewPet(species, name) {
    return { species, name, level: 1, exp: 0, hunger: 70, mood: 80, clean: 80, energy: 80, lastTick: Date.now(), bornAt: Date.now() };
}
function lfApplyDecay() {
    const p = lfData.pet;
    if (!p) return;
    const hours = Math.min(48, (Date.now() - (p.lastTick || Date.now())) / 36e5);
    p.hunger = Math.max(0, p.hunger - hours * 6);
    p.mood = Math.max(0, p.mood - hours * 4);
    p.clean = Math.max(0, p.clean - hours * 5);
    p.energy = Math.max(0, p.energy - hours * 5);
    p.lastTick = Date.now();
    lfSave();
}
function lfPetFace(p) {
    const avg = (p.hunger + p.mood + p.clean + p.energy) / 4;
    if (avg >= 75) return ['😆', '精神满满，到处撒欢'];
    if (avg >= 50) return ['🙂', '安静地陪着你'];
    if (avg >= 30) return ['🥺', '有点蔫蔫的，想要照顾'];
    return ['😵', '快撑不住啦，快照顾一下！'];
}
function lfAddExp(p, n) {
    p.exp += n;
    while (p.exp >= p.level * 40) {
        p.exp -= p.level * 40;
        p.level++;
        if (typeof showNotification === 'function') showNotification(`🎉 ${p.name} 升到 ${p.level} 级啦！`, 'success', 4000);
        try { pgChat('partner', `哇！${p.name} 升级到 ${p.level} 级了！好棒呀 🎉`); } catch (e) {}
    }
}
window.pgOpenPet = async function () {
    await lfLoadData();
    lfOpenModal();
    lfViewPet();
};
function lfViewPet() {
    const p = lfData.pet;
    let inner;
    if (!p) {
        inner = lfTabs('pet') + lfCard('领养一只小可爱', `
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">
                ${LF_SPECIES.map(([ic, nm]) => `
                    <div onclick="lfAdopt('${ic}','${nm}')" style="background:var(--primary-bg); border:1.5px solid var(--border-color); border-radius:14px; padding:14px 6px; text-align:center; cursor:pointer;"
                        onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='var(--border-color)'">
                        <div style="font-size:30px;">${ic}</div>
                        <div style="font-size:12px; color:var(--text-primary); margin-top:4px;">${nm}</div>
                    </div>`).join('')}
            </div>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:10px; text-align:center;">选择后可以改名 · 记得常回来照顾它哦</div>
        `);
    } else {
        lfApplyDecay();
        const [face, desc] = lfPetFace(p);
        inner = lfTabs('pet') + `
        ${lfCard('', `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="font-size:52px; line-height:1;">${p.species}</div>
                <div style="flex:1;">
                    <div style="font-size:15px; font-weight:800; color:var(--text-primary);">${pgEscape(p.name)} <span style="font-size:11px; color:var(--accent-color);">Lv.${p.level}</span></div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${face} ${desc}</div>
                    <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">经验 ${p.exp}/${p.level * 40}</div>
                </div>
            </div>
            <div style="margin-top:12px;">
                ${lfBar('饱食', p.hunger, '#F39C12')}
                ${lfBar('心情', p.mood, '#FF6B9D')}
                ${lfBar('清洁', p.clean, '#3498DB')}
                ${lfBar('精力', p.energy, '#2ECC71')}
            </div>
        `)}
        ${lfCard('互动', `
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${lfBtn('🍚 喂食 (🪙10)', "lfAct('feed')")}
                ${lfBtn('🎾 玩耍', "lfAct('play')")}
                ${lfBtn('🛁 洗澡', "lfAct('bath')")}
                ${lfBtn('💤 睡觉', "lfAct('sleep')")}
                ${lfBtn('✏️ 改名', 'lfRenamePet()', false)}
            </div>
            <div id="lf-pet-say" style="font-size:12px; color:var(--text-secondary); margin-top:10px; text-align:center;">💬 ${lfPetSay(p)}</div>
        `)}
        ${lfCard(`与 ${pgEscape(pgPartnerName())} 的共同回忆`, `
            <div style="font-size:12px; color:var(--text-secondary); line-height:1.8;">
                领养于 ${lfDate(p.bornAt)} · 陪伴 ${Math.max(1, Math.floor((Date.now() - p.bornAt) / 864e5))} 天<br>
                ${pgEscape(pgPartnerName())} 有时会偷偷来喂它、陪它玩，互动记录会出现在聊天里～
            </div>
        `)}`;
    }
    const b = document.getElementById('pg-life-body');
    if (b) b.innerHTML = inner;
}
function lfDate(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function lfPetSay(p) {
    const lines = p.hunger < 30 ? ['肚子咕咕叫了…想吃罐罐 🍚'] :
        p.mood < 30 ? ['无聊地扒拉你的裤脚…陪我玩嘛'] :
        p.clean < 30 ? ['身上痒痒的…想洗澡澡 🛁'] :
        p.energy < 30 ? ['眼皮打架中…让我睡一会'] :
        ['今天也要一起加油鸭！', '（用脑袋蹭蹭你的手）', '最爱你啦，比心 ❤', '咦？好像听到 ' + pgPartnerName() + ' 的声音了？', '在窗边等你回家～'];
    return lines[Math.floor(Math.random() * lines.length)];
}
function lfPrompt(title, def, cb) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `<div style="background:var(--primary-bg,#fff);border-radius:16px;padding:18px;width:100%;max-width:320px;">
        <div style="font-size:15px;font-weight:700;color:var(--text-primary,#333);margin-bottom:12px;">${title}</div>
        <input id="lf-prompt-input" type="text" value="${def || ''}" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border-color,#ccc);border-radius:8px;font-size:14px;background:var(--secondary-bg,#f5f5f5);color:var(--text-primary,#333);" placeholder="${def || ''}">
        <div style="display:flex;gap:8px;margin-top:12px;">
            <button id="lf-prompt-cancel" style="flex:1;padding:10px;border:1px solid var(--border-color,#ccc);border-radius:8px;background:var(--primary-bg,#fff);color:var(--text-primary,#333);cursor:pointer;font-size:13px;">取消</button>
            <button id="lf-prompt-ok" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color,#ff6b9d);color:#fff;cursor:pointer;font-size:13px;font-weight:600;">确定</button>
        </div></div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#lf-prompt-input');
    input.focus();
    const close = (val) => { overlay.remove(); cb(val); };
    overlay.querySelector('#lf-prompt-cancel').onclick = () => close(null);
    overlay.querySelector('#lf-prompt-ok').onclick = () => close(input.value.trim());
    input.onkeydown = (e) => { if (e.key === 'Enter') close(input.value.trim()); if (e.key === 'Escape') close(null); };
}
window.lfAdopt = function (species, name) {
    lfPrompt('给它取个名字吧：', name, function (petName) {
        if (petName === null || petName === '') { petName = name; }
        lfData.pet = lfNewPet(species, petName);
        lfSave();
        try { pgChat('partner', `我们领养了${LF_SPECIES.find(s => s[0] === species)[1]}「${lfData.pet.name}」！以后它就是我们家的一员啦 🐾`); } catch (e) {}
        try { if (typeof playSound === 'function') playSound('mood'); } catch (e) {}
        if (typeof showNotification === 'function') showNotification('领养成功，好好照顾它哦 🐾', 'success');
        lfViewPet();
    });
};
window.lfRenamePet = function () {
    const p = lfData.pet;
    if (!p) return;
    lfPrompt('改成什么名字：', p.name, function (n) {
        if (n && n.trim()) { p.name = n.trim(); lfSave(); lfViewPet(); }
    });
};
window.lfAct = function (type) {
    const p = lfData.pet;
    if (!p) return;
    let msg = '';
    if (type === 'feed') {
        let coins = 0;
        try { coins = Number(typeof pgCoins === 'function' ? pgCoins() : 0); } catch (e) { coins = 0; }
        if (coins < LF_FEED_COST) { if (typeof showNotification === 'function') showNotification('金币不够买粮了', 'warning'); return; }
        try {
            if (typeof pgAddCoins === 'function') pgAddCoins(-LF_FEED_COST);
        } catch (e) {
            // 金币模块异常时不阻断宠物互动，使用生活模块自己的备用余额。
            lfData.__coins = Math.max(0, (Number(lfData.__coins) || coins) - LF_FEED_COST);
        }
        p.hunger = Math.min(100, p.hunger + 30); p.mood = Math.min(100, p.mood + 5);
        lfAddExp(p, 6); msg = '（埋头干饭）好吃！谢谢你 🍚';
    } else if (type === 'play') {
        p.mood = Math.min(100, p.mood + 25); p.energy = Math.max(0, p.energy - 10);
        lfAddExp(p, 8); msg = '（转圈圈）再玩一次嘛再玩一次！';
    } else if (type === 'bath') {
        p.clean = Math.min(100, p.clean + 35); p.mood = Math.max(0, p.mood - 3);
        lfAddExp(p, 5); msg = '（吹干毛毛）香喷喷的，自己都爱自己了';
    } else if (type === 'sleep') {
        p.energy = Math.min(100, p.energy + 35); p.hunger = Math.max(0, p.hunger - 5);
        lfAddExp(p, 4); msg = 'Zzz…（梦里也在追蝴蝶）';
    }
    p.lastTick = Date.now();
    lfSave();
    try { if (typeof playSound === 'function') playSound('mood'); } catch (e) {}
    lfViewPet();
    const say = document.getElementById('lf-pet-say');
    if (say) say.textContent = '💬 ' + msg;
};
/* 对方照顾宠物（后台随机） */
setInterval(async () => {
    try {
        await lfLoadData();
        const p = lfData.pet;
        if (!p || Math.random() > 0.3) return;
        lfApplyDecay();
        const act = [['喂了', () => { p.hunger = Math.min(100, p.hunger + 20); }], ['陪', () => { p.mood = Math.min(100, p.mood + 15); }], ['洗了', () => { p.clean = Math.min(100, p.clean + 20); }]][Math.floor(Math.random() * 3)];
        act[1]();
        lfAddExp(p, 4);
        lfSave();
        try { pgChat('partner', `刚刚偷偷${act[0]}${p.name}～它可开心了 🐾`); } catch (e) {}
        try { if (typeof showNotification === 'function') showNotification(`${pgPartnerName()} 照顾了 ${p.name} 🐾`, 'info'); } catch (e) {}
    } catch (e) {}
}, (typeof getSiteFrequency === 'function' ? getSiteFrequency('petCareMin', 8) : 8) * 60000);

/* ==================== 花园 ==================== */
const LF_SEEDS = [
    { id: 'clover',  icon: '🍀', name: '四叶草', price: 15,  minutes: 6,   reward: 25 },
    { id: 'sun',     icon: '🌻', name: '向日葵', price: 20,  minutes: 10,  reward: 32 },
    { id: 'tulip',   icon: '🌷', name: '郁金香', price: 35,  minutes: 20,  reward: 55 },
    { id: 'rose',    icon: '🌹', name: '玫瑰花', price: 60,  minutes: 40,  reward: 95 },
    { id: 'berry',   icon: '🍓', name: '草莓',   price: 100, minutes: 90,  reward: 160 },
    { id: 'pumpkin', icon: '🎃', name: '南瓜',   price: 150, minutes: 180, reward: 240 }
];
function lfSeed(id) { return LF_SEEDS.find(s => s.id === id); }
function lfPlotProgress(plot) {
    if (!plot) return 0;
    const seed = lfSeed(plot.seed);
    const elapsedMin = (Date.now() - plot.plantedAt) / 60000 + (plot.waters || 0) * 0.5;
    return Math.min(100, Math.round(elapsedMin / seed.minutes * 100));
}
window.pgOpenGarden = async function () {
    await lfLoadData();
    lfOpenModal();
    lfViewGarden();
};
function lfViewGarden() {
    const plots = lfData.garden.plots;
    let gardenCells = plots.map((plot, i) => {
        if (!plot) {
            return `<div onclick="lfShowShop(${i})" style="height:86px; border:1.5px dashed var(--border-color); border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;">
                <div style="font-size:20px; opacity:0.4;">➕</div>
                <div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">空地 · 点我种植</div>
            </div>`;
        }
        const seed = lfSeed(plot.seed);
        const prog = lfPlotProgress(plot);
        const stage = prog >= 100 ? seed.icon : prog >= 60 ? '🪴' : prog >= 25 ? '🌿' : '🌱';
        const ripe = prog >= 100;
        return `<div onclick="${ripe ? `lfHarvest(${i})` : `lfWater(${i})`}" style="height:86px; border:1.5px solid ${ripe ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; position:relative;">
            ${ripe ? '<div style="position:absolute; top:3px; right:5px; font-size:9px; color:var(--accent-color); font-weight:700;">可收获</div>' : ''}
            <div style="font-size:26px;">${stage}</div>
            <div style="font-size:10px; color:var(--text-secondary);">${seed.name} ${prog}%</div>
            ${ripe ? '' : `<div style="width:70%; height:4px; background:var(--primary-bg); border-radius:2px; overflow:hidden; margin-top:3px;"><div style="width:${prog}%; height:100%; background:#2ECC71;"></div></div><div style="font-size:9px; color:var(--text-secondary); margin-top:2px;">点击浇水💧</div>`}
        </div>`;
    }).join('');
    const b = document.getElementById('pg-life-body');
    if (b) b.innerHTML = lfTabs('garden') + `
        ${lfCard('', `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">${gardenCells}</div>`)}
        ${lfVaseHtml()}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-size:13px; font-weight:700; color:var(--text-primary);">🛒 种子商店 <span style="font-size:11px; color:var(--text-secondary);">（余额 ${pgCoins()}）</span></div>
            ${lfBtn('🔄 看看花园', 'lfViewGarden()', false)}
        </div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:12px;">
            ${LF_SEEDS.map(s => `
                <div onclick="lfBuy('${s.id}')" style="background:var(--secondary-bg); border:1px solid var(--border-color); border-radius:12px; padding:10px 6px; text-align:center; cursor:pointer;">
                    <div style="font-size:22px;">${s.icon}</div>
                    <div style="font-size:11px; font-weight:700; color:var(--text-primary);">${s.name}</div>
                    <div style="font-size:10px; color:var(--text-secondary);">🪙${s.price} · ${s.minutes >= 60 ? (s.minutes / 60) + '小时' : s.minutes + '分钟'}</div>
                    <div style="font-size:10px; color:#2ECC71;">收成 🪙${s.reward}</div>
                </div>`).join('')}
        </div>
        ${lfData.flowerGifts && lfData.flowerGifts.length ? lfCard('🎁 花朵互赠记录', lfData.flowerGifts.slice(0, 8).map(g => `
            <div style="font-size:12px; color:var(--text-secondary); padding:6px 0; border-bottom:1px dashed var(--border-color);">${g.dir === 'me2ta' ? '我送给' + pgEscape(pgPartnerName()) : pgEscape(pgPartnerName()) + '送给我'}：${g.icon}${pgEscape(g.name)} <span style="opacity:0.6;">· ${pgTimeText(g.time)}</span></div>`).join('')) : ''}
        ${lfCard('📜 花园日志', lfData.gardenLog.length ? lfData.gardenLog.slice(0, 10).map(l => `
            <div style="font-size:12px; color:var(--text-secondary); padding:6px 0; border-bottom:1px dashed var(--border-color);">${pgEscape(l.text)} <span style="opacity:0.6;">· ${pgTimeText(l.time)}</span></div>`).join('')
            : '<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:8px;">种下第一颗种子吧 🌱</div>')}
    `;
}
/* 花瓶：收获的花放这里，可以互相赠送 */
function lfVaseHtml() {
    const flowers = (lfData.flowers || []).filter(f => f.count > 0);
    let cells;
    if (!flowers.length) {
        cells = '<div style="font-size:11px; color:var(--text-secondary);">花瓶空空的，收获花朵后会自动放进这里 💐</div>';
    } else {
        cells = flowers.map(f => {
            const seed = lfSeed(f.seedId);
            return `<div style="background:var(--secondary-bg); border:1px solid var(--border-color); border-radius:12px; padding:8px 6px; text-align:center;">
                <div style="font-size:20px;">${seed.icon}</div>
                <div style="font-size:11px; color:var(--text-primary); font-weight:600;">${seed.name} ×${f.count}</div>
                <button onclick="lfGiftFlower('${f.seedId}')" style="margin-top:4px; padding:3px 10px; font-size:11px; border:none; border-radius:8px; background:var(--accent-color); color:#fff; cursor:pointer;">🎁 送给Ta</button>
            </div>`;
        }).join('');
    }
    return `<div style="margin-bottom:12px;">
        <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:8px;">💐 我们的花瓶 <span style="font-size:10px; color:var(--text-secondary);">（收获的花可以互相赠送）</span></div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">${cells}</div>
    </div>`;
}
window.lfGiftFlower = function (seedId) {
    const f = (lfData.flowers || []).find(x => x.seedId === seedId);
    if (!f || f.count <= 0) return;
    const seed = lfSeed(seedId);
    f.count--;
    lfData.flowerGifts.unshift({ dir: 'me2ta', icon: seed.icon, name: seed.name, time: new Date().toISOString() });
    if (lfData.flowerGifts.length > 20) lfData.flowerGifts.length = 20;
    lfSave();
    try { pgChat('partner', `送你一朵自己种的${seed.icon}${seed.name}，希望你喜欢～ 🌷💕`); } catch (e) {}
    try { if (typeof showNotification === 'function') showNotification(`已把${seed.icon}${seed.name}送给${pgPartnerName()} 🎁`, 'success', 4000); } catch (e) {}
    try { if (typeof playSound === 'function') playSound('favorite'); } catch (e) {}
    lfViewGarden();
};
/* 对方偶尔送花到我的花瓶 */
setInterval(async () => {
    try {
        if (Math.random() > 0.18) return;
        await lfLoadData();
        const seed = LF_SEEDS[Math.floor(Math.random() * Math.min(4, LF_SEEDS.length))];
        let f = lfData.flowers.find(x => x.seedId === seed.id);
        if (f) f.count++; else lfData.flowers.push({ seedId: seed.id, count: 1 });
        lfData.flowerGifts.unshift({ dir: 'ta2me', icon: seed.icon, name: seed.name, time: new Date().toISOString() });
        if (lfData.flowerGifts.length > 20) lfData.flowerGifts.length = 20;
        lfSave();
        try { pgChat('partner', `路过花店看到${seed.icon}${seed.name}很漂亮，买给你插花瓶里啦～ 🌷`); } catch (e) {}
        try { if (typeof showNotification === 'function') showNotification(`${pgPartnerName()} 送了你一朵${seed.icon}${seed.name}，已放进花瓶 💐`, 'success', 4000); } catch (e) {}
    } catch (e) {}
}, (typeof getSiteFrequency === 'function' ? getSiteFrequency('flowerGiftMin', 7) : 7) * 60000);
window.lfShowShop = function () { /* 商店已在下方，滚动提示 */ try { if (typeof showNotification === 'function') showNotification('在下面商店挑一颗种子吧 🛒', 'info'); } catch (e) {} };
window.lfBuy = function (seedId) {
    const seed = lfSeed(seedId);
    const emptyIdx = lfData.garden.plots.findIndex(p => !p);
    if (emptyIdx === -1) { if (typeof showNotification === 'function') showNotification('花园满啦，先收获或等等吧', 'warning'); return; }
    if (pgCoins() < seed.price) { if (typeof showNotification === 'function') showNotification('金币不足，先去发个红包赚回来？', 'warning'); return; }
    pgAddCoins(-seed.price);
    lfData.garden.plots[emptyIdx] = { seed: seedId, plantedAt: Date.now(), waters: 0 };
    lfData.gardenLog.unshift({ time: new Date().toISOString(), text: `种下了${seed.name}${seed.icon}` });
    if (lfData.gardenLog.length > 30) lfData.gardenLog.length = 30;
    lfSave();
    try { if (typeof playSound === 'function') playSound('send'); } catch (e) {}
    lfViewGarden();
};
window.lfWater = function (i) {
    const plot = lfData.garden.plots[i];
    if (!plot) return;
    const last = plot.lastWater || 0;
    if (Date.now() - last < 30000) { if (typeof showNotification === 'function') showNotification('刚浇过水啦，歇一会 💧', 'info'); return; }
    plot.lastWater = Date.now();
    plot.waters = (plot.waters || 0) + 1;
    lfSave();
    try { if (typeof playSound === 'function') playSound('mood'); } catch (e) {}
    lfViewGarden();
};
window.lfHarvest = function (i) {
    const plot = lfData.garden.plots[i];
    if (!plot || lfPlotProgress(plot) < 100) return;
    const seed = lfSeed(plot.seed);
    pgAddCoins(seed.reward);
    // 花朵放进花瓶（可以送给Ta）
    let fl = (lfData.flowers || []).find(x => x.seedId === seed.id);
    if (fl) fl.count++; else { if (!lfData.flowers) lfData.flowers = []; lfData.flowers.push({ seedId: seed.id, count: 1 }); }
    lfData.garden.plots[i] = null;
    lfData.gardenLog.unshift({ time: new Date().toISOString(), text: `收获了${seed.name}${seed.icon}，赚到 🪙${seed.reward}，花放进了花瓶` });
    lfSave();
    try { pgChat('partner', `花园里的${seed.name}熟啦！我摘下来给你留了一半 🌷`); } catch (e) {}
    try { if (typeof showNotification === 'function') showNotification(`收获${seed.name}${seed.icon}，获得 ${pgCoin(seed.reward)}，花已放入花瓶💐`, 'success', 4000); } catch (e) {}
    try { if (typeof playSound === 'function') playSound('partner_message'); } catch (e) {}
    lfViewGarden();
};
/* 对方帮忙浇水（后台随机） */
setInterval(async () => {
    try {
        await lfLoadData();
        const growing = lfData.garden.plots.map((p, i) => p && lfPlotProgress(p) < 100 ? i : -1).filter(i => i >= 0);
        if (!growing.length || Math.random() > 0.25) return;
        const i = growing[Math.floor(Math.random() * growing.length)];
        lfData.garden.plots[i].waters = (lfData.garden.plots[i].waters || 0) + 2;
        lfSave();
        const seed = lfSeed(lfData.garden.plots[i].seed);
        try { pgChat('partner', `路过花园顺手给你的${seed.name}浇了浇水💧 快快长大～`); } catch (e) {}
        try { if (typeof showNotification === 'function') showNotification(`${pgPartnerName()} 帮你浇水了 💧`, 'info'); } catch (e) {}
    } catch (e) {}
}, 6 * 60000);

/* ==================== 灵感笔记 ==================== */
window.pgOpenNotes = async function () {
    await lfLoadData();
    if (!Array.isArray(lfData.notes)) lfData.notes = [];
    lfOpenModal();
    lfViewNotes();
};
function lfViewNotes() {
    const notes = (lfData.notes || []).slice().reverse();
    const today = new Date().toDateString();
    const todayCount = (lfData.notes || []).filter(n => new Date(n.time).toDateString() === today).length;
    const b = document.getElementById('pg-life-body');
    if (!b) return;
    b.innerHTML = lfTabs('notes') + `
        ${lfCard('💡 记一条灵感', `
            <textarea id="lf-note-input" placeholder="灵感、想法、备忘、今天的心事…随时写下来" style="width:100%; min-height:80px; padding:10px 12px; border:1px solid var(--border-color); border-radius:10px; background:var(--primary-bg); color:var(--text-primary); font-size:13px; box-sizing:border-box; resize:vertical;"></textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <span style="font-size:11px; color:var(--text-secondary);">共 ${lfData.notes.length} 条 · 今天 ${todayCount} 条</span>
                <button onclick="lfAddNote()" style="padding:8px 20px; border:none; border-radius:10px; background:var(--accent-color); color:#fff; font-size:13px; font-weight:700; cursor:pointer;">✍️ 记下来</button>
            </div>
        `)}
        ${notes.length ? notes.map(n => `
            <div style="background:var(--secondary-bg); border:1px solid var(--border-color); border-radius:12px; padding:12px 14px; margin-bottom:10px; position:relative;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:5px;">🗓 ${pgTimeText(n.time)}</div>
                <div style="font-size:13px; color:var(--text-primary); white-space:pre-wrap; word-break:break-word;">${pgEscape(n.text)}</div>
                <button onclick="lfDelNote('${n.id}')" title="删除" style="position:absolute; top:8px; right:10px; width:20px; height:20px; border-radius:50%; border:none; background:transparent; color:var(--text-secondary); cursor:pointer; font-size:13px;">✕</button>
            </div>`).join('')
        : '<div style="text-align:center; padding:24px; color:var(--text-secondary); font-size:12px;">还没有灵感记录，写下第一条吧 ✨</div>'}
    `;
    try { const t = document.getElementById('lf-note-input'); if (t) t.focus(); } catch (e) {}
}
window.lfAddNote = function () {
    const t = document.getElementById('lf-note-input');
    const text = t ? t.value.trim() : '';
    if (!text) { if (typeof showNotification === 'function') showNotification('先写点什么吧', 'warning'); return; }
    if (!Array.isArray(lfData.notes)) lfData.notes = [];
    lfData.notes.push({ id: 'nt_' + Date.now(), text, time: new Date().toISOString() });
    if (lfData.notes.length > 200) lfData.notes.splice(0, lfData.notes.length - 200);
    lfSave();
    try { if (typeof showNotification === 'function') showNotification('灵感已记下 💡', 'success'); } catch (e) {}
    try { if (typeof playSound === 'function') playSound('favorite'); } catch (e) {}
    lfViewNotes();
};
window.lfDelNote = function (id) {
    if (!Array.isArray(lfData.notes)) return;
    const idx = lfData.notes.findIndex(n => n.id === id);
    if (idx === -1) return;
    lfData.notes.splice(idx, 1);
    lfSave();
    lfViewNotes();
};
