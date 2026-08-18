/* ============================================================
 * space.js — 共同空间（动态/相册/心情手账/纪念日/电影院）
 * 依赖全局：localforage, getStorageKey, showNotification, playSound, addMessage
 * 暴露：window.openSpaceCenter, window.initSpace
 * 引入方式：在 index.html 中添加：
 *   <script src="js/features/space.js?v=1"></script>
 * ============================================================ */

/* ======================== 数据与存储 ======================== */
let spData = {
    moments: [],       // 动态 {id, author, text, image, video, time, likes:[], comments:[]}
    album: [],         // 相册 {id, url, time, caption}
    diary: [],         // 心情手账 {id, mood, text, time}
    memorials: [],    // 纪念日 {id, title, date, repeat:'yearly'|'once'}
    cinema: {          // 电影院
        plans: [],    // 约看计划 {id, title, videoUrl, videoType:'local'|'bilibili', scheduledAt, status:'pending'|'watching'|'done'}
        history: [],
        currentVideo: null, // 当前正在看的 {url, type, title, startedAt}
        chat: [],     // 边看边聊的聊天 {id, from, text, time}
    },
};
let spDataLoaded = false;

async function spLoadData() {
    if (spDataLoaded) return;
    try {
        const key = getStorageKey('spaceData');
        const saved = await localforage.getItem(key);
        if (saved && typeof saved === 'object') spData = Object.assign({}, spData, saved);
    } catch (e) {
        try {
            const raw = localStorage.getItem('space_spaceData');
            if (raw) spData = Object.assign({}, spData, JSON.parse(raw));
        } catch (e2) {}
    }
    spDataLoaded = true;
}

function spSaveData() {
    try { localforage.setItem(getStorageKey('spaceData'), spData); }
    catch (e) { try { localStorage.setItem('space_spaceData', JSON.stringify(spData)); } catch (e2) {} }
}

/* ======================== 主入口 ======================== */
let spModal = null;

async function openSpaceCenter() {
    await spLoadData();
    const existing = document.getElementById('sp-modal');
    if (existing) { existing.remove(); }

    const modal = document.createElement('div');
    modal.id = 'sp-modal';
    modal.className = 'modal';
    modal.style.zIndex = '9200';
    modal.innerHTML = `<div class="modal-content" style="max-width:520px;padding:0;overflow:hidden;" id="sp-modal-inner"></div>`;
    document.body.appendChild(modal);
    spModal = modal;
    modal.addEventListener('click', (e) => { if (e.target === modal) spClose(); });
    spRenderHub();
    // 关键修复：调用全局 showModal() 才会真正把 modal 从 display:none → display:flex
    try { if (typeof showModal === 'function') showModal(modal); else modal.style.display = 'flex'; } catch (_) { modal.style.display = 'flex'; }
}

window.openSpaceCenter = openSpaceCenter;

function spClose() {
    if (!spModal) return;
    try { if (typeof hideModal === 'function') hideModal(spModal); else spModal.style.display = 'none'; } catch (_) { spModal.style.display = 'none'; }
    const toRemove = spModal;
    setTimeout(() => { try { toRemove.remove(); } catch(_) {} if (spModal === toRemove) spModal = null; }, 320);
}

function spSetBody(html) {
    const inner = document.getElementById('sp-modal-inner');
    if (inner) inner.innerHTML = html;
}

function spHeader(title, sub) {
    return `
        <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:linear-gradient(135deg,#a8edea 0%,#fed6e3 100%);">
            <button onclick="spBackToHub()" style="background:rgba(255,255,255,0.3);border:none;color:#333;width:28px;height:28px;border-radius:50%;cursor:pointer;">←</button>
            <div style="flex:1;">
                <div style="font-size:16px;font-weight:700;color:#333;">${title}</div>
                ${sub ? `<div style="font-size:11px;color:#555;">${sub}</div>` : ''}
            </div>
        </div>`;
}

