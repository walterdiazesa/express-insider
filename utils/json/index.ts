import { COLOR, TYPE_TO_COLOR, JSONTagPad } from "../../constants";

const valueFormatter = (value: any) => {
  const formatted =  typeof value === "string" ? `${COLOR.fgGreen}"${value}"` : `${TYPE_TO_COLOR[value === false || value === null ? "red" : typeof value]}${value}`
  return `${COLOR.reset}${formatted}${COLOR.reset}`
};
export const colorizedJSON = (nextLinePad: string, value: any, objMultiline = true, firstMultiline = true): string => {
  if (typeof value !== "object" || value === null) return valueFormatter(value)
  if (Array.isArray(value)) return `[\n${nextLinePad}${JSONTagPad}${value
      .map(item => colorizedJSON(`${nextLinePad}${JSONTagPad}`, item, objMultiline)).join(`,\n${nextLinePad}${JSONTagPad}`)}\n${nextLinePad}]`;
  const objEntries = Object.entries(value);
  if (!objEntries.length || !objEntries.some(([key, value]) => (typeof value === "object" ? Object.keys(value).length : true))) return "";
  if (!firstMultiline) return `{ ${objEntries.filter(([qK, qV]) => qV !== undefined).map(([qK, qV]) => `${COLOR.fgYellow}"${qK}": ${colorizedJSON(nextLinePad, qV, objMultiline)}`).join(", ")} }`
  return `{${objEntries
    .reduce((acc, [key, value]) => {
      if (value === undefined) return acc;
      const elements = `${acc},\n${nextLinePad}${JSONTagPad}${COLOR.fgYellow}${key}: ${COLOR.reset}`
      if (typeof value !== "object" || value === null) return `${elements}${valueFormatter(value)}`;
      const valueKeys = Object.keys(value);
      if (!valueKeys.length) return acc;
      return `${elements}${colorizedJSON(`${nextLinePad}${JSONTagPad}`, value, objMultiline, objMultiline)}`;
    }, "")
    .slice(1)}\n${nextLinePad}}`;
};