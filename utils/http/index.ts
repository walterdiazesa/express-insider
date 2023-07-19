import { Response } from "express";
import { HTTP_STATUS_MESSAGE_TO_CODE } from "../../constants";

/**
  * __[ODD-1]__: When using express@4.9.0 (unknown about other versions under 4.10.0) the test "trail on custom configuration › Should handle [CASE 12] with POST /conditional-route"
  * fails, even that the route return statusCode 200 as expected, the trail output shows 404, when removing the next call in the third route everything works as expected,
  * what is happenning is that express treats undefined next routes different in 4.9.0, so as no afterwards middleware is found the app crashes setting the statusCode as 404, so
  * the bandage fix to support 4.9.0 is to redefine the possible outcome for 404 cases if res.statusMessage is still defined as "OK"
  * 
  * Current state: FIXED!, we could return => res.statusCode directly, but it's a good redundant condition
  */
export const getStatusCode = (res: Response): typeof HTTP_STATUS_MESSAGE_TO_CODE[keyof typeof HTTP_STATUS_MESSAGE_TO_CODE] =>
  res.statusCode === 404 && res.statusMessage !== 'Not found' ? HTTP_STATUS_MESSAGE_TO_CODE[res.statusMessage.toLowerCase().replaceAll(' ', '')] : res.statusCode;