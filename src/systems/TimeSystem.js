// 游戏时间：总共 72 小时。探索时每现实秒推进 TIME_RATE 游戏分钟。
export const TOTAL_MINUTES = 72 * 60;
export const START_MINUTE_OF_DAY = 7 * 60; // 第 1 天早上 7:00
export const TIME_RATE = 2;

const pad = (n) => String(n).padStart(2, '0');

export function formatCountdown(min) {
  min = Math.max(0, Math.floor(min));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return `${pad(d)}天 ${pad(h)}小时 ${pad(m)}分钟`;
}

export function formatDuration(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}小时${m}分钟`;
  if (h) return `${h}小时`;
  return `${m}分钟`;
}

export class TimeSystem {
  constructor(game) {
    this.game = game;
  }
  get elapsed() {
    return this.game.state.time.elapsed;
  }
  remaining() {
    return Math.max(0, TOTAL_MINUTES - this.elapsed);
  }
  advance(min) {
    if (!(min > 0)) return 0;
    const s = this.game.state;
    const before = s.time.elapsed;
    s.time.elapsed = Math.min(TOTAL_MINUTES, s.time.elapsed + min);
    const delta = s.time.elapsed - before;
    if (delta > 0) this.game.bus.emit('time:advanced', delta);
    return delta;
  }
  absMinute() {
    return START_MINUTE_OF_DAY + this.elapsed;
  }
  hour() {
    return (this.absMinute() % 1440) / 60;
  }
  day() {
    return Math.floor(this.absMinute() / 1440) + 1;
  }
  clock() {
    const t = Math.floor(this.absMinute());
    return `${pad(Math.floor((t % 1440) / 60))}:${pad(t % 60)}`;
  }
  dateLabel() {
    return `末日前 · 第${this.day()}天 ${this.clock()}`;
  }
  minutesUntil(hourOfDay) {
    const now = this.absMinute() % 1440;
    let target = hourOfDay * 60 - now;
    if (target <= 0) target += 1440;
    return target;
  }
}
