/**
 * HTML 导出器 - 将项目转换为可独立运行的 HTML 文件
 */
const HtmlExporter = (function () {

  /** 生成可运行的 HTML */
  function generateHTML(projectName, blocksData, spritesData, extensionExecutors, extensionJsSources, exportSettings) {
    const blocks = JSON.stringify(blocksData);
    const sprites = JSON.stringify(spritesData || []);
    const extExecJSON = JSON.stringify(extensionExecutors || {});
    const extJsCode = (extensionJsSources || []).join('\n');
    const S = exportSettings || {};
    const touchControls = !!S.touchControls;
    const touchConfig = S.touchConfig || null;
    const joystickConfig = S.joystickConfig || null;
    const fullscreenBtn = S.fullscreenBtn !== false;
    const autoRun = !!S.autoRun;
    const showConsole = S.showConsole !== false;
    const gameTitle = S.title || projectName;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${gameTitle}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    html, body { width:100%; height:100%; overflow:hidden; background:#0a0a0f; font-family:'Segoe UI','Microsoft YaHei',sans-serif; user-select:none; -webkit-user-select:none; touch-action:none; }
    #game-container { position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#0a0a0f; touch-action:none; }
    #stage { background:#fff; border-radius:4px; cursor:crosshair; display:block; touch-action:none; }
    /* Top bar */
    #top-bar { position:absolute; top:0; left:0; right:0; height:40px; display:flex; align-items:center; justify-content:space-between; padding:0 12px; z-index:100; background:linear-gradient(to bottom, rgba(0,0,0,.6), transparent); pointer-events:none; }
    #top-bar > * { pointer-events:auto; }
    #game-title { color:#fff; font-size:14px; font-weight:600; text-shadow:0 1px 4px rgba(0,0,0,.8); opacity:.8; }
    #top-right-btns { display:flex; gap:6px; }
    .top-btn { width:32px; height:32px; border:none; border-radius:50%; background:rgba(255,255,255,.12); color:#fff; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); transition:background .15s; }
    .top-btn:hover { background:rgba(255,255,255,.25); }
    .top-btn:active { background:rgba(255,255,255,.35); }
    /* Control buttons */
    #game-controls { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; gap:8px; z-index:100; }
    .game-btn { background:rgba(255,255,255,.1); color:#cdd6f4; border:1px solid rgba(255,255,255,.15); border-radius:20px; padding:8px 20px; cursor:pointer; font-size:13px; backdrop-filter:blur(4px); transition:all .15s; }
    .game-btn:hover { background:rgba(255,255,255,.2); }
    .game-btn:active { transform:scale(.95); }
    .game-btn.run { background:rgba(76,175,80,.2); color:#a5d6a7; border-color:rgba(76,175,80,.3); }
    .game-btn.stop { background:rgba(244,67,54,.15); color:#ef9a9a; border-color:rgba(244,67,54,.25); }
    /* Touch controls */
    #touch-controls { position:absolute; bottom:0; left:0; right:0; top:0; pointer-events:none; z-index:90; display:none; }
    #touch-controls.active { display:block; }
    .touch-btn { position:absolute; pointer-events:auto; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; backdrop-filter:blur(2px); transition:background .1s, transform .1s; user-select:none; -webkit-user-select:none; cursor:pointer; }
    .touch-btn:active, .touch-btn.pressed { background:rgba(255,255,255,.35) !important; transform:scale(.92); }
    .touch-btn.has-texture { background-size:cover !important; background-position:center !important; }
    /* Joystick */
    .joystick { position:absolute; pointer-events:auto; z-index:95; touch-action:none; user-select:none; -webkit-user-select:none; }
    .joystick-base { position:relative; border-radius:50%; background:rgba(255,255,255,.06); border:2px solid rgba(255,255,255,.15); backdrop-filter:blur(2px); touch-action:none; }
    .joystick-knob { position:absolute; border-radius:50%; background:rgba(255,255,255,.2); border:1px solid rgba(255,255,255,.3); transition:none; }
    /* Output console (collapsible) */
    #output-wrap { position:absolute; bottom:0; left:0; right:0; z-index:80; transition:transform .25s; }
    #output-wrap.collapsed { transform:translateY(calc(100% - 28px)); }
    #output-toggle { height:28px; background:rgba(24,24,37,.9); border-top:1px solid rgba(255,255,255,.1); display:flex; align-items:center; padding:0 10px; cursor:pointer; color:#a6adc8; font-size:11px; gap:4px; }
    #output-toggle .arrow { transition:transform .2s; }
    #output-wrap.collapsed #output-toggle .arrow { transform:rotate(180deg); }
    #output { color:#a6adc8; font-family:'Cascadia Code','Consolas',monospace; font-size:11px; height:100px; overflow-y:auto; background:rgba(24,24,37,.95); padding:6px 10px; white-space:pre-wrap; backdrop-filter:blur(8px); }
    /* Mobile landscape forcing */
    #rotate-hint { display:none; position:fixed; inset:0; z-index:9999; background:#0a0a0f; color:#cdd6f4; flex-direction:column; align-items:center; justify-content:center; gap:16px; font-size:16px; text-align:center; }
    #rotate-hint .rotate-icon { font-size:48px; animation:rotateHint 2s ease-in-out infinite; }
    @keyframes rotateHint { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(90deg)} }
    html.is-portrait body {
      transform: rotate(90deg);
      transform-origin: 0 0;
      width: 100vh;
      height: 100vw;
      position: absolute;
      top: 0;
      left: 100%;
      overflow: hidden;
    }
    html.is-portrait #rotate-hint { display:none; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js" async onerror="console.warn('Three.js CDN load failed')"><\/script>
</head>
<body>
<div id="rotate-hint">
  <div class="rotate-icon">📱</div>
  <div>请旋转手机至横屏模式</div>
  <div style="font-size:12px;color:#6c7086;">Rotate to landscape mode</div>
</div>
<div id="game-container">
  <canvas id="stage" width="480" height="360"></canvas>
  <div id="top-bar">
    <span id="game-title">${gameTitle}</span>
    <div id="top-right-btns">
${fullscreenBtn ? '      <button class="top-btn" id="btn-fullscreen" title="\u5168\u5c4f">\u26F6</button>\n' : ''}      <button class="top-btn" id="btn-console-toggle" title="\u63a7\u5236\u53f0">\u2261</button>
    </div>
  </div>
  <div id="game-controls">
    <button class="game-btn run" onclick="startRun()">\u25B6 \u8fd0\u884c</button>
    <button class="game-btn stop" onclick="stopRun()">\u23F9 \u505c\u6b62</button>
  </div>
${touchControls ? (function() {
    var cfg = touchConfig || [
      {id:'up',label:'\u25B2',keyCode:'ArrowUp',x:8,y:28,size:42,shape:'rect',color:'#89b4fa',texture:''},
      {id:'down',label:'\u25BC',keyCode:'ArrowDown',x:8,y:5,size:42,shape:'rect',color:'#89b4fa',texture:''},
      {id:'left',label:'\u25C0',keyCode:'ArrowLeft',x:2,y:16,size:42,shape:'rect',color:'#89b4fa',texture:''},
      {id:'right',label:'\u25B6',keyCode:'ArrowRight',x:14,y:16,size:42,shape:'rect',color:'#89b4fa',texture:''},
      {id:'btn-a',label:'A',keyCode:'Space',x:88,y:18,size:52,shape:'circle',color:'#a6e3a1',texture:''},
      {id:'btn-b',label:'B',keyCode:'Enter',x:78,y:6,size:46,shape:'circle',color:'#f38ba8',texture:''}
    ];
    var btns = cfg.map(function(b) {
      var br = b.shape === 'circle' ? '50%' : '8px';
      var border = b.shape === 'circle' ? '2px solid '+b.color+'80' : '1px solid '+b.color+'80';
      var bg = b.texture ? '' : b.color+'20';
      var fs = Math.max(10, b.size * 0.35);
      var texCls = b.texture ? ' has-texture' : '';
      var texStyle = b.texture ? 'background-image:url('+b.texture+');' : '';
      return '<div class="touch-btn'+texCls+'" data-key="'+b.keyCode+'" style="left:'+b.x+'%;bottom:'+b.y+'%;width:'+b.size+'px;height:'+b.size+'px;border-radius:'+br+';border:'+border+';background:'+bg+';font-size:'+fs+'px;'+texStyle+'">'+(!b.texture ? b.label : '')+'</div>';
    }).join('\n    ');
    return '  <div id="touch-controls" class="active">\n    '+btns+'\n  </div>';
  })() : ''}
${joystickConfig ? (function() {
    var jc = joystickConfig;
    var sz = jc.size || 120;
    var knobSz = Math.round(sz * 0.38);
    var bColor = jc.color || '#89b4fa';
    return '  <div class="joystick" data-joystick style="left:'+jc.x+'%;bottom:'+jc.y+'%;width:'+sz+'px;height:'+sz+'px;transform:translate(-50%,50%);">\n' +
           '    <div class="joystick-base" style="width:'+sz+'px;height:'+sz+'px;border-color:'+bColor+'60;background:'+bColor+'10;">\n' +
           '      <div class="joystick-knob" style="width:'+knobSz+'px;height:'+knobSz+'px;left:'+(sz/2-knobSz/2)+'px;top:'+(sz/2-knobSz/2)+'px;background:'+bColor+'40;border-color:'+bColor+'80;"></div>\n' +
           '    </div>\n' +
           '  </div>';
  })() : ''}
${showConsole ? `  <div id="output-wrap">
    <div id="output-toggle" onclick="document.getElementById('output-wrap').classList.toggle('collapsed')">
      <span class="arrow">\u25BC</span> \u8F93\u51FA
    </div>
    <div id="output"></div>
  </div>` : '<div id="output" style="display:none;"></div>'}
</div>

<script>
// ===== Mobile Orientation Lock =====
(function() {
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
  if (!isMobile) return;

  function checkOrientation() {
    var isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) {
      document.documentElement.classList.add('is-portrait');
    } else {
      document.documentElement.classList.remove('is-portrait');
    }
  }
  checkOrientation();
  window.addEventListener('resize', function() { setTimeout(checkOrientation, 50); });
  window.addEventListener('orientationchange', function() { setTimeout(checkOrientation, 150); });

  // Try JS orientation lock
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').then(function() {
        document.documentElement.classList.remove('is-portrait');
      }).catch(function(){});
    }
  } catch(e) {}
})();
// ===== Objector Runtime =====
window.onerror = function(msg, url, line) {
  var out = document.getElementById('output');
  if (out) out.textContent += String.fromCharCode(10) + '[Error] ' + msg + ' (line ' + line + ')';
};
const STAGE_W = 480, STAGE_H = 360;
const canvas = document.getElementById('stage');
const outputEl = document.getElementById('output');

let running = false, stopRequested = false;
let globalVars = {};
let _classes = {};
let dynamicFunctions = {};
let sprites = ${sprites};
let blocks = ${blocks};
let timers = [];
let keyHandler = null;
let mouseX = 0, mouseY = 0, mouseDown = false;
let pressedKeys = {};
let broadcastListeners = [];
let output = [];
let turboMode = 0;

// 3D 模式检测（Three.js 是 async 加载，startRun 时再确认）
var _is3D = Object.values(blocks).some(b => b.type && b.type.startsWith('3d_'));
var _use3D = _is3D && typeof THREE !== 'undefined';
var ctx = canvas.getContext('2d');
canvas.id = 'stage-canvas';

// 舞台自适应窗口大小（全屏游戏布局）
function _resizeCanvas() {
  var container = document.getElementById('game-container');
  var maxW = container ? container.clientWidth - 16 : window.innerWidth - 16;
  var maxH = container ? container.clientHeight - 60 : window.innerHeight - 60;
  var aspect = STAGE_W / STAGE_H;
  var cw, ch;
  if (maxW / maxH > aspect) { ch = maxH; cw = Math.floor(ch * aspect); }
  else { cw = maxW; ch = Math.floor(cw / aspect); }
  cw = Math.max(240, cw); ch = Math.max(180, ch);
  canvas.width = STAGE_W; canvas.height = STAGE_H;
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
}
_resizeCanvas();
window.addEventListener('resize', _resizeCanvas);
window.addEventListener('orientationchange', function() { setTimeout(_resizeCanvas, 200); });

// 扩展执行器
const ExtensionExecutors = new Map(Object.entries(${extExecJSON}).map(([k,v]) => [k, new Function('return ' + v)()]));
console.log('[扩展] 初始执行器数:', ExtensionExecutors.size, Array.from(ExtensionExecutors.keys()).join(', '));

// 扩展 JS 源码（重新执行以注册执行器及其辅助函数）
${extJsCode ? `
(function() {
  console.log('[扩展JS] 开始重新执行扩展源码...');
  // 提供 ExtensionManager 桩，让扩展 JS 重新注册执行器
  var ExtensionManager = {
    registerExtension: function(def) {
      console.log('[扩展JS] 注册扩展:', def.name || def.id, '积木数:', def.blocks ? def.blocks.length : 0, '执行器数:', def.executors ? Object.keys(def.executors).length : 0);
      if (def.executors) {
        Object.entries(def.executors).forEach(function(entry) {
          ExtensionExecutors.set(entry[0], entry[1]);
        });
      }
    }
  };
  try {
${extJsCode.split('\n').map(line => '    ' + line).join('\n')}
    console.log('[扩展JS] 执行完成，当前执行器总数:', ExtensionExecutors.size);
  } catch(e) { console.error('[扩展JS执行出错]', e); }
})();
` : 'console.log("[扩展JS] 无扩展JS源码需要执行");'}

// 3D 舞台模块
var Stage3D = (function() {
  var scene, camera, renderer3d, _init=false;
  var groundPlane, gridHelper;
  var meshMap = new Map(), _meshId = 0;
  var createdMeshes = [];
  var spriteMeshes = new Map(), spriteTextures = new Map();
  var W=480, H=360, SC=50;
  function init(cv) {
    if(typeof THREE==='undefined'||!cv) return false;
    cv.width=W; cv.height=H; cv.style.width=W+'px'; cv.style.height=H+'px';
    try {
      scene=new THREE.Scene(); scene.background=new THREE.Color(0x87ceeb);
      camera=new THREE.PerspectiveCamera(60,W/H,0.1,1000);
      camera.position.set(0,25,35); camera.lookAt(0,0,0);
      renderer3d=new THREE.WebGLRenderer({canvas:cv,antialias:true});
      renderer3d.setSize(W,H,false); renderer3d.shadowMap.enabled=true;
      scene.add(new THREE.AmbientLight(0xffffff,0.7));
      var dl=new THREE.DirectionalLight(0xffffff,0.8);
      dl.position.set(10,20,10); dl.castShadow=true; scene.add(dl);
      var gg=new THREE.PlaneGeometry(SC*2,SC*2);
      var gm=new THREE.MeshStandardMaterial({color:0x88cc88,roughness:0.8});
      groundPlane=new THREE.Mesh(gg,gm); groundPlane.rotation.x=-Math.PI/2;
      groundPlane.receiveShadow=true; scene.add(groundPlane);
      gridHelper=new THREE.GridHelper(SC*2,20,0x444444,0x666666);
      gridHelper.position.y=0.01; gridHelper.material.opacity=0.25;
      gridHelper.material.transparent=true; scene.add(gridHelper);
      _init=true; return true;
    } catch(e) { console.error('[Stage3D]',e.message); return false; }
  }
  function conv(x,y) { var s=SC/240; return {x:x*s,y:1,z:-y*s}; }
  function spriteMesh(sp,idx) {
    var mesh=spriteMeshes.get(idx);
    var cost=sp.costumePath||'';
    var last=spriteTextures.get(idx);
    if(mesh&&cost!==last) {
      if(mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose(); scene.remove(mesh); mesh=null;
    }
    if(!mesh) {
      var geo, mat;
      if(sp.image) {
        var tex=new THREE.Texture(sp.image); tex.needsUpdate=true;
        var asp=sp.image.width/sp.image.height;
        geo=new THREE.PlaneGeometry(4*asp,4);
        mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide});
      } else {
        geo=new THREE.PlaneGeometry(4,4);
        mat=new THREE.MeshBasicMaterial({color:new THREE.Color(sp.color||'#4a90d9'),side:THREE.DoubleSide});
      }
      mesh=new THREE.Mesh(geo,mat); mesh.castShadow=true; scene.add(mesh);
      spriteMeshes.set(idx,mesh); spriteTextures.set(idx,cost);
    }
    return mesh;
  }
  function updateSprites() {
    var ids=new Set();
    sprites.forEach(function(sp,i) {
      ids.add(i);
      if(!sp.visible) { var m=spriteMeshes.get(i); if(m) m.visible=false; return; }
      var mesh=spriteMesh(sp,i);
      var pos=conv(sp.x,sp.y);
      mesh.position.set(pos.x,pos.y+(sp._height3d||0),pos.z);
      var sc=(sp.size||100)/100; mesh.scale.set(sc,sc,sc);
      if(sp.rotationStyle==='allAround') mesh.rotation.y=(90-sp.direction)*Math.PI/180;
      else if(sp.rotationStyle==='leftRight') mesh.rotation.y=sp.direction>180?Math.PI:0;
      mesh.visible=true;
    });
    spriteMeshes.forEach(function(mesh,id) {
      if(!ids.has(id)) {
        scene.remove(mesh);
        if(mesh.geometry) mesh.geometry.dispose();
        if(mesh.material) { if(mesh.material.map) mesh.material.map.dispose(); mesh.material.dispose(); }
        spriteMeshes.delete(id); spriteTextures.delete(id);
      }
    });
  }
  function render3d() { if(_init&&renderer3d) renderer3d.render(scene,camera); }
  function createMesh(type,p) {
    p=p||{}; var x=+p.x||0,y=+p.y||0,z=+p.z||0,color=p.color||'#FF6B35';
    var w=+p.w||4,h=+p.h||4,d=+p.d||4,radius=+p.radius||2;
    var geo,mat;
    switch(type) {
      case 'sphere': geo=new THREE.SphereGeometry(radius,16,16); break;
      case 'cylinder': geo=new THREE.CylinderGeometry(radius,radius,h,16); break;
      case 'cone': geo=new THREE.ConeGeometry(radius,h,16); break;
      case 'plane': geo=new THREE.PlaneGeometry(w,h);
        mat=new THREE.MeshStandardMaterial({color:color,side:THREE.DoubleSide}); break;
      default: geo=new THREE.BoxGeometry(w,h,d); type='box';
    }
    if(!mat) mat=new THREE.MeshStandardMaterial({color:color});
    var mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh);
    var id=++_meshId;
    var wr={__is3DMesh:true,id:id,type:type,mesh:mesh,x:x,y:y,z:z,w:w,h:h,d:d,radius:radius,color:color,scale:1,rotationY:0,visible:true};
    meshMap.set(id,wr); createdMeshes.push(mesh);
    return wr;
  }
  function setProp(w) {
    if(!w||!w.mesh) return;
    w.mesh.position.set(+w.x,+w.y,+w.z);
    var s=+(w.scale||1); w.mesh.scale.set(s,s,s);
    w.mesh.rotation.y=+(w.rotationY||0)*Math.PI/180;
    if(w.mesh.material&&w.mesh.material.color&&w.color) w.mesh.material.color.set(String(w.color));
    w.mesh.visible=w.visible!==false;
  }
  function getProp(id,a) {
    var w=meshMap.get(+id); if(!w) return undefined;
    return w[a];
  }
  function clearMeshes() {
    createdMeshes.forEach(function(m) {
      scene.remove(m); if(m.geometry) m.geometry.dispose(); if(m.material) m.material.dispose();
    });
    createdMeshes=[]; meshMap.clear();
  }
  return {
    init:init, isInitialized:function(){return _init;},
    getCamera:function(){return camera;},
    getScene:function(){return scene;},
    getRenderer:function(){return renderer3d;},
    getMeshMap:function(){return meshMap;},
    createMesh:createMesh, setMeshProperty:setProp, getMeshProperty:getProp,
    clearCreatedMeshes:clearMeshes,
    setCameraPosition:function(x,y,z){if(camera){camera.position.set(x,y,z);camera.lookAt(0,0,0);}},
    setSkyColor:function(c){if(scene&&scene.background)scene.background.set(c);},
    setGroundColor:function(c){if(groundPlane&&groundPlane.material)groundPlane.material.color.set(c);},
    setGridVisible:function(s){if(gridHelper)gridHelper.visible=!!s;},
    updateSprites:updateSprites, render3d:render3d
  };
})();

