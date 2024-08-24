export const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
export const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
export const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
export const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;
export const magenta = (text: string) => `\x1b[35m${text}\x1b[0m`;
export const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;

export const frames = ['|', '/', '-', '\\'];


export function customSpinner(text: string) {
    let i = 0;
    return setInterval(() => {
      process.stdout.write(`\r${frames[i]} ${text}`);
      i = (i + 1) % frames.length;
    }, 100);
  }


export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const colorize = {
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
};

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export const  spinner = {
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  interval: 80,
  current: 0,
  timer: null as NodeJS.Timeout | null,
  start(text: string) {
      this.current = 0;
      this.timer = setInterval(() => {
          process.stdout.write(`\r${this.frames[this.current]} ${text}`);
          this.current = (this.current + 1) % this.frames.length;
      }, this.interval);
  },
  stop() {
      if (this.timer) {
          clearInterval(this.timer);
          process.stdout.write('\r');
      }
  }
};



export const printProgressBar = (current: number, total: number, barLength: number = 30) => {
  const filledLength = Math.floor(barLength * current / total);
  const emptyLength = barLength - filledLength;
  const filledBar = '█'.repeat(filledLength);
  const emptyBar = '░'.repeat(emptyLength);
  const percentage = Math.round((current / total) * 100);
  console.log(`\r[${filledBar}${emptyBar}] ${percentage}% | ${current}/${total}`);
};