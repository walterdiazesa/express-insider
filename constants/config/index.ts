export const CONFIG_KEYS = ["trailId", "logger", "ignoreMiddlewares", "ignoreRoutes", "showRequestedURL", "showResponse", "showRSS", "showColors", "report", "timingFormatter", "initialImmutableMiddlewares", "logStrategy", "delayMs", "skip"] as const;

export const DEFAULT_TRAIL_OPTIONS = {
  ignoreMiddlewares: false,
  showRequestedURL: false,
  showResponse: false,
  showRSS: false,
  logStrategy: 'real-time',
  showColors: true,
} as const;