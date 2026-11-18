import * as THREE from 'three';
import { mat, GEO, canvasTexture, textTexture, glowTexture } from './materials.js';
import { Batcher } from './Batcher.js';

export const WALL_H = 2.8;
const T = 0.2;

// 布局（单位：米）
// 卧室 x[-9,-3] z[-6,0]，厨房 x[-9,-3] z[0,6]，客厅 x[-3,8] z[-6,6]
// 玄关 x[5,8] z[-2.5,2.5]，楼道 x[8,22] z[-2.5,2.5]，电梯厅/保安室 x[22,28] z[-6,6]
export function buildApartment(scene, { mobile = false } = {}) {
  const colliders = [];
  const blockers = [];
  const batch = new Batcher();
  const root = new THREE.Group();
  scene.add(root);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  const place = (geo, material, x, y, z, sx, sy, sz, rotY = 0, f = {}) => {
    _e.set(f.rotX || 0, rotY, f.rotZ || 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    batch.add(geo, _m, material, { cast: f.cast !== false, receive: f.receive !== false, block: !!f.block });
  };
  const addCol = (x, z, w, d, pad = 0) => colliders.push({ minX: x - w / 2 - pad, maxX: x + w / 2 + pad, minZ: z - d / 2 - pad, maxZ: z + d / 2 + pad });
  // y 为底面高度
  const box = (x, y, z, w, h, d, color, o = {}) => {
    place(GEO.box, o.material || mat(color, o.mat), x, y + h / 2, z, w, h, d, o.rot || 0, o);
    if (o.collide) addCol(x, z, w, d, o.pad || 0);
  };
  const cyl = (x, y, z, r, h, color, o = {}) => {
    place(GEO.cyl, mat(color, o.mat), x, y + h / 2, z, r * 2, h, r * 2, 0, o);
    if (o.collide) addCol(x, z, r * 2, r * 2);
  };
  const sphere = (x, y, z, r, color, o = {}) => place(GEO.sphere, mat(color, o.mat), x, y, z, r * 2, r * 2 * (o.sy || 1), r * 2, 0, o);

  const wall = (x1, z1, x2, z2, color) => {
    const horiz = z1 === z2;
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const w = horiz ? Math.abs(x2 - x1) + T : T;
    const d = horiz ? T : Math.abs(z2 - z1) + T;
    place(GEO.box, mat(color), cx, WALL_H / 2, cz, w, WALL_H, d, 0, { block: true });
    place(GEO.box, mat('#5d4b3c'), cx, 0.06, cz, w + 0.03, 0.12, d + 0.03, 0, { cast: false });
    place(GEO.box, mat('#b9b0a2'), cx, WALL_H - 0.03, cz, w + 0.02, 0.06, d + 0.02, 0, { cast: false });
    addCol(cx, cz, w, d);
  };

  // ---------- 地板纹理 ----------
  const wood = canvasTexture(256, (ctx, S) => {
    ctx.fillStyle = '#7a5434';
    ctx.fillRect(0, 0, S, S);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const y = (r * S) / rows;
      const off = ((r * 97) % 128);
      for (let k = -1; k < 3; k++) {
        const x = off + (k * S) / 2;
        const l = 52 + (((r * 7 + k * 13) % 9) - 4);
        ctx.fillStyle = `hsl(30, 42%, ${l}%)`;
        ctx.fillRect(x + 1, y + 1, S / 2 - 2, S / rows - 2);
        ctx.fillStyle = 'rgba(80,50,25,0.08)';
        for (let g = 0; g < 4; g++) ctx.fillRect(x + 4, y + 4 + g * 6, S / 2 - 10, 1);
      }
    }
  });
  const tile = (base, line, n = 4) =>
    canvasTexture(256, (ctx, S) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = line;
      for (let i = 0; i <= n; i++) {
        ctx.fillRect((i * S) / n - 1, 0, 2, S);
        ctx.fillRect(0, (i * S) / n - 1, S, 2);
      }
    });
  const kitchenTile = tile('#e7e1d6', '#c9c0b0');
  const greyTile = tile('#b9bec4', '#9aa1a9', 2);
  const marble = tile('#d8d4cc', '#bdb7ad', 2);
  const darkTile = tile('#6f675f', '#5a534c', 4);

  const floorMeshes = [];
  const floor = (x1, z1, x2, z2, tex, rep, y = 0, tint = '#ffffff') => {
    const w = x2 - x1, d = z2 - z1;
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(w / rep, d / rep);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, color: tint, roughness: 0.75 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    m.receiveShadow = true;
    root.add(m);
    floorMeshes.push(m);
  };
  // 外部地面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), mat('#1b1f26', { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(9, -0.02, 0);
  root.add(ground);

  floor(-9, -6, -3, 0, wood, 2.2, 0.001, '#f3dcc4');
  floor(-9, 0, -3, 6, kitchenTile, 1.6, 0.001);
  floor(-3, -6, 8, 6, wood, 2.2, 0);
  floor(5, -2.5, 8, 2.5, darkTile, 1.2, 0.003);
  floor(8, -2.5, 22, 2.5, greyTile, 1.2, 0.001);
  floor(22, -6, 28, 6, marble, 2, 0.001);

  // ---------- 墙体 ----------
  const IN = '#ece4d6', BED = '#dde6ee', KIT = '#f2eee6', COR = '#cfd5da', LOB = '#c5cbd1';
  wall(-9, -6, 8, -6, IN);
  wall(-9, 6, 8, 6, IN);
  wall(-9, -6, -9, 6, IN);
  wall(8, -6, 8, -1, IN);
  wall(8, 1, 8, 6, IN);
  wall(-9, 0, -3, 0, BED);
  wall(-3, -6, -3, -2.6, BED);
  wall(-3, -1.2, -3, 0, BED);
  wall(-3, 0, -3, 1.5, KIT);
  wall(-3, 4.5, -3, 6, KIT);
  wall(5, -2.5, 8, -2.5, IN);
  wall(5, 2.5, 8, 2.5, IN);
  wall(5, -2.5, 5, -1, IN);
  wall(5, 1, 5, 2.5, IN);
  wall(8, -2.5, 22, -2.5, COR);
  wall(8, 2.5, 22, 2.5, COR);
  wall(22, -6, 28, -6, LOB);
  wall(22, 6, 28, 6, LOB);
  wall(28, -6, 28, 6, LOB);
  wall(22, -6, 22, -2.5, LOB);
  wall(22, 2.5, 22, 6, LOB);
  // 门楣
  box(-3, 2.15, -1.9, 0.24, 0.65, 1.6, '#8a6a50', { cast: false });
  box(8, 2.15, 0, 0.26, 0.65, 2.2, '#5b4636', { cast: false });
  box(5, 2.3, 0, 0.24, 0.5, 2.2, '#cbbfae', { cast: false });
  // 入户门（敞开）
  box(7.35, 0, -1.0, 0.9, 2.1, 0.06, '#5c3f2c', { cast: false });
  box(7.05, 1.0, -0.95, 0.06, 0.06, 0.1, '#d8c27a', { cast: false });

  // ---------- 窗户（材质随时间变化） ----------
  const windowMat = new THREE.MeshBasicMaterial({ color: '#a9cfe8' });
  const windows = [];
  const addWindow = (x, z, w, facing) => {
    const m = new THREE.Mesh(GEO.plane, windowMat);
    m.scale.set(w, 1.15, 1);
    m.position.set(x, 1.65, z);
    m.rotation.y = facing;
    root.add(m);
    windows.push(m);
    const horiz = Math.abs(Math.sin(facing)) < 0.5;
    const fw = horiz ? w + 0.16 : 0.1, fd = horiz ? 0.1 : w + 0.16;
    box(x, 1.0, z, fw, 0.08, fd, '#f7f7f7', { cast: false });
    box(x, 2.23, z, fw, 0.08, fd, '#f7f7f7', { cast: false });
    box(x, 1.0, z, horiz ? 0.05 : 0.11, 1.3, horiz ? 0.11 : 0.05, '#f7f7f7', { cast: false });
  };
  addWindow(-6.5, -5.88, 1.6, 0);
  addWindow(3.8, -5.88, 1.8, 0);
  addWindow(-6.8, 5.88, 1.2, Math.PI);
  addWindow(3.5, 5.88, 1.8, Math.PI);

  // ---------- 卧室 ----------
  box(-7.85, 0, -4.3, 2.1, 0.35, 1.7, '#7a5a40', { collide: true });
  box(-7.8, 0.35, -4.3, 2.0, 0.22, 1.6, '#f4f1ea');
  box(-7.05, 0.56, -4.3, 1.15, 0.1, 1.64, '#5f87b5');
  box(-8.45, 0.57, -4.3, 0.45, 0.14, 1.15, '#ffffff');
  box(-8.85, 0, -4.3, 0.1, 1.15, 1.8, '#6b4c35');
  box(-8.6, 0, -2.95, 0.5, 0.55, 0.5, '#8b6a4d', { collide: true });
  cyl(-8.6, 0.55, -2.95, 0.05, 0.3, '#cfcfcf');
  cyl(-8.6, 0.82, -2.95, 0.16, 0.22, '#ffe2b0', { mat: { emissive: '#ffb860', emissiveIntensity: 0.6 } });
  box(-4.4, 0, -5.55, 1.9, 2.2, 0.62, '#a07a58', { collide: true });
  box(-4.4, 0.05, -5.23, 0.02, 2.1, 0.02, '#6d523b');
  box(-4.55, 1.0, -5.22, 0.05, 0.3, 0.04, '#d8c27a');
  box(-4.25, 1.0, -5.22, 0.05, 0.3, 0.04, '#d8c27a');
  // 梳妆台
  box(-6.4, 0, -0.38, 1.5, 0.85, 0.5, '#9b7656', { collide: true });
  box(-6.4, 0.3, -0.62, 1.42, 0.02, 0.02, '#6d523b');
  box(-6.4, 0.95, -0.15, 0.95, 1.05, 0.04, '#cfe3ea', { mat: { metalness: 0.7, roughness: 0.12 } });
  box(-6.4, 0.9, -0.13, 1.05, 0.06, 0.06, '#7b5a40');
  box(-6.4, 2.0, -0.13, 1.05, 0.06, 0.06, '#7b5a40');
  box(-6.95, 0.85, -0.42, 0.1, 0.18, 0.1, '#d77fa1');
  box(-6.75, 0.85, -0.42, 0.08, 0.12, 0.08, '#8fc6e8');
  // 首饰盒（静态部分）
  box(-6.05, 0.85, -0.4, 0.34, 0.12, 0.24, '#7b2d3a');
  box(-6.05, 0.95, -0.4, 0.3, 0.03, 0.2, '#e8d7c3', { cast: false });
  box(-6.05, 1.0, -0.53, 0.34, 0.22, 0.03, '#7b2d3a', { mat: {}, rotX: -0.35 });
  // 地毯、书桌
  box(-5.8, 0, -2.6, 2.6, 0.015, 1.8, '#c9a9a6', { cast: false });
  box(-3.7, 0, -3.8, 0.55, 0.75, 1.2, '#efe7da', { collide: true });
  box(-3.75, 0.75, -3.8, 0.3, 0.02, 0.4, '#2d2d33');
  box(-3.62, 0.76, -3.8, 0.03, 0.24, 0.38, '#2d2d33', { rotZ: -0.25 });
  // 墙上海报
  box(-8.88, 1.3, -1.6, 0.03, 0.7, 0.5, '#3b5c7e', { cast: false });

  // ---------- 厨房 ----------
  box(-8.6, 0, 3.3, 0.6, 0.9, 4.6, '#e9e9e9', { collide: true });
  box(-8.6, 0.9, 3.3, 0.64, 0.05, 4.64, '#3b3f45');
  box(-6.9, 0, 5.6, 2.8, 0.9, 0.6, '#e9e9e9', { collide: true });
  box(-6.9, 0.9, 5.6, 2.84, 0.05, 0.64, '#3b3f45');
  box(-8.78, 1.55, 3.3, 0.34, 0.7, 4.6, '#f6f6f6');
  for (let z = 1.3; z < 5.6; z += 0.92) box(-8.6, 0.12, z, 0.62, 0.66, 0.02, '#d5d5d5', { cast: false });
  box(-8.55, 0, 0.48, 0.72, 1.9, 0.7, '#cfd6dc', { collide: true, mat: { metalness: 0.3, roughness: 0.4 } });
  box(-8.18, 0.7, 0.62, 0.04, 0.5, 0.04, '#888');
  box(-8.6, 0.95, 2.6, 0.52, 0.02, 0.62, '#202024');
  cyl(-8.6, 0.97, 2.45, 0.09, 0.01, '#555');
  cyl(-8.6, 0.97, 2.75, 0.09, 0.01, '#555');
  box(-8.6, 0.93, 4.3, 0.45, 0.03, 0.6, '#9aa4ad', { mat: { metalness: 0.6, roughness: 0.3 } });
  box(-8.82, 0.95, 4.3, 0.04, 0.3, 0.04, '#bbb');
  box(-7.6, 0.95, 5.6, 0.3, 0.25, 0.25, '#c44');
  box(-5.6, 0, 2.8, 1.2, 0.74, 0.8, '#b08660', { collide: true });
  box(-5.6, 0, 2.05, 0.45, 0.45, 0.42, '#8a6a50', { collide: true });
  box(-5.6, 0.45, 1.86, 0.45, 0.45, 0.05, '#8a6a50');
  box(-5.6, 0, 3.55, 0.45, 0.45, 0.42, '#8a6a50', { collide: true });
  box(-5.6, 0.45, 3.74, 0.45, 0.45, 0.05, '#8a6a50');
  sphere(-5.6, 0.82, 2.8, 0.14, '#f3b23a', { sy: 0.6 });

  // ---------- 客厅 ----------
  box(1, 0, -5.65, 2.2, 0.5, 0.45, '#3a3a40', { collide: true });
  box(1, 0.75, -5.84, 1.9, 1.1, 0.07, '#111114');
  box(1, 0, -3.2, 3.6, 0.015, 2.8, '#3e5a6e', { cast: false });
  box(1, 0, -3.6, 1.2, 0.4, 0.62, '#a57c55', { collide: true });
  box(0.7, 0.4, -3.55, 0.2, 0.1, 0.15, '#e9e2d0');
  box(1, 0, -1.9, 2.6, 0.45, 0.95, '#5b6c8f', { collide: true });
  box(1, 0.45, -1.5, 2.6, 0.55, 0.22, '#53648a');
  box(-0.2, 0.45, -1.95, 0.22, 0.25, 0.9, '#53648a');
  box(2.2, 0.45, -1.95, 0.22, 0.25, 0.9, '#53648a');
  box(0.45, 0.45, -1.95, 0.9, 0.12, 0.7, '#6d7ea3');
  box(1.55, 0.45, -1.95, 0.9, 0.12, 0.7, '#6d7ea3');
  box(-0.1, 0.57, -1.7, 0.35, 0.3, 0.12, '#e8c25d', { rotZ: 0.2 });
  // 落地灯
  cyl(3.0, 0, -1.6, 0.18, 0.04, '#333');
  cyl(3.0, 0, -1.6, 0.025, 1.55, '#333');
  cyl(3.0, 1.5, -1.6, 0.22, 0.3, '#fff1d6', { mat: { emissive: '#ffcf80', emissiveIntensity: 0.5 } });
  addCol(3.0, -1.6, 0.36, 0.36);
  // 书架（全家福在上面）
  box(0, 0, 5.72, 1.8, 2.0, 0.4, '#8f6b4a', { collide: true });
  for (const y of [0.45, 0.9, 1.35]) box(0, y, 5.6, 1.7, 0.03, 0.36, '#a7845f', { cast: false });
  const bookColors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#f39c12', '#16a085'];
  for (let i = 0; i < 14; i++) {
    const shelf = [0.48, 0.93][i % 2];
    box(-0.75 + (i % 7) * 0.12 + (i > 6 ? 0.85 : 0), shelf, 5.62, 0.08, 0.3 + (i % 3) * 0.04, 0.24, bookColors[i % bookColors.length], { cast: false });
  }
  // 餐桌
  box(2.6, 0, 3.4, 1.5, 0.75, 0.9, '#c4a07a', { collide: true });
  for (const [dx, dz] of [[-0.45, -0.75], [0.45, -0.75], [-0.45, 0.75], [0.45, 0.75]]) {
    box(2.6 + dx, 0, 3.4 + dz, 0.42, 0.45, 0.4, '#7a5b42', { collide: true });
    box(2.6 + dx, 0.45, 3.4 + dz + Math.sign(dz) * 0.18, 0.42, 0.45, 0.05, '#7a5b42');
  }
  cyl(2.6, 0.75, 3.4, 0.12, 0.18, '#ffffff');
  // 绿植
  const plant = (x, z, s = 1) => {
    cyl(x, 0, z, 0.22 * s, 0.4 * s, '#b56b45', { collide: true });
    sphere(x, 0.75 * s, z, 0.38 * s, '#3f8f4a');
    sphere(x + 0.15 * s, 1.05 * s, z - 0.08 * s, 0.25 * s, '#4fa35a');
  };
  plant(-2.45, 5.4);
  plant(4.6, -5.4);
  plant(-3.6, -5.4, 0.8);
  // 玄关与角落
  box(6.5, 0, -2.2, 1.3, 1.0, 0.38, '#7e6450', { collide: true });
  box(6.5, 1.0, -2.2, 1.34, 0.04, 0.42, '#a58b73');
  box(7.45, 0, 0, 0.9, 0.015, 1.4, '#5a4636', { cast: false });
  cyl(5.5, 0, 2.05, 0.05, 1.7, '#3a3a3a');
  sphere(5.5, 1.55, 2.05, 0.18, '#a8573b', { sy: 1.4 });
  box(6.5, 0, 5.6, 2.2, 2.0, 0.6, '#d9d2c4', { collide: true });
  box(6.5, 0.05, 5.29, 0.02, 1.9, 0.02, '#a69f92');
  box(6.6, 0, -5.45, 1.6, 0.75, 0.7, '#efe7da', { collide: true });
  box(6.6, 0.75, -5.6, 0.6, 0.4, 0.04, '#1f2328');
  box(6.6, 0, -4.7, 0.5, 0.48, 0.48, '#3f3f46', { collide: true });

  // ---------- 楼道 ----------
  const door = (x, z, facing, num) => {
    const horizontalWall = true;
    box(x, 0, z, 1.0, 2.15, 0.08, '#6d4c3a', { cast: false });
    box(x + 0.35, 1.0, z + facing * 0.06, 0.05, 0.05, 0.08, '#d4c08a', { cast: false });
    const plate = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: textTexture(num, { w: 128, h: 64, bg: '#2a2f36', font: 'bold 40px sans-serif' }) }));
    plate.scale.set(0.3, 0.15, 1);
    plate.position.set(x, 2.3, z + facing * 0.05);
    plate.rotation.y = facing > 0 ? 0 : Math.PI;
    root.add(plate);
    return horizontalWall;
  };
  door(11.0, -2.37, 1, '1202');
  door(20.3, -2.37, 1, '1203');
  door(10.6, 2.37, -1, '1205');
  door(20.6, 2.37, -1, '1206');
  const myPlate = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: textTexture('1201', { w: 128, h: 64, bg: '#2a2f36', font: 'bold 40px sans-serif' }) }));
  myPlate.scale.set(0.3, 0.15, 1);
  myPlate.position.set(8.12, 2.3, 1.35);
  myPlate.rotation.y = Math.PI / 2;
  root.add(myPlate);
  box(9.3, 0.6, 2.33, 0.6, 0.8, 0.14, '#c0392b', { cast: false });
  box(21.2, 0, -1.9, 0.45, 0.8, 0.45, '#3b6e4f', { collide: true });
  // 快递暂存区地面标线
  const Y = '#e8c547';
  for (const zc of [-1.75, 1.75]) {
    box(15.6, 0.004, zc - 0.68, 7.6, 0.01, 0.06, Y, { cast: false });
    box(15.6, 0.004, zc + 0.68, 7.6, 0.01, 0.06, Y, { cast: false });
    box(11.8, 0.004, zc, 0.06, 0.01, 1.42, Y, { cast: false });
    box(19.4, 0.004, zc, 0.06, 0.01, 1.42, Y, { cast: false });
  }
  const sign = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: textTexture('快递暂存区', { w: 512, h: 128, bg: '#e8c547', fg: '#2a2a2a' }) }));
  sign.scale.set(1.6, 0.4, 1);
  sign.position.set(15.6, 2.05, -2.38);
  root.add(sign);
  // 墙灯
  for (const x of [11.5, 15.6, 19.6]) {
    box(x, 2.45, -2.36, 0.6, 0.08, 0.1, '#ffffff', { cast: false, mat: { emissive: '#e8f6ff', emissiveIntensity: 1.2 } });
    box(x, 2.45, 2.36, 0.6, 0.08, 0.1, '#ffffff', { cast: false, mat: { emissive: '#e8f6ff', emissiveIntensity: 1.2 } });
  }

  // ---------- 电梯厅 / 保安室 ----------
  for (const z of [-2.6, 1.0]) {
    box(27.86, 0, z, 0.08, 2.25, 1.3, '#9aa3ab', { cast: false, mat: { metalness: 0.7, roughness: 0.3 } });
    box(27.84, 0, z, 0.1, 2.25, 0.02, '#6b737b', { cast: false });
    box(27.85, 2.3, z, 0.1, 0.18, 0.4, '#111', { cast: false, mat: { emissive: '#ff4d3a', emissiveIntensity: 0.6 } });
  }
  box(26.6, 0, 4.6, 0.7, 0.8, 1.6, '#5c6670', { collide: true });
  box(26.6, 0.8, 4.6, 0.76, 0.04, 1.66, '#8b949c');
  box(26.75, 0.84, 4.25, 0.08, 0.4, 0.55, '#16191d');
  box(26.75, 0.84, 4.9, 0.08, 0.4, 0.55, '#16191d');
  box(26.7, 0.88, 4.25, 0.01, 0.32, 0.48, '#3a7fb5', { cast: false, mat: { emissive: '#3a9fe0', emissiveIntensity: 0.8 } });
  box(26.7, 0.88, 4.9, 0.01, 0.32, 0.48, '#3a7fb5', { cast: false, mat: { emissive: '#3a9fe0', emissiveIntensity: 0.8 } });
  box(25.2, 0, 5.55, 0.5, 0.5, 0.5, '#2f3540', { collide: true });
  plant(22.7, -5.4, 0.9);
  plant(27.3, -5.4, 0.9);
  box(23.5, 0, 5.6, 1.5, 0.45, 0.5, '#4b5563', { collide: true });
  const guardSign = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: textTexture('保安室', { w: 256, h: 96, bg: '#1f3a5a', font: 'bold 52px "PingFang SC","Microsoft YaHei",sans-serif' }) }));
  guardSign.scale.set(0.9, 0.34, 1);
  guardSign.position.set(25.6, 2.2, 5.88);
  guardSign.rotation.y = Math.PI;
  root.add(guardSign);
  const floorSign = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: textTexture('12F', { w: 256, h: 128, bg: '#2a2f36', font: 'bold 80px sans-serif' }) }));
  floorSign.scale.set(0.8, 0.4, 1);
  floorSign.position.set(27.88, 2.05, -0.8);
  floorSign.rotation.y = -Math.PI / 2;
  root.add(floorSign);

  // ---------- 动态物体 ----------
  // 电视屏幕
  const tvTex = canvasTexture(0, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0f2a4a');
    g.addColorStop(1, '#2a1030');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(0, H - 54, W, 54);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('新闻快讯：全球多地出现异常天象', 16, H - 18);
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('LIVE', 20, 60);
  }, { repeat: false, w: 512, h: 288 });
  const tvMat = new THREE.MeshBasicMaterial({ map: tvTex });
  const tv = new THREE.Mesh(GEO.plane, tvMat);
  tv.scale.set(1.8, 1.0, 1);
  tv.position.set(1, 1.3, -5.795);
  root.add(tv);

  // 全家福
  const photoTex = canvasTexture(0, (ctx, W, H) => {
    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8fc2e8';
    ctx.fillRect(8, 8, W - 16, H * 0.55);
    const fig = (x, h, c) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, H - h - 18, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 12, H - h - 6, 24, h);
    };
    fig(36, 52, '#5a4a8a');
    fig(64, 40, '#3d6e8f');
    fig(92, 50, '#a0524a');
  }, { repeat: false, w: 128, h: 100 });
  const photo = new THREE.Group();
  const pf = new THREE.Mesh(GEO.box, mat('#5a3d2b'));
  pf.scale.set(0.34, 0.28, 0.03);
  photo.add(pf);
  const pimg = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: photoTex }));
  pimg.scale.set(0.28, 0.22, 1);
  pimg.position.z = -0.017;
  pimg.rotation.y = Math.PI;
  photo.add(pimg);
  photo.position.set(0.35, 1.53, 5.6);
  photo.rotation.x = 0.12;
  root.add(photo);

  // 发光的手镯
  const bracelet = new THREE.Group();
  bracelet.position.set(-6.05, 1.0, -0.4);
  const bMat = new THREE.MeshStandardMaterial({ color: '#7ff5e6', emissive: '#2fe0d0', emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.2 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.016, 10, 28), bMat);
  ring.rotation.x = Math.PI / 2;
  bracelet.add(ring);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#4ff0e0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 }));
  halo.scale.set(0.55, 0.55, 1);
  bracelet.add(halo);
  root.add(bracelet);

  // ---------- 灯光 ----------
  const hemi = new THREE.HemisphereLight('#dfe9ff', '#4b3f36', 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3e0', 2.2);
  sun.position.set(12, 20, 9);
  sun.target.position.set(9, 0, 0);
  sun.castShadow = true;
  const sm = mobile ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 12, bottom: -12, near: 2, far: 50 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const bedLamp = new THREE.PointLight('#ffcf8a', 0, 7, 2);
  bedLamp.position.set(-8.4, 1.3, -2.8);
  const livingLamp = new THREE.PointLight('#ffd49a', 0, 9, 2);
  livingLamp.position.set(3.0, 1.9, -1.6);
  const corridorLight = new THREE.PointLight('#e2f2ff', 7, 14, 1.6);
  corridorLight.position.set(15.6, 2.4, 0);
  const braceletLight = new THREE.PointLight('#3ff5e0', 1.6, 3.5, 2);
  braceletLight.position.set(-6.05, 1.35, -0.55);
  scene.add(bedLamp, livingLamp, corridorLight, braceletLight);

  const built = batch.build(root);
  for (const b of built) if (b.flags.block) blockers.push(b.mesh);

  // ---------- 交互点 ----------
  const points = {
    bed: new THREE.Vector3(-7.0, 0, -3.5),
    jewelry: new THREE.Vector3(-6.05, 1.0, -0.4),
    tv: new THREE.Vector3(1, 0, -4.6),
    photo: new THREE.Vector3(0.35, 0, 5.1),
    fridge: new THREE.Vector3(-7.9, 0, 0.6),
    window: new THREE.Vector3(3.8, 0, -5.2),
  };

  let t = 0;
  let emitter = null;
  let emitAcc = 0;
  const update = (dt) => {
    t += dt;
    if (bracelet.visible) {
      bracelet.position.y = 1.02 + Math.sin(t * 2) * 0.015;
      ring.rotation.z += dt * 0.8;
      const pulse = 0.75 + Math.sin(t * 3.2) * 0.25;
      halo.material.opacity = 0.45 + pulse * 0.35;
      halo.scale.setScalar(0.45 + pulse * 0.18);
      bMat.emissiveIntensity = 1.2 + pulse * 0.8;
      braceletLight.intensity = 1.1 + pulse * 0.9 + (Math.random() < 0.04 ? 0.6 : 0);
      emitAcc += dt;
      if (emitter && emitAcc > 0.18) {
        emitAcc = 0;
        emitter(bracelet.position, 1, { color: '#7ffff0', speed: 0.12, up: 0.35, life: 1.6, spread: 0.12, size: 1 });
      }
    }
    tvMat.color.setScalar(0.85 + Math.sin(t * 7) * 0.05 + (Math.random() < 0.05 ? -0.15 : 0));
  };

  return {
    root,
    colliders,
    blockers,
    points,
    windowMat,
    lights: { hemi, sun, bedLamp, livingLamp, corridorLight, braceletLight },
    bracelet: { group: bracelet, light: braceletLight, halo, mat: bMat },
    photo,
    update,
    setEmitter: (fn) => (emitter = fn),
    setBraceletVisible(v) {
      bracelet.visible = v;
      braceletLight.visible = v;
    },
    setPhotoVisible(v) {
      photo.visible = v;
    },
  };
}
