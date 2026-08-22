/**
 * moments.js - 朋友圈功能
 * 功能：发文字/图片、更换朋友圈背景、个性签名、双方互相留言
 * 存储：localforage + getStorageKey（与 extras.js 相同 session）
 */

let momData = {
    posts: [],       // {id, type:'text'|'image'|'both', text, images:[dataURL], from:'me'|'partner',
                     //  time, likes:[from], comments:[{id, from, text, time}]}
    background: null, // URL or null
    signature: '',    // 个性签名，显示在名片位置
    myMomentsName: null,   // 我的昵称（null=默认）
    partnerMomentsName: null, // 对方昵称
    myMomentsAvatar: null,
    partnerMomentsAvatar: null,
    likes: [],       // 兼容字段
};
let momLoaded = false;
let momModal = null;

/* 数据持久化 */
async function momLoad() {
    if (momLoaded) return;
    let saved = null;
    try {
        if (typeof getStorageKey === 'function') {
            saved = await localforage.getItem(getStorageKey('momentsData'));
        }
    } catch(e) {}
    if (!saved) {
        try {
            const raw = localStorage.getItem('moments_data_fallback');
            if (raw) saved = JSON.parse(raw);
        } catch(_) {}
    }
    if (saved) Object.assign(momData, saved);
    if (!Array.isArray(momData.posts)) momData.posts = [];
    momLoaded = true;
    // 第一次使用发一条示例欢迎
    if (momData.posts.length === 0) {
        momData.posts.push({
            id: 'm_welcome', type:'text',
            text:'开通朋友圈啦 🎉 欢迎光临～\n记录每一天的小美好！',
            images: [], from:'me', time: new Date().toISOString(),
            likes: [{from:'partner'}],
            comments: [{id:'c_0', from:'partner', text:'撒花！我来啦～', time: new Date().toISOString()}]
        });
        momSave();
    }
}
function momSave() {
    try {
        if (typeof getStorageKey === 'function')
            localforage.setItem(getStorageKey('momentsData'), momData).catch(()=>{});
    } catch(_) {}
    try {
        // 轻量 fallback（图片转为缩略标记——图片可能很大，这里只做降级，图片主要靠 localforage）
        const lite = {
            ...momData,
            posts: momData.posts.map(p => ({...p, images: p.images ? '[array length '+p.images.length+']' : []}))
        };
        localStorage.setItem('moments_data_fallback', JSON.stringify(lite));
    } catch(_) {}
}

