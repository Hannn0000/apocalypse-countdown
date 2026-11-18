export const STOCKS = [
  { name: '华夏科技', code: '600318', shares: 400, base: 22.5 },
  { name: '东方新能源', code: '300741', shares: 300, base: 18.0 },
  { name: '鹏城地产', code: '000562', shares: 500, base: 11.2 },
]; // 初始市值合计 ¥20,000

const wave = (i, t) => 0.03 * Math.sin(t / 37 + i * 2.1) + 0.015 * Math.sin(t / 11 + i);

export function stockPrice(i, elapsed) {
  const s = STOCKS[i];
  return Math.round(s.base * (1 + wave(i, elapsed) - wave(i, 0)) * 100) / 100;
}

export class Economy {
  constructor(game) {
    this.game = game;
  }
  get s() {
    return this.game.state;
  }
  get money() {
    return this.s.money;
  }
  log(desc, amount) {
    this.s.transactions.unshift({ t: this.s.time.elapsed, desc, amount });
    if (this.s.transactions.length > 60) this.s.transactions.length = 60;
  }
  canAfford(amount) {
    return this.s.money >= amount;
  }
  spend(amount, desc) {
    amount = Math.round(amount);
    if (!(amount > 0) || this.s.money < amount) return false;
    this.s.money -= amount;
    this.s.stats.spent += amount;
    this.log(desc, -amount);
    this.game.bus.emit('money:changed', -amount);
    return true;
  }
  earn(amount, desc) {
    amount = Math.round(amount);
    if (!(amount > 0)) return false;
    this.s.money += amount;
    this.log(desc, amount);
    this.game.bus.emit('money:changed', amount);
    return true;
  }
  claimLoan(kind) {
    const key = kind === 30 ? 'l30' : kind === 50 ? 'l50' : null;
    if (!key) return { ok: false, msg: '无效的贷款类型' };
    if (this.s.loans[key]) return { ok: false, msg: '该贷款已领取，不能重复申请' };
    this.s.loans[key] = true;
    const amount = kind * 1000;
    this.earn(amount, kind === 30 ? '个人消费贷款到账' : '极速闪电贷到账');
    return { ok: true, amount };
  }
  portfolioValue() {
    if (this.s.stocksSold) return 0;
    let v = 0;
    STOCKS.forEach((st, i) => (v += stockPrice(i, this.s.time.elapsed) * st.shares));
    return Math.round(v);
  }
  sellStocks() {
    if (this.s.stocksSold) return { ok: false, msg: '股票已经全部卖出了' };
    const value = this.portfolioValue();
    this.s.stocksSold = true;
    this.earn(value, '股票清仓卖出');
    return { ok: true, value };
  }
}
