export default class IntervalScheduler {
  constructor(interval, func) {
    this.interval = interval;
    this.func = func;
    this.timer = null;
  }
  
  start() {
    this.timer = setInterval(this.func, this.interval);
  }
  
  stop() {
    clearInterval(this.timer);
  }
}