/* 名字/头像辅助 */
function momMyName() {
    if (momData.myMomentsName) return momData.myMomentsName;
    try { return (typeof settings !== 'undefined' && settings.myName) || '我'; }
    catch(e) { return '我'; }
}
function momPartnerName() {
    if (momData.partnerMomentsName) return momData.partnerMomentsName;
    try { return (typeof settings !== 'undefined' && (settings.partnerName || settings.contactName)) || '对方'; }
    catch(e) { return '对方'; }
}
function momMyAvatar() {
    if (momData.myMomentsAvatar) return momData.myMomentsAvatar;
    try { return (typeof settings !== 'undefined' && settings.myAvatar) || null; }
    catch(e) { return null; }
}
function momPartnerAvatar() {
    if (momData.partnerMomentsAvatar) return momData.partnerMomentsAvatar;
    try { return (typeof settings !== 'undefined' && settings.partnerAvatar) || null; }
    catch(e) { return null; }
}
function momAvatarHtml(avatar, fallbackEmoji, size) {
    const s = size || '40px';
    const img = avatar ? `<img src="${avatar}" style="width:${s};height:${s};border-radius:50%;object-fit:cover;">`
                       : `<div style="width:${s};height:${s};border-radius:50%;background:var(--secondary-bg);display:flex;align-items:center;justify-content:center;font-size:18px;">${fallbackEmoji}</div>`;
    return img;
}
function momEscape(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function momFmt(d) {
    const dt = new Date(d);
    const now = new Date();
    const diff = (now - dt) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff/60) + '分钟前';
    if (diff < 86400) return Math.floor(diff/3600) + '小时前';
    if (diff < 86400*7) return Math.floor(diff/86400) + '天前';
    const p = x => String(x).padStart(2,'0');
    return `${dt.getFullYear()}/${p(dt.getMonth()+1)}/${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

/* ============ 公开入口：打开朋友圈 ============ */
window.openMoments = async function() {
    await momLoad();
    // 创建或复用 Modal
    if (!momModal) {
        momModal = document.createElement('div');
        momModal.id = 'moments-modal';
        momModal.className = 'modal';
        momModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
        document.body.appendChild(momModal);
    }
    momRender();
    if (typeof showModal === 'function') showModal(momModal);
    else momModal.style.display = 'block';
};

function momClose() {
    if (!momModal) return;
    if (typeof hideModal === 'function') hideModal(momModal);
    else momModal.style.display = 'none';
}

/* ============ 渲染主页 ============ */
function momRender() {
    if (!momModal) return;
    const bgStyle = momData.background
        ? `background-image:url('${momData.background}');background-size:cover;background-position:center;`
        : 'background:linear-gradient(135deg,#c5a47e,#e8d0a6,#f4a261);';
    const sig = momData.signature || '什么都没留下…';
    momModal.innerHTML = `
        <div class="modal-content" style="max-width:560px;margin:30px auto;border-radius:18px;overflow:hidden;position:relative;max-height:92vh;display:flex;flex-direction:column;">
            <div id="mom-header" style="position:relative;height:200px;${bgStyle};cursor:pointer;" onclick="document.getElementById('mom-bg-file').click()">
                <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.35));"></div>
                <button onclick="momClose();event.stopPropagation();" style="position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,0.4);color:#fff;border:none;font-size:18px;cursor:pointer;z-index:5;">×</button>
                <div style="position:absolute;right:14px;bottom:14px;display:flex;align-items:flex-end;gap:10px;z-index:3;">
                    <div style="color:#fff;font-size:15px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.5);padding-bottom:12px;text-align:right;">
                        <div>${momEscape(momMyName())}</div>
                        <div style="font-size:11px;font-weight:400;opacity:0.9;margin-top:4px;">${momEscape(sig)}</div>
                    </div>
                    ${momAvatarHtml(momMyAvatar(), '🧑', '64px')}
                </div>
                <div style="position:absolute;left:12px;top:12px;color:rgba(255,255,255,0.9);font-size:10px;background:rgba(0,0,0,0.35);padding:4px 8px;border-radius:10px;z-index:4;">
                    📸 点击封面更换背景
                </div>
                <input type="file" id="mom-bg-file" accept="image/*" style="display:none" onchange="momBgUpload(this)">
            </div>
            <div style="flex:1;overflow:auto;background:var(--primary-bg);">
                <!-- 工具栏 -->
                <div style="position:sticky;top:0;background:var(--primary-bg);z-index:2;padding:10px 14px;border-bottom:1px solid var(--border-color);display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                    <button onclick="momNewPost()" style="flex:1;padding:8px 12px;border-radius:10px;border:1px dashed var(--accent-color);background:rgba(var(--accent-color-rgb,197,164,126),0.08);color:var(--accent-color);cursor:pointer;font-size:12px;font-weight:600;">✨ 发动态</button>
                    <button onclick="momShowProfile()" style="padding:8px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;font-size:11px;">🛠 资料设置</button>
                    <button onclick="momPartnerPostExample()" style="padding:8px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;font-size:11px;" title="模拟对方发一条">🤖 模拟对方</button>
                </div>
                <div id="mom-feed" style="padding:12px 14px 30px;"></div>
            </div>
        </div>`;
    momRenderFeed();
}
function momBgUpload(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { momData.background = r.result; momSave(); momRender();
        if (typeof showNotification === 'function') showNotification('封面已更新', 'success');
    };
    r.readAsDataURL(f);
    input.value = '';
}

/* ============ 资料设置 ============ */
function momShowProfile() {
    if (!momModal) return;
    const body = momModal.querySelector('#mom-feed')?.parentElement;
    const parent = momModal.querySelector('.modal-content');
    parent.innerHTML = parent.innerHTML; // no-op，我们另起 modal 内的编辑层
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;background:var(--primary-bg);z-index:10;border-radius:18px;padding:14px;overflow:auto;';
    overlay.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:15px;font-weight:700;color:var(--text-primary);">🛠 朋友圈资料</div>
            <button onclick="this.closest('[style*=position]').remove();" style="padding:6px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;">返回</button>
        </div>
        <div style="background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;margin-bottom:12px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">📝 个性签名</div>
            <input id="mom-sig" type="text" maxlength="40" value="${momEscape(momData.signature)}" placeholder="留一句话在朋友圈封面"
                style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:8px;background:var(--primary-bg);color:var(--text-primary);">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div style="background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">我的昵称</div>
                <input id="mom-myn" type="text" maxlength="12" value="${momEscape(momMyName())}"
                    style="width:100%;padding:7px;border:1px solid var(--border-color);border-radius:8px;background:var(--primary-bg);color:var(--text-primary);margin-bottom:8px;">
                <div onclick="document.getElementById('mom-mya-file').click();cursor:pointer;"
                    style="display:flex;align-items:center;gap:10px;">
                    ${momAvatarHtml(momMyAvatar(), '🧑', '44px')}
                    <span style="font-size:11px;color:var(--text-secondary);">点击修改头像</span>
                </div>
                <input type="file" accept="image/*" id="mom-mya-file" style="display:none" onchange="momAvUpload(this,'my')">
            </div>
            <div style="background:var(--secondary-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px;">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">对方昵称</div>
                <input id="mom-pn" type="text" maxlength="12" value="${momEscape(momPartnerName())}"
                    style="width:100%;padding:7px;border:1px solid var(--border-color);border-radius:8px;background:var(--primary-bg);color:var(--text-primary);margin-bottom:8px;">
                <div onclick="document.getElementById('mom-pa-file').click();cursor:pointer;"
                    style="display:flex;align-items:center;gap:10px;">
                    ${momAvatarHtml(momPartnerAvatar(), '🧸', '44px')}
                    <span style="font-size:11px;color:var(--text-secondary);">点击修改头像</span>
                </div>
                <input type="file" accept="image/*" id="mom-pa-file" style="display:none" onchange="momAvUpload(this,'partner')">
            </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:14px;">
            <button class="ex-primary-btn" style="flex:1;padding:9px 12px;font-size:12px;border-radius:10px;" onclick="momSaveProfile()">💾 保存资料</button>
            <button onclick="momClearAll()" style="flex:1;padding:9px 12px;font-size:12px;border-radius:10px;background:#fff;color:#ff6b6b;border:1px solid #ff6b6b;cursor:pointer;">🗑 清空动态</button>
        </div>
        <div style="background:rgba(var(--accent-color-rgb,197,164,126),0.07);border:1px dashed var(--accent-color);border-radius:12px;padding:12px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">💡 说明</div>
            <div style="font-size:11px;line-height:1.7;color:var(--text-primary);">
                · 发动态支持文字+图片，点击封面可换背景<br>
                · 你和对方都能发、都能点赞/留言<br>
                · 点击"模拟对方"可看到对方视角的动态
            </div>
        </div>
    `;
    momModal.querySelector('.modal-content').appendChild(overlay);
}
window.momAvUpload = function(input, who) {
    const f = input.files && input.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
        if (who === 'my') momData.myMomentsAvatar = r.result;
        else momData.partnerMomentsAvatar = r.result;
        momSave();
        if (typeof showNotification === 'function') showNotification('头像已更新，点击保存以永久生效', 'info');
        // 立刻刷新编辑层显示
        const profileLayer = momModal.querySelector('[style*="position\\:absolute"]');
        if (profileLayer) profileLayer.remove();
        momShowProfile();
    };
    r.readAsDataURL(f);
    input.value = '';
};
window.momSaveProfile = function() {
    const sig = document.getElementById('mom-sig');
    const myn = document.getElementById('mom-myn');
    const pn = document.getElementById('mom-pn');
    if (sig) momData.signature = sig.value.trim();
    if (myn) momData.myMomentsName = myn.value.trim() || null;
    if (pn) momData.partnerMomentsName = pn.value.trim() || null;
    momSave();
    // 若存在编辑层则移除并刷新
    const profileLayer = momModal.querySelector('[style*="position\\:absolute"]');
    if (profileLayer) profileLayer.remove();
    momRender();
    if (typeof showNotification === 'function') showNotification('资料已更新 ✓', 'success');
};
window.momClearAll = function() {
    if (!confirm('清空朋友圈所有动态？')) return;
    momData.posts = [];
    momSave();
    momRender();
    if (typeof showNotification === 'function') showNotification('动态已清空', 'success');
};