/* 主页：5 大模块 */
function spRenderHub() {
    const items = [
        { key: 'moments', icon: '📰', name: '动态', desc: '文字/照片/视频', color: '#FF6B9D', bg: 'linear-gradient(135deg,#FF6B9D,#FEC163)' },
        { key: 'album',   icon: '🖼️', name: '相册', desc: '共同回忆', color: '#A29BFE', bg: 'linear-gradient(135deg,#A29BFE,#6C5CE7)' },
        { key: 'diary',   icon: '📔', name: '心情手账', desc: '记录情绪', color: '#FFD93D', bg: 'linear-gradient(135deg,#FFD93D,#FF9A8B)' },
        { key: 'memorial',icon: '💝', name: '纪念日', desc: '倒计时', color: '#FF6B6B', bg: 'linear-gradient(135deg,#FF6B6B,#EE5A6F)' },
        { key: 'cinema',  icon: '🎬', name: '电影院', desc: '边看边聊', color: '#00B894', bg: 'linear-gradient(135deg,#00B894,#00CEC9)' },
    ];
    spSetBody(`
        <div style="padding:24px 18px 22px;background:linear-gradient(135deg,#a8edea 0%,#fed6e3 100%);color:#333;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:20px;font-weight:700;">✨ 我们的空间</div>
                    <div style="font-size:11px;opacity:0.85;margin-top:2px;">共同的生活画卷</div>
                </div>
                <button onclick="spClose()" style="background:rgba(255,255,255,0.4);border:none;color:#333;width:30px;height:30px;border-radius:50%;cursor:pointer;">✕</button>
            </div>
        </div>
        <div style="padding:18px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                ${items.slice(0,4).map(it => `
                    <div onclick="spOpen('${it.key}')" style="background:${it.bg};border-radius:14px;padding:14px;color:#fff;cursor:pointer;min-height:80px;display:flex;flex-direction:column;justify-content:space-between;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <div style="font-size:26px;">${it.icon}</div>
                        <div>
                            <div style="font-size:13px;font-weight:700;">${it.name}</div>
                            <div style="font-size:10px;opacity:0.9;">${it.desc}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <!-- 电影院占整行 -->
            <div onclick="spOpen('cinema')" style="background:${items[4].bg};border-radius:14px;padding:18px;color:#fff;cursor:pointer;display:flex;align-items:center;gap:14px;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                <div style="font-size:36px;">${items[4].icon}</div>
                <div style="flex:1;">
                    <div style="font-size:15px;font-weight:700;">${items[4].name}</div>
                    <div style="font-size:11px;opacity:0.9;margin-top:2px;">边看边聊 · ${spData.cinema.history.length}部已看 · ${spData.cinema.plans.length}个待约</div>
                </div>
                <div style="font-size:14px;opacity:0.7;">›</div>
            </div>
        </div>
    `);
}

window.spBackToHub = spRenderHub;

function spOpen(key) {
    if (typeof playSound === 'function') playSound('mood');
    const map = { moments: spViewMoments, album: spViewAlbum, diary: spViewDiary, memorial: spViewMemorial, cinema: spViewCinema };
    if (map[key]) map[key]();
}
window.spOpen = spOpen;

/* ======================== 1. 动态 ======================== */
function spViewMoments() {
    spSetBody(spHeader('📰 动态', `共 ${spData.moments.length} 条`) + `
        <div style="padding:14px;">
            <button onclick="spNewMoment()" class="ex-primary-btn" style="width:100%;margin-bottom:14px;">✏️ 发动态</button>
            <div id="sp-moments-list"></div>
        </div>
    `);
    spRenderMomentsList();
}

function spRenderMomentsList() {
    const el = document.getElementById('sp-moments-list');
    if (!el) return;
    if (!spData.moments.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:20px;">还没有动态，发一条吧～</div>`;
        return;
    }
    el.innerHTML = spData.moments.slice().reverse().map(m => {
        const isMe = m.author === 'me';
        const liked = m.likes && m.likes.includes('me');
        return `
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px 14px;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="font-size:18px;">${isMe ? '👤' : '💕'}</span>
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary);">${isMe ? '我' : 'Ta'}</span>
                    <span style="font-size:10px;color:var(--text-secondary);margin-left:auto;">${new Date(m.time).toLocaleString('zh-CN').slice(5,17)}</span>
                </div>
                ${m.text ? `<div style="font-size:13px;color:var(--text-primary);line-height:1.6;margin-bottom:8px;white-space:pre-wrap;">${spEscape(m.text)}</div>` : ''}
                ${m.image ? `<img src="${m.image}" style="max-width:100%;border-radius:10px;margin-bottom:8px;max-height:300px;object-fit:cover;" onclick="viewImage('${m.image}')">` : ''}
                ${m.video ? `<video src="${m.video}" controls style="max-width:100%;border-radius:10px;margin-bottom:8px;max-height:300px;"></video>` : ''}
                <div style="display:flex;gap:14px;font-size:12px;color:var(--text-secondary);border-top:1px solid var(--border-color);padding-top:8px;">
                    <span onclick="spToggleLike('${m.id}')" style="cursor:pointer;${liked?'color:#FF6B6B;font-weight:600;':''}">${liked?'❤️':'🤍'} ${m.likes ? m.likes.length : 0}</span>
                    <span onclick="spToggleComment('${m.id}')" style="cursor:pointer;">💬 ${m.comments ? m.comments.length : 0}</span>
                </div>
                <div id="sp-comments-${m.id}" style="display:none;margin-top:8px;border-top:1px solid var(--border-color);padding-top:8px;">
                    ${(m.comments||[]).map(c => `<div style="font-size:12px;margin-bottom:6px;"><b>${c.from==='me'?'我':'Ta'}:</b> ${spEscape(c.text)}</div>`).join('')}
                    <div style="display:flex;gap:6px;margin-top:6px;">
                        <input id="sp-cmt-input-${m.id}" placeholder="评论..." style="flex:1;padding:6px;border:1px solid var(--border-color);border-radius:6px;background:var(--secondary-bg);color:var(--text-primary);font-size:12px;">
                        <button onclick="spAddComment('${m.id}')" class="ex-quick-btn">发送</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

window.spNewMoment = function() {
    spSetBody(spHeader('✏️ 发动态', '记录这一刻') + `
        <div style="padding:14px;">
            <textarea id="sp-moment-text" placeholder="此刻的心情..." style="width:100%;min-height:80px;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button onclick="document.getElementById('sp-moment-img').click()" class="ex-quick-btn" style="flex:1;">🖼 添加图片</button>
                <button onclick="document.getElementById('sp-moment-video').click()" class="ex-quick-btn" style="flex:1;">🎬 添加视频</button>
            </div>
            <input id="sp-moment-img" type="file" accept="image/*" style="display:none;" onchange="spPreviewFile(this,'img')">
            <input id="sp-moment-video" type="file" accept="video/*" style="display:none;" onchange="spPreviewFile(this,'video')">
            <div id="sp-moment-preview" style="margin-top:10px;"></div>
            <button onclick="spSaveMoment()" class="ex-primary-btn" style="width:100%;margin-top:14px;">📤 发布动态</button>
        </div>
    `);
};

window.spPreviewFile = function(input, type) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const prev = document.getElementById('sp-moment-preview');
        if (!prev) return;
        prev.innerHTML = type === 'img'
            ? `<img src="${e.target.result}" style="max-width:100%;max-height:200px;border-radius:8px;">`
            : `<video src="${e.target.result}" controls style="max-width:100%;max-height:200px;border-radius:8px;"></video>`;
        prev.dataset.url = e.target.result;
        prev.dataset.type = type;
    };
    reader.readAsDataURL(file);
};

window.spSaveMoment = function() {
    const text = document.getElementById('sp-moment-text').value.trim();
    const prev = document.getElementById('sp-moment-preview');
    const url = prev?.dataset.url || null;
    if (!text && !url) { if (typeof showNotification==='function') showNotification('请输入内容或添加图片/视频', 'warning'); return; }
    const m = { id:'mo_'+Date.now(), author:'me', text, image: prev?.dataset.type==='img'?url:null, video: prev?.dataset.type==='video'?url:null, time:new Date().toISOString(), likes:[], comments:[] };
    spData.moments.push(m);
    spSaveData();
    if (typeof showNotification==='function') showNotification('动态已发布', 'success');
    if (typeof addMessage === 'function') addMessage({ id:Date.now(), sender:'user', text:`[动态] ${text || '发布了一张图片'}`, timestamp:new Date(), status:'sent', type:'normal' });
    spViewMoments();
};

window.spToggleLike = function(id) {
    const m = spData.moments.find(x => x.id === id);
    if (!m) return;
    if (!m.likes) m.likes = [];
    const idx = m.likes.indexOf('me');
    if (idx >= 0) m.likes.splice(idx, 1);
    else { m.likes.push('me'); if (typeof playSound==='function') playSound('favorite'); }
    spSaveData();
    spRenderMomentsList();
};

window.spToggleComment = function(id) {
    const el = document.getElementById('sp-comments-' + id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.spAddComment = function(id) {
    const input = document.getElementById('sp-cmt-input-' + id);
    if (!input || !input.value.trim()) return;
    const m = spData.moments.find(x => x.id === id);
    if (!m) return;
    if (!m.comments) m.comments = [];
    m.comments.push({ id:'c_'+Date.now(), from:'me', text: input.value.trim(), time:new Date().toISOString() });
    input.value = '';
    spSaveData();
    spRenderMomentsList();
    // 确保展开
    const el = document.getElementById('sp-comments-' + id);
    if (el) el.style.display = 'block';
};

/* ======================== 2. 相册 ======================== */
function spViewAlbum() {
    spSetBody(spHeader('🖼️ 相册', `共 ${spData.album.length} 张`) + `
        <div style="padding:14px;">
            <button onclick="document.getElementById('sp-album-upload').click()" class="ex-primary-btn" style="width:100%;margin-bottom:14px;">📤 上传照片</button>
            <input id="sp-album-upload" type="file" accept="image/*" multiple style="display:none;" onchange="spUploadAlbum(this)">
            <div id="sp-album-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;"></div>
        </div>
    `);
    spRenderAlbum();
}

function spRenderAlbum() {
    const el = document.getElementById('sp-album-grid');
    if (!el) return;
    if (!spData.album.length) {
        el.innerHTML = `<div style="grid-column:span 3;font-size:12px;color:var(--text-secondary);text-align:center;padding:20px;">还没有照片</div>`;
        return;
    }
    el.innerHTML = spData.album.slice().reverse().map(a => `
        <div style="position:relative;cursor:pointer;" onclick="viewImage('${a.url}')">
            <img src="${a.url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;">
            ${a.caption ? `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:#fff;font-size:9px;padding:8px 6px 4px;border-radius:0 0 8px 8px;">${spEscape(a.caption)}</div>` : ''}
        </div>
    `).join('');
}

window.spUploadAlbum = function(input) {
    const files = Array.from(input.files);
    if (!files.length) return;
    let processed = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            spData.album.push({ id:'al_'+Date.now()+'_'+processed, url: e.target.result, time:new Date().toISOString(), caption:'' });
            processed++;
            if (processed === files.length) {
                spSaveData();
                spRenderAlbum();
                if (typeof showNotification==='function') showNotification(`上传了 ${files.length} 张照片`, 'success');
            }
        };
        reader.readAsDataURL(file);
    });
};

/* ======================== 3. 心情手账 ======================== */
const SP_MOODS = [
    { key:'happy', emoji:'😊', name:'开心', color:'#FFD93D' },
    { key:'love',  emoji:'😍', name:'甜蜜', color:'#FF6B9D' },
    { key:'calm',  emoji:'😌', name:'平静', color:'#6BCB77' },
    { key:'sad',   emoji:'😢', name:'难过', color:'#74C0FC' },
    { key:'angry', emoji:'😤', name:'生气', color:'#FF6B6B' },
    { key:'tired', emoji:'😩', name:'疲惫', color:'#A29BFE' },
];

function spViewDiary() {
    spSetBody(spHeader('📔 心情手账', `共 ${spData.diary.length} 篇`) + `
        <div style="padding:14px;">
            <button onclick="spNewDiary()" class="ex-primary-btn" style="width:100%;margin-bottom:14px;">✏️ 写一篇</button>
            <div id="sp-diary-list"></div>
        </div>
    `);
    spRenderDiary();
}

function spRenderDiary() {
    const el = document.getElementById('sp-diary-list');
    if (!el) return;
    if (!spData.diary.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:20px;">还没有手账，写下今天的心情吧～</div>`;
        return;
    }
    el.innerHTML = spData.diary.slice().reverse().map(d => {
        const mood = SP_MOODS.find(m => m.key === d.mood) || SP_MOODS[0];
        return `
            <div style="background:var(--primary-bg);border-left:4px solid ${mood.color};border-radius:0 12px 12px 0;padding:12px 14px;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="font-size:24px;">${mood.emoji}</span>
                    <span style="font-size:13px;font-weight:600;color:${mood.color};">${mood.name}</span>
                    <span style="font-size:10px;color:var(--text-secondary);margin-left:auto;">${new Date(d.time).toLocaleString('zh-CN').slice(5,17)}</span>
                </div>
                <div style="font-size:13px;color:var(--text-primary);line-height:1.6;white-space:pre-wrap;">${spEscape(d.text)}</div>
            </div>`;
    }).join('');
}

window.spNewDiary = function() {
    spSetBody(spHeader('✏️ 写心情', '记录此刻') + `
        <div style="padding:14px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">选择心情</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;" id="sp-mood-pick">
                ${SP_MOODS.map((m,i) => `<div onclick="document.querySelectorAll('#sp-mood-pick > div').forEach(x=>x.style.outline='none');this.style.outline='2px solid ${m.color}';window.spCurrentMood='${m.key}'" style="cursor:pointer;padding:8px 12px;border-radius:10px;background:${m.color}33;font-size:13px;${i===0?'outline:2px solid '+m.color+';':''}">${m.emoji} ${m.name}</div>`).join('')}
            </div>
            <textarea id="sp-diary-text" placeholder="今天发生了什么..." style="width:100%;min-height:120px;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;resize:vertical;font-family:inherit;"></textarea>
            <button onclick="spSaveDiary()" class="ex-primary-btn" style="width:100%;margin-top:14px;">💾 保存手账</button>
        </div>
    `);
    window.spCurrentMood = 'happy';
};

window.spSaveDiary = function() {
    const text = document.getElementById('sp-diary-text').value.trim();
    if (!text) { if (typeof showNotification==='function') showNotification('写点什么吧', 'warning'); return; }
    spData.diary.push({ id:'dy_'+Date.now(), mood: window.spCurrentMood || 'happy', text, time:new Date().toISOString() });
    spSaveData();
    if (typeof showNotification==='function') showNotification('手账已保存', 'success');
    spViewDiary();
};

/* ======================== 4. 纪念日 ======================== */
function spViewMemorial() {
    spSetBody(spHeader('💝 纪念日', `共 ${spData.memorials.length} 个`) + `
        <div style="padding:14px;">
            <button onclick="spNewMemorial()" class="ex-primary-btn" style="width:100%;margin-bottom:14px;">➕ 添加纪念日</button>
            <div id="sp-memorial-list"></div>
        </div>
    `);
    spRenderMemorial();
}

function spRenderMemorial() {
    const el = document.getElementById('sp-memorial-list');
    if (!el) return;
    if (!spData.memorials.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:20px;">还没有纪念日，添加一个吧～</div>`;
        return;
    }
    const now = new Date();
    el.innerHTML = spData.memorials.map(m => {
        const date = new Date(m.date);
        let target = new Date(now.getFullYear(), date.getMonth(), date.getDate());
        let diff = Math.ceil((target - now) / 86400000);
        if (diff < 0) {
            if (m.repeat === 'yearly') {
                target = new Date(now.getFullYear()+1, date.getMonth(), date.getDate());
                diff = Math.ceil((target - now) / 86400000);
            } else {
                diff = -diff; // 已过去多少天
            }
        }
        const isFuture = diff > 0;
        return `
            <div style="background:linear-gradient(135deg,#FF6B6B,#EE5A6F);color:#fff;border-radius:14px;padding:14px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:15px;font-weight:700;">${spEscape(m.title)}</div>
                        <div style="font-size:11px;opacity:0.9;margin-top:2px;">${date.toLocaleDateString('zh-CN')} ${m.repeat==='yearly'?'· 每年':''}</div>
                    </div>
                    <div style="text-align:center;background:rgba(255,255,255,0.2);border-radius:10px;padding:6px 12px;min-width:60px;">
                        <div style="font-size:18px;font-weight:700;">${Math.abs(diff)}</div>
                        <div style="font-size:9px;">${isFuture?'天后':'天前'}</div>
                    </div>
                </div>
                <button onclick="spDelMemorial('${m.id}')" style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:10px;padding:4px 8px;border-radius:6px;cursor:pointer;margin-top:6px;">删除</button>
            </div>`;
    }).join('');
}

window.spNewMemorial = function() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    spSetBody(spHeader('➕ 添加纪念日', '填写信息') + `
        <div style="padding:14px;">
            <div style="margin-bottom:14px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">纪念日名称</div>
                <input id="sp-mem-title" placeholder="如：在一起的日子" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;font-size:14px;">
            </div>
            <div style="margin-bottom:14px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">选择日期</div>
                <input id="sp-mem-date" type="date" value="${todayStr}" style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;font-size:14px;">
            </div>
            <div style="margin-bottom:18px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">重复方式</div>
                <div style="display:flex;gap:8px;">
                    <label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;border:1px solid var(--border-color);border-radius:10px;cursor:pointer;font-size:13px;color:var(--text-primary);justify-content:center;">
                        <input type="radio" name="sp-mem-repeat" value="yearly" checked style="accent-color:var(--accent-color);">
                        <span>每年重复</span>
                    </label>
                    <label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;border:1px solid var(--border-color);border-radius:10px;cursor:pointer;font-size:13px;color:var(--text-primary);justify-content:center;">
                        <input type="radio" name="sp-mem-repeat" value="once" style="accent-color:var(--accent-color);">
                        <span>仅一次</span>
                    </label>
                </div>
            </div>
            <button onclick="spSaveMemorial()" class="ex-primary-btn" style="width:100%;padding:12px;font-size:15px;">💾 保存纪念日</button>
        </div>
    `);
};

