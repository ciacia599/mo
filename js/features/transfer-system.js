/* transfer-system.js - 显化 / 转移 / OC 设计
 * 所有内容只保存在当前浏览器，可导入导出 JSON。
 */
(function () {
    const STORAGE_KEY = 'transferSystemData';
    const OC_KEY = 'ocDesignerData';
    const TEMPLATES = {
        manifestation: { name: '显化模板', subtitle: '把想要的生活写得更清楚', fields: ['intention', 'affirmation', 'action'] },
        shifting: { name: '转移模板', subtitle: '整理想去的世界与脚本', fields: ['destination', 'script', 'safeWord'] },
        blank: { name: '自由模板', subtitle: '从一张空白纸开始', fields: ['free'] }
    };
    const sections = [
        ['reality', '当前现实', '记录此刻的生活、状态与需要'],
        ['desired', '想去的世界', '描述目标世界与抵达后的生活'],
        ['visited', '去过的世界', '记录曾经体验过的世界'],
        ['shop', '商店', '收藏想带走的物品、资源与兑换想法'],
        ['wardrobe', '衣橱', '整理角色服装、配饰和外观'],
        ['skills', '技能', '记录拥有或想学习的能力'],
        ['characters', '人物设定', '角色姓名、性格、身份与关系'],
        ['world', '世界设定', '时代、规则、地点与世界观'],
        ['harvest', '收获本', '记录显化或转移后的收获'],
        ['checkin', '打卡', '记录今天是否完成练习或整理']
    ];
    const defaultData = {
        mode: 'manifestation',
        template: 'manifestation',
        intention: '', affirmation: '', action: '', destination: '', script: '', safeWord: '', free: '',
        reality: '', desired: '', visited: '', shop: '', wardrobe: '', skills: '', characters: '', world: '',
        harvest: [], checkin: []
    };
    const defaultOC = { character: '', world: '', relationships: '' };
    let data = Object.assign({}, defaultData);
    let ocData = Object.assign({}, defaultOC);
    let modal = null;

    function load() {
        try { data = Object.assign({}, defaultData, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch (e) {}
        try { ocData = Object.assign({}, defaultOC, JSON.parse(localStorage.getItem(OC_KEY) || '{}')); } catch (e) {}
    }
    function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
    function saveOC() { try { localStorage.setItem(OC_KEY, JSON.stringify(ocData)); } catch (e) {} }
    function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function notify(text, type) { if (typeof showNotification === 'function') showNotification(text, type || 'success'); }
    function ensureModal() {
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'transfer-system-modal';
        modal.className = 'modal';
        modal.innerHTML = '<div class="modal-content transfer-system-content"><div id="transfer-system-body"></div></div>';
        modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
        document.body.appendChild(modal);
        return modal;
    }
    function close() { if (modal && typeof hideModal === 'function') hideModal(modal); else if (modal) modal.style.display = 'none'; }
    function open() { load(); ensureModal(); render(); if (typeof showModal === 'function') showModal(modal); else modal.style.display = 'flex'; }
    function header(title, subtitle) {
        return `<div class="transfer-system-header"><div><div class="transfer-system-kicker">PRIVATE WORLDS</div><h2>${title}</h2><p>${subtitle}</p></div><button class="transfer-system-close" onclick="window.closeTransferSystem()">×</button></div>`;
    }
    function textarea(id, label, value, placeholder) {
        return `<label class="transfer-field"><span>${label}</span><textarea id="${id}" placeholder="${placeholder || ''}">${esc(value)}</textarea></label>`;
    }
    function render() {
        const body = document.getElementById('transfer-system-body');
        if (!body) return;
        const t = TEMPLATES[data.template] || TEMPLATES.manifestation;
        body.innerHTML = `${header(data.mode === 'oc' ? 'OC 设计' : '转移系统', data.mode === 'oc' ? '建立属于你的角色与世界关系' : '显化与转移的私人工作台')}
            <div class="transfer-tabs">
                <button class="${data.mode === 'manifestation' ? 'active' : ''}" onclick="window.transferSetMode('manifestation')">✨ 显化</button>
                <button class="${data.mode === 'shifting' ? 'active' : ''}" onclick="window.transferSetMode('shifting')">🌙 转移</button>
                <button class="${data.mode === 'oc' ? 'active' : ''}" onclick="window.openOCDesigner()">🪐 OC设计</button>
            </div>
            ${data.mode === 'oc' ? renderOC() : renderTransfer(t)}`;
        bindForm();
    }
    function renderTransfer(template) {
        return `<div class="transfer-template-row"><span>当前模板：<b>${template.name}</b></span><select id="transfer-template">${Object.keys(TEMPLATES).map(k => `<option value="${k}" ${data.template === k ? 'selected' : ''}>${TEMPLATES[k].name}</option>`).join('')}</select></div>
            <div class="transfer-template-desc">${template.subtitle}</div>
            <div class="transfer-highlight">${data.mode === 'manifestation' ? '把愿望拆成可感知的意图、肯定句和行动。' : '只记录你愿意记录的内容，保持清醒、舒适和可退出。'}</div>
            ${data.mode === 'manifestation' ? textarea('transfer-intention', '我想要的生活', data.intention, '写下你想靠近的状态…') : textarea('transfer-destination', '想去的世界', data.destination, '世界名称、时代、地点…')}
            ${data.mode === 'manifestation' ? textarea('transfer-affirmation', '给自己的话', data.affirmation, '一句今天可以相信的话…') : textarea('transfer-script', '世界脚本', data.script, '人物、规则、日常和你想体验的片段…')}
            ${data.mode === 'manifestation' ? textarea('transfer-action', '今天可以做的一步', data.action, '一个很小、可完成的动作…') : textarea('transfer-safe-word', '安全设置 / 返回方式', data.safeWord, '写下你的边界、退出方式和照顾自己的安排…')}
            <div class="transfer-section-grid">${sections.map(item => `<button type="button" onclick="window.transferEditSection('${item[0]}')"><strong>${item[1]}</strong><small>${item[2]}</small></button>`).join('')}</div>
            <div class="transfer-actions"><button class="secondary" onclick="window.transferImport()">导入文件</button><button class="secondary" onclick="window.transferExport()">导出文件</button><button class="primary" onclick="window.transferSave()">保存当前模板</button></div>`;
    }
    function renderOC() {
        return `<div class="transfer-oc-intro">人物设计、世界观和人物关系可以分开写，也可以慢慢补全。所有内容均可再次修改。</div>
            ${textarea('oc-character', '人物设计', ocData.character, '姓名、外貌、性格、身份、能力、经历…')}
            ${textarea('oc-world', '世界观', ocData.world, '时代、地理、规则、组织、文化、冲突…')}
            ${textarea('oc-relationships', '人物关系', ocData.relationships, '人物之间的关系、称呼、共同经历和变化…')}
            <div class="transfer-actions"><button class="secondary" onclick="window.ocImport()">导入 OC</button><button class="secondary" onclick="window.ocExport()">导出 OC</button><button class="primary" onclick="window.ocSave()">保存 OC 设定</button></div>`;
    }
    function bindForm() {
        const select = document.getElementById('transfer-template');
        if (select) select.onchange = function () { data.template = this.value; render(); };
    }
    function collectTransfer() {
        const values = { intention: 'transfer-intention', affirmation: 'transfer-affirmation', action: 'transfer-action', destination: 'transfer-destination', script: 'transfer-script', safeWord: 'transfer-safe-word' };
        Object.keys(values).forEach(key => { const el = document.getElementById(values[key]); if (el) data[key] = el.value; });
    }
    window.transferSetMode = function (mode) { collectTransfer(); data.mode = mode; render(); };
    window.openTransferSystem = open;
    window.closeTransferSystem = close;
    window.openOCDesigner = function () { load(); data.mode = 'oc'; ensureModal(); render(); if (typeof showModal === 'function') showModal(modal); else modal.style.display = 'flex'; };
    window.transferSave = function () { collectTransfer(); save(); notify('当前模板已保存'); };
    window.ocSave = function () { const a = document.getElementById('oc-character'); const b = document.getElementById('oc-world'); const c = document.getElementById('oc-relationships'); if (a) ocData.character = a.value; if (b) ocData.world = b.value; if (c) ocData.relationships = c.value; saveOC(); notify('OC 设定已保存'); };
    window.transferEditSection = function (key) {
        collectTransfer();
        const item = sections.find(x => x[0] === key);
        if (!item) return;
        const value = Array.isArray(data[key]) ? data[key].map(x => x.text || '').join('\n') : (data[key] || '');
        const body = document.getElementById('transfer-system-body');
        body.innerHTML = `${header(item[1], item[2])}${textarea('transfer-section-value', item[1], value, '把内容写在这里…')}
            <div class="transfer-actions"><button class="secondary" onclick="window.transferBack()">返回系统</button><button class="primary" onclick="window.transferSaveSection('${key}')">保存这一栏</button></div>`;
    };
    window.transferBack = function () { render(); };
    window.transferSaveSection = function (key) {
        const input = document.getElementById('transfer-section-value');
        if (!input) return;
        if (key === 'harvest' || key === 'checkin') {
            const lines = input.value.split('\n').map(x => x.trim()).filter(Boolean);
            data[key] = lines.map(text => ({ text, time: new Date().toISOString() }));
        } else data[key] = input.value;
        save(); render(); notify('内容已保存');
    };
    function download(name, object) {
        const blob = new Blob([JSON.stringify(object, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    }
    window.transferExport = function () { collectTransfer(); save(); download('transfer-system.json', data); };
    window.ocExport = function () { window.ocSave(); download('oc-design.json', ocData); };
    function importFile(callback) { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = function () { const file = input.files && input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function () { try { callback(JSON.parse(reader.result)); } catch (e) { notify('文件格式无法读取', 'error'); } }; reader.readAsText(file); }; input.click(); }
    window.transferImport = function () { importFile(function (incoming) { data = Object.assign({}, defaultData, incoming); save(); render(); notify('转移系统已导入'); }); };
    window.ocImport = function () { importFile(function (incoming) { ocData = Object.assign({}, defaultOC, incoming); saveOC(); render(); notify('OC 设定已导入'); }); };
})();