/* ============ 发动态 ============ */
let momNewImages = [];
window.momNewPost = function() {
    momNewImages = [];
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;background:var(--primary-bg);z-index:10;border-radius:18px;padding:14px;overflow:auto;';
    overlay.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:15px;font-weight:700;color:var(--text-primary);">✨ 发朋友圈</div>
            <button onclick="this.closest('[style*=position]').remove();momNewImages=[];" style="padding:6px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--secondary-bg);color:var(--text-secondary);cursor:pointer;">取消</button>
        </div>
        <textarea id="mom-new-text" rows="5" placeholder="此刻的想法..."
            style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--secondary-bg);color:var(--text-primary);font-size:13px;resize:vertical;"></textarea>
        <div id="mom-new-imgs" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0;"></div>
        <div style="margin-bottom:12px;">
            <button onclick="document.getElementById('mom-new-imgfile').click()" style="padding:8px 14px;border-radius:10px;border:1px dashed var(--accent-color);background:rgba(var(--accent-color-rgb,197,164,126),0.06);color:var(--accent-color);cursor:pointer;font-size:12px;">📷 上传图片（支持多张）</button>
            <input type="file" id="mom-new-imgfile" accept="image/*" multiple style="display:none" onchange="momAddNewImages(this)">
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:11px;color:var(--text-secondary);">发布身份：</div>
            <div style="display:flex;gap:6px;">
                <button id="mom-from-me" onclick="momSetFrom('me')" style="padding:6px 12px;border-radius:10px;background:var(--accent-color);color:#fff;border:none;cursor:pointer;font-size:12px;">我发</button>
                <button id="mom-from-p" onclick="momSetFrom('partner')" style="padding:6px 12px;border-radius:10px;background:var(--secondary-bg);color:var(--text-secondary);border:1px solid var(--border-color);cursor:pointer;font-size:12px;">对方发</button>
            </div>
        </div>
        <button onclick="momPublish()" style="width:100%;padding:10px;border-radius:12px;background:var(--accent-color);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:13px;">📤 发布</button>
    `;
    momModal.querySelector('.modal-content').appendChild(overlay);
    window._momFrom = 'me';
};
window.momAddNewImages = function(input) {
    if (!input.files) return;
    const files = Array.from(input.files);
    let done = 0;
    const grid = document.getElementById('mom-new-imgs');
    files.forEach(f => {
        const r = new FileReader();
        r.onload = () => {
            momNewImages.push(r.result);
            if (grid) {
                const div = document.createElement('div');
                div.style.cssText = 'aspect-ratio:1/1;border-radius:8px;overflow:hidden;position:relative;';
                div.innerHTML = `<img src="${r.result}" style="width:100%;height:100%;object-fit:cover;">
                    <button onclick="this.parentElement.remove();const idx=momNewImages.indexOf('${r.result}');if(idx>=0)momNewImages.splice(idx,1);" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:12px;cursor:pointer;">×</button>`;
                grid.appendChild(div);
            }
            done++;
        };
        r.readAsDataURL(f);
    });
    input.value = '';
};
window.momSetFrom = function(who) {
    window._momFrom = who;
    const me = document.getElementById('mom-from-me');
    const p = document.getElementById('mom-from-p');
    if (me) { me.style.background = who==='me' ? 'var(--accent-color)' : 'var(--secondary-bg)';
             me.style.color = who==='me' ? '#fff' : 'var(--text-secondary)';
             me.style.border = who==='me' ? 'none' : '1px solid var(--border-color)'; }
    if (p) { p.style.background = who==='partner' ? 'var(--accent-color)' : 'var(--secondary-bg)';
            p.style.color = who==='partner' ? '#fff' : 'var(--text-secondary)';
            p.style.border = who==='partner' ? 'none' : '1px solid var(--border-color)'; }
};
window.momPublish = function() {
    const text = document.getElementById('mom-new-text')?.value || '';
    const images = momNewImages.slice();
    if (!text.trim() && images.length === 0) {
        if (typeof showNotification === 'function') showNotification('写点什么或加张图片吧', 'warning');
        return;
    }
    const from = window._momFrom || 'me';
    const post = {
        id: 'm_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        type: text && images.length ? 'both' : (images.length ? 'image' : 'text'),
        text: text.trim(),
        images,
        from,
        time: new Date().toISOString(),
        likes: [],
        comments: []
    };
    momData.posts.unshift(post);
    if (momData.posts.length > 500) momData.posts.length = 500;
    momSave();
    momNewImages = [];
    const layer = momModal.querySelector('[style*="position\\:absolute"]');
    if (layer) layer.remove();
    momRender();
    if (typeof showNotification === 'function') showNotification('已发布 ✓', 'success');
};