window.spSaveMemorial = function() {
    const title = document.getElementById('sp-mem-title').value.trim();
    const date = document.getElementById('sp-mem-date').value;
    const repeatEl = document.querySelector('input[name="sp-mem-repeat"]:checked');
    if (!title) { if (typeof showNotification==='function') showNotification('请填写纪念日名称', 'warning'); return; }
    if (!date) { if (typeof showNotification==='function') showNotification('请选择日期', 'warning'); return; }
    const d = new Date(date);
    if (isNaN(d.getTime())) { if (typeof showNotification==='function') showNotification('日期格式不正确', 'error'); return; }
    const repeat = repeatEl ? repeatEl.value : 'yearly';
    spData.memorials.push({ id:'me_'+Date.now(), title, date: d.toISOString(), repeat });
    spSaveData();
    if (typeof showNotification==='function') showNotification('纪念日已添加', 'success');
    spViewMemorial();
};

window.spDelMemorial = function(id) {
    if (!confirm('删除这个纪念日？')) return;
    spData.memorials = spData.memorials.filter(m => m.id !== id);
    spSaveData();
    spRenderMemorial();
};

/* ======================== 5. 电影院 ======================== */
function spViewCinema() {
    spSetBody(spHeader('🎬 电影院', `已看 ${spData.cinema.history.length} 部 · 待约 ${spData.cinema.plans.length} 个`) + `
        <div style="padding:14px;">
            <button onclick="spCinemaStart()" class="ex-primary-btn" style="width:100%;margin-bottom:14px;">▶ 立即开播</button>
            ${spData.cinema.currentVideo ? `
                <div style="background:var(--message-received-bg);border-radius:12px;padding:10px;margin-bottom:14px;text-align:center;font-size:12px;">
                    🎬 正在看: ${spEscape(spData.cinema.currentVideo.title || '未知')}
                    <button onclick="spCinemaStop()" class="ex-quick-btn" style="margin-left:8px;">结束</button>
                </div>` : ''}
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">📅 约看电影</div>
            <div id="sp-cinema-plans"></div>
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin:14px 0 8px;">📜 观影历史</div>
            <div id="sp-cinema-history"></div>
        </div>
    `);
    spRenderCinemaPlans();
    spRenderCinemaHistory();
}

