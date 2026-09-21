/* frequency-settings.js - 全站自动行为频率控制 */
(function () {
    const KEY = 'siteFrequencySettings';
    const defaults = {
        proactiveMin: 10, proactiveMax: 25,
        replyMinSec: 3, replyMaxSec: 7,
        petCareMin: 8, flowerGiftMin: 7,
        momentsAutoMin: 60, boardAutoMin: 30,
        partnerRandomMin: 9, checkinMin: 30,
        statusRefreshSec: 3, backgroundPushSec: 30,
        doodleMin: 20, doodleMax: 40
    };
    let values = Object.assign({}, defaults);
    let modal = null;
    const fields = [
        ['proactiveMin', '主动消息最短间隔', '分钟'], ['proactiveMax', '主动消息最长间隔', '分钟'],
        ['replyMinSec', '自动回复最短延迟', '秒'], ['replyMaxSec', '自动回复最长延迟', '秒'],
        ['petCareMin', '宠物自动照顾', '分钟一次'], ['flowerGiftMin', '对方送花检查', '分钟一次'],
        ['momentsAutoMin', '朋友圈自动动态检查', '分钟一次'], ['boardAutoMin', '留言板自动留言检查', '分钟一次'],
        ['partnerRandomMin', '随机互动检查', '分钟一次'], ['checkinMin', '查岗检查', '分钟一次'],
        ['statusRefreshSec', '链接 / 状态刷新', '秒一次'], ['backgroundPushSec', '后台推送检查', '秒一次'],
        ['doodleMin', '对方画画最短间隔', '分钟'], ['doodleMax', '对方画画最长间隔', '分钟']
    ];
    function load() { try { values = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {} }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (e) {} }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || min)); }
    window.getSiteFrequency = function (key, fallback) { load(); return Number.isFinite(Number(values[key])) ? Number(values[key]) : fallback; };
    window.getSiteFrequencyRange = function (minKey, maxKey, fallbackMin, fallbackMax) { return [window.getSiteFrequency(minKey, fallbackMin), window.getSiteFrequency(maxKey, fallbackMax)]; };
    function ensureModal() {
        if (modal) return modal;
        modal = document.createElement('div'); modal.id = 'frequency-settings-modal'; modal.className = 'modal';
        modal.innerHTML = '<div class="modal-content frequency-settings-content"><div id="frequency-settings-body"></div></div>';
        modal.addEventListener('click', e => { if (e.target === modal) close(); }); document.body.appendChild(modal); return modal;
    }
    function close() { if (modal && typeof hideModal === 'function') hideModal(modal); else if (modal) modal.style.display = 'none'; }
    function render() {
        const body = document.getElementById('frequency-settings-body'); if (!body) return;
        body.innerHTML = `<div class="frequency-head"><div><div class="frequency-kicker">SYSTEM RHYTHM</div><h2>全站频率控制</h2><p>所有自动发生的互动都可以由你决定。数值越小，发生越频繁。</p></div><button onclick="window.closeFrequencySettings()">×</button></div><div class="frequency-grid">${fields.map(([key, label, unit]) => `<label><span>${label}</span><div><input data-frequency-key="${key}" type="number" min="1" max="1440" value="${values[key]}"><small>${unit}</small></div></label>`).join('')}</div><div class="frequency-note">游戏中的倒计时、对局计时和动画速度属于玩法本身，不会被这里改变。</div><div class="frequency-actions"><button class="secondary" onclick="window.frequencyReset()">恢复默认</button><button class="primary" onclick="window.frequencySave()">保存全部频率</button></div>`;
    }
    window.openFrequencySettings = function () { load(); ensureModal(); render(); if (typeof showModal === 'function') showModal(modal); else modal.style.display = 'flex'; };
    window.closeFrequencySettings = close;
    window.frequencySave = function () {
        document.querySelectorAll('[data-frequency-key]').forEach(input => { values[input.dataset.frequencyKey] = clamp(input.value, 1, 1440); });
        values.proactiveMax = Math.max(values.proactiveMin, values.proactiveMax); values.replyMaxSec = Math.max(values.replyMinSec, values.replyMaxSec); values.doodleMax = Math.max(values.doodleMin, values.doodleMax); save();
        if (typeof showNotification === 'function') showNotification('全站频率已保存，新的自动行为会按此执行', 'success');
        close();
    };
    window.frequencyReset = function () { values = Object.assign({}, defaults); save(); render(); if (typeof showNotification === 'function') showNotification('频率已恢复默认', 'info'); };
})();
