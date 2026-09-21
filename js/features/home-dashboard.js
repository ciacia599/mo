/* home-dashboard.js - 关系首页状态面板
 * 保留原聊天页，补充参考站常见的状态总览与功能直达入口。
 */
(function () {
    var STORAGE_KEY = 'homeDashboardData';
    var data = { myMood: '平静', partnerMood: '想念', note: '' };
    var moodOptions = ['平静', '想念', '开心', '疲惫', '期待', '需要陪伴'];

    function load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) data = Object.assign(data, JSON.parse(raw));
        } catch (e) {}
    }

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    }

    function esc(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getName(key, fallback) {
        try {
            return (typeof settings !== 'undefined' && settings[key]) || fallback;
        } catch (e) { return fallback; }
    }

    function daysTogether() {
        var raw = null;
        try { raw = settings && (settings.startDate || settings.anniversaryDate || settings.meetDate); } catch (e) {}
        if (!raw) return '0';
        var date = new Date(raw);
        if (Number.isNaN(date.getTime())) return '0';
        return String(Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000)));
    }

    function openTarget(target) {
        var actions = {
            chat: function () { close(); },
            together: function () { close(); if (typeof openTogetherMode === 'function') openTogetherMode(); },
            space: function () { close(); if (typeof openSpaceCenter === 'function') openSpaceCenter(); },
            moments: function () { close(); if (typeof openMoments === 'function') openMoments(); },
            games: function () { close(); if (typeof openMiniGamesCenter === 'function') openMiniGamesCenter(); },
            extras: function () { close(); if (typeof openExtrasHub === 'function') openExtrasHub(); },
            heartflow: function () { close(); if (typeof openHeartFlow === 'function') openHeartFlow(); },
            survey: function () { openSurvey(); },
            settings: function () { close(); var button = document.getElementById('settings-btn'); if (button) button.click(); }
        };
        if (actions[target]) actions[target]();
    }

    function openSurvey() {
        var modal = document.getElementById('home-dashboard-modal');
        if (!modal) return;
        modal.innerHTML = `
            <div class="home-dashboard-card home-survey-card" role="dialog" aria-label="关系问卷">
                <div class="home-dashboard-head">
                    <div><div class="home-dashboard-eyebrow">A SMALL CHECK-IN</div><h2>今天的关系问卷</h2><p>花一分钟记录彼此的需要，答案只保存在当前设备。</p></div>
                    <button class="home-dashboard-close" type="button" data-survey-action="close" aria-label="关闭">×</button>
                </div>
                <form id="home-survey-form">
                    <label>今天最想收到什么？<select name="wish"><option>一句肯定</option><option>安静陪伴</option><option>一个拥抱</option><option>一起玩点什么</option></select></label>
                    <label>今天的能量值 <input name="energy" type="range" min="1" max="5" value="3"><span class="home-survey-range-value">3 / 5</span></label>
                    <label>想把哪件小事留在今天？<textarea name="note" maxlength="120" placeholder="写一句给未来的我们…"></textarea></label>
                    <div class="home-survey-actions"><button type="button" class="home-survey-back" data-survey-action="back">返回首页</button><button type="submit" class="home-survey-save">保存问卷</button></div>
                </form>
            </div>`;
        var form = document.getElementById('home-survey-form');
        var range = form.querySelector('input[type="range"]');
        range.addEventListener('input', function () { form.querySelector('.home-survey-range-value').textContent = range.value + ' / 5'; });
        modal.querySelectorAll('[data-survey-action]').forEach(function (button) {
            button.addEventListener('click', function () {
                if (button.getAttribute('data-survey-action') === 'back') render();
                else close();
            });
        });
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var result = { wish: form.wish.value, energy: form.energy.value, note: form.note.value, savedAt: new Date().toISOString() };
            try { localStorage.setItem('homeRelationshipSurvey', JSON.stringify(result)); } catch (e) {}
            if (typeof showNotification === 'function') showNotification('问卷已保存到本机', 'success');
            render();
        });
    }

    function render() {
        var modal = document.getElementById('home-dashboard-modal');
        if (!modal) return;
        var myName = getName('myName', '我');
        var partnerName = getName('partnerName', '梦角');
        var today = new Date();
        var dateText = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
        modal.innerHTML = `
            <div class="home-dashboard-card" role="dialog" aria-label="关系首页">
                <div class="home-dashboard-head">
                    <div>
                        <div class="home-dashboard-eyebrow">TWO OF US · ${esc(dateText)}</div>
                        <h2>我们的首页</h2>
                        <p>先看看彼此的状态，再决定今天一起做什么。</p>
                    </div>
                    <button class="home-dashboard-close" type="button" data-dashboard-action="close" aria-label="关闭">×</button>
                </div>
                <div class="home-dashboard-status">
                    <div class="home-dashboard-profile">
                        <div class="home-dashboard-avatar">${esc(myName.slice(0, 1))}</div>
                        <div><strong>${esc(myName)}</strong><span>我现在 · ${esc(data.myMood)}</span></div>
                    </div>
                    <div class="home-dashboard-connection"><span>相伴</span><strong>${daysTogether()}</strong><small>天</small></div>
                    <div class="home-dashboard-profile is-partner">
                        <div class="home-dashboard-avatar">${esc(partnerName.slice(0, 1))}</div>
                        <div><strong>${esc(partnerName)}</strong><span>TA现在 · ${esc(data.partnerMood)}</span></div>
                    </div>
                </div>
                <div class="home-dashboard-section-title">今天想做什么</div>
                <div class="home-dashboard-actions">
                    <button type="button" data-dashboard-action="together"><i class="fas fa-heartbeat"></i><span>陪伴</span><small>一起学习 / 工作</small></button>
                    <button type="button" data-dashboard-action="space"><i class="fas fa-images"></i><span>共同空间</span><small>相册 / 日记 / 纪念日</small></button>
                    <button type="button" data-dashboard-action="moments"><i class="fas fa-camera-retro"></i><span>朋友圈</span><small>记录今天的小事</small></button>
                    <button type="button" data-dashboard-action="games"><i class="fas fa-gamepad"></i><span>游戏</span><small>轻松玩一局</small></button>
                    <button type="button" data-dashboard-action="survey"><i class="fas fa-clipboard-list"></i><span>关系问卷</span><small>记录今天的需要</small></button>
                    <button type="button" data-dashboard-action="extras"><i class="fas fa-gift"></i><span>红包与链接</span><small>心意 / 分享 / 问答</small></button>
                    <button type="button" data-dashboard-action="heartflow"><i class="fas fa-link"></i><span>心流链接</span><small>看看连接状态</small></button>
                </div>
                <div class="home-dashboard-section-title">更新今天的状态</div>
                <div class="home-dashboard-moods">
                    <select id="dashboard-my-mood" aria-label="我的状态">${moodOptions.map(function (item) { return '<option' + (item === data.myMood ? ' selected' : '') + '>' + item + '</option>'; }).join('')}</select>
                    <span>↔</span>
                    <select id="dashboard-partner-mood" aria-label="对方状态">${moodOptions.map(function (item) { return '<option' + (item === data.partnerMood ? ' selected' : '') + '>' + item + '</option>'; }).join('')}</select>
                    <button type="button" data-dashboard-action="save-mood">保存</button>
                </div>
                <button type="button" class="home-dashboard-chat-link" data-dashboard-action="chat"><i class="fas fa-comment-dots"></i> 回到聊天，给 ${esc(partnerName)} 发一句话</button>
            </div>`;
        modal.querySelectorAll('[data-dashboard-action]').forEach(function (button) {
            button.addEventListener('click', function () {
                var action = button.getAttribute('data-dashboard-action');
                if (action === 'close') close();
                else if (action === 'save-mood') {
                    data.myMood = document.getElementById('dashboard-my-mood').value;
                    data.partnerMood = document.getElementById('dashboard-partner-mood').value;
                    save();
                    render();
                    if (typeof showNotification === 'function') showNotification('今天的状态已保存', 'success');
                } else openTarget(action);
            });
        });
    }

    function close() {
        var modal = document.getElementById('home-dashboard-modal');
        if (!modal) return;
        modal.classList.remove('is-visible');
        setTimeout(function () { modal.remove(); }, 220);
    }

    window.openHomeDashboard = function () {
        load();
        var old = document.getElementById('home-dashboard-modal');
        if (old) old.remove();
        var modal = document.createElement('div');
        modal.id = 'home-dashboard-modal';
        modal.className = 'home-dashboard-modal';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
        render();
        requestAnimationFrame(function () { modal.classList.add('is-visible'); });
    };
})();