function spRenderCinemaPlans() {
    const el = document.getElementById('sp-cinema-plans');
    if (!el) return;
    if (!spData.cinema.plans.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:8px;">暂无约看计划</div>`;
        return;
    }
    el.innerHTML = spData.cinema.plans.map(p => `
        <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:10px;padding:10px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:13px;font-weight:600;color:var(--text-primary);">🎬 ${spEscape(p.title)}</div>
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">⏰ ${new Date(p.scheduledAt).toLocaleString('zh-CN').slice(5,17)} · ${p.videoType==='bilibili'?'B站':'本地'}</div>
                </div>
                <button onclick="spCinemaStartPlan('${p.id}')" class="ex-quick-btn">开播</button>
            </div>
        </div>
    `).join('');
}

function spRenderCinemaHistory() {
    const el = document.getElementById('sp-cinema-history');
    if (!el) return;
    if (!spData.cinema.history.length) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);text-align:center;padding:8px;">暂无观影历史</div>`;
        return;
    }
    el.innerHTML = spData.cinema.history.slice().reverse().slice(0,10).map(h => `
        <div style="padding:6px 0;border-bottom:1px solid var(--border-color);font-size:12px;display:flex;justify-content:space-between;">
            <span style="color:var(--text-primary);">🎬 ${spEscape(h.title)}</span>
            <span style="color:var(--text-secondary);font-size:10px;">${new Date(h.watchedAt).toLocaleDateString('zh-CN').slice(5)}</span>
        </div>
    `).join('');
}

