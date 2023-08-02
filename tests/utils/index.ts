export const awaitConsoleLog = (checkMs: number, consoleCalls: any[]): Promise<number> => new Promise((r) => {
  let callsLength: number = consoleCalls.length;
  const interval = setInterval(() => {
    if (callsLength === consoleCalls.length) {
      clearInterval(interval);
      r(consoleCalls.length);
    }
    callsLength = consoleCalls.length;
  }, checkMs)
});

export const sleep = (ms: number, payload?: object) => new Promise((r) => setTimeout(() => r(payload), ms));