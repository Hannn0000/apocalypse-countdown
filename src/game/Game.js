import * as THREE from 'three';
import { buildApartment } from './Apartment.js';
import { Player } from './Player.js';
import { CameraRig } from './CameraRig.js';
import { Guard, suspicionLevel } from './NPC.js';
import { Effects } from './Effects.js';
import { PileManager } from './Piles.js';
import { Input } from './Input.js';
import { Cutscene } from './Cutscene.js';
import { pointBlocked } from './Collision.js';
import { EventBus } from '../systems/EventBus.js';
import * as Save from '../systems/SaveSystem.js';
import { TimeSystem, TIME_RATE, formatDuration } from '../systems/TimeSystem.js';
import { Economy } from '../systems/EconomySystem.js';
import { StorageSystem } from '../systems/StorageSystem.js';
import { DeliverySystem } from '../systems/DeliverySystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { ITEMS, formatMoney, formatVolume } from '../data/items.js';
import { Notify } from '../ui/Notify.js';
import { HUD } from '../ui/HUD.js';
import { DialogueUI } from '../ui/DialogueUI.js';
import { Smartphone } from '../ui/Smartphone.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { Screens } from '../ui/Screens.js';

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const C = (c) => new THREE.Color(c);
const SKY = { night: C('#0b1222'), day: C('#9db8d1'), dusk: C('#d88a5c') };
const WIN = { night: C('#1a2440'), day: C('#cfe8fb'), dusk: C('#ffb07a') };

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.bus = new EventBus();
    this.state = Save.createDefaultState();
    this.mode = 'menu';
    this.paused = false;
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.time = new TimeSystem(this);
    this.economy = new Economy(this);
    this.storage = new StorageSystem(this);
    this.delivery = new DeliverySystem(this);
    this.quests = new QuestSystem(this);
    this.audio = new AudioSystem();
    this.updaters = new Set();
    this.autosaveT = 0;
    this.callTimer = 0;
    this.summaryTimer = 0;
    this.busy = false; // 防止交互流程重入
    this.cutLighting = false;
    this.menuAng = 0;
    this._v = new THREE.Vector3();
  }

  boot() {
    this.initRenderer();
    this.initWorld();
    this.initUI();
    this.bindEvents();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
    this.showMainMenu();
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
  }

  // ---------------- 初始化 ----------------
  initRenderer() {
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.isTouch || window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isTouch ? 1.5 : 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.scene.background = SKY.day.clone();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 140);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      r.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initWorld() {
    this.world = buildApartment(this.scene, { mobile: this.isTouch });
    this.colliders = this.world.colliders;
    this.blockers = this.world.blockers;
    this.player = new Player(this.scene);
    this.rig = new CameraRig(this.camera);
    this.guard = new Guard(this.scene);
    this.effects = new Effects(this.scene, this.isTouch);
    this.piles = new PileManager(this.scene, this);
    this.world.setEmitter((p, n, o) => this.effects.emit(p, n, o));
    this.cutscene = new Cutscene(this);
    const P = this.world.points;
    this.staticInteractables = [
      { id: 'bed', pos: P.bed, r: 1.7, label: () => '休息 / 睡觉', act: () => this.sleepMenu() },
      { id: 'jewelry', pos: P.jewelry, r: 1.45, label: () => (this.state.flags.examinedBracelet ? '拿起手镯' : '查看首饰盒'), enabled: () => !this.state.bracelet, act: () => this.cutscene.awaken() },
      { id: 'tv', pos: P.tv, r: 1.6, label: () => '看电视新闻', act: () => this.watchTV() },
      { id: 'photo', pos: P.photo, r: 1.4, label: () => '查看全家福', enabled: () => !this.state.flags.photoTaken, act: () => this.lookPhoto() },
      { id: 'fridge', pos: P.fridge, r: 1.3, label: () => '打开冰箱', act: () => this.lookFridge() },
      { id: 'window', pos: P.window, r: 1.4, label: () => '看看窗外', act: () => this.lookWindow() },
    ];
  }

  initUI() {
    const root = this.uiRoot;
    this.notify = new Notify(root, this.audio);
    this.hud = new HUD(root, this);
    this.dialogue = new DialogueUI(root, this.audio);
    this.phone = new Smartphone(root, this);
    this.inventory = new InventoryUI(root, this);
    this.screens = new Screens(root, this);
    this.input = new Input(this.canvas, root, this);
  }

  bindEvents() {
    const b = this.bus;
    b.on('pile:added', (p) => this.piles.add(p, { animate: this.mode === 'play' }));
    b.on('pile:changed', (p) => this.piles.rebuild(p));
    b.on('delivery:arrived', ({ order }) => {
      const n = Object.values(order.items).reduce((a, c) => a + c, 0);
      this.notify.toast(['【快递已送达】', `订单 #${order.id} · ${n} 件`, '已放在楼道「快递暂存区」'], { type: 'system', duration: 4500 });
      this.addMessage(order.type === 'food' ? '饱了么外卖' : '速达优选', `您的订单 #${order.id} 已送达 12 楼快递暂存区，请尽快领取。`, false);
    });
    b.on('quest:complete', (q) => this.notify.toast(['【任务完成】', q.title], { type: 'success' }));
    b.on('quest:start', (q) => {
      setTimeout(() => this.notify.toast(['【新任务】', q.title, q.hint], { type: 'info', duration: 4200 }), 700);
      this.saveNow();
    });
    b.on('time:advanced', (min) => {
      const s = this.state;
      if (s.suspicion > 0) s.suspicion = Math.max(0, s.suspicion - (min / 60) * 0.6);
    });
  }

  // ---------------- 状态 ----------------
  isBlocking() {
    return this.paused || this.phone.isOpen || this.inventory.isOpen || this.dialogue.busy || this.screens.modalOpen || this.cutscene.active || this.busy;
  }
  canControl() {
    return this.mode === 'play' && !this.isBlocking();
  }
  addUpdater(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }
  itemCat(id) {
    return ITEMS[id]?.cat || '其他';
  }
  timeLabel(t) {
    const m = Math.floor(7 * 60 + t);
    const d = Math.floor(m / 1440) + 1;
    return `第${d}天 ${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  playerInCorridor() {
    return this.player.pos.x > 7.6;
  }
  allColliders() {
    return this.colliders.concat(this.piles.colliders());
  }

  addMessage(from, text, toast = true) {
    this.state.messages.push({ from, text, t: this.state.time.elapsed, read: false });
    if (this.state.messages.length > 80) this.state.messages.shift();
    if (toast) this.notify.toast([`💬 ${from}`, text.split('\n')[0]], { type: 'info' });
  }

  saveNow() {
    if (this.mode === 'menu') return;
    const p = this.player.pos;
    this.state.player = { x: p.x, z: p.z, rot: this.player.yaw };
    Save.saveState(this.state);
  }

  // ---------------- 菜单 / 流程 ----------------
  showMainMenu() {
    this.mode = 'menu';
    this.hud.setVisible(false);
    this.input.setMobileVisible(false);
    this.screens.showMainMenu({
      hasSave: Save.hasSave(),
      onNew: () => this.newGame(),
      onContinue: () => this.continueGame(),
      onReset: () => {
        Save.resetSave();
        this.notify.toast('存档已重置', { type: 'info' });
        this.showMainMenu();
      },
    });
  }

  async newGame() {
    Save.resetSave();
    this.state = Save.createDefaultState();
    this.applyState();
    this.screens.hideMainMenu();
    await this.cutscene.intro();
  }

  async continueGame() {
    const s = Save.loadState();
    if (!s) {
      this.notify.toast('存档无效或已损坏，请开始新游戏', { type: 'warn' });
      this.showMainMenu();
      return;
    }
    this.state = s;
    this.applyState();
    this.screens.hideMainMenu();
    if (!s.flags.introDone) {
      await this.cutscene.intro();
      return;
    }
    await this.screens.fade(true, 0);
    this.mode = 'play';
    this.hud.setVisible(true);
    this.hud.update(0, true);
    this.input.setMobileVisible(true);
    await this.screens.fade(false, 600);
    this.notify.toast(['欢迎回来', this.time.dateLabel()], { type: 'info' });
  }

  applyState() {
    const s = this.state;
    this.player.setPosition(s.player.x, s.player.z, s.player.rot);
    this.player.setBracelet(s.bracelet);
    this.world.setBraceletVisible(!s.bracelet);
    this.world.setPhotoVisible(!s.flags.photoTaken);
    this.piles.clear();
    for (const p of s.piles) this.piles.add(p);
    this.guard.reset();
    this.quests.update(true);
    this.callTimer = 0;
    this.summaryTimer = 0;
    this.busy = false;
    this.paused = false;
    this.rig.yaw = s.player.rot + Math.PI;
    this.rig.override = null;
    this.rig.snap();
    this.hud.lastQuestKey = '';
  }

  closeAllUI() {
    if (this.phone.isOpen) this.phone.close();
    if (this.inventory.isOpen) this.inventory.close();
  }

  pause() {
    this.paused = true;
    this.input.exitPointerLock();
    this.screens.showPause({
      onResume: () => this.resume(),
      onSave: () => {
        this.saveNow();
        this.notify.toast('游戏已保存', { type: 'success' });
      },
      onMenu: () => this.returnToMenu(),
    });
  }
  resume() {
    this.paused = false;
    this.screens.hidePause();
  }
  returnToMenu() {
    this.saveNow();
    this.paused = false;
    this.screens.hidePause();
    this.closeAllUI();
    this.screens.closeAll();
    this.showMainMenu();
  }

  // ---------------- 输入 ----------------
  onAction(a) {
    this.audio.ensure();
    if (this.mode === 'menu') {
      if (this.screens.modalOpen) this.screens.handleKey(a);
      return;
    }
    if (this.dialogue.busy) {
      if (a === 'interact' || a === 'advance') this.dialogue.advance();
      else if (a.startsWith('choice')) this.dialogue.pick(Number(a.slice(6)) - 1);
      else if (a === 'escape' && this.mode === 'intro') this.cutscene.skip();
      return;
    }
    if (this.screens.modalOpen) {
      this.screens.handleKey(a);
      return;
    }
    if (this.mode === 'intro') {
      if (a === 'escape') this.cutscene.skip();
      return;
    }
    if (this.paused) {
      if (a === 'escape') this.resume();
      return;
    }
    if (this.phone.isOpen) {
      if (a === 'phone' || a === 'escape') this.phone.close();
      return;
    }
    if (this.inventory.isOpen) {
      if (a === 'storage' || a === 'escape') this.inventory.close();
      return;
    }
    if (this.cutscene.active || this.busy || this.mode !== 'play') return;
    if (a === 'interact') this.tryInteract();
    else if (a === 'phone') {
      this.input.exitPointerLock();
      this.phone.open();
    } else if (a === 'storage') this.openStorage();
    else if (a === 'escape') this.pause();
  }

  onPhoneOpened() {
    if (!this.state.flags.phoneOpened) {
      this.state.flags.phoneOpened = true;
    }
  }

  openStorage() {
    if (!this.state.bracelet) {
      this.audio.play('error');
      this.notify.toast(['【空间尚未觉醒】', '卧室的首饰盒里，好像有什么在发光……'], { type: 'warn' });
      return;
    }
    this.input.exitPointerLock();
    this.inventory.open();
  }

  // ---------------- 交互 ----------------
  getInteractables() {
    const list = this.staticInteractables.filter((i) => !i.enabled || i.enabled());
    list.push({ id: 'guard', pos: this.guard.pos, r: 1.8, label: () => '和老周聊天', act: () => this.run(() => this.cutscene.guardTalk()) });
    for (const p of this.state.piles) {
      list.push({ id: 'pile' + p.id, pos: { x: p.x, z: p.z }, r: p.kind === 'crate' ? 1.25 : 1.5, label: () => (p.kind === 'crate' ? '查看物资箱' : '查看快递'), act: () => this.run(() => this.openPile(p.id)) });
    }
    return list;
  }
  updateInteractions() {
    const pp = this.player.pos;
    let best = null, bd = Infinity;
    for (const it of this.getInteractables()) {
      const d = Math.hypot(it.pos.x - pp.x, it.pos.z - pp.z);
      if (d < it.r && d < bd) {
        best = it;
        bd = d;
      }
    }
    this.current = best;
    this.hud.prompt(best ? best.label() : null);
  }
  tryInteract() {
    if (this.current) {
      this.audio.play('click');
      this.current.act();
    }
  }
  async run(fn) {
    if (this.busy) return;
    this.busy = true;
    this.input.exitPointerLock();
    try {
      await fn();
    } catch (e) {
      console.error(e);
    }
    this.busy = false;
  }

  async sleepMenu() {
    await this.run(async () => {
      const toMorning = this.time.minutesUntil(7);
      const idx = await this.dialogue.choose('苏然', '要休息一会儿吗？（睡觉会推进时间）', [
        { text: '小睡 2 小时' },
        { text: `睡到早上 7 点`, note: `约 ${formatDuration(toMorning)}` },
        { text: '算了，时间不多了' },
      ]);
      if (idx === 0) await this.waitMinutes(120, '睡了一会儿……');
      else if (idx === 1) await this.waitMinutes(toMorning, '一夜过去了……');
    });
  }

  async watchTV() {
    await this.run(() =>
      this.dialogue.say([
        { speaker: '新闻主播', text: '……近日全球多地出现异常天象，极光出现在低纬度地区。专家表示这是正常的太阳活动，市民无需恐慌。' },
        { speaker: '苏然', text: '前世也是这么说的。三天后，天会变成血红色，然后一切都结束了。' },
      ]),
    );
  }
  async lookFridge() {
    await this.run(() =>
      this.dialogue.say([
        { speaker: '', text: '冰箱里只有半盒鸡蛋、一瓶过期的酸奶和几罐啤酒。' },
        { speaker: '苏然', text: '前世我就是靠这点东西撑了一周……这次绝对不会了。' },
      ]),
    );
  }
  async lookWindow() {
    const h = this.time.hour();
    await this.run(() =>
      this.dialogue.say([
        { speaker: '', text: h >= 19 || h < 6 ? '城市的夜晚依旧灯火通明，远处天边隐约泛着诡异的红光。' : '楼下车水马龙，人们照常上班、买菜、遛狗，没有人知道即将发生什么。' },
        { speaker: '苏然', text: '再过不久，这些人里，能活下来的不到一成。' },
      ]),
    );
  }
  async lookPhoto() {
    await this.run(async () => {
      await this.dialogue.say([{ speaker: '苏然', text: '我和爸妈的合影……前世末日爆发时，他们在老家，我再也没能联系上。' }]);
      if (!this.state.bracelet) {
        await this.dialogue.say([{ speaker: '苏然', text: '（这一次，我一定要守住重要的东西。）' }]);
        return;
      }
      const idx = await this.dialogue.choose('苏然', '要把相框收进随身空间吗？', [{ text: '收入空间，好好保存' }, { text: '先放在原处' }]);
      if (idx === 0) {
        const r = this.storage.addItems({ photo: 1 });
        if (r.added.photo) {
          this.state.flags.photoTaken = true;
          this.world.setPhotoVisible(false);
          this.effects.emit(this.world.photo.position, 50, { color: '#3ff5e0', speed: 0.8, up: 0.6, life: 1, spread: 0.2, target: this.player.wristWorld(), attract: 8 });
          this.audio.play('magic');
          this.notify.toast(['【收取成功】', '全家福 × 1个'], { type: 'system' });
          this.saveNow();
        } else this.notify.toast('空间已满', { type: 'warn' });
      }
    });
  }

  // 快递 / 物资箱
  async openPile(id) {
    const s = this.state;
    const pile = s.piles.find((p) => p.id === id);
    if (!pile) return;
    if (pile.kind === 'delivery') s.flags.openedDelivery = true;
    if (!s.bracelet) {
      await this.screens.pilePanel(pile, { locked: true });
      await this.dialogue.say([
        { speaker: '苏然', text: '这么多箱子，一趟趟搬回家太显眼了……要是能悄悄收起来就好了。' },
        { speaker: '苏然', text: '（卧室首饰盒里那只发光的手镯……会不会和这个“系统”有关？）' },
      ]);
      return;
    }
    const ok = await this.screens.pilePanel(pile, { free: this.storage.free(), cap: this.storage.capacity() });
    if (!ok) return;
    const target = this._v.set(pile.x, 0.5, pile.z);
    const seen = this.guard.canSee(target, this.blockers);
    const firstName = ITEMS[Object.keys(pile.items)[0]]?.short || '东西';
    const res = this.delivery.collectPile(id);
    if (!res) return;
    if (!Object.keys(res.added).length) {
      this.audio.play('error');
      this.notify.toast(['【空间不足】', '随身空间已经装满了'], { type: 'warn' });
      return;
    }
    this.player.faceTowards(pile.x, pile.z);
    this.audio.play('magic');
    const anim = this.piles.playCollect(res.pile, res.removed);
    const lines = ['【收取成功】', ...Object.entries(res.added).map(([k, q]) => `${ITEMS[k].short} × ${q}${ITEMS[k].unit}`), `当前空间：${formatVolume(this.storage.used())} / ${formatVolume(this.storage.capacity())} m³`];
    if (!res.removed) lines.push('空间不足，剩余物资仍留在原地');
    this.notify.toast(lines, { type: 'system', duration: 4200 });
    if (res.pile.kind === 'delivery') {
      s.flags.storedDelivery = true;
      if (!seen) s.flags.avoidedGuard = true;
    }
    this.saveNow();
    await anim;
    if (seen) await this.onSeen(firstName, 'collect');
  }

  async onSeen(itemName, kind) {
    const s = this.state;
    const before = suspicionLevel(s.suspicion).level;
    const inc = kind === 'collect' ? (s.flags.encounterDone ? 18 : 28) : 14;
    s.suspicion = Math.min(100, s.suspicion + inc);
    this.guard.showBubble(s.suspicion >= 50 ? '!' : '?', 2.5);
    this.notify.toast([`👮 老周似乎看到了什么……`, `怀疑度 +${inc}（${suspicionLevel(s.suspicion).label}）`], { type: 'warn' });
    if (!s.flags.encounterDone && s.suspicion >= 25) {
      await this.cutscene.guardEncounter(itemName);
    } else {
      this.guard.hold(this.player.pos, 2.5);
      const lv = suspicionLevel(s.suspicion).level;
      if (lv >= 3 && before < 3) {
        this.notify.toast(['【警告】', '老周已经起了很大的疑心，你的秘密可能暴露！'], { type: 'warn', duration: 5000 });
      } else {
        this.notify.toast(`老周：“${['嗯？', '怪了……', '又不见了？！', '这到底是怎么回事……'][lv]}”`, { type: 'info', sound: false });
      }
    }
    this.saveNow();
  }

  withdrawItem(id, qty) {
    const p = this.player.pos;
    const f = this.player.forward();
    let x = p.x + f.x * 1.1, z = p.z + f.y * 1.1;
    if (pointBlocked(x, z, 0.32, this.colliders)) {
      x = p.x - f.x * 1.1;
      z = p.z - f.y * 1.1;
      if (pointBlocked(x, z, 0.32, this.colliders)) {
        x = p.x;
        z = p.z;
      }
    }
    const pile = this.delivery.withdraw(id, qty, { x, z });
    if (!pile) return;
    this.audio.play('magic');
    this.notify.toast(['【取出成功】', `${ITEMS[id].short} × ${pile.items[id]}${ITEMS[id].unit}`, '物资箱已出现在面前，可随时收回'], { type: 'system' });
    if (this.guard.canSee(this._v.set(x, 0.5, z), this.blockers)) this.run(() => this.onSeen(ITEMS[id].short, 'withdraw'));
    this.saveNow();
  }

  placeOrder(type, cart, allowed) {
    const r = this.delivery.placeOrder(type, cart, allowed);
    if (!r.ok) {
      this.audio.play('error');
      this.notify.toast(r.msg, { type: 'warn' });
      return r;
    }
    this.time.advance(10);
    this.audio.play('coin');
    const n = Object.values(r.order.items).reduce((a, c) => a + c, 0);
    this.notify.toast(['【下单成功】', `${n} 件 · ${formatMoney(r.order.total)}`, `预计 ${formatDuration(r.order.arriveAt - this.state.time.elapsed)}后送达楼道暂存区`], { type: 'success' });
    this.saveNow();
    return r;
  }

  async waitMinutes(min, text) {
    min = Math.min(min, this.time.remaining());
    if (min <= 0) return;
    const wasBusy = this.busy;
    this.busy = true;
    await this.screens.timePass(text || `时间流逝…… +${formatDuration(min)}`);
    this.time.advance(min);
    this.delivery.update();
    this.guard.reset();
    this.busy = wasBusy;
    this.saveNow();
  }
  async waitForNextDelivery() {
    const o = this.delivery.nextArrival();
    if (!o) {
      this.notify.toast('目前没有配送中的订单', { type: 'info' });
      return;
    }
    await this.waitMinutes(Math.max(1, Math.ceil(o.arriveAt - this.state.time.elapsed)), '等待快递送达……');
  }

  // ---------------- 主循环 ----------------
  updateLighting() {
    if (this.cutLighting) return;
    const L = this.world.lights;
    const h = this.mode === 'menu' ? 17.6 : this.time.hour();
    const day = smooth(5.5, 8, h) * (1 - smooth(17.5, 20, h));
    const dusk = Math.max(smooth(5, 6.5, h) * (1 - smooth(6.5, 8.5, h)), smooth(16.5, 18.2, h) * (1 - smooth(18.2, 20, h)));
    L.sun.intensity = 0.25 + 2.1 * day;
    L.hemi.intensity = 0.5 + 0.75 * day;
    L.sun.color.setRGB(1, 0.92 - dusk * 0.25, 0.82 - dusk * 0.4);
    const bg = this.scene.background;
    bg.copy(SKY.night).lerp(SKY.day, day).lerp(SKY.dusk, dusk * 0.6);
    this.world.windowMat.color.copy(WIN.night).lerp(WIN.day, day).lerp(WIN.dusk, dusk * 0.7);
    const night = 1 - day;
    L.bedLamp.intensity = 1 + night * 5;
    L.livingLamp.intensity = 1.5 + night * 7;
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const blocking = this.isBlocking();
    const playing = this.mode === 'play' && !blocking;
    const s = this.state;

    if (playing) {
      this.time.advance(dt * TIME_RATE);
    }
    if (this.mode !== 'menu') this.delivery.update();

    const move = playing ? this.input.getMove() : { x: 0, y: 0 };
    const look = this.input.consumeLook();
    if (playing) this.rig.rotate(look.dx, look.dy);
    this.player.update(dt, move, this.rig.yaw, this.allColliders(), this.input.isRunning);
    // 与保安的简单碰撞
    const gp = this.guard.pos, pp = this.player.pos;
    const dx = pp.x - gp.x, dz = pp.z - gp.z, d = Math.hypot(dx, dz);
    if (d < 0.6 && d > 1e-4) {
      pp.x = gp.x + (dx / d) * 0.6;
      pp.z = gp.z + (dz / d) * 0.6;
    }
    this.guard.update(dt, playing, this.blockers, suspicionLevel(s.suspicion).color);
    for (const fn of this.updaters) fn(dt);
    this.effects.update(dt);
    this.world.update(dt);

    if (this.mode === 'menu') {
      this.menuAng += dt * 0.05;
      this.rig.override = { pos: this._v.set(1 + Math.sin(this.menuAng) * 10, 8.5, 1 + Math.cos(this.menuAng) * 10).clone(), look: new THREE.Vector3(1, 0.5, -1), speed: 1.5 };
    }
    this.rig.update(dt, this.player.focus(), this.blockers);

    if (playing) {
      this.updateInteractions();
      if (!s.flags.foundJewelry && Math.hypot(pp.x - this.world.points.jewelry.x, pp.z - this.world.points.jewelry.z) < 2.4) {
        s.flags.foundJewelry = true;
        this.notify.toast('梳妆台上的首饰盒里，有什么东西在发光……', { type: 'info' });
      }
      this.quests.update();
      this.storyTimers(dt);
      this.autosaveT += dt;
      if (this.autosaveT > 15) {
        this.autosaveT = 0;
        this.saveNow();
      }
    } else if (this.mode !== 'play' || blocking) {
      this.hud.prompt(null);
    }
    if (this.mode === 'play' || this.mode === 'intro') this.hud.update(dt);
    this.updateLighting();
    this.renderer.render(this.scene, this.camera);
  }

  storyTimers(dt) {
    const s = this.state;
    const qi = s.quest.index;
    if (qi === 5 && !s.flags.callAnswered) {
      this.callTimer += dt;
      if (this.callTimer > 10) {
        this.callTimer = 0;
        this.cutscene.phoneCall();
      }
    }
    if (qi === 6 && !s.flags.summaryShown) {
      this.summaryTimer += dt;
      if (this.summaryTimer > 2.5) {
        this.summaryTimer = 0;
        this.cutscene.chapterEnd(false);
      }
    }
    if (this.time.remaining() <= 0 && !s.flags.apocalypse) {
      s.flags.apocalypse = true;
      s.flags.summaryShown = true;
      this.cutscene.chapterEnd(true);
    }
  }
}
