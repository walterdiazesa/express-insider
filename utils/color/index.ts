import { COLOR } from "../../constants";

export const getStatusCodeColor = (statusCode: number) => (statusCode >= 200 && statusCode <= 299 ? COLOR.fgGreen : statusCode >= 400 ? COLOR.fgRed : COLOR.fgWhite);