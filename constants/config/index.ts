export const DEFAULT_TRACE_OPTIONS = {
  ignoreMiddlewares: false,
  showRequestedURL: false,
  showResponse: false,
  showRSS: false,
  logStrategy: 'real time',
  showColors: true,
  timingFormatter: (elapsed: number) => elapsed
} as const;