/* ============ 模拟对方发动态 ============ */
window.momPartnerPostExample = function() {
    const samples = [
        {text:'今天天气真好，适合想你 ☀️🌷', images:false},
        {text:'加班到现在…希望Ta不要等急了 🌙', images:false},
        {text:'晚饭吃了Ta最讨厌的香菜，拍一张气气Ta 😝', images:false},
        {text:'偷偷买了礼物，期待见面那天 🎁', images:false},
        {text:'今天喝了一点点奶茶 🧋 三分糖，是你喜欢的口味', images:false},
    ];
    const s = samples[Math.floor(Math.random()*samples.length)];
    const post = {
        id: 'm_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        type: 'text', text: s.text, images: [],
        from:'partner', time:new Date().toISOString(),
        likes: [], comments: []
    };
    momData.posts.unshift(post);
    momSave();
    momRender();
    if (typeof showNotification === 'function') showNotification(`${momPartnerName()} 发了一条朋友圈 💫`, 'success', 3000);
};

/* ============ 渲染动态列表 ============ */
function momRenderFeed() {
    const feed = document.getElementById('mom-feed');
    if (!feed) return;
    if (!momData.posts.length) {
        feed.innerHTML = `<div style="text-align:center;padding:50px 20px;color:var(--text-secondary);font-size:12px;">还没有动态，点上面「✨ 发动态」开始吧～</div>`;
        return;
    }
    feed.innerHTML = momData.posts.map(p => {
        const isMe = p.from === 'me';
        const name = isMe ? momMyName() : momPartnerName();
        const avatar = isMe ? momMyAvatar() : momPartnerAvatar();
        const fallbackEmoji = isMe ? '🧑' : '🧸';
        const imgs = p.images && p.images.length ? `
            <div style="display:grid;grid-template-columns:repeat(${Math.min(p.images.length,3)},1fr);gap:6px;margin-top:8px;">
                ${p.images.map(src => `<img src="${src}" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;cursor:pointer;" onclick="momViewImage('${src.replace(/'/g,"\\'")}')">`).join('')}
            </div>` : '';
        const likedMe = p.likes.some(l => l.from === 'me');
        const likedP  = p.likes.some(l => l.from === 'partner');
        const likers = [];
        if (likedMe) likers.push(momMyName());
        if (likedP) likers.push(momPartnerName());
        const likeHtml = likers.length
            ? `<div style="background:var(--secondary-bg);border-radius:8px;padding:6px 8px;margin-top:8px;font-size:11px;color:var(--text-secondary);">❤️ ${likers.map(x=>momEscape(x)).join('、')}</div>`
            : '';
        const commentsHtml = p.comments && p.comments.length
            ? `<div style="background:var(--secondary-bg);border-radius:8px;padding:6px 8px;margin-top:6px;">
                ${p.comments.map(c => `
                <div style="display:flex;gap:6px;font-size:11px;line-height:1.6;">
                    <span style="color:#0984e3;font-weight:600;flex-shrink:0;">${momEscape(c.from==='me'?momMyName():momPartnerName())}:</span>
                    <span style="color:var(--text-primary);word-break:break-word;">${momEscape(c.text)}</span>
                </div>`).join('')}
            </div>` : '';
        return `
        <div style="padding:14px 0;border-bottom:1px solid var(--border-color);">
            <div style="display:flex;gap:10px;">
                ${momAvatarHtml(avatar, fallbackEmoji, '40px')}
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${momEscape(name)}</div>
                        <button onclick="momDelPost('${p.id}')" style="font-size:10px;color:var(--text-secondary);background:none;border:none;cursor:pointer;padding:4px 6px;">🗑</button>
                    </div>
                    <div style="font-size:10px;color:var(--text-secondary);margin:2px 0 6px;">${momFmt(p.time)}</div>
                    ${p.text ? `<div style="font-size:13px;line-height:1.7;color:var(--text-primary);white-space:pre-wrap;word-break:break-word;">${momEscape(p.text)}</div>` : ''}
                    ${imgs}
                    ${likeHtml}
                    ${commentsHtml}
                    <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">
                        <button onclick="momToggleLike('${p.id}')" style="padding:5px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--primary-bg);color:${likedMe?'var(--accent-color)':'var(--text-secondary)'};cursor:pointer;font-size:11px;">
                            ${likedMe?'❤️':'🤍'} 赞
                        </button>
                        <button onclick="momShowComment('${p.id}')" style="padding:5px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--primary-bg);color:var(--text-secondary);cursor:pointer;font-size:11px;">
                            💬 留言
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}
window.momToggleLike = function(id) {
    const p = momData.posts.find(x => x.id === id);
    if (!p) return;
    const idx = p.likes.findIndex(l => l.from === 'me');
    if (idx >= 0) p.likes.splice(idx, 1);
    else p.likes.push({ from:'me', time: new Date().toISOString() });
    // 对方 60% 概率也赞
    if (idx < 0 && !p.likes.some(l=>l.from==='partner') && Math.random() < 0.6) {
        setTimeout(() => {
            if (!p.likes.some(l=>l.from==='partner')) {
                p.likes.push({from:'partner', time:new Date().toISOString()});
                momSave(); momRenderFeed();
                if (typeof showNotification === 'function') showNotification(`${momPartnerName()} 也赞了一下 💕`, 'info', 2500);
            }
        }, 1500 + Math.random()*2000);
    }
    momSave(); momRenderFeed();
};
window.momDelPost = function(id) {
    if (!confirm('删除这条动态？')) return;
    momData.posts = momData.posts.filter(p => p.id !== id);
    momSave(); momRenderFeed();
};
window.momShowComment = function(id) {
    const text = prompt('写留言：');
    if (!text || !text.trim()) return;
    const p = momData.posts.find(x => x.id === id);
    if (!p) return;
    p.comments.push({ id: 'c_'+Date.now(), from:'me', text:text.trim(), time: new Date().toISOString() });
    momSave(); momRenderFeed();
    // 对方 50% 概率回一条留言
    if (Math.random() < 0.5) {
        setTimeout(() => {
            const replies = ['哈哈哈哈 我认同！','可爱 💗','我来凑热闹～','嗯嗯，有道理','+1'];
            p.comments.push({ id: 'c_'+Date.now()+'r', from:'partner',
                text: replies[Math.floor(Math.random()*replies.length)], time: new Date().toISOString() });
            momSave(); momRenderFeed();
        }, 2000 + Math.random()*2500);
    }
};
window.momViewImage = function(src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:500;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px;';
    overlay.onclick = () => overlay.remove();
    overlay.innerHTML = `<img src="${src}" style="max-width:100%;max-height:100%;border-radius:10px;object-fit:contain;">`;
    document.body.appendChild(overlay);
};

/* ============ 绑定主页按钮（如有 moments-btn） ============ */
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const btn = document.getElementById('moments-btn');
        if (btn) btn.addEventListener('click', () => window.openMoments());
    }, 1200);
});