// 渲染循环（持续渲染，和舞台面板窗口一样）
let _rafId = null;
function _renderLoop() {
  if (_use3D) { Stage3D.updateSprites(); Stage3D.render3d(); }
  else { render(); }
  _rafId = requestAnimationFrame(_renderLoop);
}
function _startRenderLoop() { if (!_rafId) _rafId = requestAnimationFrame(_renderLoop); }
function _stopRenderLoop() { if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; } }

// 保存初始状态（用于重置）
// 分离舞台背景和普通精灵
var _stageBgImg = null;
var _stageBgData = sprites.find(function(s) { return s.isStage; });
sprites = sprites.filter(function(s) { return !s.isStage; });
let _initSprites = JSON.parse(JSON.stringify(sprites));

// 预加载舞台背景贴图
if (_stageBgData && _stageBgData.costumePath) {
  var _bgIm = new Image();
  _bgIm.onload = function() { _stageBgImg = _bgIm; };
  _bgIm.src = _stageBgData.costumePath;
}

// 初始化精灵 + 预加载造型图片
function _preloadCostumes() {
  var promises = [];
  sprites.forEach(function(s) {
    s.x = s.x || 0; s.y = s.y || 0;
    s.direction = s.direction != null ? s.direction : 90;
    s.size = s.size || 100;
    s.visible = s.visible !== false;
    s.sayText = ''; s.sayTimer = null;
    s.vx = 0; s.vy = 0;
    s.rotationStyle = s.rotationStyle || 'allAround';
    s._posHistory = [];
    s.image = null;
    if (s.costumePath) {
      promises.push(new Promise(function(resolve) {
        var img = new Image();
        img.onload = function() { s.image = img; resolve(); };
        img.onerror = function() { resolve(); };
        img.src = s.costumePath;
      }));
    }
  });
  return Promise.all(promises);
}
_preloadCostumes().then(function() { render(); });
_startRenderLoop();

// 鼠标追踪（和面板窗口一样）
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouseX = Math.round((e.clientX - r.left) / r.width * STAGE_W - STAGE_W/2);
  mouseY = Math.round((e.clientY - r.top) / r.height * STAGE_H - STAGE_H/2);
});
canvas.addEventListener('mousedown', () => { mouseDown = true; });
canvas.addEventListener('mouseup', () => { mouseDown = false; });

// 持续键盘追踪（不依赖 running 状态）
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  pressedKeys[mapKey(e.key)] = true;
});
document.addEventListener('keyup', (e) => {
  delete pressedKeys[mapKey(e.key)];
});

// 全屏按钮
${fullscreenBtn ? `document.getElementById('btn-fullscreen').addEventListener('click', function() {
  var el = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || function(){}).call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || function(){}).call(document);
  }
});` : ''}

// 控制台切换按钮
document.getElementById('btn-console-toggle').addEventListener('click', function() {
  var wrap = document.getElementById('output-wrap');
  if (wrap) wrap.classList.toggle('collapsed');
  var out = document.getElementById('output');
  if (out && out.style.display === 'none') out.style.display = '';
});

// 触屏虚拟按键
${touchControls ? `(function() {
  function codeToKey(code) {
    if (code.indexOf('Arrow') === 0) return code.substring(5).toLowerCase();
    if (code === 'Space') return 'space';
    if (code === 'Enter') return 'enter';
    if (code === 'Escape') return 'escape';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'shift';
    if (code === 'ControlLeft' || code === 'ControlRight') return 'control';
    if (code === 'AltLeft' || code === 'AltRight') return 'alt';
    if (code.indexOf('Key') === 0) return code.substring(3).toLowerCase();
    if (code.indexOf('Digit') === 0) return code.substring(5);
    return code.toLowerCase();
  }
  var touchBtns = document.querySelectorAll('.touch-btn');
  touchBtns.forEach(function(btn) {
    var key = codeToKey(btn.dataset.key);
    function press(e) { e.preventDefault(); pressedKeys[key] = true; btn.classList.add('pressed'); }
    function release(e) { e.preventDefault(); delete pressedKeys[key]; btn.classList.remove('pressed'); }
    btn.addEventListener('touchstart', press, {passive:false});
    btn.addEventListener('touchend', release, {passive:false});
    btn.addEventListener('touchcancel', release, {passive:false});
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
  });
  if ('ontouchstart' in window) { document.getElementById('touch-controls').classList.add('active'); }
})();` : '// 触屏控制未启用'}

${joystickConfig ? `(function() {
  function codeToKey(code) {
    if (code.indexOf('Arrow') === 0) return code.substring(5).toLowerCase();
    if (code === 'Space') return 'space';
    if (code === 'Enter') return 'enter';
    if (code === 'Escape') return 'escape';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'shift';
    if (code === 'ControlLeft' || code === 'ControlRight') return 'control';
    if (code === 'AltLeft' || code === 'AltRight') return 'alt';
    if (code.indexOf('Key') === 0) return code.substring(3).toLowerCase();
    if (code.indexOf('Digit') === 0) return code.substring(5);
    return code.toLowerCase();
  }
  var jk = ${JSON.stringify(joystickConfig.keys)};
  var mode = '${joystickConfig.mode}';
  var el = document.querySelector('[data-joystick]');
  if (!el) { console.warn('[Joystick] Element not found'); return; }
  var base = el.querySelector('.joystick-base');
  var knob = el.querySelector('.joystick-knob');
  if (!base || !knob) { console.warn('[Joystick] Base or knob not found'); return; }
  var sz = ${joystickConfig.size || 120};
  var maxR = sz / 2;
  var knobR = (sz * 0.38) / 2;
  var cx = sz / 2, cy = sz / 2;
  var activeKeys = [];
  var activePointerId = null;
  var deadZone = sz * 0.15;
  console.log('[Joystick] Initialized, size:', sz, 'mode:', mode);

  // 8方向角度映射表
  var dirKeys4 = [
    ['up'],['up','right'],['right'],['down','right'],
    ['down'],['down','left'],['left'],['up','left']
  ];
  var dirKeys8 = [
    ['up'],['upRight'],['right'],['downRight'],
    ['down'],['downLeft'],['left'],['upLeft']
  ];

  function clearKeys() {
    activeKeys.forEach(function(k) { delete pressedKeys[codeToKey(k)]; });
    activeKeys = [];
  }
  function setDirKeys(angleDeg) {
    clearKeys();
    // 量化为8方向: 0=上, 1=右上, 2=右, 3=右下, 4=下, 5=左下, 6=左, 7=左上
    var sector = Math.round(((angleDeg + 22.5) % 360) / 45) % 8;
    var dkeys = (mode === '8key') ? dirKeys8[sector] : dirKeys4[sector];
    dkeys.forEach(function(name) {
      if (jk[name]) {
        activeKeys.push(jk[name]);
        pressedKeys[codeToKey(jk[name])] = true;
      }
    });
  }

  function moveKnob(dx, dy) {
    var dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 1) { resetKnob(); return; }
    var clampDist = Math.min(dist, maxR - knobR);
    var angle = Math.atan2(dy, dx);
    var nx = cx + Math.cos(angle) * clampDist - knobR;
    var ny = cy + Math.sin(angle) * clampDist - knobR;
    knob.style.left = nx + 'px';
    knob.style.top = ny + 'px';
    if (dist > deadZone) {
      var deg = ((angle * 180 / Math.PI) + 360) % 360;
      // 转换: 0=右,90=下,180=左,270=上 → 需要 0=上,45=右上,90=右...
      var gameDeg = (90 - deg + 360) % 360;
      setDirKeys(gameDeg);
    } else {
      clearKeys();
    }
  }
  function resetKnob() {
    knob.style.left = (cx - knobR) + 'px';
    knob.style.top = (cy - knobR) + 'px';
    clearKeys();
  }

  // Pointer Events (unified touch/mouse)
  el.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    activePointerId = e.pointerId;
    var r = el.getBoundingClientRect();
    moveKnob(e.clientX - r.left - cx, e.clientY - r.top - cy);
  });
  el.addEventListener('pointermove', function(e) {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    e.stopPropagation();
    var r = el.getBoundingClientRect();
    moveKnob(e.clientX - r.left - cx, e.clientY - r.top - cy);
  });
  el.addEventListener('pointerup', function(e) {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    activePointerId = null;
    resetKnob();
  });
  el.addEventListener('pointercancel', function(e) {
    activePointerId = null;
    resetKnob();
  });
  el.addEventListener('lostpointercapture', function(e) {
    activePointerId = null;
    resetKnob();
  });

  // Fallback touch events for older browsers
  if (!window.PointerEvent) {
    el.addEventListener('touchstart', function(e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      activePointerId = t.identifier;
      var r = el.getBoundingClientRect();
      moveKnob(t.clientX - r.left - cx, t.clientY - r.top - cy);
    }, {passive:false});
    el.addEventListener('touchmove', function(e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activePointerId) {
          var t = e.changedTouches[i];
          var r = el.getBoundingClientRect();
          moveKnob(t.clientX - r.left - cx, t.clientY - r.top - cy);
          break;
        }
      }
    }, {passive:false});
    el.addEventListener('touchend', function(e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activePointerId) {
          activePointerId = null;
          resetKnob();
          break;
        }
      }
    }, {passive:false});
    el.addEventListener('touchcancel', function(e) {
      e.preventDefault();
      activePointerId = null;
      resetKnob();
    }, {passive:false});
  }
})();` : ''}

${autoRun ? '// 自动运行\nsetTimeout(function() { startRun(); }, 500);' : '// 等待用户点击运行'}

