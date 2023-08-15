import { COLOR, TYPE_TO_COLOR, JSONTagPad, ANONYMOUS_ROUTE } from "../../constants";

const valueFormatter = (value: any) => {
  const formatted =  typeof value === "string" ? `${COLOR.fgGreen}"${value}"` : `${TYPE_TO_COLOR[value === false || value === null ? "red" : typeof value]}${value}`
  return `${COLOR.reset}${formatted}${COLOR.reset}`
};

const STRINGIFY_FUNCTION_REF = "[*Function*]ref";

type JSONColorizedOption = {
  /**
   * wrap
   */
  0: true;
  /**
   * inlineObjMultiline
   */
  1: undefined;
} | {
  /**
   * wrap
   */
  0: undefined;
  /**
   * inlineObjMultiline
   */
  1: boolean;
}

export const colorizedJSON = (nextLinePad: string, value: any, options: JSONColorizedOption = [, true], inlineMultiline = true): string => {
  if (typeof value !== "object" || value === null) return valueFormatter(value);
  const newLine = typeof options[0] === 'undefined' ? '\n' : '';
  const pad = typeof options[0] === 'undefined' ? JSONTagPad : '';
  const spacing = typeof options[0] === 'undefined' ? ' ' : '';
  if (Array.isArray(value)) return `[${newLine}${nextLinePad}${pad}${value
      .map(item => colorizedJSON(`${nextLinePad}${pad}`, item, options)).join(`,${newLine}${nextLinePad}${pad}`)}${newLine}${nextLinePad}]`;
  const objEntries = Object.entries(value);
  if (!objEntries.length || !objEntries.some(([key, value]) => (typeof value === "object" && value !== null ? Object.keys(value).length : true))) return "";
  if (!inlineMultiline) return `{${spacing}${objEntries.filter(([qK, qV]) => qV !== undefined).map(([qK, qV]) => `${COLOR.fgYellow}"${qK}":${spacing}${colorizedJSON(nextLinePad, qV, options)}`).join(`,${spacing}`)}${spacing}}`
  return `{${objEntries
    .reduce((acc, [key, value]) => {
      if (value === undefined) return acc;
      const elements = `${acc},${newLine}${nextLinePad}${pad}${COLOR.fgYellow}${key}:${spacing}${COLOR.reset}`
      if (typeof value !== "object" || value === null) return `${elements}${valueFormatter(value)}`;
      const valueKeys = Object.keys(value);
      /* istanbul ignore next */
      if (!valueKeys.length) return acc;
      if (value['type'] === STRINGIFY_FUNCTION_REF) return `${elements}${COLOR.fgCyan}[Function ${value['name']}]${COLOR.reset}`
      return `${elements}${colorizedJSON(`${nextLinePad}${pad}`, value, options, options[1])}`;
    }, "")
    .slice(1)}${newLine}${nextLinePad}}`;
};

export const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    else if (typeof value === 'function') return {
      type: STRINGIFY_FUNCTION_REF,
      name: (value as Function).name || ANONYMOUS_ROUTE
    }
    return value;
  };
};