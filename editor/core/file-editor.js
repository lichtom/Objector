/**
 * 文件编辑器模块 - 管理扩展文件的新建/编辑/保存/加载
 * 使用 CodeMirror 提供语法高亮
 */
const FileEditor = (function () {
  let currentFile = null;
  let files = [];
  let _cmEditor = null;  // CodeMirror 实例

  /** 获取 extensions 目录路径 */
  function getExtensionsDir() {
    if (!EditorState.projectPath) return null;
    return EditorState.projectPath + '/extensions';
  }

  /** 根据文件名获取 CodeMirror mode */
  function _getCmMode(fname) {
    if (!fname) return 'javascript';
    if (fname.endsWith('.py')) return 'python';
    if (fname.endsWith('.json')) return { name: 'javascript', json: true };
    return 'javascript';
  }

  /** 获取编辑器内容 */
  function _getEditorContent() {
    if (_cmEditor) return _cmEditor.getValue();
    const fallback = document.getElementById('file-editor-fallback');
    if (fallback) return fallback.value;
    return '';
  }

  /** 设置编辑器内容并切换语法模式 */
  function _setEditorContent(content, fname) {
    if (_cmEditor) {
      _cmEditor.setOption('mode', _getCmMode(fname));
      _cmEditor.setValue(content || '');
      // 延迟 refresh 确保 CodeMirror 正确渲染
      setTimeout(() => _cmEditor && _cmEditor.refresh(), 50);
    } else {
      const fallback = document.getElementById('file-editor-fallback');
      if (fallback) fallback.value = content || '';
    }
  }

  /** 刷新文件列表 */
  async function refreshFileList() {
    const dir = getExtensionsDir();
    if (!dir) return;

    const listEl = document.getElementById('file-list');
    if (!listEl) return;

    // 确保目录存在
    await window.api.ensureDir(dir);

    // 读取目录
    const entries = await window.api.listDir(dir);
    files = (entries || []).filter(f => f.endsWith('.js') || f.endsWith('.json') || f.endsWith('.py'));

    listEl.innerHTML = '';
    files.forEach(fname => {
      const item = document.createElement('div');
      item.className = 'file-item' + (currentFile === fname ? ' active' : '');

      const nameEl = document.createElement('span');
      nameEl.className = 'file-item-name';
      nameEl.textContent = fname;
      nameEl.onclick = () => openFile(fname);

      const delEl = document.createElement('span');
      delEl.className = 'file-item-delete';
      delEl.textContent = '×';
      delEl.onclick = (e) => { e.stopPropagation(); deleteFile(fname); };

      item.appendChild(nameEl);
      item.appendChild(delEl);
      listEl.appendChild(item);
    });
  }

  /** 打开文件 */
  async function openFile(fname) {
    const dir = getExtensionsDir();
    if (!dir) return;

    const content = await window.api.readFile(dir + '/' + fname);
    if (content === null) return;

    currentFile = fname;
    _setEditorContent(content, fname);
    refreshFileList();
  }

  /** 显示文件名输入对话框 */
  function showFilenameDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box" style="max-width:360px;text-align:left;">
          <h2 style="text-align:center;">新建文件</h2>
          <p style="text-align:center;">输入文件名（以 .js / .json / .py 结尾）</p>
          <input id="filename-input" type="text" placeholder="my-extension.js"
            style="width:100%;padding:8px 12px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius);font-size:14px;outline:none;margin-bottom:16px;" />
          <div class="dialog-actions">
            <button id="fname-ok" class="tb-btn tb-run" style="flex:1;">确定</button>
            <button id="fname-cancel" class="tb-btn" style="flex:1;">取消</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#filename-input');
      const okBtn = overlay.querySelector('#fname-ok');
      const cancelBtn = overlay.querySelector('#fname-cancel');

      input.focus();

      function close(val) {
        document.body.removeChild(overlay);
        resolve(val || null);
      }

      okBtn.addEventListener('click', () => close(input.value.trim()));
      cancelBtn.addEventListener('click', () => close(null));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') close(input.value.trim());
        if (e.key === 'Escape') close(null);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(null);
      });
    });
  }

  /** 新建文件 */
  async function createFile() {
    const fname = await showFilenameDialog();
    if (!fname) return;

    // 验证文件名
    if (!fname.endsWith('.js') && !fname.endsWith('.json') && !fname.endsWith('.py')) {
      alert(i18n.isEnglish()
        ? 'File name must end with .js, .json or .py'
        : '文件名必须以 .js / .json / .py 结尾');
      return;
    }

    const dir = getExtensionsDir();
    if (!dir) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    // 确保目录存在
    await window.api.ensureDir(dir);

    // 检查是否已存在
    const existing = await window.api.readFile(dir + '/' + fname);
    if (existing !== null) {
      if (!confirm(i18n.isEnglish() ? 'File exists, overwrite?' : '文件已存在，是否覆盖？')) return;
    }

    // 创建模板内容
    let content = '';
    if (fname.endsWith('.json')) {
      content = JSON.stringify({
        name: fname.replace('.json', ''),
        version: '1.0.0',
        blocks: []
      }, null, 2);
    } else if (fname.endsWith('.py')) {
      content = pyExtTemplate(fname.replace(/\.py$/i, ''));
    } else {
      content = '/**\n * Extension: ' + fname + '\n */\n\n// Write extension code here\n';
    }

    console.log('[FileEditor] 创建文件:', dir + '/' + fname);
    const result = await window.api.writeFile(dir + '/' + fname, content);
    console.log('[FileEditor] 写入结果:', result);
    if (result && result.error) {
      alert((i18n.isEnglish() ? 'File creation failed: ' : '文件创建失败: ') + result.error);
      return;
    }

    currentFile = fname;
    _setEditorContent(content, fname);
    document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'File created: ' : '文件已创建: ') + fname;
    await refreshFileList();

    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

  /** 保存当前文件 */
  async function saveFile() {
    if (!currentFile) {
      alert(i18n.isEnglish() ? 'Please select or create a file first' : '请先选择或新建一个文件');
      return;
    }

    const dir = getExtensionsDir();
    if (!dir) return;

    const content = _getEditorContent();
    await window.api.writeFile(dir + '/' + currentFile, content);
    document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'File saved: ' : '文件已保存: ') + currentFile;
    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

  /** 删除文件 */
  async function deleteFile(fname) {
    if (!confirm(i18n.isEnglish() ? 'Delete file ' + fname + '?' : '确定删除文件 ' + fname + '？')) return;

    const dir = getExtensionsDir();
    if (!dir) return;

    await window.api.deleteFile(dir + '/' + fname);
    if (currentFile === fname) {
      currentFile = null;
      _setEditorContent('', null);
    }
    await refreshFileList();
  }

  /** 加载测试（加载当前项目的扩展） */
  async function loadTest() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    // 先保存当前文件
    if (currentFile) {
      await saveFile();
    }

    // 调用扩展管理器加载
    const count = await ExtensionManager.loadFromProject(EditorState.projectPath);
    if (count > 0) {
      Palette.init();
      document.getElementById('status-text').textContent = i18n.isEnglish() ? `Loaded ${count} extension(s)` : `已加载 ${count} 个扩展`;
    } else {
      document.getElementById('status-text').textContent = i18n.isEnglish() ? 'No extension files found' : '未找到可扩展文件';
    }
    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

  /** 生成 Python 扩展文件模板（先 def 执行函数, 最后 register_extension） */
  function pyExtTemplate(name) {
    const extId = String(name).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_?\d.*$/, 'ext_$&') || 'py_extension';
    return [
      '# Objector 扩展开发 · Python',
      '# 积木执行器用 def 编写, register_extension 必须写在所有 def 之后',
      '# 执行器接收两个 dict: params（积木参数）与 scope（执行上下文）, 返回值即 reporter 结果',
      '# 可直接调用的舞台 API: say show hide move turn_right goto_xy set_x get_x get_var set_var ...',
      '',
      'def ext_say(params, scope):',
      '    say(params["text"])',
      '    print("扩展被调用: " + str(params["text"]))',
      '',
      'def ext_add(params, scope):',
      '    return params["a"] + params["b"]',
      '',
      'register_extension({',
      '    "id": "' + extId + '",',
      '    "name": "' + name + '",',
      '    "color": "#FF6B6B",',
      '    "blocks": [',
      '        {',
      '            "type": "ext_say", "label": "说 {text}", "shape": "stack",',
      '            "params": [ {"name": "text", "type": "string", "default": "你好"} ],',
      '            "code_exp": { "python": "say_it", "ALB": "say_it", "JavaScript": "sayIt" },',
      '        },',
      '        {',
      '            "type": "ext_add", "label": "{a} 加 {b}", "shape": "reporter",',
      '            "params": [',
      '                {"name": "a", "type": "number", "default": 1},',
      '                {"name": "b", "type": "number", "default": 1},',
      '            ],',
      '        },',
      '    ],',
      '    "executors": {',
      '        "ext_say": ext_say,',
      '        "ext_add": ext_add,',
      '    },',
      '})',
      '',
    ].join('\n');
  }

  /** 初始化 CodeMirror 编辑器 */
  function _initCmEditor() {
    const container = document.getElementById('ext-file-cm-editor');
    if (!container || _cmEditor) return;
    if (typeof CodeMirror === 'undefined') {
      console.warn('[FileEditor] CodeMirror 未加载，回退到 textarea');
      // 回退：创建带样式的 textarea
      if (!container.querySelector('textarea')) {
        const ta = document.createElement('textarea');
        ta.id = 'file-editor-fallback';
        ta.placeholder = '选择或新建文件开始编辑...';
        ta.spellcheck = false;
        ta.style.cssText = 'width:100%;height:100%;background:#212121;color:#eeffff;border:none;resize:none;padding:12px;font-family:Cascadia Code,Consolas,monospace;font-size:13px;line-height:1.6;outline:none;tab-size:4;';
        container.appendChild(ta);
      }
      return;
    }

    try {
      _cmEditor = CodeMirror(container, {
        mode: 'javascript',
        theme: 'material-darker',
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        autoCloseBrackets: true,
        matchBrackets: true,
        extraKeys: {
          'Ctrl-S': () => saveFile(),
          'Cmd-S': () => saveFile(),
          'Tab': (cm) => {
            if (cm.somethingSelected()) {
              cm.indentSelection('add');
            } else {
              cm.replaceSelection('    ', 'end');
            }
          },
          'Shift-Tab': (cm) => cm.indentSelection('subtract'),
        },
        value: '// 选择或新建文件开始编辑...\n',
      });
      console.log('[FileEditor] CodeMirror 初始化成功');
    } catch(e) {
      console.error('[FileEditor] CodeMirror 初始化失败:', e);
    }
  }

  /** 初始化（绑定按钮事件） */
  function init() {
    const newBtn = document.getElementById('btn-file-editor-new');
    const saveBtn = document.getElementById('btn-save-file');
    const loadBtn = document.getElementById('btn-load-test');
    const closeBtn = document.getElementById('btn-ext-file-editor-close');
    const openBtn = document.getElementById('btn-ext-file-editor');

    if (newBtn) newBtn.addEventListener('click', createFile);
    if (saveBtn) saveBtn.addEventListener('click', saveFile);
    if (loadBtn) loadBtn.addEventListener('click', loadTest);
    if (closeBtn) closeBtn.addEventListener('click', hideOverlay);
    if (openBtn) openBtn.addEventListener('click', toggleOverlay);
  }

  /** 切换文件编辑器覆盖层（再点一下关闭） */
  function toggleOverlay() {
    const overlay = document.getElementById('ext-file-editor-overlay');
    if (!overlay) return;
    if (overlay.classList.contains('hidden')) {
      showOverlay();
    } else {
      hideOverlay();
    }
  }

  /** 显示文件编辑器覆盖层 */
  function showOverlay() {
    const overlay = document.getElementById('ext-file-editor-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      // 按钮高亮
      const btn = document.getElementById('btn-ext-file-editor');
      if (btn) btn.classList.add('tb-btn-active');
      // 延迟初始化 CodeMirror（确保容器可见后再创建）
      setTimeout(() => {
        _initCmEditor();
        if (_cmEditor) _cmEditor.refresh();
        refreshFileList();
      }, 50);
    }
  }

  /** 隐藏文件编辑器覆盖层 */
  function hideOverlay() {
    const overlay = document.getElementById('ext-file-editor-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      const btn = document.getElementById('btn-ext-file-editor');
      if (btn) btn.classList.remove('tb-btn-active');
    }
  }

  return { init, refreshFileList, openFile, createFile, saveFile, pyExtTemplate, showOverlay, hideOverlay, toggleOverlay };
})();