function log(msg) {
  output.push(String(msg));
  outputEl.textContent = output.join('\\n');
}
function delay(ms) {
  if (turboMode > 0) return Promise.resolve();
  return new Promise(r => setTimeout(r, ms));
}
function getActiveSprite() { return sprites[0]; }
function getActiveSpriteIdx() { return 0; }
function setSpritePos(idx, x, y) { sprites[idx].x = x; sprites[idx].y = y; }
function setSpriteDir(idx, d) { sprites[idx].direction = ((d - 90) % 360 + 360) % 360 + 90; }
function rotateSprite(idx, d) { sprites[idx].direction += d; }
function moveSprite(idx, steps) {
  const s = sprites[idx]; if (!s) return;
  const rad = (s.direction - 90) * Math.PI / 180;
  s.x += steps * Math.cos(rad);
  s.y += steps * Math.sin(rad);
}
function setSpriteVisible(idx, v) { sprites[idx].visible = v; }
function setSpriteSay(idx, text) { sprites[idx].sayText = text; }
function setSpriteSize(idx, sz) { sprites[idx].size = sz; }
function changeSpriteSize(idx, n) { sprites[idx].size += n; }
function bounceSprite(idx) {
  const s = sprites[idx]; if (!s) return;
  const hw = STAGE_W/2, hh = STAGE_H/2;
  if (s.x < -hw || s.x > hw) s.direction = 180 - s.direction;
  if (s.y < -hh || s.y > hh) s.direction = -s.direction;
}
function pointTowards(idx, tx, ty) {
  const s = sprites[idx]; if (!s) return;
  const dx = tx - s.x, dy = ty - s.y;
  s.direction = Math.atan2(dy, dx) * 180 / Math.PI + 90;
}
function moveTowards(idx, tx, ty, steps) {
  const s = sprites[idx]; if (!s) return;
  const dx = tx - s.x, dy = ty - s.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 1) return;
  s.x += (dx/dist) * steps;
  s.y += (dy/dist) * steps;
}
function getDistanceToPoint(idx, tx, ty) {
  const s = sprites[idx]; if (!s) return 0;
  return Math.sqrt((tx-s.x)**2 + (ty-s.y)**2);
}
function getDirectionToPoint(idx, tx, ty) {
  const s = sprites[idx]; if (!s) return 0;
  return Math.atan2(ty - s.y, tx - s.x) * 180 / Math.PI + 90;
}
function isTouchingEdge(idx) {
  const s = sprites[idx]; if (!s) return false;
  const hw = STAGE_W/2, hh = STAGE_H/2;
  return s.x <= -hw || s.x >= hw || s.y <= -hh || s.y >= hh;
}
function clampToStage(idx) {
  const s = sprites[idx]; if (!s) return;
  const hw = STAGE_W/2, hh = STAGE_H/2;
  s.x = Math.max(-hw, Math.min(hw, s.x));
  s.y = Math.max(-hh, Math.min(hh, s.y));
}
function mapKey(key) {
  const map = { ' ':'space','ArrowUp':'up','ArrowDown':'down','ArrowLeft':'left','ArrowRight':'right','Enter':'enter','Shift':'shift','Control':'control','Alt':'alt','Escape':'escape','Tab':'tab','Backspace':'backspace' };
  return map[key] || key.toLowerCase();
}