window.spCinemaStart = function() {
    spSetBody(spHeader('▶ 开播', '选择视频源') + `
        <div style="padding:14px;">
            <div style="background:var(--primary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:14px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">视频标题</div>
                <input id="sp-cinema-title" placeholder="如：我们的婚礼视频" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;margin-bottom:10px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">方式一：B站视频链接</div>
                <input id="sp-cinema-bili" placeholder="https://www.bilibili.com/video/BV..." style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);box-sizing:border-box;margin-bottom:10px;">
                <div style="font-size:12px;color:var(--text-secondary);margin:8px 0;">方式二：本地视频</div>
                <input id="sp-cinema-local" type="file" accept="video/*" style="font-size:12px;">
            </div>
            <div style="background:#FFF3E0;border:1px solid #FFE082;border-radius:10px;padding:10px;font-size:11px;color:#E65100;margin-bottom:14px;line-height:1.6;">
                💡 B站链接支持格式：<br>
                • https://www.bilibili.com/video/BVxxxxx<br>
                • https://b23.tv/xxxxx
            </div>
            <button onclick="spCinemaSaveStart()" class="ex-primary-btn" style="width:100%;">🎬 开始观看</button>
            <button onclick="spCinemaPlan()" class="ex-quick-btn" style="width:100%;margin-top:8px;">📅 约个时间一起看</button>
        </div>
    `);
};

