/* companion.js - 可关闭的陪伴小人
 * 外观复用当前对方头像/昵称，数据保存在本机。
 */
(function () {
    const KEY = 'companionCharacterData';
    const defaultData = {
        enabled: false, name: '', avatar: '', emoji: '🙂', level: 1, exp: 0, hunger: 78, mood: 82, energy: 80, hygiene: 86,
        outfit: '日常衣', wardrobe: ['日常衣', '居家服', '学习服'], dialogues: [], lastAction: '正在等你回来。'
    };
    const outfits = ['日常衣', '居家服', '学习服', '外出服', '睡衣', '节日装'];
    const actions = [
        ['feed', '🍚 喂食', '吃到喜欢的东西，眼睛亮起来了。', 12, -2, 4, 0],
        ['outfit', '👕 换衣服', '换好衣服后，在镜子前转了一圈。', 3, 4, 0, 0],
        ['outing', '🌳 出门游玩', '回来时带着风的味道，心情变好了。', 5, 15, -12, -2],
        ['shopping', '🛍 逛街', '挑了一件小礼物，说下次要和你一起去。', 4, 10, -5, -1],
        ['game', '🎮 玩游戏', '赢了一局，开心地向你炫耀战绩。', 5, 12, -8, 0],
        ['read', '📖 读书', '安静读完一页，把喜欢的句子记了下来。', 10, 5, -3, 0],
        ['work', '💻 工作', '认真完成了一小段工作，想要你的表扬。', 12, 3, -6, 0],
        ['touch', '🤍 摸摸', '靠过来蹭了蹭你的手，小声说谢谢。', 4, 14, 0, 0],
        ['bath', '🛁 洗澡洗漱', '洗得香喷喷的，整个人都清爽了。', 3, 5, 0, 18],
        ['eat', '🍜 吃饭', '和你一起吃饭，是今天最满足的时刻。', 10, 8, -2, 0],
        ['movie', '🎬 看电影', '看到喜欢的片段，偷偷把肩膀靠向你。', 2, 12, -5, 0],
        ['music', '🎵 听歌', '选了一首歌循环播放，房间变得很温柔。', 2, 10, -1, 0],
        ['sleep', '🌙 一起睡觉', '把被角分给你一点，安心地睡着了。', 0, 9, 18, 0],
        ['cook', '🍳 一起做饭', '手忙脚乱地完成了一顿饭，觉得很有成就感。', 12, 16, -7, -2],
        ['hug', '🫂 拥抱', '用力抱住你，今天的不开心都散掉了一点。', 2, 20, 0, 0]
    ];
    let data = Object.assign({}, defaultData);
    let modal = null;

    function load() { try { data = Object.assign({}, defaultData, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {} }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
    function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function notify(text, type) { if (typeof showNotification === 'function') showNotification(text, type || 'success'); }
    function partnerName() { try { return (typeof settings !== 'undefined' && settings.partnerName) || '梦角'; } catch (e) { return '梦角'; } }
    function avatarSrc() {
        if (data.avatar) return data.avatar;
        try { if (typeof settings !== 'undefined' && settings.partnerAvatar) return settings.partnerAvatar; } catch (e) {}
        const img = document.querySelector('#partner-avatar img');
        return img ? img.src : '';
    }
    function face() { return data.mood >= 75 ? '😊' : data.mood >= 45 ? '🙂' : '🥺'; }
    function levelUp() { while (data.exp >= data.level * 30) { data.exp -= data.level * 30; data.level++; notify(`${data.name || partnerName()} 成长到 Lv.${data.level}`, 'success'); } }
    function sendChat(text) {
        if (typeof addMessage !== 'function') return;
        addMessage({ id: 'companion_' + Date.now(), sender: 'partner', text: text, timestamp: new Date(), status: 'received', type: 'normal' });
    }
    function ensureModal() {
        if (modal) return modal;
        modal = document.createElement('div'); modal.id = 'companion-modal'; modal.className = 'modal';
        modal.innerHTML = '<div class="modal-content companion-content"><div id="companion-body"></div></div>';
        modal.addEventListener('click', e => { if (e.target === modal) close(); }); document.body.appendChild(modal); return modal;
    }
    function close() { if (modal && typeof hideModal === 'function') hideModal(modal); else if (modal) modal.style.display = 'none'; }
    function avatar() { return avatarSrc() ? `<img src="${esc(avatarSrc())}" alt="${esc(data.name || partnerName())}">` : `<span>${esc(data.emoji || (data.name || partnerName()).slice(0, 1))}</span>`; }
    function render() {
        const body = document.getElementById('companion-body'); if (!body) return;
        body.innerHTML = `<div class="companion-header"><div><div class="companion-kicker">LITTLE COMPANION</div><h2>${esc(data.name || partnerName())} 的小人</h2><p>外观跟随当前对方头像，动作会影响心情和成长。</p></div><button onclick="window.closeCompanion()">×</button></div>
            <div class="companion-profile"><div class="companion-avatar">${avatar()}</div><div class="companion-profile-info"><strong>${esc(data.name || partnerName())} · Lv.${data.level}</strong><span>${face()} ${esc(data.lastAction)}</span><div class="companion-bars"><i style="width:${data.hunger}%"></i><i style="width:${data.mood}%"></i><i style="width:${data.energy}%"></i></div><small>成长 ${data.exp}/${data.level * 30} · 饱食 / 心情 / 精力</small></div></div>
            <div class="companion-section companion-identity"><div class="companion-section-title">小人资料</div><div class="companion-identity-row"><input id="companion-name" value="${esc(data.name)}" placeholder="小人的昵称"><input id="companion-emoji" value="${esc(data.emoji)}" maxlength="4" placeholder="🙂"><button onclick="window.companionSaveIdentity()">保存</button></div><label class="companion-upload">上传小人图片<input id="companion-avatar-file" type="file" accept="image/*" onchange="window.companionAvatarUpload(this)"></label><small class="companion-helper">不上传图片时，会使用对方头像；也可以只用表情作为小人形象。</small></div>
            <div class="companion-actions">${actions.map(a => `<button onclick="window.companionAction('${a[0]}')">${a[1]}</button>`).join('')}</div>
            <div class="companion-section"><div class="companion-section-title">衣橱</div><div class="companion-outfits">${outfits.map(item => `<button class="${data.outfit === item ? 'active' : ''}" onclick="window.companionWear('${item}')">${item}</button>`).join('')}</div></div>
            <div class="companion-section"><div class="companion-section-title">我的对话库</div><textarea id="companion-dialogue" placeholder="每行一句，例如：今天也辛苦了，回来抱抱。">${esc(data.dialogues.join('\n'))}</textarea><button class="companion-save-dialogue" onclick="window.companionSaveDialogue()">保存对话</button></div>
            <label class="companion-toggle"><input id="companion-visible-toggle" type="checkbox" ${data.enabled ? 'checked' : ''} onchange="window.companionToggle(this.checked)"> 出现在聊天界面</label>`;
    }
    function open() { load(); ensureModal(); render(); if (typeof showModal === 'function') showModal(modal); else modal.style.display = 'flex'; }
    window.openCompanion = open; window.closeCompanion = close;
    window.companionAction = function (key) {
        load(); const action = actions.find(a => a[0] === key); if (!action) return;
        if (key === 'outfit' || key === 'shopping') data.hunger = Math.max(0, data.hunger - 2);
        data.hunger = Math.max(0, Math.min(100, data.hunger + action[3])); data.mood = Math.max(0, Math.min(100, data.mood + action[4])); data.energy = Math.max(0, Math.min(100, data.energy + action[5])); data.hygiene = Math.max(0, Math.min(100, data.hygiene + action[6])); data.exp += 5; data.lastAction = action[2]; levelUp(); save(); render();
        if (data.dialogues.length) sendChat(data.dialogues[Math.floor(Math.random() * data.dialogues.length)]); else sendChat(action[2]);
    };
    window.companionWear = function (outfit) { data.outfit = outfit; if (!data.wardrobe.includes(outfit)) data.wardrobe.push(outfit); data.lastAction = `换上了${outfit}，等你夸好看。`; data.mood = Math.min(100, data.mood + 4); data.exp += 3; levelUp(); save(); render(); };
    window.companionSaveDialogue = function () { const el = document.getElementById('companion-dialogue'); if (el) data.dialogues = el.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 100); save(); notify('小人的对话库已保存'); };
    window.companionSaveIdentity = function () { const name = document.getElementById('companion-name'); const emoji = document.getElementById('companion-emoji'); if (name) data.name = name.value.trim(); if (emoji) data.emoji = emoji.value.trim() || '🙂'; save(); render(); renderWidget(); notify('小人资料已保存'); };
    window.companionAvatarUpload = function (input) { const file = input.files && input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function () { data.avatar = reader.result; save(); render(); renderWidget(); notify('小人形象已更新'); }; reader.readAsDataURL(file); input.value = ''; };
    window.companionToggle = function (enabled) { data.enabled = !!enabled; save(); renderWidget(); if (typeof showNotification === 'function') showNotification(data.enabled ? '小人已显示在聊天界面' : '小人已从聊天界面关闭', 'success'); };
    window.companionCloseWidget = function (event) { if (event) event.stopPropagation(); data.enabled = false; save(); renderWidget(); notify('小人已关闭，不会再显示在聊天界面', 'info'); };
    function renderWidget() {
        let widget = document.getElementById('companion-widget'); if (widget) widget.remove();
        if (!data.enabled) return;
        widget = document.createElement('div'); widget.id = 'companion-widget'; widget.innerHTML = `<button class="companion-widget-open" title="打开陪伴小人"><span class="companion-widget-avatar">${avatar()}</span><span><b>${esc(data.name || partnerName())}</b><small>${face()} ${esc(data.lastAction)}</small></span></button><button class="companion-widget-close" title="关闭小人" aria-label="关闭小人">×</button>`; widget.querySelector('.companion-widget-open').onclick = open; widget.querySelector('.companion-widget-close').onclick = window.companionCloseWidget; document.body.appendChild(widget);
    }
    window.initCompanion = function () { load(); renderWidget(); };
    document.addEventListener('DOMContentLoaded', () => setTimeout(window.initCompanion, 800));
})();