// 渲染
function render() {
  if (_use3D || !ctx) return;
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  // 先画舞台背景
  if (_stageBgImg) {
    var bw = _stageBgImg.width, bh = _stageBgImg.height;
    var sc = Math.min(STAGE_W / bw, STAGE_H / bh);
    var dw = bw * sc, dh = bh * sc;
    ctx.drawImage(_stageBgImg, (STAGE_W - dw) / 2, (STAGE_H - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }
  // 渲染普通精灵
  sprites.forEach(function(s) {
    if (!s.visible) return;
    ctx.save();
    ctx.translate(STAGE_W/2 + s.x, STAGE_H/2 - s.y);
    if (s.rotationStyle === 'allAround') ctx.rotate((s.direction - 90) * Math.PI / 180);
    else if (s.rotationStyle === 'leftRight') { if (s.direction > 180) ctx.scale(-1, 1); }
    var sc = s.size / 100;
    ctx.scale(sc, sc);
    if (s.image) {
      var iw = s.image.width, ih = s.image.height;
      var maxD = 64;
      var dw = iw, dh = ih;
      if (iw > maxD || ih > maxD) { var r = Math.min(maxD/iw, maxD/ih); dw = iw*r; dh = ih*r; }
      ctx.drawImage(s.image, -dw/2, -dh/2, dw, dh);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(14, 14); ctx.lineTo(-14, 14);
      ctx.closePath();
      ctx.fillStyle = s.color || '#4C97FF'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-4, -4, 3, 0, Math.PI*2); ctx.arc(4, -4, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(-3, -4, 1.5, 0, Math.PI*2); ctx.arc(5, -4, 1.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    if (s.sayText) {
      var bx = STAGE_W/2 + s.x + 25, by = STAGE_H/2 - s.y - 30;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ctx.font = '12px sans-serif';
      var tw = ctx.measureText(s.sayText).width;
      ctx.beginPath(); ctx.roundRect(bx, by, tw+12, 22, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.fillText(s.sayText, bx+6, by+15);
    }
  });
}

// 执行引擎
async function executeChain(block, scope) {
  let cur = block;
  while (cur && !stopRequested) {
    const r = await executeBlock(cur, scope);
    if (r === '__RETURN__' || r === '__STOP__') return r;
    cur = cur.flowOut ? blocks[cur.flowOut] : null;
  }
}

function resolveParams(block, scope) {
  const result = {};
  const BLOCK_TYPE_PARAMS = ['block', 'code'];
  if (block.params) {
    for (const [k, v] of Object.entries(block.params)) {
      const connId = block.paramConnections && block.paramConnections[k];
      if (connId && blocks[connId]) {
        if (BLOCK_TYPE_PARAMS.includes(k)) {
          result[k] = { __blockRef: connId };
        } else {
          result[k] = evaluateReporter(blocks[connId], scope);
        }
      } else {
        result[k] = v;
      }
    }
  }
  // 处理动态参数槽（_extraParams）
  if (block._extraParams) {
    for (const ep of block._extraParams) {
      const connId = block.paramConnections && block.paramConnections[ep.name];
      if (connId && blocks[connId]) {
        if (ep.type === 'block') {
          result[ep.name] = { __blockRef: connId };
        } else {
          result[ep.name] = evaluateReporter(blocks[connId], scope);
        }
      } else {
        result[ep.name] = block.params[ep.name];
      }
    }
  }
  return result;
}

function evaluateReporter(block, scope) {
  const p = resolveParams(block, scope);
  switch(block.type) {
    case 'op_add': return Number(p.a) + Number(p.b);
    case 'op_sub': return Number(p.a) - Number(p.b);
    case 'op_mul': return Number(p.a) * Number(p.b);
    case 'op_div': return Number(p.b) ? Number(p.a) / Number(p.b) : 0;
    case 'op_mod': return Number(p.a) % Number(p.b);
    case 'op_random': return Math.floor(Math.random() * (Number(p.b) - Number(p.a) + 1)) + Number(p.a);
    case 'op_random_float': return Math.random();
    case 'op_pow': return Math.pow(Number(p.a), Number(p.b));
    case 'op_lt': return Number(p.a) < Number(p.b);
    case 'op_gt': return Number(p.a) > Number(p.b);
    case 'op_lte': return Number(p.a) <= Number(p.b);
    case 'op_gte': return Number(p.a) >= Number(p.b);
    case 'op_eq': return p.a == p.b;
    case 'op_neq': return p.a != p.b;
    case 'op_and': return !!p.a && !!p.b;
    case 'op_or': return !!p.a || !!p.b;
    case 'op_not': return !p.a;
    case 'op_join': return String(p.a) + String(p.b);
    case 'op_strlen': return String(p.s).length;
    case 'op_substr': return String(p.s).substring(Number(p.start) - 1, Number(p.end));
    case 'op_str_index': { const idx = String(p.s).indexOf(String(p.sub)); return idx === -1 ? 0 : idx + 1; }
    case 'op_str_contains': return String(p.s).includes(String(p.sub));
    case 'op_str_upper': return String(p.s).toUpperCase();
    case 'op_str_lower': return String(p.s).toLowerCase();
    case 'op_str_trim': return String(p.s).trim();
    case 'op_str_repeat': return String(p.s).repeat(Math.max(0, Number(p.n)));
    case 'op_str_replace': return String(p.s).split(String(p.from)).join(String(p.to));
    case 'op_char_at': return String(p.s).charAt(Number(p.n) - 1) || '';
    case 'op_to_number': return Number(p.s) || 0;
    case 'op_to_string': return String(p.n);
    case 'op_min': return Math.min(Number(p.a), Number(p.b));
    case 'op_max': return Math.max(Number(p.a), Number(p.b));
    case 'op_clamp': return Math.min(Math.max(Number(p.n), Number(p.min)), Number(p.max));
    case 'op_lerp': return Number(p.a) + (Number(p.b) - Number(p.a)) * Number(p.t);
    case 'op_pi': return Math.PI;
    case 'op_e': return Math.E;
    case 'op_math': { const n=Number(p.n); const fn=p.fn; if(fn==='abs')return Math.abs(n); if(fn==='floor')return Math.floor(n); if(fn==='ceil')return Math.ceil(n); if(fn==='round')return Math.round(n); if(fn==='sqrt')return Math.sqrt(n); if(fn==='sin')return Math.sin(n); if(fn==='cos')return Math.cos(n); if(fn==='tan')return Math.tan(n); if(fn==='asin')return Math.asin(n); if(fn==='acos')return Math.acos(n); if(fn==='atan')return Math.atan(n); if(fn==='log')return Math.log(n); if(fn==='log2')return Math.log2(n); if(fn==='exp')return Math.exp(n); if(fn==='sign')return Math.sign(n); return n; }
    case 'var_get': {
      if (dynamicFunctions[p.name]) { const df=dynamicFunctions[p.name]; return { __blockRef:df.blockRef, __isFunction:true, __dynamicFn:p.name }; }
      const fn = findFunction(p.name);
      if (fn) return { __blockRef: fn.id, __isFunction: true };
      return getVar(p.name, scope);
    }
    case 'func_param_get': return getVar(p.name, scope);
    case 'func_call_reporter': {
      const dynFn = dynamicFunctions[p.name];
      if (dynFn) {
        const callArgs = collectCallArgs(block, scope);
        const fnScope = {};
        dynFn.paramNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
        const tb = blocks[dynFn.blockRef];
        if (tb) {
          const subTop = dynFn.closure ? getSubTop(tb, 'body') : (tb.type === 'control_code_block' ? getSubTop(tb, 'body') : tb);
          const execScope = dynFn.closure ? { ...dynFn.closure, ...fnScope } : { ...scope, ...fnScope };
          if (subTop) { executeChainSync(subTop, execScope); return execScope.__return; }
        }
      }
      const fn2 = findFunction(p.name);
      if (fn2) {
        const callArgs = collectCallArgs(block, scope);
        const defParamNames = (fn2._extraParams || []).map(ep => String(fn2.params[ep.name] || '').trim()).filter(Boolean);
        const fnScope = {};
        defParamNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
        const next = fn2.flowOut ? blocks[fn2.flowOut] : null;
        if (next) { executeChainSync(next, fnScope); return fnScope.__return; }
      }
      return undefined;
    }
    case 'get_x': return getActiveSprite()?.x || 0;
    case 'get_y': return getActiveSprite()?.y || 0;
    case 'get_direction': return getActiveSprite()?.direction || 90;
    case 'get_vx': return getActiveSprite()?.vx || 0;
    case 'get_vy': return getActiveSprite()?.vy || 0;
    case 'get_speed': { const s=getActiveSprite(); return s ? Math.sqrt(s.vx*s.vx+s.vy*s.vy) : 0; }
    case 'sensing_mouse_x': return mouseX;
    case 'sensing_mouse_y': return mouseY;
    case 'sensing_mouse_down': return mouseDown;
    case 'sensing_key_pressed': return !!pressedKeys[p.key];
    case 'sensing_timer': return (Date.now() - window.__timerStart) / 1000;
    case 'sensing_touching_edge': return isTouchingEdge(0);
    case 'sensing_current': { const now=new Date(); switch(p.unit){case'年':return now.getFullYear();case'月':return now.getMonth()+1;case'日':return now.getDate();case'时':return now.getHours();case'分':return now.getMinutes();case'秒':return now.getSeconds();case'星期':return now.getDay()||7;default:return now.getSeconds();} }
    case 'sensing_answer': return window.__answer || '';
    case 'sensing_username': return '用户';
    case 'sensing_stage_width': return STAGE_W;
    case 'sensing_stage_height': return STAGE_H;
    case 'sensing_sprite_count': return sprites.length;
    case 'sensing_timestamp': return Date.now();
    case 'sensing_format_time': { const now=new Date(); let fmt=String(p.fmt||'yyyy-MM-dd HH:mm:ss'); fmt=fmt.replace('yyyy',now.getFullYear()).replace('MM',String(now.getMonth()+1).padStart(2,'0')).replace('dd',String(now.getDate()).padStart(2,'0')).replace('HH',String(now.getHours()).padStart(2,'0')).replace('mm',String(now.getMinutes()).padStart(2,'0')).replace('ss',String(now.getSeconds()).padStart(2,'0')); return fmt; }
    case 'io_answer': return window.__answer || '';
    case 'io_load_data': return globalVars['__data_' + p.key] || '';
    case 'io_confirm': return confirm(String(p.msg));
    case 'list_create': {
      const result = [];
      const allKeys = Object.keys(block.params).filter(k => k.startsWith('item'));
      for (const key of allKeys) { const val = p[key] !== undefined ? p[key] : block.params[key]; if (val !== undefined && val !== null && String(val).trim() !== '') { if (Array.isArray(val)) val.forEach(v => result.push(v)); else String(val).split(',').forEach(s => { const t = s.trim(); if (t) result.push(t); }); } }
      return result;
    }
    case 'list_get': { const arr=resolveListArray(p.list,scope); return Array.isArray(arr)?arr[Number(p.idx)-1]:undefined; }
    case 'list_length': { const arr=resolveListArray(p.list,scope); return Array.isArray(arr)?arr.length:0; }
    case 'list_contains': { const arr=resolveListArray(p.list,scope); return Array.isArray(arr)?arr.includes(p.val):false; }
    case 'list_index_of': { const arr=resolveListArray(p.list,scope); if(!Array.isArray(arr))return 0; const idx=arr.indexOf(p.val); return idx===-1?0:idx+1; }
    case 'list_join': { const arr=resolveListArray(p.list,scope); return Array.isArray(arr)?arr.join(String(p.sep)):''; }
    case 'distance_to_mouse': return getDistanceToPoint(0, mouseX, mouseY);
    case 'direction_to_mouse': return getDirectionToPoint(0, mouseX, mouseY);
    case 'is_at_edge': return isTouchingEdge(0);
    case 'looks_get_size': return getActiveSprite()?.size || 100;
    case 'class_get_attr': { const obj=resolveObj(p.obj,scope); return obj?obj[p.attr]:undefined; }
    case 'class_self': return scope.self || null;
    case 'class_param_get': return getVar(p.name, scope);
    case 'class_create': {
      const className = String(p.cls);
      const cls = _classes[className];
      if (cls) {
        const instance = { __className: className };
        if (cls.initBlock) {
          const subTop = getSubTop(cls.initBlock, 'body');
          const fnScope = { self: instance };
          const paramNames = (cls.initBlock._extraParams || []).map(ep => String(cls.initBlock.params[ep.name] || '').trim()).filter(Boolean);
          const callArgs = collectCallArgs(block, scope);
          paramNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
          if (subTop) executeChainSync(subTop, fnScope);
        }
        globalVars['__obj_' + className + '_' + Date.now()] = instance;
        return instance;
      }
      return null;
    }
    case 'class_call_method_reporter': {
      const obj = resolveObj(p.obj, scope);
      if (obj && obj.__className) {
        const cls = _classes[obj.__className];
        if (cls && cls.methods[p.method]) {
          const methodBlock = cls.methods[p.method];
          const fnScope = { self: obj };
          const paramNames = (methodBlock._extraParams || []).map(ep => String(methodBlock.params[ep.name] || '').trim()).filter(Boolean);
          const callArgs = collectCallArgs(block, scope);
          paramNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
          const subTop = getSubTop(methodBlock, 'body');
          if (subTop) executeChainSync(subTop, fnScope);
          return fnScope.__return;
        }
      }
      return undefined;
    }
    // 元编程：积木本身作为值
    case 'control_code_block': {
      return { __blockRef: block.id, __closure: { ...scope } };
    }
    case 'control_run_return_block': {
      const bv = p.block;
      if (bv && bv.__blockRef) {
        const tb = blocks[bv.__blockRef];
        if (tb && tb.__closure) {
          const sub = getSubTop(tb, 'body');
          if (sub) { let result = undefined; const execSync = (b) => { let cur = b; while (cur) { if (cur.type === 'func_return') { result = resolveParams(cur, tb.__closure).val; return; } cur = cur.flowOut ? blocks[cur.flowOut] : null; } }; execSync(sub); return result; }
        } else if (tb) { let result = undefined; const execSync = (b) => { let cur = b; while (cur) { if (cur.type === 'func_return') { result = resolveParams(cur, scope).val; return; } cur = cur.flowOut ? blocks[cur.flowOut] : null; } }; execSync(tb); return result; }
      }
      return undefined;
    }
    default: {
      // 3D reporter 积木
      if (block.type === '3d_camera_x') return _use3D && Stage3D.isInitialized() && Stage3D.getCamera() ? Stage3D.getCamera().position.x : 0;
      if (block.type === '3d_camera_y') return _use3D && Stage3D.isInitialized() && Stage3D.getCamera() ? Stage3D.getCamera().position.y : 0;
      if (block.type === '3d_camera_z') return _use3D && Stage3D.isInitialized() && Stage3D.getCamera() ? Stage3D.getCamera().position.z : 0;
      if (block.type === '3d_mesh_get_attr') { var _o=resolveObj(p.obj,scope); if(_o&&_o.__is3DMesh) return Stage3D.getMeshProperty(_o.id,p.attr); return undefined; }
      if (block.type === '3d_create_box') return _use3D && Stage3D.isInitialized() ? Stage3D.createMesh('box',{x:p.x,y:p.y,z:p.z,w:p.w,h:p.h,d:p.d,color:p.color}) : {__is3DMesh:true,id:0};
      if (block.type === '3d_create_sphere') return _use3D && Stage3D.isInitialized() ? Stage3D.createMesh('sphere',{x:p.x,y:p.y,z:p.z,radius:p.radius,color:p.color}) : {__is3DMesh:true,id:0};
      if (block.type === '3d_create_cylinder') return _use3D && Stage3D.isInitialized() ? Stage3D.createMesh('cylinder',{x:p.x,y:p.y,z:p.z,radius:p.radius,h:p.h,color:p.color}) : {__is3DMesh:true,id:0};
      if (block.type === '3d_create_cone') return _use3D && Stage3D.isInitialized() ? Stage3D.createMesh('cone',{x:p.x,y:p.y,z:p.z,radius:p.radius,h:p.h,color:p.color}) : {__is3DMesh:true,id:0};
      if (block.type === '3d_create_plane') return _use3D && Stage3D.isInitialized() ? Stage3D.createMesh('plane',{x:p.x,y:p.y,z:p.z,w:p.w,h:p.h,color:p.color}) : {__is3DMesh:true,id:0};
      // 检查扩展自定义执行器（reporter 类型）
      if (typeof ExtensionExecutors !== 'undefined') {
        const customExec = ExtensionExecutors.get(block.type);
        if (customExec) { p._block = block; return customExec(p, scope); }
      }
      return p[Object.keys(p)[0]] || 0;
    }
  }
}

function resolveBool(val, block, paramName, scope) {
  if (block && paramName) {
    const connId = block.paramConnections && block.paramConnections[paramName];
    if (connId && blocks[connId]) return !!evaluateReporter(blocks[connId], scope);
  }
  return !!val;
}
function getVar(name, scope) { if (scope[name]!==undefined) return scope[name]; return globalVars[name]; }
function setVar(name, val, scope) { if (scope[name]!==undefined) scope[name]=val; else if(scope.__local) scope[name]=val; else globalVars[name]=val; }
function resolveListArray(val, scope) { if (Array.isArray(val)) return val; const v=getVar(String(val),scope); return Array.isArray(v)?v:null; }
function getSubTop(block, subName) { const subId = block.subBlocks && block.subBlocks[subName]; return subId ? blocks[subId] : null; }
function findFunction(name) { return Object.values(blocks).find(b => b.type === 'func_define' && b.params.name === name); }
function findBlockByLabel(label) {
  return Object.values(blocks).find(b => {
    if (b.type === 'control_label_run' && b.params && b.params.label === label) return true;
    if (b._importantLabel === label) return true;
    return false;
  });
}
function resolveObj(val, scope) {
  if (val && typeof val === 'object' && (val.__className || val.__is3DMesh)) return val;
  const name = String(val);
  if (name === 'self') return scope.self || null;
  if (scope[name] !== undefined && typeof scope[name] === 'object') return scope[name];
  const g = globalVars[name];
  if (g && typeof g === 'object') return g;
  return null;
}
function collectCallArgs(block, scope) {
  if (!block._extraParams || block._extraParams.length === 0) return [];
  const result = [];
  for (const ep of block._extraParams) {
    const connId = block.paramConnections && block.paramConnections[ep.name];
    if (connId && blocks[connId]) { result.push(evaluateReporter(blocks[connId], scope)); continue; }
    result.push(block.params[ep.name] || '');
  }
  return result;
}
// 同步执行链（用于 reporter 上下文中的函数调用）
function executeChainSync(startBlock, scope) {
  let cur = startBlock;
  while (cur) {
    if (cur.type === 'func_return') { scope.__return = resolveParams(cur, scope).val; return; }
    const p = resolveParams(cur, scope);
    if (cur.type === 'var_set') setVar(p.name, p.val, scope);
    else if (cur.type === 'var_change') { const c = getVar(p.name, scope); setVar(p.name, Number(c) + Number(p.val), scope); }
    else if (cur.type === 'class_set_attr') { const obj = scope.self || scope; obj[p.attr] = p.val; }
    else if (cur.type === 'class_set_attr_external') { const obj = resolveObj(p.obj, scope); if (obj) obj[p.attr] = p.val; }
    else if (cur.type === 'io_print') log(p.text);
    cur = cur.flowOut ? blocks[cur.flowOut] : null;
  }
}
// 类定义处理
function executeClassDefine(block) {
  const name = block.params.name;
  _classes[name] = { name, initBlock: null, methods: {} };
  let cur = block.flowOut ? blocks[block.flowOut] : null;
  while (cur) {
    if (cur.type === 'class_init') _classes[name].initBlock = cur;
    if (cur.type === 'class_method') _classes[name].methods[cur.params.name] = cur;
    cur = cur.flowOut ? blocks[cur.flowOut] : null;
  }
}

async function executeBlock(block, scope) {
  const p = resolveParams(block, scope);
  const type = block.type;
  if (type==='event_start') {}
  else if (type==='event_broadcast') { const msg=String(p.msg); broadcastListeners.forEach(rb=>{ if(String(rb.params?.msg||'')===msg) executeChain(rb,{}).catch(e=>log('广播错误:'+e.message)); }); }
  else if (type==='event_broadcast_wait') { const msg=String(p.msg); const promises=[]; broadcastListeners.forEach(rb=>{ if(String(rb.params?.msg||'')===msg) promises.push(executeChain(rb,{})); }); if(promises.length>0) await Promise.all(promises); }
  else if (type==='event_receive') {}
  else if (type==='event_timer') {}
  else if (type==='event_key_pressed') {}
  // 运动
  else if (type==='move_steps') moveSprite(0, Number(p.steps));
  else if (type==='turn_right') rotateSprite(0, Number(p.deg));
  else if (type==='turn_left') rotateSprite(0, -Number(p.deg));
  else if (type==='go_to_xy') setSpritePos(0, Number(p.x), Number(p.y));
  else if (type==='go_to_random') { const hw=STAGE_W/2,hh=STAGE_H/2; setSpritePos(0,Math.random()*hw*2-hw,Math.random()*hh*2-hh); }
  else if (type==='go_to_mouse') setSpritePos(0, mouseX, mouseY);
  else if (type==='go_to_sprite') { const t=sprites.find(s=>s.name===p.sprite); if(t) setSpritePos(0,t.x,t.y); }
  else if (type==='change_x') { const s=getActiveSprite(); if(s) s.x+=Number(p.dx); }
  else if (type==='set_x') { const s=getActiveSprite(); if(s) s.x=Number(p.x); }
  else if (type==='change_y') { const s=getActiveSprite(); if(s) s.y+=Number(p.dy); }
  else if (type==='set_y') { const s=getActiveSprite(); if(s) s.y=Number(p.y); }
  else if (type==='set_direction') setSpriteDir(0, Number(p.deg));
  else if (type==='point_towards_mouse') pointTowards(0, mouseX, mouseY);
  else if (type==='point_towards_sprite') { const t=sprites.find(s=>s.name===p.sprite); if(t) pointTowards(0,t.x,t.y); }
  else if (type==='change_direction') rotateSprite(0, Number(p.ddir));
  else if (type==='bounce_edge') bounceSprite(0);
  else if (type==='rotation_style') { const s=getActiveSprite(); if(s){if(p.mode==='左右翻转')s.rotationStyle='leftRight';else if(p.mode==='不旋转')s.rotationStyle='noRotate';else s.rotationStyle='allAround';} }
  else if (type==='glide_to') { const s=getActiveSprite(); if(s){const sx=s.x,sy=s.y,tx=Number(p.x),ty=Number(p.y),ms=Math.max(Number(p.sec)*1000,16),st=Date.now(); while(!stopRequested){const t=Math.min((Date.now()-st)/ms,1);setSpritePos(0,sx+(tx-sx)*t,sy+(ty-sy)*t);if(t>=1)break;await delay(16);} } }
  else if (type==='random_move') { const mn=Number(p.min),mx=Number(p.max); moveSprite(0,Math.random()*(mx-mn)+mn); }
  else if (type==='random_turn') { const mn=Number(p.min),mx=Number(p.max); rotateSprite(0,Math.random()*(mx-mn)+mn); }
  else if (type==='clamp_to_stage') clampToStage(0);
  else if (type==='move_towards_mouse') moveTowards(0,mouseX,mouseY,p.steps);
  else if (type==='move_towards_sprite') { const t=sprites.find(s=>s.name===p.sprite); if(t) moveTowards(0,t.x,t.y,p.steps); }
  // 外观
  else if (type==='looks_show') setSpriteVisible(0, true);
  else if (type==='looks_hide') setSpriteVisible(0, false);
  else if (type==='looks_say') { setSpriteSay(0,String(p.text)); await delay(Number(p.sec)*1000); setSpriteSay(0,''); }
  else if (type==='looks_say_nowait') { setSpriteSay(0,String(p.text)); }
  else if (type==='looks_think') { setSpriteSay(0,'💭 '+String(p.text)); }
  else if (type==='looks_next_costume') { /* web: limited costume cycling */ }
  else if (type==='looks_set_size') setSpriteSize(0, Number(p.size));
  else if (type==='looks_change_size') changeSpriteSize(0, Number(p.n));
  else if (type==='looks_set_color') { const s=getActiveSprite(); if(s) s.color=p.val; }
  else if (type==='looks_clear_effects') { const s=getActiveSprite(); if(s){s.color=null;s.size=100;} }
  // 控制
  else if (type==='wait') await delay(Number(p.sec)*1000);
  else if (type==='repeat') { const n=Number(p.times); for(let i=0;i<n&&!stopRequested;i++){const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,{...scope,__i:i});if(r==='__RETURN__')return r;}} }
  else if (type==='forever') { while(!stopRequested){const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}await delay(16);} }
  else if (type==='if_then') { if(resolveBool(p.cond,block,'cond',scope)){const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}} }
  else if (type==='if_else') { if(resolveBool(p.cond,block,'cond',scope)){const sub=getSubTop(block,'then');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}}else{const sub=getSubTop(block,'else');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}} }
  else if (type==='repeat_until') { while(!stopRequested&&!resolveBool(p.cond,block,'cond',scope)){const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}await delay(16);} }
  else if (type==='stop_all') return '__STOP__';
  else if (type==='control_label_run') { const sub=getSubTop(block,'body'); if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;} }
  else if (type==='control_turbo') { turboMode++; try{const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__'){turboMode--;return r;}}}finally{turboMode--;} }
  else if (type==='control_goto_label') { const targetLabel=String(p.label); const target=findBlockByLabel(targetLabel); if(target){const nextBlock=target.flowOut?blocks[target.flowOut]:null; if(nextBlock){const r=await executeChain(nextBlock,scope);if(r==='__RETURN__'||r==='__STOP__')return r;} return '__STOP__';} else { log('警告: 找不到代码标签 "'+targetLabel+'"'); } }
  else if (type==='control_run_block') {
    const bv=p.block;
    if(bv&&bv.__blockRef){
      const tb=blocks[bv.__blockRef];
      if(tb){
        if(tb.type==='func_define'||bv.__isFunction){ const fnBody=tb.flowOut?blocks[tb.flowOut]:null; if(fnBody){const r=await executeChain(fnBody,scope);if(r==='__RETURN__')return r;} }
        else if(tb.__closure){ const sub=getSubTop(tb,'body'); if(sub){const r=await executeChain(sub,tb.__closure);if(r==='__RETURN__')return r;} }
        else{const r=await executeChain(tb,scope);if(r==='__RETURN__'||r==='__STOP__')return r;}
      }
    }
  }
  else if (type==='control_code_block') { const sub=getSubTop(block,'body'); if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;} }
  // 变量
  else if (type==='var_set') setVar(p.name, p.val, scope);
  else if (type==='var_change') { const cur=getVar(p.name,scope); setVar(p.name,Number(cur)+Number(p.val),scope); }
  else if (type==='var_show') { /* simplified */ }
  else if (type==='var_hide') { /* simplified */ }
  else if (type==='scope_local') { const localScope={...scope,__local:true}; const sub=getSubTop(block,'body'); if(sub){const r=await executeChain(sub,localScope);if(r==='__RETURN__')return r;} }
  // IO
  else if (type==='io_print') log(p.text);
  else if (type==='io_print_line') log(p.text+'\\n');
  else if (type==='io_clear_output') { output=[]; outputEl.textContent=''; }
  else if (type==='io_alert') alert(String(p.msg));
  else if (type==='io_log') { console.log('[Objector]',p.text); log('[日志] '+p.text); }
  else if (type==='io_input') { log('询问: '+p.q); window.__answer=prompt(String(p.q))||''; log('回答: '+window.__answer); }
  else if (type==='io_save_data') { globalVars['__data_'+p.key]=p.val; }
  else if (type==='sensing_reset_timer') window.__timerStart=Date.now();
  // 函数
  else if (type==='func_define') { /* 注册函数，已由预处理处理 */ }
  else if (type==='func_set_define') {
    const name=String(p.name).trim();
    const codeVal=p.code;
    if(name&&codeVal&&codeVal.__blockRef){
      const paramNames=(block._extraParams||[]).map(ep=>String(block.params[ep.name]||'').trim()).filter(Boolean);
      dynamicFunctions[name]={blockRef:codeVal.__blockRef,closure:codeVal.__closure||null,paramNames:paramNames};
    }
  }
  else if (type==='func_call') {
    const dynFn=dynamicFunctions[p.name];
    if(dynFn){
      const callArgs=collectCallArgs(block,scope);
      const fnScope={};
      dynFn.paramNames.forEach((name,i)=>{fnScope[name]=callArgs[i]!==undefined?callArgs[i]:'';});
      const tb=blocks[dynFn.blockRef];
      if(tb){
        const subTop=dynFn.closure?getSubTop(tb,'body'):(tb.type==='control_code_block'?getSubTop(tb,'body'):tb);
        const execScope=dynFn.closure?{...dynFn.closure,...fnScope}:{...scope,...fnScope};
        if(subTop){const r=await executeChain(subTop,execScope);if(r==='__RETURN__')return execScope.__return;}
      }
    } else {
      const fn=findFunction(p.name);
      if(fn){
        const callArgs=collectCallArgs(block,scope);
        const fnScope={};
        const defParamNames=(fn._extraParams||[]).map(ep=>String(fn.params[ep.name]||'').trim()).filter(Boolean);
        defParamNames.forEach((name,i)=>{fnScope[name]=callArgs[i]!==undefined?callArgs[i]:'';});
        const next=fn.flowOut?blocks[fn.flowOut]:null;
        if(next){const r=await executeChain(next,fnScope);if(r==='__RETURN__')return fnScope.__return;}
      }
    }
  }
  else if (type==='func_return') { scope.__return=p.val; return '__RETURN__'; }
  // 列表
  else if (type==='list_push') { const arr=resolveListArray(p.list,scope); if(Array.isArray(arr))arr.push(p.val); }
  else if (type==='list_delete') { const arr=resolveListArray(p.list,scope); if(Array.isArray(arr))arr.splice(Number(p.idx)-1,1); }
  else if (type==='list_insert') { const arr=resolveListArray(p.list,scope); if(Array.isArray(arr))arr.splice(Number(p.idx)-1,0,p.val); }
  else if (type==='list_set') { const arr=resolveListArray(p.list,scope); if(Array.isArray(arr))arr[Number(p.idx)-1]=p.val; }
  else if (type==='list_clear') { const arr=resolveListArray(p.list,scope); if(Array.isArray(arr))arr.length=0; }
  else if (type==='list_sort') { const arr=resolveListArray(p.list,scope); if(Array.isArray(arr)){arr.sort((a,b)=>{const na=Number(a),nb=Number(b);if(!isNaN(na)&&!isNaN(nb))return p.order==='降序'?nb-na:na-nb;return p.order==='降序'?String(b).localeCompare(String(a)):String(a).localeCompare(String(b));});} }
  else if (type==='list_reverse') { const arr=resolveListArray(p.list,scope); if(Array.isArray(arr))arr.reverse(); }
  else if (type==='list_foreach') {
    const arr=resolveListArray(p.list,scope); const list=Array.isArray(arr)?arr:[];
    for(let i=0;i<list.length&&!stopRequested;i++){const subScope={...scope,[p.var]:list[i]};const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,subScope);if(r==='__RETURN__')return r;}}
  }
  // OOP
  else if (type==='class_define') { /* 已由预处理处理 */ }
  else if (type==='class_new') {
    const name=String(p.name).trim();
    const codeVal=p.code;
    if(name&&codeVal&&codeVal.__blockRef){
      _classes[name]={name,initBlock:null,methods:{}};
      const tb=blocks[codeVal.__blockRef];
      if(tb){
        let scanBlock=tb;
        if(tb.type==='control_code_block'){scanBlock=getSubTop(tb,'body');}
        let cur=scanBlock;
        while(cur){
          if(cur.type==='class_init')_classes[name].initBlock=cur;
          if(cur.type==='class_method')_classes[name].methods[cur.params.name]=cur;
          cur=cur.flowOut?blocks[cur.flowOut]:null;
        }
      }
    }
  }
  else if (type==='class_init') { const sub=getSubTop(block,'body'); if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;} }
  else if (type==='class_method') { const sub=getSubTop(block,'body'); if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;} }
  else if (type==='class_set_attr') { const obj=scope.self||scope; obj[p.attr]=p.val; }
  else if (type==='class_set_attr_external') { const obj=resolveObj(p.obj,scope); if(obj)obj[p.attr]=p.val; else log('警告: 找不到对象 "'+p.obj+'"'); }
  else if (type==='class_call_method') {
    const obj=resolveObj(p.obj,scope);
    if(obj&&obj.__className){
      const cls=_classes[obj.__className];
      if(cls&&cls.methods[p.method]){
        const methodBlock=cls.methods[p.method];
        const fnScope={self:obj};
        const paramNames=(methodBlock._extraParams||[]).map(ep=>String(methodBlock.params[ep.name]||'').trim()).filter(Boolean);
        const callArgs=collectCallArgs(block,scope);
        paramNames.forEach((name,i)=>{fnScope[name]=callArgs[i]!==undefined?callArgs[i]:'';});
        const subTop=getSubTop(methodBlock,'body');
        if(subTop){await executeChain(subTop,fnScope);}
        return fnScope.__return;
      }
      log('警告: 对象没有方法 "'+p.method+'"');
    } else { log('警告: 找不到对象 "'+p.obj+'"'); }
  }
  else if (type==='3d_camera_position') { if(_use3D&&Stage3D.isInitialized()) Stage3D.setCameraPosition(+p.x,+p.y,+p.z); }
  else if (type==='3d_camera_lookat') { if(_use3D&&Stage3D.isInitialized()){var _c=Stage3D.getCamera();if(_c)_c.lookAt(+p.x,+p.y,+p.z);} }
  else if (type==='3d_set_bgcolor') { if(_use3D&&Stage3D.isInitialized()) Stage3D.setSkyColor(String(p.color)); }
  else if (type==='3d_set_ground_color') { if(_use3D&&Stage3D.isInitialized()) Stage3D.setGroundColor(String(p.color)); }
  else if (type==='3d_toggle_grid') { if(_use3D&&Stage3D.isInitialized()) Stage3D.setGridVisible(p.show==='show'); }
  else if (type==='3d_create_box') { /* reporter */ }
  else if (type==='3d_create_sphere') { /* reporter */ }
  else if (type==='3d_create_cylinder') { /* reporter */ }
  else if (type==='3d_create_cone') { /* reporter */ }
  else if (type==='3d_create_plane') { /* reporter */ }
  else if (type==='3d_clear_meshes') { if(_use3D&&Stage3D.isInitialized()) Stage3D.clearCreatedMeshes(); }
  else if (type==='3d_mesh_set_attr') { var _mo=resolveObj(p.obj,scope); if(_mo&&_mo.__is3DMesh){_mo[p.attr]=p.val;Stage3D.setMeshProperty(_mo);} }
  else if (type==='3d_set_height') { var _hs=getActiveSprite(); if(_hs) _hs._height3d=+p.height; }
  else if (type==='3d_change_height') { var _hc=getActiveSprite(); if(_hc) _hc._height3d=(_hc._height3d||0)+(+p.amount); }
  // 扩展 stack 积木
  if (typeof ExtensionExecutors !== 'undefined') {
    const extExec = ExtensionExecutors.get(type);
    if (extExec) { console.log('[扩展执行]', type); const result = extExec(p, scope); if (result && typeof result.then === 'function') await result; return; }
  }
  await delay(1);
}

