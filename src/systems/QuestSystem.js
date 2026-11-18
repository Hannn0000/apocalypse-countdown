export const QUESTS = [
  {
    id: 'q1', title: '重生之日',
    hint: '按 Tab（或点击「手机」按钮）打开手机',
    objectives: [
      { text: '醒来', done: (s) => s.flags.woke },
      { text: '阅读系统通知', done: (s) => s.flags.readSystem },
      { text: '打开手机', done: (s) => s.flags.phoneOpened },
    ],
  },
  {
    id: 'q2', title: '最后的资产',
    hint: '在手机里打开「银行」和「股票」App',
    objectives: [
      { text: '查看银行账户', done: (s) => s.flags.bankChecked },
      { text: '卖出股票或申请贷款', done: (s) => s.stocksSold || s.loans.l30 || s.loans.l50 },
    ],
  },
  {
    id: 'q3', title: '神秘的手镯',
    hint: '首饰盒在卧室的梳妆台上',
    objectives: [
      { text: '找到卧室里的首饰盒', done: (s) => s.flags.foundJewelry },
      { text: '查看发光的手镯', done: (s) => s.flags.examinedBracelet },
      { text: '觉醒空间异能', done: (s) => s.bracelet },
    ],
  },
  {
    id: 'q4', title: '第一次囤货',
    hint: '下单后可用「时钟」App、睡觉，或四处走走等待送达',
    objectives: [
      { text: '打开购物 App', done: (s) => s.flags.shopOpened },
      { text: '购买至少 5 件生存物资', done: (s) => s.stats.shopItemsBought >= 5, progress: (s) => `${Math.min(5, s.stats.shopItemsBought)}/5` },
      { text: '等待快递送达', done: (s) => s.flags.deliveryArrived },
    ],
  },
  {
    id: 'q5', title: '空间的秘密',
    hint: '老周巡逻时会看向楼道，趁他回保安室时再收取',
    objectives: [
      { text: '去楼道快递暂存区查看快递', done: (s) => s.flags.openedDelivery },
      { text: '用手镯把物资收入空间', done: (s) => s.flags.storedDelivery },
      { text: '避开保安老周的视线', done: (s) => s.flags.avoidedGuard || s.flags.encounterDone },
    ],
  },
  {
    id: 'q6', title: '前世的电话',
    hint: '……手机好像要响了',
    objectives: [
      { text: '接听来电', done: (s) => s.flags.callAnswered },
      { text: '做出你的决定', done: (s) => !!(s.choices.call || s.choices.lend) },
    ],
  },
  {
    id: 'q7', title: '未雨绸缪',
    hint: '回顾这一天的准备',
    objectives: [{ text: '查看准备总结', done: (s) => s.flags.summaryShown }],
  },
];

export class QuestSystem {
  constructor(game) {
    this.game = game;
  }
  get s() {
    return this.game.state;
  }
  current() {
    return QUESTS[this.s.quest.index] || null;
  }
  isComplete(q) {
    return q.objectives.every((o) => !!o.done(this.s));
  }
  update(silent = false) {
    let guard = 0;
    while (this.s.quest.index < QUESTS.length && guard++ < 10) {
      const q = QUESTS[this.s.quest.index];
      if (!this.isComplete(q)) break;
      this.s.quest.index++;
      if (!silent) {
        this.game.bus.emit('quest:complete', q);
        const next = QUESTS[this.s.quest.index];
        if (next) this.game.bus.emit('quest:start', next);
      }
    }
  }
  allDone() {
    return this.s.quest.index >= QUESTS.length;
  }
}
