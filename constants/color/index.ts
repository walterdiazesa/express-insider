import { Method } from "../../ts";

export const COLOR = {
  bgRed: "\x1b[41m",
  fgWhite: "\x1b[37m",
  fgRed: "\x1b[31m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgGreen: "\x1b[32m",
  fgMagenta: "\x1b[35m",
  fgCyan: "\x1b[36m",
  reset: "\x1b[0m",
  bright: "\x1b[1m",
};

export const TYPE_TO_COLOR = {
  number: COLOR.fgBlue,
  boolean: COLOR.fgMagenta,
  red: COLOR.fgRed,
};

export const METHOD_COLOR: Record<Uppercase<Method>, (typeof COLOR)[keyof typeof COLOR]> = {
  GET: COLOR.fgGreen,
  PATCH: COLOR.fgCyan,
  PUT: COLOR.fgCyan,
  DELETE: COLOR.fgRed,
  POST: COLOR.fgYellow,
  HEAD: COLOR.fgBlue,
  OPTIONS: COLOR.fgBlue,
  CONNECT: COLOR.fgBlue,
  TRACE: COLOR.fgBlue,
  ALL: COLOR.fgBlue,
};