async function startRun() {
  if (running) return;
  try {
  running = true; stopRequested = false;
  globalVars = {}; _classes = {}; output = [];
  outputEl.textContent = '';
  window.__timerStart = Date.now();
  window.__answer = '';

  // 预处理类定义
  for (const b of Object.values(blocks)) {
    if (b.type === 'class_define') executeClassDefine(b);
  }

  // 注册按键事件（利用已有的持续键盘监听）
  const keyBlocks = Object.values(blocks).filter(b => b.type === 'event_key_pressed');
  const firedKeys = {};
  if (keyBlocks.length > 0) {
    keyHandler = (e) => {
      if (!running || stopRequested) return;
      const kn = mapKey(e.key);
      keyBlocks.forEach(b => {
        const tk = (b.params && b.params.key) || 'space';
        if (tk === kn && !firedKeys[kn]) { firedKeys[kn] = true; executeChain(b, {}).catch(err => log(err.message)); }
      });
    };
    const upHandler = (e) => { const kn = mapKey(e.key); delete firedKeys[kn]; };
    document.addEventListener('keydown', keyHandler);
    document.addEventListener('keyup', upHandler);
    keyHandler._up = upHandler;
  }

  // 注册定时器
  const timerBlocks = Object.values(blocks).filter(b => b.type === 'event_timer');
  timerBlocks.forEach(tb => {
    const ms = Math.max(Number(tb.params?.sec || 1) * 1000, 50);
    timers.push(setInterval(() => { if (!stopRequested) executeChain(tb, {}).catch(e => log(e.message)); }, ms));
  });

  // 注册广播接收者
  broadcastListeners = Object.values(blocks).filter(b => b.type === 'event_receive');

  // 重置精灵到初始状态
  var initCopy = JSON.parse(JSON.stringify(_initSprites));
  sprites.forEach(function(s, i) {
    var init = initCopy[i];
    if (init) {
      s.x = init.x; s.y = init.y;
      s.direction = init.direction != null ? init.direction : 90;
      s.size = init.size || 100;
      s.visible = init.visible !== false;
      s.rotationStyle = init.rotationStyle || 'allAround';
    }
    s.sayText = ''; s.sayTimer = null;
    s.vx = 0; s.vy = 0;
    s._posHistory = [];
  });

  // 3D 模式初始化（Three.js 是 async 加载，此时重新检测）
  if (_is3D && typeof THREE !== 'undefined') {
    _use3D = true;
    ctx = null; // 3D 模式不需要 2D context
    _use3D = Stage3D.init(canvas);
    if (!_use3D) { ctx = canvas.getContext('2d'); console.warn('[Stage3D] 初始化失败，降级为 2D 模式'); }
  }

  // 渲染循环已在后台持续运行，无需再启动
  const starts = Object.values(blocks).filter(b => b.type === 'event_start');
  console.log('[Runtime] 开始执行，event_start 数量:', starts.length, '总积木数:', Object.keys(blocks).length);
  try {
    for (const s of starts) { if (stopRequested) break; await executeChain(s, {}); }
  } catch(e) {
    console.error('[Runtime] 执行出错:', e);
    log('[\u9519\u8bef] ' + e.message);
  }

  // 保持运行（等待事件）
  const hasEvents = keyBlocks.length > 0 || timerBlocks.length > 0 || broadcastListeners.length > 0;
  if (hasEvents && !stopRequested) {
    while (!stopRequested) await delay(100);
  }

  stopRun();
  } catch(e) {
    console.error('[Runtime] \u81f4\u547d\u9519\u8bef:', e);
    log('[\u9519\u8bef] ' + e.message);
    running = false;
  }
}

function stopRun() {
  stopRequested = true;
  running = false;
  timers.forEach(id => clearInterval(id));
  timers = [];
  broadcastListeners = [];
  if (keyHandler) {
    document.removeEventListener('keydown', keyHandler);
    if (keyHandler._up) document.removeEventListener('keyup', keyHandler._up);
    keyHandler = null;
  }
  // 渲染循环继续运行（停止后仍然显示最后一帧）
}
</script>


