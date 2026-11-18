import { Game } from './game/Game.js';

function fail(msg) {
  const l = document.getElementById('loading');
  if (l) l.innerHTML = `<div class="load-err">${msg}</div>`;
}

try {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('nowebgl');
  const game = new Game(document.getElementById('game-canvas'), document.getElementById('ui-root'));
  game.boot();
  window.__game = game; // 便于调试
} catch (e) {
  console.error(e);
  fail(e.message === 'nowebgl' ? '你的浏览器不支持 WebGL，无法运行 3D 游戏。请使用最新版 Chrome / Edge / Safari。' : '游戏加载失败：' + e.message);
}
