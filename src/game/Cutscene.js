import * as THREE from 'three';
import { buildHuman } from './Character.js';
import { formatCountdown } from '../systems/TimeSystem.js';
import { suspicionLevel } from './NPC.js';

const SKIP = Symbol('skip');
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 剧情演出：开场、手镯觉醒、保安对峙、前世来电、章节结算
export class Cutscene {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.skipped = false;
  }
  sleep(ms) {
    return new Promise((res) => {
      const t0 = performance.now();
      const id = setInterval(() => {
        if (this.skipped || performance.now() - t0 >= ms) {
          clearInterval(id);
          res();
        }
      }, 30);
    });
  }
  async step(p) {
    await p;
    if (this.skipped) throw SKIP;
  }
  skip() {
    if (this.skipped) return;
    this.skipped = true;
    this.game.dialogue.cancelAll();
  }

  // ================= 开场 =================
  async intro() {
    const g = this.game;
    this.active = true;
    this.skipped = false;
    g.mode = 'intro';
    g.hud.setVisible(false);
    g.screens.showSkip(() => this.skip());
    try {
      await this.prevLife();
      await this.wakeUp();
    } catch (e) {
      if (e !== SKIP) console.error(e);
    }
    this.cleanupPrevLife();
    g.screens.hideSkip();
    g.screens.letterbox(false);
    g.screens.hideBigText();
    this.skipped = false;
    if (!g.state.flags.woke) {
      await g.screens.fade(true, 0);
      this.placeWake();
      g.rig.override = null;
      g.rig.snap();
      await g.screens.fade(false, 700);
    }
    g.state.flags.woke = true;
    g.rig.override = null;
    g.hud.setVisible(true);
    g.hud.update(0, true);
    await this.systemNotice();
    await g.screens.bigCountdown(formatCountdown(g.time.remaining()));
    g.state.flags.introDone = true;
    g.mode = 'play';
    g.input.setMobileVisible(true);
    this.active = false;
    g.saveNow();
    g.notify.toast(['新任务：重生之日', g.isTouch ? '点击「手机」按钮打开手机' : '按 Tab 打开手机'], { type: 'info' });
  }

  placeWake() {
    const g = this.game;
    g.player.group.visible = true;
    g.player.setPosition(-6.0, -2.6, 0.86);
    g.rig.yaw = -0.6;
    g.rig.pitch = 0.6;
  }

  setupPrevLife() {
    const g = this.game;
    const L = g.world.lights;
    g.cutLighting = true;
    this.saved = { hemi: L.hemi.intensity, sun: L.sun.intensity, bg: g.scene.background?.clone() };
    L.hemi.intensity = 0.12;
    L.sun.intensity = 0;
    L.corridorLight.visible = false;
    g.scene.background = new THREE.Color('#04080c');
    g.scene.fog = new THREE.Fog('#04080c', 5, 16);
    this.lights = [];
    // 实验舱冷光 + 警报红光
    this.podLight = new THREE.PointLight('#5fe8ff', 14, 6, 1.6);
    this.podLight.position.set(26.6, 2.0, -2.6);
    this.alarm = new THREE.PointLight('#ff2a1a', 0, 16, 1.4);
    this.alarm.position.set(25.0, 2.6, 0);
    this.fill = new THREE.PointLight('#8fb8ff', 6, 10, 1.6);
    this.fill.position.set(24.0, 2.4, 2.0);
    g.scene.add(this.podLight, this.alarm, this.fill);
    this.sil = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#3a434d', metalness: 0.7, roughness: 0.35 });
    // 实验舱
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.3, 20), metal);
    base.position.set(26.6, 0.15, -2.6);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.25, 20), metal);
    cap.position.set(26.6, 2.35, -2.6);
    this.glassMat = new THREE.MeshStandardMaterial({ color: '#7fe7ff', emissive: '#1a8fa8', emissiveIntensity: 0.6, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false });
    this.glass = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.95, 20, 1, true), this.glassMat);
    this.glass.position.set(26.6, 1.27, -2.6);
    // 控制台与红色按钮
    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 1.1), metal);
    consoleBox.position.set(23.4, 0.5, -2.4);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ color: '#2fd6ff' }));
    screen.position.set(23.06, 1.35, -2.4);
    screen.rotation.y = Math.PI / 2;
    const scrPole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), metal);
    scrPole.position.set(23.3, 1.1, -2.4);
    this.button = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff1010', emissiveIntensity: 1.5 }));
    this.button.position.set(23.5, 1.02, -2.4);
    this.screenMat = screen.material;
    this.sil.add(base, cap, this.glass, consoleBox, screen, scrPole, this.button);
    // 主角（实验舱内）与两名研究员
    const me = buildHuman({ silhouette: true, longHair: true });
    me.group.position.set(26.6, 0.3, -2.6);
    me.group.rotation.y = 0.4;
    const r1 = buildHuman({ shirt: '#dfe6ea', pants: '#1d2128', hair: '#151515', skin: '#2a221d', shoes: '#111' });
    r1.group.position.set(25.0, 0, -0.3);
    const r2 = buildHuman({ shirt: '#dfe6ea', pants: '#1d2128', hair: '#151515', skin: '#2a221d', shoes: '#111' });
    r2.group.position.set(24.2, 0, 0.6);
    for (const r of [r1, r2]) r.group.rotation.y = Math.atan2(26.6 - r.group.position.x, -2.6 - r.group.position.z);
    this.sil.add(me.group, r1.group, r2.group);
    this.me = me;
    this.r1 = r1;
    g.scene.add(this.sil);
    g.player.group.visible = false;
    g.guard.setVisible(false);
    g.piles.root.visible = false;
  }
  cleanupPrevLife() {
    const g = this.game;
    if (!this.sil) return;
    g.scene.remove(this.sil);
    g.scene.remove(this.podLight, this.alarm, this.fill);
    this.sil = null;
    g.scene.fog = null;
    g.world.lights.corridorLight.visible = true;
    if (this.saved?.bg) g.scene.background = this.saved.bg;
    g.cutLighting = false;
    g.player.group.visible = true;
    g.guard.setVisible(true);
    g.piles.root.visible = true;
    if (this.orbitOff) this.orbitOff();
    this.orbitOff = null;
  }

  // 前世：被神秘组织抓去做实验，最终启动基地自毁程序，与基地同归于尽
  async prevLife() {
    const g = this.game;
    await g.screens.fade(true, 0);
    this.setupPrevLife();
    g.screens.letterbox(true);
    let ang = 1.0, shake = 0, alarmOn = false, t = 0, walk = 0;
    const center = V(25.0, 1.1, -1.4);
    this.setShake = (v) => (shake = v);
    this.setAlarm = (v) => (alarmOn = v);
    this.setWalk = (v) => (walk = v);
    this.orbitOff = g.addUpdater((dt) => {
      t += dt;
      ang = Math.min(2.1, ang + dt * 0.06);
      const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
      g.rig.override = { pos: V(center.x + Math.cos(ang) * 3.4 + sx, 1.9 + sy, center.z + Math.sin(ang) * 3.4), look: center, speed: shake ? 20 : 2.5 };
      if (alarmOn) {
        const on = Math.sin(t * 9) > 0;
        this.alarm.intensity = on ? 34 : 4;
        this.screenMat.color.set(on ? '#ff3030' : '#601010');
      }
      this.me.animate(dt, walk);
      this.r1.animate(dt, 0);
    });
    g.rig.snap();
    g.audio.play('drone');
    await this.step(g.screens.fade(false, 1600));
    g.screens.bigText('【末日第47天 · 秘密实验基地】', 'cyan');
    await this.step(this.sleep(2800));
    g.screens.hideBigText();
    await this.step(g.dialogue.say([{ speaker: '研究员', text: '“实验体 S-047，第 31 次异能诱导实验，开始注射。”' }], { auto: 3200 }));
    await this.step(g.dialogue.say([{ speaker: '苏然', text: '“放我出去……你们这群疯子！”' }], { auto: 2800 }));
    await this.step(g.dialogue.say([{ speaker: '研究员', text: '“在末日里，普通人唯一的价值，就是成为实验材料。”' }], { auto: 3400 }));
    await this.step(g.dialogue.say([{ speaker: '苏然', text: '（逃不出去了……那至少，不能让他们再害更多的人。）' }], { auto: 3400 }));
    // 击碎实验舱，冲向控制台
    g.audio.play('glass');
    g.screens.flash('rgba(120,230,255,0.45)', 500);
    this.glass.visible = false;
    g.effects.emit(V(26.6, 1.3, -2.6), 120, { color: '#9ff4ff', speed: 2.6, up: 0.8, life: 1.2, spread: 0.5, gravity: 4 });
    const me = this.me.group;
    me.position.y = 0;
    this.setWalk(4);
    const from = { x: 26.6, z: -2.6 }, to = { x: 23.95, z: -2.4 };
    me.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    await this.step(g.effects.tween(1.5, (k) => {
      me.position.x = from.x + (to.x - from.x) * k;
      me.position.z = from.z + (to.z - from.z) * k;
    }));
    this.setWalk(0);
    await this.step(g.effects.tween(0.35, (k) => (this.me.armR.pivot.rotation.x = -1.6 * k)));
    this.button.scale.y = 0.4;
    g.audio.play('cut');
    this.setAlarm(true);
    g.audio.play('alarm');
    g.screens.bigText('【基地自毁程序已启动】', 'red');
    await this.step(this.sleep(2200));
    g.screens.hideBigText();
    await this.step(g.dialogue.say([{ speaker: '广播', text: '“警告：自毁程序已启动。十秒后，基地将被彻底摧毁。”' }], { auto: 3000 }));
    g.audio.play('alarm');
    await this.step(g.dialogue.say([{ speaker: '研究员', text: '“你疯了！你自己也会死的！”' }], { auto: 2400 }));
    await this.step(g.dialogue.say([{ speaker: '苏然', text: '“能让这个地方彻底消失……值了。”' }], { auto: 3000 }));
    // 爆炸
    g.audio.play('explode');
    this.setShake(0.35);
    g.screens.flash('rgba(255,190,110,1)', 1300);
    for (let i = 0; i < 3; i++) g.effects.emit(V(23.6 + i * 1.2, 1.0, -2.0 + i * 0.6), 160, { color: i === 1 ? '#ffffff' : '#ffa040', speed: 6, up: 3, life: 1.6, spread: 0.6, gravity: 2 });
    this.alarm.color.set('#ffb060');
    this.alarm.intensity = 80;
    await this.step(this.sleep(700));
    await this.step(g.screens.fade(true, 500));
    this.setShake(0);
    this.setAlarm(false);
    await this.step(this.sleep(900));
    g.audio.play('flatline');
    g.screens.bigText('【生命体征消失】', 'red');
    await this.step(this.sleep(2800));
    g.screens.hideBigText();
    await this.step(this.sleep(700));
    g.screens.bigText('“如果能重来一次，你会怎样活下去？”', 'white');
    await this.step(this.sleep(3600));
    g.screens.hideBigText();
    await this.step(this.sleep(500));
  }

  async wakeUp() {
    const g = this.game;
    this.cleanupPrevLife();
    g.screens.letterbox(false);
    this.placeWake();
    g.rig.override = { pos: V(-6.0, 3.6, -2.0), look: V(-6.0, 1.4, -2.7), speed: 1 };
    g.rig.snap();
    g.state.flags.woke = true;
    g.audio.play('heartbeat');
    await this.step(g.screens.fade(false, 1800));
    await this.step(this.sleep(300));
    g.rig.override = { pos: V(-4.6, 1.9, -1.4), look: V(-6.0, 1.5, -2.6), speed: 1.2 };
    await this.step(g.dialogue.say([
      { speaker: '苏然', text: '……这里是，我的房间？' },
      { speaker: '苏然', text: '我不是已经死了吗……手机上的日期——是末日降临的三天前！' },
      { speaker: '苏然', text: '我……重生了。' },
    ]));
    g.rig.override = null;
  }

  async systemNotice() {
    const g = this.game;
    g.screens.flash('rgba(63,245,224,0.35)', 900);
    await g.dialogue.system(['【末日生存系统已激活】', '欢迎来到末日生存游戏。', '距离末日降临还有三天。', '初始资金：¥10,000', '请宿主尽快做好准备。'], { title: 'SYSTEM · 末日生存系统' });
    g.state.flags.readSystem = true;
    g.addMessage('末日生存系统', '【末日生存系统已激活】\n欢迎来到末日生存游戏。距离末日降临还有三天。\n初始资金：¥10,000\n请宿主尽快做好准备。', false);
  }

  // ================= 手镯觉醒 =================
  async awaken() {
    const g = this.game, s = g.state;
    if (s.bracelet || this.active) return;
    this.active = true;
    g.input.exitPointerLock();
    const bp = g.world.points.jewelry;
    g.player.setPosition(bp.x + 0.3, bp.z - 0.95);
    g.player.faceTowards(bp.x, bp.z);
    g.rig.override = { pos: V(bp.x - 0.95, bp.y + 0.75, bp.z - 1.35), look: V(bp.x, bp.y, bp.z), speed: 2.2 };
    await this.sleep(700);
    await g.dialogue.say([
      { speaker: '苏然', text: '这是……妈妈留给我的手镯。' },
      { speaker: '苏然', text: '前世我一直把它锁在首饰盒里，从没发现它会发光……' },
    ]);
    s.flags.examinedBracelet = true;
    g.rig.override = { pos: V(bp.x - 0.5, bp.y + 0.45, bp.z - 0.75), look: V(bp.x, bp.y, bp.z), speed: 2.5 };
    await g.dialogue.say([{ speaker: '', text: '你伸手拿起手镯，首饰盒边缘的金属扣划破了指尖。' }, { speaker: '苏然', text: '嘶——' }]);
    g.audio.play('cut');
    g.screens.flash('rgba(255,30,40,0.35)', 500);
    // 血滴落在手镯上
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: '#d0102a' }));
    drop.position.set(bp.x, bp.y + 0.35, bp.z);
    g.scene.add(drop);
    await g.effects.tween(0.7, (k) => (drop.position.y = bp.y + 0.35 - 0.33 * k * k));
    g.scene.remove(drop);
    g.effects.emit(bp, 14, { color: '#ff2040', speed: 0.3, up: 0.2, life: 0.6, spread: 0.05 });
    await this.sleep(400);
    g.audio.play('awaken');
    const B = g.world.bracelet;
    await g.effects.tween(1.6, (k) => {
      B.light.intensity = 2 + k * 18;
      B.halo.scale.setScalar(0.5 + k * 2.2);
      B.mat.emissiveIntensity = 2 + k * 6;
      if (Math.random() < 0.6) g.effects.emit(bp, 6, { color: k > 0.5 ? '#ffffff' : '#3ff5e0', speed: 0.6 + k, up: 0.4, life: 1, spread: 0.1 + k * 0.4 });
    });
    g.screens.flash('rgba(120,255,240,0.85)', 1200);
    g.effects.emit(bp, 160, { color: '#7ffff0', speed: 3, up: 1.5, life: 1.6, spread: 0.2 });
    g.world.setBraceletVisible(false);
    g.player.setBracelet(true);
    s.bracelet = true;
    g.effects.emit(g.player.wristWorld(), 60, { color: '#3ff5e0', speed: 0.6, up: 0.6, life: 1.2, spread: 0.15 });
    await this.sleep(900);
    g.rig.override = null;
    await g.dialogue.system(['【滴血认主成功】', '【空间异能已觉醒】', '【初始空间容量：100 m³】'], { title: 'SYSTEM · 空间异能' });
    await g.dialogue.say([{ speaker: '苏然', text: '空间异能……有了它，我就能把物资悄悄藏起来，谁也发现不了。' }, { speaker: '苏然', text: '这一次，我要囤够活下去的一切。' }]);
    g.notify.toast(['💠 随身空间已解锁', g.isTouch ? '点击「空间」按钮查看' : '按 I 打开随身空间'], { type: 'system' });
    this.active = false;
    g.saveNow();
  }

  // ================= 保安 =================
  async guardEncounter(itemName) {
    const g = this.game, s = g.state;
    this.active = true;
    g.input.exitPointerLock();
    g.guard.hold(g.player.pos, 999);
    g.guard.showBubble('!', 6);
    g.player.faceTowards(g.guard.pos.x, g.guard.pos.z);
    await this.sleep(500);
    await g.dialogue.say([
      { speaker: '老周', text: `咦？刚刚这里不是还有几箱${itemName}吗？` },
      { speaker: '老周', text: '小苏，你看见是谁搬走的没有？我明明一眨眼的工夫……' },
    ]);
    const idx = await g.dialogue.choose('苏然', '（糟了，被他看见了。该怎么回答？）', [
      { text: '“我朋友刚帮我搬上楼了，周叔您没看见吗？”' },
      { text: '“我……我什么都不知道！”（慌忙走开）' },
      { text: '递上一包好烟：“周叔辛苦了，一点心意。”', note: '¥100', disabled: s.money < 100 },
    ]);
    if (idx === 0) {
      s.choices.guard = 'lie';
      s.suspicion = Math.max(0, s.suspicion - 12);
      await g.dialogue.say([{ speaker: '老周', text: '哦……这样啊。可能是我年纪大了，眼神不太好。' }, { speaker: '苏然', text: '（暂时糊弄过去了。下次得更小心才行。）' }]);
    } else if (idx === 2) {
      g.economy.spend(100, '给老周的香烟');
      s.choices.guard = 'bribe';
      s.suspicion = Math.max(0, s.suspicion - 20);
      g.guard.showBubble('…', 2);
      await g.dialogue.say([{ speaker: '老周', text: '哎哟，小苏真懂事！放心，楼道这块有我看着，丢不了东西。' }, { speaker: '苏然', text: '（人情世故，有时候比解释更管用。）' }]);
    } else {
      s.choices.guard = 'panic';
      s.suspicion = Math.min(100, s.suspicion + 20);
      g.guard.showBubble('?', 3);
      await g.dialogue.say([{ speaker: '老周', text: '……这孩子怎么慌慌张张的？' }, { speaker: '老周', text: '不对劲，我得多留意一下 1201。' }]);
    }
    s.flags.encounterDone = true;
    g.guard.release();
    this.active = false;
    g.saveNow();
  }

  async guardTalk() {
    const g = this.game, s = g.state;
    g.guard.hold(g.player.pos, 4);
    g.player.faceTowards(g.guard.pos.x, g.guard.pos.z);
    const lines = [
      ['小苏啊，这两天快递可真多，又在网上买什么好东西了？', '最近天气怪得很，晚上记得关好门窗。'],
      ['小苏，你家最近东西搬进搬出的，是要搬家吗？'],
      ['……小苏，楼道里的快递总是一转眼就不见了，你说奇怪不奇怪？'],
      ['我在这栋楼干了十几年，从来没见过这种怪事……小苏，你是不是有什么事瞒着我？'],
    ][suspicionLevel(s.suspicion).level];
    await g.dialogue.say(lines.map((t) => ({ speaker: '老周', text: t })));
    g.guard.hold(g.player.pos, 1);
  }

  // ================= 前世的电话 =================
  // 前世末日爆发后，苏然再也没能联系上老家的父母。这一世，妈妈的电话提前打来了。
  async phoneCall() {
    const g = this.game, s = g.state;
    this.active = true;
    g.closeAllUI();
    g.input.exitPointerLock();
    await g.screens.incomingCall('妈妈', '老家 · 来电');
    s.flags.callAnswered = true;
    await g.dialogue.say([
      { speaker: '妈妈', text: '喂，然然？吃早饭了没有？最近工作忙不忙？' },
      { speaker: '妈妈', text: '你爸说新闻里天上老出怪光，我寻思给你打个电话问问。' },
      { speaker: '苏然', text: '（妈妈的声音……前世末日爆发后，我再也没能打通家里的电话。）' },
    ]);
    const idx = await g.dialogue.choose('苏然', '这一次，要怎么做？', [
      { text: '给爸妈转 ¥20,000，叮嘱他们马上囤粮囤水', disabled: s.money < 20000, note: s.money < 20000 ? '余额不足' : '' },
      { text: '劝爸妈这两天就收拾东西，来城里和我会合' },
      { text: '只叮嘱他们多备些吃的，别让他们担心' },
    ]);
    if (idx === 0) {
      g.economy.spend(20000, '转账给 妈妈');
      s.choices.call = 'money';
      await g.dialogue.say([
        { speaker: '妈妈', text: '哎呀，你转这么多钱干什么？……好好好，听你的，明天就和你爸去镇上多买点米和水。' },
        { speaker: '苏然', text: '（家里有地窖，只要囤够物资，他们一定能撑下去。）' },
      ]);
      g.addMessage('妈妈', '钱收到了。米面油都买好了，你爸还多买了两桶水。你自己也照顾好自己。');
    } else if (idx === 1) {
      s.choices.call = 'gather';
      await g.dialogue.say([
        { speaker: '妈妈', text: '这么突然？……行，你这孩子从小就有主意，我和你爸后天坐车过去。' },
        { speaker: '苏然', text: '（后天……一定要赶在末日之前。这一次，一家人要在一起。）' },
      ]);
      g.addMessage('妈妈', '车票买好了，后天早上的车。到了给你打电话。');
    } else {
      s.choices.call = 'hint';
      await g.dialogue.say([
        { speaker: '妈妈', text: '知道啦知道啦，家里米缸满着呢，你自己别光顾着工作。' },
        { speaker: '苏然', text: '（现在说出真相，他们也不会信。至少……让他们多一分准备。）' },
      ]);
    }
    this.active = false;
    g.saveNow();
  }

  // ================= 章节结算 =================
  async chapterEnd(timeout = false) {
    const g = this.game, s = g.state;
    this.active = true;
    g.closeAllUI();
    g.input.exitPointerLock();
    const byCat = {};
    for (const [id, q] of Object.entries(s.storage)) {
      const c = g.itemCat(id);
      byCat[c] = (byCat[c] || 0) + q;
    }
    await g.screens.summary({ byCat }, timeout);
    s.flags.summaryShown = true;
    g.quests.update(true);
    await g.screens.fade(true, 900);
    g.hud.setVisible(false);
    for (const [t, c] of [['【末日倒计时仍在继续……】', 'red'], ['【第一章：重生之日 完成】', 'cyan'], ['【未完待续】', 'white']]) {
      g.screens.bigText(t, c);
      g.audio.play(c === 'red' ? 'heartbeat' : 'system');
      await this.sleep(2600);
      g.screens.hideBigText();
      await this.sleep(400);
    }
    s.flags.chapterDone = true;
    if (timeout) s.flags.apocalypse = true;
    g.saveNow();
    await g.screens.fade(false, 700);
    g.hud.setVisible(true);
    const choice = await g.screens.endingChoice();
    this.active = false;
    if (choice === 'menu') g.returnToMenu();
  }
}