</body>
</html>`;
  }

  /** Blob \u4e0b\u8f7d\u8f85\u52a9\u51fd\u6570 */
  function blobDownload(projectName, html) {
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = projectName + '.html';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    console.log('[HTML\u5bfc\u51fa] \u4e0b\u8f7d\u89e6\u53d1\u5b8c\u6210');
    document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'Exported: ' : '\u5df2\u5bfc\u51fa: ') + projectName + '.html';
  }
  
  /** 检测当前是否为代码编程模式 */
  function _isCodeMode() {
    if (typeof EditorApp === 'undefined' || !EditorApp.getCodeLangRunner) return false;
    var mode = (typeof EditorState !== 'undefined' && EditorState.projectMode) ? String(EditorState.projectMode) : '';
    return mode === 'code' || mode.indexOf('code-') === 0;
  }

  /** 收集代码模式导出数据（async: ALB 模式下需读取解释器源码） */
  async function _collectCodeModeData() {
    var spritesData = [];
    try {
      var sprites = StageManager.getSprites();
      for (var si = 0; si < sprites.length; si++) {
        var s = sprites[si];
        var spriteData = {
          name: s.name, x: s.x, y: s.y, direction: s.direction,
          size: s.size, visible: s.visible, color: s.color || '#4C97FF',
          rotationStyle: s.rotationStyle || 'allAround', isStage: s.isStage || false,
        };
        if (s.costumeImage) {
          try {
            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = s.costumeImage.width; tmpCanvas.height = s.costumeImage.height;
            tmpCanvas.getContext('2d').drawImage(s.costumeImage, 0, 0);
            spriteData.costumePath = tmpCanvas.toDataURL('image/png');
          } catch (e) {}
        }
        spritesData.push(spriteData);
      }
    } catch(e) {}
    var runner = (typeof EditorApp !== 'undefined' && EditorApp.getCodeLangRunner) ? EditorApp.getCodeLangRunner() : 'javascript';
    var codeMap = {};
    if (typeof EditorApp !== 'undefined' && EditorApp.getAllCodeScripts) {
      var all = EditorApp.getAllCodeScripts();
      Object.keys(all).forEach(function(name) {
        if (all[name] && all[name][runner]) codeMap[name] = String(all[name][runner]);
      });
    }
    // ALB 模式: 从磁盘读取解释器源码, 内联到导出 HTML
    var albSource = '';
    if (runner === 'alb' && window.api && window.api.readFile && EditorState.projectPath) {
      try {
        // projectPath 是目录路径, 如 e:\My App\ObjectScratch\proj\ALB
        // 需往上 2 级到 ObjectScratch 根目录, 再进入 interpreter/alb.js
        var albPath;
        if (window.api.pathJoin) {
          albPath = await window.api.pathJoin(EditorState.projectPath, '..', '..', 'interpreter', 'alb.js');
        } else {
          // pathJoin 不可用时, 用字符串拼接手动解析路径
          var _parts = EditorState.projectPath.replace(/\\/g, '/').split('/');
          _parts.pop(); _parts.pop(); // 去掉 ProjectName, proj
          albPath = _parts.join('/') + '/interpreter/alb.js';
        }
        console.log('[ALB导出] 尝试读取 alb.js, 路径:', albPath);
        albSource = await window.api.readFile(albPath);
        if (!albSource) console.warn('[ALB导出] 读取 alb.js 失败 (返回空), 路径:', albPath);
        else console.log('[ALB导出] 读取 alb.js 成功, 长度:', albSource.length);
      } catch (e) { console.warn('[ALB导出] 读取 alb.js 异常:', e); }
    }
    return { spritesData: spritesData, runner: runner, codeMap: codeMap, albSource: albSource };
  }

  /** 生成代码模式可运行的 HTML（内置解释器和代码） */
  function generateCodeModeHTML(projectName, spritesData, runner, codeMap, exportSettings, albSource) {
    var sprites = JSON.stringify(spritesData || []);
    var codeMapJSON = JSON.stringify(codeMap || {});
    var S = exportSettings || {};
    var gameTitle = S.title || projectName;
    var showConsole = S.showConsole !== false;
    var autoRun = !!S.autoRun;
    var interval = runner === 'python' ? 100 : 33;

    // ★ ALB 分支代码用字符串拼接 + base64 编码嵌入源码
    // 用 base64 编码 alb.js 源码, 彻底避免模板字面量 / 字符串字面量的转义问题:
    //   base64 字符串只含 A-Z a-z 0-9 + / =, 不会破坏任何语法结构
    var albBranchCode = '';
    if (runner === 'alb') {
      albBranchCode += '// ALB 代码模式运行时\n';
      albBranchCode += 'window.addEventListener("error", function(ev) {\n';
      albBranchCode += '  var msg = "[页面错误] " + (ev.message || ev.error) + " @ line " + ev.lineno + ":" + ev.colno;\n';
      albBranchCode += '  console.error(msg); if (typeof log === "function") log(msg);\n';
      albBranchCode += '});\n';
      albBranchCode += 'window.addEventListener("unhandledrejection", function(ev) {\n';
      albBranchCode += '  var msg = "[Promise错误] " + (ev.reason && ev.reason.message || ev.reason);\n';
      albBranchCode += '  console.error(msg); if (typeof log === "function") log(msg);\n';
      albBranchCode += '});\n';
      if (albSource) {
        // 用 base64 编码, 在浏览器端解码后用 new Function 执行
        var albB64 = btoa(unescape(encodeURIComponent(albSource)));
        albBranchCode += '// === 加载 ALB 解释器 (base64 编码嵌入, 用 new Function 执行) ===\n';
        albBranchCode += 'try {\n';
        albBranchCode += '  var _albB64 = "' + albB64 + '";\n';
        albBranchCode += '  var _albRaw = new TextDecoder("utf-8").decode(Uint8Array.from(atob(_albB64), function(c){return c.charCodeAt(0);}));\n';
        albBranchCode += '  console.log("[ALB导出] ALB 源码 base64 长度:", _albB64.length, "解码后长度:", _albRaw.length);\n';
        albBranchCode += '  (new Function(_albRaw))();\n';
        albBranchCode += '  console.log("[ALB导出] ALB 源码执行完毕, 无异常");\n';
        albBranchCode += '} catch(_albLoadErr) {\n';
        albBranchCode += '  console.error("[ALB导出] ALB 源码加载失败:", _albLoadErr);\n';
        albBranchCode += '  if (typeof log === "function") log("ALB 解释器加载失败: " + (_albLoadErr && _albLoadErr.message || _albLoadErr));\n';
        albBranchCode += '}\n';
      } else {
        albBranchCode += '(function() { if (typeof log === "function") log("ALB 解释器未内联, 无法运行"); })();\n';
      }
      albBranchCode += 'var _albInst = null;\n';
      albBranchCode += 'var _apiNames = ["set_sprite","sprite_name","sprite_count","get_x","get_y","get_direction","get_size",\n';
      albBranchCode += '  "set_x","set_y","change_x","change_y","goto_xy","move","turn_right","turn_left","point_in_direction",\n';
      albBranchCode += '  "bounce_edge","point_towards_xy","show","hide","set_size","change_size","say","clear_say","say_for",\n';
      albBranchCode += '  "think","stage_width","stage_height","mouse_x","mouse_y","mouse_down","key_pressed","touching_edge",\n';
      albBranchCode += '  "touching_sprite","distance_to","sprite_x","sprite_y","timer_now","random_int","get_var","set_var",\n';
      albBranchCode += '  "change_var","has_var","sleep","stop_all","math_abs","math_floor","math_ceil","math_round","math_sqrt",\n';
      albBranchCode += '  "math_min","math_max","math_pi","math_sin","math_cos","math_tan","str_len","str_upper","str_lower","str_trim"];\n';
      albBranchCode += 'console.log("[ALB导出] === 加载诊断 ===");\n';
      albBranchCode += 'console.log("[ALB导出] typeof createALB:", typeof createALB);\n';
      albBranchCode += 'console.log("[ALB导出] typeof ALB:", typeof ALB);\n';
      albBranchCode += 'console.log("[ALB导出] typeof ALBInterpreter:", typeof ALBInterpreter);\n';
      albBranchCode += 'console.log("[ALB导出] typeof window.createALB:", typeof window.createALB);\n';
      albBranchCode += 'console.log("[ALB导出] _codeMap 角色:", Object.keys(_codeMap));\n';
      albBranchCode += 'console.log("[ALB导出] sprites:", sprites.map(function(s){return s.name;}));\n';
      albBranchCode += 'Object.keys(_codeMap).forEach(function(name) {\n';
      albBranchCode += '  console.log("[ALB导出] --- 角色 [" + name + "] 代码长度:", _codeMap[name].length);\n';
      albBranchCode += '  console.log("[ALB导出] --- 角色 [" + name + "] 代码前100字符:", _codeMap[name].substring(0, 100));\n';
      albBranchCode += '});\n';
      albBranchCode += 'console.log("[ALB导出] === 诊断结束 ===");\n';
      albBranchCode += 'function _initALB() {\n';
      albBranchCode += '  console.log("[ALB导出] _initALB 开始");\n';
      albBranchCode += '  if (typeof createALB !== "function") {\n';
      albBranchCode += '    console.error("[ALB导出] createALB 不是函数, typeof:", typeof createALB);\n';
      albBranchCode += '    log("ALB 解释器未加载 (createALB 不存在)");\n';
      albBranchCode += '    return false;\n';
      albBranchCode += '  }\n';
      albBranchCode += '  try {\n';
      albBranchCode += '    _albInst = createALB();\n';
      albBranchCode += '    console.log("[ALB导出] createALB() 成功");\n';
      albBranchCode += '  } catch(e) {\n';
      albBranchCode += '    console.error("[ALB导出] createALB() 异常:", e);\n';
      albBranchCode += '    log("ALB 解释器创建失败: " + e.message);\n';
      albBranchCode += '    return false;\n';
      albBranchCode += '  }\n';
      albBranchCode += '  var injected = 0;\n';
      albBranchCode += '  _apiNames.forEach(function(n) {\n';
      albBranchCode += '    try { _albInst.setFunc(n, window[n]); injected++; } catch(e) { console.warn("[ALB导出] setFunc " + n + " 失败:", e.message); }\n';
      albBranchCode += '  });\n';
      albBranchCode += '  console.log("[ALB导出] 注入 API 函数:", injected, "/", _apiNames.length);\n';
      albBranchCode += '  try { _albInst.setConst("STAGE_W", STAGE_W); _albInst.setConst("STAGE_H", STAGE_H); } catch(e) { console.warn("[ALB导出] setConst 失败:", e.message); }\n';
      albBranchCode += '  log("ALB 解释器初始化成功, " + Object.keys(_codeMap).length + " 个角色");\n';
      albBranchCode += '  return true;\n';
      albBranchCode += '}\n';
      albBranchCode += 'function _execAlbFrame() {\n';
      albBranchCode += '  if (!running || !_albInst) return;\n';
      albBranchCode += '  Object.keys(_codeMap).forEach(function(name) {\n';
      albBranchCode += '    var idx = sprites.findIndex(function(s){return s.name===name;});\n';
      albBranchCode += '    if (idx < 0) { console.warn("[ALB导出] 角色 [" + name + "] 在 sprites 中找不到"); return; }\n';
      albBranchCode += '    _activeSpriteIdx = idx;\n';
      albBranchCode += '    try {\n';
      albBranchCode += '      var r = _albInst.run(_codeMap[name]);\n';
      albBranchCode += '      (r.output || []).forEach(function(line) { log(line); });\n';
      albBranchCode += '      if (r.error) { log("[ALB错误] " + name + ": " + r.error); console.error("[ALB导出] 运行错误:", r.error); }\n';
      albBranchCode += '    } catch(e) { log("[ALB异常] " + name + ": " + e.message); console.error("[ALB导出] 异常:", e); }\n';
      albBranchCode += '  });\n';
      albBranchCode += '}\n';
      albBranchCode += 'function startRun() {\n';
      albBranchCode += '  console.log("[ALB导出] startRun 被调用");\n';
      albBranchCode += '  if (running) { console.log("[ALB导出] 已在运行中"); return; }\n';
      albBranchCode += '  running = true; globalVars = {}; output = []; outputEl.textContent = ""; _startTime = Date.now();\n';
      albBranchCode += '  if (!_albInst) { if (!_initALB()) { running = false; return; } }\n';
      albBranchCode += '  console.log("[ALB导出] 启动帧循环, 间隔 ' + interval + 'ms");\n';
      albBranchCode += '  _frameTimer = setInterval(_execAlbFrame, ' + interval + ');\n';
      albBranchCode += '}\n';
      albBranchCode += 'function stopRun() { running = false; if (_frameTimer) { clearInterval(_frameTimer); _frameTimer = null; } }\n';
    }

    var pyCDN = '<script src="https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js"><\/script>\n<script src="https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js"><\/script>';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${gameTitle}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    html, body { width:100%; height:100%; overflow:hidden; background:#0a0a0f; font-family:'Segoe UI','Microsoft YaHei',sans-serif; user-select:none; -webkit-user-select:none; }
    #game-container { position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#0a0a0f; }
    #stage { background:#fff; border-radius:4px; display:block; }
    #top-bar { position:absolute; top:0; left:0; right:0; height:40px; display:flex; align-items:center; justify-content:space-between; padding:0 12px; z-index:100; background:linear-gradient(to bottom, rgba(0,0,0,.6), transparent); pointer-events:none; }
    #top-bar > * { pointer-events:auto; }
    #game-title { color:#fff; font-size:14px; font-weight:600; text-shadow:0 1px 4px rgba(0,0,0,.8); opacity:.8; }
    #game-controls { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; gap:8px; z-index:100; }
    .game-btn { background:rgba(255,255,255,.1); color:#cdd6f4; border:1px solid rgba(255,255,255,.15); border-radius:20px; padding:8px 20px; cursor:pointer; font-size:13px; backdrop-filter:blur(4px); }
    .game-btn:hover { background:rgba(255,255,255,.2); }
    .game-btn.run { background:rgba(76,175,80,.2); color:#a5d6a7; border-color:rgba(76,175,80,.3); }
    .game-btn.stop { background:rgba(244,67,54,.15); color:#ef9a9a; border-color:rgba(244,67,54,.25); }
    #output-wrap { position:absolute; bottom:0; left:0; right:0; z-index:80; transition:transform .25s; }
    #output-wrap.collapsed { transform:translateY(calc(100% - 28px)); }
    #output-toggle { height:28px; background:rgba(24,24,37,.9); border-top:1px solid rgba(255,255,255,.1); display:flex; align-items:center; padding:0 10px; cursor:pointer; color:#a6adc8; font-size:11px; gap:4px; }
    #output-toggle .arrow { transition:transform .2s; }
    #output-wrap.collapsed #output-toggle .arrow { transform:rotate(180deg); }
    #output { color:#a6adc8; font-family:'Cascadia Code','Consolas',monospace; font-size:11px; height:100px; overflow-y:auto; background:rgba(24,24,37,.95); padding:6px 10px; white-space:pre-wrap; backdrop-filter:blur(8px); }
  </style>
${runner === 'python' ? '  ' + pyCDN + '\n' : ''}</head>
<body>
<div id="game-container">
  <canvas id="stage" width="480" height="360"></canvas>
  <div id="top-bar"><span id="game-title">${gameTitle}</span></div>
  <div id="game-controls">
    <button class="game-btn run" onclick="startRun()">\u25B6 \u8fd0\u884c</button>
    <button class="game-btn stop" onclick="stopRun()">\u23F9 \u505c\u6b62</button>
  </div>
${showConsole ? '  <div id="output-wrap">\n    <div id="output-toggle" onclick="document.getElementById(\'output-wrap\').classList.toggle(\'collapsed\')">\n      <span class="arrow">\u25BC</span> \u8F93\u51FA\n    </div>\n    <div id="output"></div>\n  </div>' : '<div id="output" style="display:none;"></div>'}
</div>
<script>
const STAGE_W = 480, STAGE_H = 360;
const canvas = document.getElementById('stage');
const outputEl = document.getElementById('output');
let running = false, globalVars = {}, _startTime = Date.now();
let sprites = ${sprites};
let _codeMap = ${codeMapJSON};
let _lang = '${runner}';
let _frameTimer = null;
let mouseX = 0, mouseY = 0, mouseDown = false, pressedKeys = {};
let output = [];
function log(msg) { output.push(String(msg)); if (outputEl) { outputEl.textContent = output.join('\\n'); outputEl.scrollTop = outputEl.scrollHeight; } }

// 分离舞台背景
var _stageBgImg = null;
var _stageBgData = sprites.find(function(s) { return s.isStage; });
sprites = sprites.filter(function(s) { return !s.isStage; });
if (_stageBgData && _stageBgData.costumePath) { _stageBgImg = new Image(); _stageBgImg.src = _stageBgData.costumePath; }

// 预加载造型
sprites.forEach(function(s) {
  s.x = s.x || 0; s.y = s.y || 0; s.direction = s.direction != null ? s.direction : 90;
  s.size = s.size || 100; s.visible = s.visible !== false; s.sayText = '';
  s.rotationStyle = s.rotationStyle || 'allAround'; s.image = null;
  if (s.costumePath) { var img = new Image(); img.onload = function() { s.image = img; }; img.src = s.costumePath; }
});

// 自适应窗口
var ctx = canvas.getContext('2d');
function _resize() {
  var c = document.getElementById('game-container');
  var mw = c ? c.clientWidth - 16 : window.innerWidth - 16;
  var mh = c ? c.clientHeight - 60 : window.innerHeight - 60;
  var a = STAGE_W / STAGE_H, cw, ch;
  if (mw / mh > a) { ch = mh; cw = Math.floor(ch * a); } else { cw = mw; ch = Math.floor(cw / a); }
  canvas.width = STAGE_W; canvas.height = STAGE_H;
  canvas.style.width = Math.max(240, cw) + 'px'; canvas.style.height = Math.max(180, ch) + 'px';
}
_resize(); window.addEventListener('resize', _resize);

// 鼠标/键盘追踪
canvas.addEventListener('mousemove', function(e) {
  var r = canvas.getBoundingClientRect();
  mouseX = Math.round((e.clientX - r.left) / r.width * STAGE_W - STAGE_W / 2);
  mouseY = Math.round((e.clientY - r.top) / r.height * STAGE_H - STAGE_H / 2);
});
canvas.addEventListener('mousedown', function() { mouseDown = true; });
canvas.addEventListener('mouseup', function() { mouseDown = false; });
var _keyMap = {' ':'space','ArrowUp':'up','ArrowDown':'down','ArrowLeft':'left','ArrowRight':'right','Enter':'enter','Shift':'shift','Control':'control','Alt':'alt','Escape':'escape','Tab':'tab','Backspace':'backspace'};
function mapKey(k) { return _keyMap[k] || k.toLowerCase(); }
document.addEventListener('keydown', function(e) { if (!e.repeat) pressedKeys[mapKey(e.key)] = true; });
document.addEventListener('keyup', function(e) { delete pressedKeys[mapKey(e.key)]; });

// 渲染
function render() {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  if (_stageBgImg && _stageBgImg.complete) {
    var bw = _stageBgImg.width, bh = _stageBgImg.height, sc = Math.min(STAGE_W/bw, STAGE_H/bh);
    var dw = bw*sc, dh = bh*sc;
    ctx.drawImage(_stageBgImg, (STAGE_W-dw)/2, (STAGE_H-dh)/2, dw, dh);
  } else { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, STAGE_W, STAGE_H); }
  sprites.forEach(function(s) {
    if (!s.visible) return;
    ctx.save(); ctx.translate(STAGE_W/2 + s.x, STAGE_H/2 - s.y);
    if (s.rotationStyle === 'allAround') ctx.rotate((s.direction - 90) * Math.PI / 180);
    else if (s.rotationStyle === 'leftRight' && s.direction > 180) ctx.scale(-1, 1);
    var sc = s.size / 100; ctx.scale(sc, sc);
    if (s.image) { ctx.drawImage(s.image, -s.image.width/2, -s.image.height/2); }
    else {
      ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(14,14); ctx.lineTo(-14,14); ctx.closePath();
      ctx.fillStyle = s.color || '#4C97FF'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4,-4,3,0,Math.PI*2); ctx.arc(4,-4,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-3,-4,1.5,0,Math.PI*2); ctx.arc(5,-4,1.5,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    if (s.sayText) {
      var bx = STAGE_W/2+s.x+25, by = STAGE_H/2-s.y-30;
      ctx.fillStyle='#fff'; ctx.strokeStyle='#333'; ctx.lineWidth=1;
      ctx.font='12px sans-serif'; var tw=ctx.measureText(s.sayText).width;
      ctx.beginPath(); ctx.roundRect(bx,by,tw+12,22,6); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#333'; ctx.fillText(s.sayText, bx+6, by+15);
    }
  });
}
function _renderLoop() { render(); requestAnimationFrame(_renderLoop); }
_renderLoop();

// === 游戏 API（snake_case, 供用户代码调用） ===
var _activeSpriteIdx = 0;
function _getSprite(i) { return sprites[i >= 0 ? i : _activeSpriteIdx] || sprites[0]; }
function _num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : (d || 0); }
function set_sprite(name_or_idx) {
  if (typeof name_or_idx === 'number' || /^\\d+$/.test(String(name_or_idx))) { _activeSpriteIdx = _num(name_or_idx, 0); }
  else { var i = sprites.findIndex(function(s){return s.name===String(name_or_idx);}); if (i>=0) _activeSpriteIdx = i; }
  return _activeSpriteIdx;
}
function sprite_name() { var s = _getSprite(_activeSpriteIdx); return s ? s.name : ''; }
function sprite_count() { return sprites.length; }
function get_x() { var s = _getSprite(_activeSpriteIdx); return s ? s.x : 0; }
function get_y() { var s = _getSprite(_activeSpriteIdx); return s ? s.y : 0; }
function get_direction() { var s = _getSprite(_activeSpriteIdx); return s ? s.direction : 90; }
function get_size() { var s = _getSprite(_activeSpriteIdx); return s ? s.size : 100; }
function set_x(v) { var s = _getSprite(_activeSpriteIdx); if (s) s.x = _num(v); }
function set_y(v) { var s = _getSprite(_activeSpriteIdx); if (s) s.y = _num(v); }
function change_x(v) { var s = _getSprite(_activeSpriteIdx); if (s) s.x += _num(v); }
function change_y(v) { var s = _getSprite(_activeSpriteIdx); if (s) s.y += _num(v); }
function goto_xy(x, y) { var s = _getSprite(_activeSpriteIdx); if (s) { s.x = _num(x); s.y = _num(y); } }
function move(steps) {
  var s = _getSprite(_activeSpriteIdx); if (!s) return;
  var rad = (s.direction - 90) * Math.PI / 180;
  s.x += Math.cos(rad) * _num(steps); s.y += Math.sin(rad) * _num(steps);
}
function turn_right(deg) { var s = _getSprite(_activeSpriteIdx); if (s) s.direction = ((s.direction + _num(deg)) % 360 + 360) % 360; }
function turn_left(deg) { var s = _getSprite(_activeSpriteIdx); if (s) s.direction = ((s.direction - _num(deg)) % 360 + 360) % 360; }
function point_in_direction(deg) { var s = _getSprite(_activeSpriteIdx); if (s) s.direction = _num(deg); }
function bounce_edge() {
  var s = _getSprite(_activeSpriteIdx); if (!s) return;
  var hw = STAGE_W/2, hh = STAGE_H/2;
  if (s.x < -hw || s.x > hw) s.direction = 180 - s.direction;
  if (s.y < -hh || s.y > hh) s.direction = -s.direction;
}
function point_towards_xy(x, y) {
  var s = _getSprite(_activeSpriteIdx); if (!s) return;
  s.direction = Math.atan2(_num(y) - s.y, _num(x) - s.x) * 180 / Math.PI + 90;
}
function show() { var s = _getSprite(_activeSpriteIdx); if (s) s.visible = true; }
function hide() { var s = _getSprite(_activeSpriteIdx); if (s) s.visible = false; }
function set_size(v) { var s = _getSprite(_activeSpriteIdx); if (s) s.size = _num(v, 100); }
function change_size(d) { var s = _getSprite(_activeSpriteIdx); if (s) s.size += _num(d); }
function say(text) { var s = _getSprite(_activeSpriteIdx); if (s) s.sayText = String(text); }
function clear_say() { var s = _getSprite(_activeSpriteIdx); if (s) s.sayText = ''; }
function say_for(text, sec) { say(text); var idx = _activeSpriteIdx; setTimeout(function(){ var s = sprites[idx]; if(s && s.sayText) s.sayText = ''; }, _num(sec,1)*1000); }
function think(text) { say('\\u{1F4AD} ' + String(text)); }
function stage_width() { return STAGE_W; }
function stage_height() { return STAGE_H; }
function mouse_x() { return mouseX; }
function mouse_y() { return mouseY; }
function mouse_down() { return mouseDown; }
function key_pressed(key) { return !!pressedKeys[String(key)]; }
function touching_edge() { var s = _getSprite(_activeSpriteIdx); if(!s) return false; var hw=STAGE_W/2,hh=STAGE_H/2; return s.x<=-hw||s.x>=hw||s.y<=-hh||s.y>=hh; }
function touching_sprite(name) {
  var s = _getSprite(_activeSpriteIdx), t = sprites.find(function(sp){return sp.name===String(name);});
  if (!s || !t) return false;
  var dx = s.x-t.x, dy = s.y-t.y; return Math.sqrt(dx*dx+dy*dy) < 40;
}
function distance_to(name) {
  var s = _getSprite(_activeSpriteIdx), t = sprites.find(function(sp){return sp.name===String(name);});
  if (!s || !t) return 0; return Math.sqrt((s.x-t.x)**2+(s.y-t.y)**2);
}
function sprite_x(name) { var t = sprites.find(function(sp){return sp.name===String(name);}); return t ? t.x : 0; }
function sprite_y(name) { var t = sprites.find(function(sp){return sp.name===String(name);}); return t ? t.y : 0; }
function timer_now() { return (Date.now() - _startTime) / 1000; }
function random_int(a, b) { var lo=Math.min(_num(a),_num(b)), hi=Math.max(_num(a),_num(b)); return Math.floor(Math.random()*(hi-lo+1))+lo; }
function get_var(name, def) { var k=String(name); return k in globalVars ? globalVars[k] : _num(def, 0); }
function set_var(name, v) { globalVars[String(name)] = v; }
function change_var(name, d) { var k=String(name); globalVars[k] = _num(globalVars[k],0)+_num(d); return globalVars[k]; }
function has_var(name) { return String(name) in globalVars; }
function sleep(sec) { var end = Date.now() + Math.max(0, _num(sec)*1000); while (Date.now() < end) {} }
function stop_all() { stopRun(); }
// 数学辅助
function math_abs(v){return Math.abs(_num(v));} function math_floor(v){return Math.floor(_num(v));}
function math_ceil(v){return Math.ceil(_num(v));} function math_round(v){return Math.round(_num(v));}
function math_sqrt(v){return Math.sqrt(_num(v));} function math_min(a,b){return Math.min(_num(a),_num(b));}
function math_max(a,b){return Math.max(_num(a),_num(b));} function math_pi(){return Math.PI;}
function math_sin(v){return Math.sin(_num(v));} function math_cos(v){return Math.cos(_num(v));}
function math_tan(v){return Math.tan(_num(v));}
// 文本辅助
function str_len(s){return String(s==null?'':s).length;} function str_upper(s){return String(s==null?'':s).toUpperCase();}
function str_lower(s){return String(s==null?'':s).toLowerCase();} function str_trim(s){return String(s==null?'':s).trim();}

${runner === 'javascript' ? `
// JavaScript 代码模式运行时
var _apiFuncs = ['set_sprite','sprite_name','sprite_count','get_x','get_y','get_direction','get_size',
  'set_x','set_y','change_x','change_y','goto_xy','move','turn_right','turn_left','point_in_direction',
  'bounce_edge','point_towards_xy','show','hide','set_size','change_size','say','clear_say','say_for',
  'think','stage_width','stage_height','mouse_x','mouse_y','mouse_down','key_pressed','touching_edge',
  'touching_sprite','distance_to','sprite_x','sprite_y','timer_now','random_int','get_var','set_var',
  'change_var','has_var','sleep','stop_all','math_abs','math_floor','math_ceil','math_round','math_sqrt',
  'math_min','math_max','math_pi','math_sin','math_cos','math_tan','str_len','str_upper','str_lower','str_trim'];