window.spCinemaSaveStart = function() {
    const title = document.getElementById('sp-cinema-title').value.trim() || '未命名视频';
    const bili = document.getElementById('sp-cinema-bili').value.trim();
    const localFile = document.getElementById('sp-cinema-local').files[0];
    let videoUrl = null, videoType = null;
    if (bili) {
        // 验证 B 站链接
        if (!/bilibili\.com|b23\.tv/i.test(bili)) { if (typeof showNotification==='function') showNotification('请输入有效的B站链接', 'warning'); return; }
        videoUrl = bili; videoType = 'bilibili';
    } else if (localFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
            spCinemaDoStart(title, e.target.result, 'local');
        };
        reader.readAsDataURL(localFile);
        return;
    } else {
        if (typeof showNotification==='function') showNotification('请选择视频源', 'warning');
        return;
    }
    spCinemaDoStart(title, videoUrl, videoType);
};

function spCinemaDoStart(title, url, type) {
    spData.cinema.currentVideo = { title, url, type, startedAt: new Date().toISOString() };
    spData.cinema.chat = [];
    spSaveData();
    spCinemaPlayer(title, url, type);
}

window.spCinemaPlan = function() {
    const title = document.getElementById('sp-cinema-title').value.trim();
    const bili = document.getElementById('sp-cinema-bili').value.trim();
    const localFile = document.getElementById('sp-cinema-local').files[0];
    if (!title) { if (typeof showNotification==='function') showNotification('请先填视频标题', 'warning'); return; }
    let videoUrl = bili || '', videoType = bili ? 'bilibili' : 'local';
    const plan = { id:'cp_'+Date.now(), title, videoUrl, videoType, scheduledAt: new Date(Date.now() + 24*3600*1000).toISOString(), status:'pending' };
    // 本地文件约看：提示先选时间
    const t = prompt('约看时间（YYYY-MM-DD HH:MM），默认明天此时）', new Date(Date.now()+24*3600*1000).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}));
    if (!t) return;
    const d = new Date(t.replace(/(\d{4})\/(\d{2})\/(\d{2})/, '$1-$2-$3'));
    if (!isNaN(d.getTime())) plan.scheduledAt = d.toISOString();
    spData.cinema.plans.push(plan);
    spSaveData();
    if (typeof showNotification==='function') showNotification('已添加约看计划', 'success');
    spViewCinema();
};

