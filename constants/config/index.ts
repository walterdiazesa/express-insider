export const CONFIG_KEYS = ["trailId", "logger", "ignoreMiddlewares", "ignoreRoutes", "showRequestedURL", "showResponse", "showRSS", "showColors", "report", "timingFormatter", "initialImmutableMiddlewares", "logStrategy", "delayMs", "skip"] as const;

export const DEFAULT_TRACE_OPTIONS = {
  ignoreMiddlewares: false,
  showRequestedURL: false,
  showResponse: false,
  showRSS: false,
  logStrategy: 'real-time',
  showColors: true,
  timingFormatter: (elapsed: number) => elapsed
} as const;