function _execFrame() {
  if (!running) return;
  Object.keys(_codeMap).forEach(function(name) {
    var idx = sprites.findIndex(function(s){return s.name===name;});
    if (idx < 0) return;
    _activeSpriteIdx = idx;
    try {
      // 把 API 函数注入到执行上下文
      var args = _apiFuncs.map(function(n){ return 'var ' + n + ' = window.' + n + ';'; }).join('');
      var fn = new Function(args + _codeMap[name]);
      fn.call(sprites[idx]);
    } catch(e) { log('[JS] ' + name + ': ' + e.message); }
  });
}
function startRun() {
  if (running) return;
  running = true; globalVars = {}; output = []; outputEl.textContent = ''; _startTime = Date.now();
  _frameTimer = setInterval(_execFrame, ${interval});
}
function stopRun() { running = false; if (_frameTimer) { clearInterval(_frameTimer); _frameTimer = null; } }
` : ''}
${runner === 'python' ? `
// Python 代码模式运行时 (Skulpt)
var _pyReady = false;
function _initSkulpt() {
  if (typeof Sk === 'undefined') { log('Skulpt 未加载, 请检查网络连接'); return false; }
  Sk.configure({
    output: function(t) { log(t.replace(/\\n$/, '')); },
    read: function(x) { if (Sk.builtinFiles === undefined || Sk.builtinFiles['files'][x] === undefined) throw 'File not found'; return Sk.builtinFiles['files'][x]; },
    __future__: Sk.python3
  });
  // 注入游戏 API 到 Python 全局
  var apiDefs = '';
  var apiNames = ['set_sprite','sprite_name','sprite_count','get_x','get_y','get_direction','get_size',
    'set_x','set_y','change_x','change_y','goto_xy','move','turn_right','turn_left','point_in_direction',
    'bounce_edge','point_towards_xy','show','hide','set_size','change_size','say','clear_say','say_for',
    'think','stage_width','stage_height','mouse_x','mouse_y','mouse_down','key_pressed','touching_edge',
    'touching_sprite','distance_to','sprite_x','sprite_y','timer_now','random_int','get_var','set_var',
    'change_var','has_var','stop_all','math_abs','math_floor','math_ceil','math_round','math_sqrt',
    'math_min','math_max','math_pi','math_sin','math_cos','math_tan','str_len','str_upper','str_lower','str_trim'];
  apiNames.forEach(function(n) {
    Sk.builtins[n] = new Sk.builtin.func(function() {
      var args = Array.prototype.slice.call(arguments).map(function(a) { return Sk.ffi.remapToJs(a); });
      return Sk.ffi.remapToPy(window[n].apply(null, args));
    });
  });
  _pyReady = true;
  return true;
}
function _execPyFrame() {
  if (!running || !_pyReady) return;
  Object.keys(_codeMap).forEach(function(name) {
    var idx = sprites.findIndex(function(s){return s.name===name;});
    if (idx < 0) return;
    _activeSpriteIdx = idx;
    try { Sk.misceval.asyncToPromise(function(){ return Sk.importMainWithBody('<'+name+'>', false, _codeMap[name], true); }); }
    catch(e) { log('[Py] ' + name + ': ' + (e.tp\$str ? Sk.ffi.remapToJs(e.tp\$str()) : e.message)); }
  });
}
function startRun() {
  if (running) return;
  running = true; globalVars = {}; output = []; outputEl.textContent = ''; _startTime = Date.now();
  if (!_pyReady) { if (!_initSkulpt()) { running = false; return; } }
  _frameTimer = setInterval(_execPyFrame, ${interval});
}
function stopRun() { running = false; if (_frameTimer) { clearInterval(_frameTimer); _frameTimer = null; } }
` : ''}
${albBranchCode}
${autoRun ? 'setTimeout(function(){ startRun(); }, 500);' : ''}
<\/script>
</body>
</html>`;
  }

  /** 收集导出数据所需的公共数据 */
  function _collectExportData() {
    var projectName = EditorState.projectName || 'Objector';
    var blocksData = {};
    if (typeof StageManager !== 'undefined') {
      var _activeIdx = StageManager.getActiveSpriteIdx ? StageManager.getActiveSpriteIdx() : 0;
      var _allSprites = StageManager.getSprites();
      if (_activeIdx >= 0 && _activeIdx < _allSprites.length && _allSprites[_activeIdx]) {
        _allSprites[_activeIdx].blocks = { ...(EditorState.blocks || {}) };
      }
      for (var _si = 0; _si < _allSprites.length; _si++) {
        if (_allSprites[_si].isStage) continue;
        if (_allSprites[_si].blocks) Object.assign(blocksData, _allSprites[_si].blocks);
      }
    }
    if (Object.keys(blocksData).length === 0) blocksData = EditorState.blocks || {};
    var spritesData = [];
    try {
      var sprites = StageManager.getSprites();
      for (var si = 0; si < sprites.length; si++) {
        var s = sprites[si];
        var spriteData = {
          name: s.name, x: s.x, y: s.y, direction: s.direction,
          size: s.size, visible: s.visible, color: s.color || '#4C97FF',
          rotationStyle: s.rotationStyle || 'allAround',
          isStage: s.isStage || false,
        };
        var costumeImg = s.costumeImage;
        if (costumeImg) {
          try {
            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = costumeImg.width; tmpCanvas.height = costumeImg.height;
            var tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(costumeImg, 0, 0);
            spriteData.costumePath = tmpCanvas.toDataURL('image/png');
          } catch (e) {}
        }
        spritesData.push(spriteData);
      }
    } catch(e) { console.warn('[HTML导出] 获取精灵失败:', e.message); }
    var extExecs = {};
    var pyExtSkipped = 0;
    try {
      if (typeof ExtensionManager !== 'undefined' && ExtensionManager.getExecutors) {
        ExtensionManager.getExecutors().forEach(function(fn, type) {
          // Python 扩展执行器需要 Skulpt 解释器, 导出页面内无法运行 → 跳过重建（fn.toString() 只能拿到 JS 包装壳）
          if (fn && fn.__extLang === 'python') { pyExtSkipped++; return; }
          try { extExecs[type] = fn.toString(); } catch(e) {}
        });
      }
    } catch(e) {}
    if (pyExtSkipped > 0) {
      console.warn('[HTML导出] 已跳过 ' + pyExtSkipped + ' 个 Python 扩展执行器（导出页面无 Python 解释器）');
      alert(i18n.isEnglish()
        ? 'Note: ' + pyExtSkipped + ' Python extension block(s) cannot run in the exported HTML (no Python interpreter embedded). Use JS/JSON extensions for web export.'
        : '注意: ' + pyExtSkipped + ' 个 Python 扩展积木在导出的 HTML 中无法运行（导出页面不含 Python 解释器）。如需网页/EXE 发布, 请改用 JS 或 JSON 扩展。');
    }
    var extJsSrcs = [];
    try {
      if (typeof ExtensionManager !== 'undefined' && ExtensionManager.getJsSources) {
        extJsSrcs = ExtensionManager.getJsSources();
      }
    } catch(e) {}
    return { projectName: projectName, blocksData: blocksData, spritesData: spritesData, extExecs: extExecs, extJsSrcs: extJsSrcs };
  }

  /** 导出 HTML 文件 */
  async function exportProject(exportSettings) {
    console.log('[HTML导出] 开始导出...');
    var projectName = (typeof EditorState !== 'undefined' && EditorState.projectName) ? EditorState.projectName : 'Objector';
    var html;
    if (_isCodeMode()) {
      // 代码模式: 内置解释器 + 角色代码
      var codeData = await _collectCodeModeData();
      console.log('[HTML导出] 代码模式, 语言:', codeData.runner, '角色数:', Object.keys(codeData.codeMap).length);
      if (Object.keys(codeData.codeMap).length === 0) {
        alert(i18n.isEnglish() ? 'No code to export' : '没有代码可以导出'); return;
      }
      html = generateCodeModeHTML(projectName, codeData.spritesData, codeData.runner, codeData.codeMap, exportSettings, codeData.albSource);
    } else {
      // 积木模式
      var data = _collectExportData();
      projectName = data.projectName;
      var _blockCount = Object.keys(data.blocksData).length;
      console.log('[HTML导出] 项目名:', projectName, '积木数:', _blockCount);
      if (!data.blocksData || _blockCount === 0) {
        alert(i18n.isEnglish() ? 'No blocks to export' : '没有积木可以导出'); return;
      }
      html = generateHTML(projectName, data.blocksData, data.spritesData, data.extExecs, data.extJsSrcs, exportSettings);
    }
    console.log('[HTML导出] 生成HTML...', 'HTML长度:', html.length);

    if (window.api && window.api.saveFileDialog && !window.api._isWebShim) {
      console.log('[HTML\u5bfc\u51fa] Electron\u6a21\u5f0f');
      var filePath = await window.api.saveFileDialog(
        projectName + '.html',
        [{ name: 'HTML \u6587\u4ef6', extensions: ['html', 'htm'] }]
      );
      if (filePath) {
        var result = await window.api.writeFile(filePath, html);
        if (result && result.error) {
          alert(i18n.isEnglish() ? 'Export failed: ' + result.error : '\u5bfc\u51fa\u5931\u8d25: ' + result.error);
          return;
        }
        document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'Exported: ' : '\u5df2\u5bfc\u51fa: ') + filePath.split(/[\\/]/).pop();
      } else {
        // saveFileDialog 返回 null（用户取消或 shim 不支持），降级为 Blob 下载
        console.log('[HTML\u5bfc\u51fa] saveFileDialog\u8fd4\u56denull, \u964d\u7ea7\u4e3aBlob\u4e0b\u8f7d');
        blobDownload(projectName, html);
      }
    } else {
      console.log('[HTML\u5bfc\u51fa] \u7f51\u9875\u6a21\u5f0f, \u4f7f\u7528Blob\u4e0b\u8f7d');
      blobDownload(projectName, html);
    }
    setTimeout(function() {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 3000);
  }

  /** 导出为 ZIP 可执行包 */
  async function exportAsExe(exportSettings) {
    console.log('[EXE导出] 开始...');
    var projectName = (typeof EditorState !== 'undefined' && EditorState.projectName) ? EditorState.projectName : 'Objector';
    var gameTitle = (exportSettings && exportSettings.title) || projectName;
    var html;
    if (_isCodeMode()) {
      var codeData = await _collectCodeModeData();
      console.log('[EXE导出] 代码模式, 语言:', codeData.runner);
      if (Object.keys(codeData.codeMap).length === 0) {
        alert(i18n.isEnglish() ? 'No code to export' : '没有代码可以导出'); return;
      }
      html = generateCodeModeHTML(projectName, codeData.spritesData, codeData.runner, codeData.codeMap, exportSettings, codeData.albSource);
    } else {
      var data = _collectExportData();
      projectName = data.projectName;
      gameTitle = (exportSettings && exportSettings.title) || projectName;
      var _blockCount = Object.keys(data.blocksData).length;
      if (!data.blocksData || _blockCount === 0) {
        alert(i18n.isEnglish() ? 'No blocks to export' : '没有积木可以导出'); return;
      }
      html = generateHTML(projectName, data.blocksData, data.spritesData, data.extExecs, data.extJsSrcs, exportSettings);
    }
    console.log('[EXE导出] 生成HTML...', 'HTML长度:', html.length);
    var safeName = projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_\-]/g, '_');
    var targetPlatform = (exportSettings && exportSettings.targetPlatform) || 'win32';
    var packageType = (exportSettings && exportSettings.packageType) || 'zip';
    var installPathType = (exportSettings && exportSettings.installPathType) || 'user-select';
  
    // Electron 模式：调用主进程 electron-packager 打包
    if (window.api && window.api.buildExe) {
      var statusEl = document.getElementById('status-text');
      if (statusEl) statusEl.textContent = i18n.t('exportDialog.checkingDeps') || '检测导出环境...';

      // 1. 检测依赖
      var depsOk = false;
      if (window.api.checkExportDeps) {
        try {
          var deps = await window.api.checkExportDeps({ targetPlatform: targetPlatform, packageType: packageType });
          console.log('[EXE导出] 依赖检测:', deps);
          depsOk = deps.available;
        } catch (e) {
          console.warn('[EXE导出] 依赖检测失败:', e);
        }
      }

      // 2. 如果有缺失依赖，自动下载
      if (!depsOk && window.api.downloadExportDeps) {
        var progressDialog = document.getElementById('export-progress-dialog');
        var progressStatus = document.getElementById('export-progress-status');
        var progressBar = document.getElementById('export-progress-bar');
        var progressDetail = document.getElementById('export-progress-detail');
        if (progressDialog) progressDialog.classList.remove('hidden');
        if (progressStatus) progressStatus.textContent = i18n.t('exportDialog.preparingEnv') || '准备导出环境';

        var progressHandler = function(data) {
          if (progressStatus) progressStatus.textContent = data.message || data.stage;
          if (progressBar) progressBar.style.width = (data.percent || 0) + '%';
          if (progressDetail) {
            if (data.transferred && data.total) {
              var mbDone = (data.transferred / 1048576).toFixed(1);
              var mbTotal = (data.total / 1048576).toFixed(1);
              progressDetail.textContent = mbDone + ' / ' + mbTotal + ' MB';
            } else {
              progressDetail.textContent = '';
            }
          }
        };
        if (window.api.onExportDepsProgress) {
          window.api.onExportDepsProgress(progressHandler);
        }

        try {
          var dlResult = await window.api.downloadExportDeps({ targetPlatform: targetPlatform, packageType: packageType });
          if (!dlResult.success) {
            alert((i18n.t('exportDialog.downloadFailed') || '下载失败') + ': ' + dlResult.error);
            if (progressDialog) progressDialog.classList.add('hidden');
            if (statusEl) statusEl.textContent = i18n.t('status.ready');
            return;
          }
        } catch (dlErr) {
          alert((i18n.t('exportDialog.downloadFailed') || '下载失败') + ': ' + dlErr.message);
          if (progressDialog) progressDialog.classList.add('hidden');
          if (statusEl) statusEl.textContent = i18n.t('status.ready');
          return;
        }

        if (progressDialog) progressDialog.classList.add('hidden');
        if (statusEl) statusEl.textContent = i18n.t('exportDialog.downloadComplete') || '下载完成，开始打包...';
      }

      if (statusEl) statusEl.textContent = '正在打包可执行文件，请稍候（可能需要1-2分钟）...';

      // 先获取文件信息并让用户选择保存路径（避免打包完成后返回超大 base64）
      var fileExt = 'zip', filterName = 'ZIP 压缩包', defaultFileName = safeName + '.zip';
      if (window.api.getExportFileInfo) {
        try {
          var fileInfo = await window.api.getExportFileInfo({ targetPlatform: targetPlatform, packageType: packageType, projectName: gameTitle });
          fileExt = fileInfo.fileExt || 'zip';
          filterName = fileInfo.filterName || 'ZIP 压缩包';
          defaultFileName = fileInfo.safeFileName || (safeName + '.' + fileExt);
        } catch(e) { console.warn('[EXE导出] getExportFileInfo 失败:', e); }
      }
      var outPath = null;
      if (window.api.saveFileDialog) {
        outPath = await window.api.saveFileDialog(defaultFileName, [{ name: filterName, extensions: [fileExt] }]);
        if (!outPath) { if (statusEl) statusEl.textContent = i18n.t('status.ready'); return; }
      }

      console.log('[EXE导出] 调用 build-exe IPC...', targetPlatform, packageType, 'outPath:', outPath);
      try {
        // 先将 HTML 写入临时文件（直接用 Node.js fs，绕过 IPC 避免大内容序列化超时）
        var tempHtmlPath = window.api.writeFileTempLocal
          ? await window.api.writeFileTempLocal('export-html-' + Date.now() + '.html', html)
          : await window.api.writeFileTemp('export-html-' + Date.now() + '.html', html);
        if (!tempHtmlPath) {
          alert('写入临时文件失败');
          if (statusEl) statusEl.textContent = i18n.t('status.ready');
          return;
        }
        console.log('[EXE导出] HTML 已写入临时文件:', tempHtmlPath);

        if (window.api.onExportDepsProgress) {
          window.api.onExportDepsProgress(function(data) {
            if (statusEl && data.message) statusEl.textContent = data.message;
          });
        }
        var result = await window.api.buildExe({
          htmlPath: tempHtmlPath, projectName: gameTitle, iconPath: null,
          outPath: outPath,
          targetPlatform: targetPlatform,
          packageType: packageType,
          installPathType: installPathType,
        });
        if (result.error) {
          alert('打包失败: ' + result.error);
          if (statusEl) statusEl.textContent = i18n.t('status.ready');
          return;
        }
        if (result.success && result.savedPath) {
          if (statusEl) statusEl.textContent = '已导出: ' + result.savedPath.split(/[\\/]/).pop();
          setTimeout(function() { if (statusEl) statusEl.textContent = i18n.t('status.ready'); }, 5000);
          console.log('[EXE导出] 完成! 已写入:', result.savedPath);
          return;
        }
        // 兼容旧流程（无 outPath 时返回 base64）
        if (result.fileBase64 && outPath) {
          var wr = await window.api.writeFileBinary(outPath, result.fileBase64);
          if (wr && wr.error) { alert('写入失败: ' + wr.error); return; }
          if (statusEl) statusEl.textContent = '已导出: ' + outPath.split(/[\\/]/).pop();
          setTimeout(function() { if (statusEl) statusEl.textContent = i18n.t('status.ready'); }, 5000);
          console.log('[EXE导出] 完成!');
          return;
        }
      } catch(e) {
        console.error('[EXE导出] 失败:', e);
        alert('打包失败: ' + e.message);
        if (statusEl) statusEl.textContent = i18n.t('status.ready');
        return;
      }
    }
  
    // Web 模式 / 回退：生成包含 HTML + 启动脚本的 ZIP
    if (typeof JSZip === 'undefined') {
      alert(i18n.isEnglish() ? 'JSZip not loaded' : 'JSZip 未加载'); return;
    }
    console.log('[EXE导出] 回退为 HTML ZIP...');
    var zip = new JSZip();
    zip.file('index.html', html);
    var readme = '=== ' + gameTitle + ' ===\n\n'
      + '【运行方法】\n'
      + '  方法1: 双击 start.bat (Windows) 或 ./start.sh (Mac/Linux)\n'
      + '  方法2: 用浏览器打开 index.html\n\n'
      + '【操作说明】\n'
      + '  键盘: 方向键移动, 空格/Enter执行\n';
    readme += '\n由 ObjectScratch 导出\n';
    zip.file('README.txt', readme);
    zip.file('start.bat', '@echo off\r\nstart "" "%~dp0index.html"\r\n');
    zip.file('start.sh', '#!/bin/bash\nDIR="$(cd "$(dirname "$0")" && pwd)"\nif command -v xdg-open &>/dev/null; then\n  xdg-open "$DIR/index.html"\nelif command -v open &>/dev/null; then\n  open "$DIR/index.html"\nelse\n  echo "Please open index.html in your browser"\nfi\n');
    var zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    var url = URL.createObjectURL(zipBlob);
    var a = document.createElement('a');
    a.href = url; a.download = safeName + '.zip'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    var statusEl = document.getElementById('status-text');
    if (statusEl) statusEl.textContent = '已导出: ' + safeName + '.zip';
    setTimeout(function() { if (statusEl) statusEl.textContent = i18n.t('status.ready'); }, 3000);
    console.log('[EXE导出] Web模式完成!');
  }
  
  return { exportProject, exportAsExe, generateHTML };
})();