window.spCinemaStartPlan = function(planId) {
    const p = spData.cinema.plans.find(x => x.id === planId);
    if (!p) return;
    spCinemaDoStart(p.title, p.videoUrl, p.videoType);
};

function spCinemaPlayer(title, url, type) {
    let videoHtml = '';
    if (type === 'bilibili') {
        // 提取 BV 号
        const match = url.match(/BV[\w]+/i) || url.match(/b23\.tv\/(\w+)/i);
        if (match) {
            const bv = match[0];
            videoHtml = `<iframe src="https://player.bilibili.com/player.html?bvid=${bv.replace('b23.tv/','')}&high_quality=1&danmaku=0" style="width:100%;height:240px;border:none;border-radius:10px;" allowfullscreen></iframe>`;
        } else {
            videoHtml = `<div style="padding:20px;text-align:center;background:var(--primary-bg);border-radius:10px;font-size:12px;color:var(--text-secondary);">无法解析B站链接<br><a href="${url}" target="_blank" style="color:var(--accent-color);">点此打开B站 ↗</a></div>`;
        }
    } else {
        videoHtml = `<video src="${url}" controls autoplay style="width:100%;max-height:240px;border-radius:10px;background:#000;"></video>`;
    }
    spSetBody(spHeader('🎬 ' + title, '边看边聊') + `
        <div style="padding:14px;">
            ${videoHtml}
            <div style="display:flex;align-items:center;gap:6px;margin-top:12px;font-size:12px;color:var(--text-secondary);">
                <span>💬 边看边聊</span>
                <span style="margin-left:auto;background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:10px;font-size:10px;">已同步</span>
            </div>
            <div id="sp-cinema-chat" style="background:var(--message-received-bg);border-radius:10px;padding:10px;max-height:200px;overflow-y:auto;margin-top:8px;font-size:12px;">
                ${(spData.cinema.chat||[]).map(c => `<div style="margin-bottom:6px;"><b style="color:${c.from==='me'?'var(--accent-color)':'#00B894'}">${c.from==='me'?'我':'Ta'}:</b> ${spEscape(c.text)}</div>`).join('') || '<div style="color:var(--text-secondary);text-align:center;padding:8px;">开始聊天吧～</div>'}
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;">
                <input id="sp-cinema-msg" placeholder="说点什么..." style="flex:1;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-primary);font-size:12px;" onkeydown="if(event.key==='Enter')spCinemaSendChat()">
                <button onclick="spCinemaSendChat()" class="ex-primary-btn" style="padding:8px 14px;font-size:12px;">发送</button>
            </div>
            <button onclick="spCinemaStop()" class="ex-quick-btn" style="width:100%;margin-top:10px;color:#E17055;">⏹ 结束观影</button>
        </div>
    `);
    // 滚动到底部
    const chat = document.getElementById('sp-cinema-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
}

window.spCinemaSendChat = function() {
    const input = document.getElementById('sp-cinema-msg');
    if (!input || !input.value.trim()) return;
    if (!spData.cinema.chat) spData.cinema.chat = [];
    spData.cinema.chat.push({ id:'cc_'+Date.now(), from:'me', text: input.value.trim(), time:new Date().toISOString() });
    input.value = '';
    spSaveData();
    // 重新渲染聊天区
    const chat = document.getElementById('sp-cinema-chat');
    if (chat) {
        chat.innerHTML = spData.cinema.chat.map(c => `<div style="margin-bottom:6px;"><b style="color:${c.from==='me'?'var(--accent-color)':'#00B894'}">${c.from==='me'?'我':'Ta'}:</b> ${spEscape(c.text)}</div>`).join('');
        chat.scrollTop = chat.scrollHeight;
    }
    // 模拟对方回复
    setTimeout(() => {
        const replies = ['哈哈这段太好笑了', '我也想看这个', '陪你看下去', '这个画面好美', '🥰', '你笑点真低～', '继续继续'];
        const r = replies[Math.floor(Math.random()*replies.length)];
        spData.cinema.chat.push({ id:'cc_'+Date.now(), from:'partner', text: r, time:new Date().toISOString() });
        spSaveData();
        const chat2 = document.getElementById('sp-cinema-chat');
        if (chat2) {
            chat2.innerHTML = spData.cinema.chat.map(c => `<div style="margin-bottom:6px;"><b style="color:${c.from==='me'?'var(--accent-color)':'#00B894'}">${c.from==='me'?'我':'Ta'}:</b> ${spEscape(c.text)}</div>`).join('');
            chat2.scrollTop = chat2.scrollHeight;
        }
    }, 1500 + Math.random()*2000);
};

window.spCinemaStop = function() {
    if (spData.cinema.currentVideo) {
        spData.cinema.history.push({ id:'ch_'+Date.now(), title: spData.cinema.currentVideo.title, watchedAt:new Date().toISOString(), type: spData.cinema.currentVideo.type });
        if (spData.cinema.history.length > 50) spData.cinema.history = spData.cinema.history.slice(-50);
    }
    spData.cinema.currentVideo = null;
    spData.cinema.chat = [];
    spSaveData();
    if (typeof showNotification==='function') showNotification('观影已结束', 'info');
    spViewCinema();
};

/* ======================== 工具 ======================== */
function spEscape(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
window.spEscape = spEscape;

/* ======================== 初始化 ======================== */
window.initSpace = async function() { await spLoadData(); };
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try { window.initSpace(); } catch(e) { console.warn('space 初始化失败', e); } }, 1000);
});
