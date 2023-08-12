<h1 align="center">express-trail</h1>

<p align="center">An extremely thoughtful and accurate request logger that provides performance metrics for middlewares, routes, and subroutes within our Express application.</p>

<p align="center">
<a href="https://codecov.io/gh/walterdiazesa/express-trail" target="_blank"><img src="https://codecov.io/gh/walterdiazesa/express-trail/branch/main/graph/badge.svg?token=JUJQ77UKI7" alt="codecov" /></a>
<a href="https://github.com/walterdiazesa/express-trail" target="_blank"><img src="https://img.shields.io/github/actions/workflow/status/walterdiazesa/express-trail/coverage.yaml" alt="GitHub Workflow Status" /></a>
<a href="https://raw.githubusercontent.com/walterdiazesa/express-trail/main/package.json" target="_blank"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
<a href="https://github.com/expressjs/express" target="_blank"><img src="https://img.shields.io/badge/express->=4.0.0-green?logo=express" alt="Express version" /></a>
<a href="https://github.com/nodejs/node" target="_blank"><img src="https://img.shields.io/badge/node->=16.0.0-green?logo=nodedotjs" alt="Node version" /></a>
<a href="https://github.com/oven-sh/bun" target="_blank"><img src="https://img.shields.io/badge/bun->=0.5.1-green?logo=bun" alt="Bun version" /></a>
</p>

# Installation

Zero dependencies, plug and play, highly customizable

1- Add `express-trail` to your `package.json`

Using `npm`:
```bash
npm install express-trail
```
Using `pnpm`:
```bash
pnpm add express-trail
```
Using `yarn`:
```bash
yarn add express-trail
```

2- Import and Configure `express-trail` in your project

```ts
import express from "express";
import { trail } from "express-trail"; // <-- Here

const app = express();
// Configure routes and middlewares for your Express app
// ...

// Before opening the server (app.listen), call trail with your express application
trail(app); // <-- You can provide custom settings as the second argument
app.listen(process.env.PORT, () => console.log(`🚀 Server ready on ${process.env.PORT}`));
// Alternatively, you can use "trail(app).listen(...)" if you prefer
```

More information about customization on the [Configuration](https://github.com/walterdiazesa/express-trail#Configuration) section.

# Description

Take the main goal of [Morgan](https://www.npmjs.com/package/morgan) but more targeted and comprehensive, our request logger library is designed to be exceptionally thoughtful and accurate. It goes beyond standard request logging, offering in-depth performance metrics specifically tailored for middlewares, routes, subroutes, and specific blocks within your Express application. By meticulously tracking and analyzing request interactions, response times, and execution paths, it provides an invaluable tool for fine-tuning and optimizing your application's performance.

# End Purpose

The ultimate goal of this library is not only to offer insightful insights into your routes' interactions and time usage for each but also to monitor request lifecycle metrics within your application comprehensively. It will generate flame graphs illustrating time distribution across each stage of request processing, facilitate tracking specific requests, highlight the most frequently accessed routes, and identify potential areas for improvement, like a lightweight NewRelic or Datadog. All of this self-hosted alongside the API you are already hosting. However, developing these features will naturally require time. Hence, the primary focus of this library, contingent on sufficient community support, will be directed towards achieving this goal.

# Logger Library?

Then what about [Winston](https://www.npmjs.com/package/winston), [Bunyan](https://www.npmjs.com/package/bunyan), [Pino](https://www.npmjs.com/package/pino), etc.? Is `express-trail` a replacement to any of those logging libraries? No, quite the opposite. `express-trail` is not intended to replace or compete with existing logging libraries like Winston, Bunyan, or Pino. Instead, it __complements them__. With `express-trail`, you're encouraged to utilize any of these established logging libraries in tandem as `express-trail` acts as a wrapper over these libraries (it uses `console.log` by default).
So it's important to note that `express-trail` doesn't aim to __"provide"__ logging functionality on its own. Rather, it __"utilizes"__ existing logging functionalities to visually depict the lifecycle of a specific request and its interactions with your express application.

# Performance

Let's use a basic application, one route to obtain a list of assets, simulating authentication (~3ms), notifications (~20ms), database (~40ms), and a final middleware cleaner

```ts
import express from "express";
import { trail } from "express-trail";
import { AuthRequest, authRouteGuard, cleanerMiddleware, cors, getAssetsFromDB, sendNotification } from "./testassets";

const app = express();

app.use(cors);
app.use(express.json());

app.get("/assets", 
authRouteGuard,
async (req, res, next) => {
  const assets = await getAssetsFromDB();
  res.send(assets);
  next();
},
async function assetNotificationHandler(req: AuthRequest, res, next) {
  await sendNotification(req.user);
  next();
});

app.use(cleanerMiddleware);

trail(app);
app.listen(3000, () => console.log(`🚀 Server ready on 3000`));
```

The output using `express-trail` (default config) is:

<img width="180" alt="image" src="https://user-images.githubusercontent.com/58494087/259510905-d7027ff0-2814-42e1-9c02-436c18b90364.png">
<img width="847" alt="image" src="https://user-images.githubusercontent.com/58494087/259510372-57bae38f-68d4-4f49-b1d8-60945462d7dc.png">

The output using `morgan` (default) is:

<img width="180" alt="image" src="https://user-images.githubusercontent.com/58494087/259512164-b9c3e3a3-26a0-48ce-95ec-e068faeb4185.png">
<img width="737" alt="image" src="https://user-images.githubusercontent.com/58494087/259511845-d5772b81-0f45-44a9-a0d6-e8a76ef47909.png">


Also, `express-trail` inject a hook to test specific segment of our application, for example we can use it to measure how much time of the request is used retrieving `getAssetsFromDB` in the previous example:

```ts
async (req, res, next) => {
  // Change
  const assets = await getAssetsFromDB();
  // To
  const segment = req.logSegmentPerf('getAssetsFromDB');
  const assets = await getAssetsFromDB();
  segment(assets);
  res.send(assets);
  next();
}
```

Now we obtain new information about the metrics of a specific Segment of our application, including time taken and segment's size (for instance, 56 bytes, which corresponds to the size showed by the HTTP Client as it wasn't Gzipped) Furthermore, the recorded time of ~41.17ms also aligns with the previously mentioned duration of the database simulation of ~40ms.

<img width="180" alt="image" src="https://user-images.githubusercontent.com/58494087/259510905-d7027ff0-2814-42e1-9c02-436c18b90364.png">
<img width="845" alt="image" src="https://user-images.githubusercontent.com/58494087/259561982-9a76c7e1-96ab-43e0-9819-9b8719c774c6.png">

Now that we're beginning to understand the reasons to opt for `express-trail`, let's examine both request loggers using various runtimes and strategies.

Using [oha](https://github.com/hatoo/oha):
```bash
oha -c 200 -z 10s -n 200 http://localhost:3000/assets
```

Points to consider:
* The tests are running on an M1 Mac with no other processes outside the server and `Oha`. The numbers will vary between computers, but concerning relative values, they should maintain the same relationship.
* The parameters for `Oha` were tweaked to cause the maximum bottleneck with this specific test application and computer.
* The tests were each run at least 3 times. While the results always exhibit slight differences, these differences are not significant enough to alter their position when compared to the rest of the tests, nor are they substantial enough to be considered inconsistent results.
* The results I will provide are the outcomes of a micro-benchmark run against a highly generalistic Express application. Depending on various factors, such as customization, number of handlers, average timeframe per single request without any logging functionality of any kind, different outcomes will arise. For instance, on applications with less asynchronous work, the best performance by a considerable margin is achieved using the `delay-all` strategy with `Pino`. Despite this, it did not emerge as the winner for this particular application. It's important to take into account the drawbacks of using `delay-all` as mentioned later in the configuration section.

![express-trail-performance](https://github.com/walterdiazesa/express-trail/assets/58494087/92ff74a8-e252-402f-821e-db1abc124798)

* Overall, this isn't the sole test or application that I've experimented with. I've conducted tests with both short-lived and long-lived requests, evaluating durations of 10, 30, and 60 seconds, while also incorporating diverse customizations. While I've examined a range of scenarios, I believe the results I've presented here provide a solid representation for a typical use case.

# Configuration

You can setup `express-trail` with a single line `trail(app)`, but you may want to provide certain properties to achieve more personalization acoomodated to your use-case, you only need to provide a second argument which is an object (`TrailOptions`) describing the behaviour you want `express-trail` to follow `trail(app, { /* Your rules here */ })`, each of them had their own inline documentation so you can jump right on it and let your editor intellisense to show you how to use each of them, here's also the same customization guideline for each rule, __all of them optional__

| Option        | Description           | Default     |
| ------------- | --------------------- | ----------- |
| `trailId` | Id of the request trace    | UUID     |
| `logger`    | Custom logger to output the process       | `console.log`        |
| `ignoreMiddlewares`    | middlewares to ignore by the logger       | `false`        |
| `ignoreRoutes`    | routes to ignore by the logger       | `undefined`        |
| `showRequestedURL`    | dynamic routes to log the requested parameter       | `false`        |
| `showResponse`    | routes to log the response sended to the user       | `false`        |
| `showRSS`    | Append rss to the logging trace       | `false`        |
| `showColors`    | Colorize outputs console outputs       | `true`        |
| `report`    | Callback to client consumer needs       | `undefined`        |
| `timingFormatter`    | Format the elapsed time for each step of the process      | `undefined`        |
| `initialImmutableMiddlewares`    | List of middlewares that shouldn't be mutated by express-trail and always ran first       | `undefined`        |
| `logStrategy`    | Strategy to output the process to console       | `"real-time"`        |
| `delayMs`    | Delay of the console outputs when using "delay-*" strategies      | `500`        |
| `skip`    | ignore requests outputs base of conditions when using "await-each" strategy       | `undefined`        |

### __The `RouteMatcher` standard__:

For `ignoreRoutes`, `showRequestedURL`, and `showResponse`, all of them use the standard __`RouteMatcher`__: An object of type
```ts
{ route: `/${string}`; method: 'any' | Uppercase<Method> | Lowercase<Method> | 'ANY' }
```
designed to match routes defined by the provided rules, let's take this app as an example

```ts
import express from 'express';
const app = express();
...
app.get('/', (req, res) => { /* Handler */ });
app.get('/:uuid', (req, res) => { /* Handler */ });
app.all('/health/:port', (req, res) => { /* Handler */ });

const userRouter = express.Router();
router.get('/', (req, res) => { /* Handler */ });
router.get('/:id', (req, res) => { /* Handler */ });
app.use('/user', userRouter);
...
```

__{RouteMatcher}`.route`__: The path of the route, independent of if it was added by an `express.Router` or to `app` directly, exactly as it would be called from a HTTP Client (without the [origin](https://developer.mozilla.org/en-US/docs/Web/API/URL/origin)) and for parametized routes use the same parameter mask that you declared on your express route, the complete list of routes for the previous application would be `/`, `/:uuid` (Note that even the paramerized mask can take any string value, we need to type exactly the same parametized mask value we gave to express in the first place), `/user` (Even that you can call this route as `/user/` you need to remove the trailing `/`), and `/user/:id`.
__{RouteMatcher}`.method`__: Any [HTTP method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods) given by [HTTP specification](https://www.w3.org/Protocols/rfc2616/rfc2616-sec5.html#sec5.1.1) or by the special-cased handlers express provides (f.e `all`, that applies the middleware, route or callback to every HTTP method), case insensitive (`get`, `GET`, `post`, `PUT`, `delete`, etc.).

❗️: The value `all` in the `method` property is not the same as `any`, if you want to ignore __all__ methods of the provided route you should use `any`, if you want to ignore requests being handle by the route `app.all('/', (req, res, next) { ... })`
you should use `all`, this is because even if you have `app.all('/', (req, res, next) { ... })` you can still use `app.get('/', (req, res, next) { ... })`
by declaring the `app.get` route before `app.all` (the first one declared would be the one taking precedence), so for cases you want to ignore `app.all('/', ...)`
but not `app.get('/', ...)` you can include the object in the array of this property as `{ route: '/', method: 'all' }`

More examples on the description of each of the properties `ignoreRoutes`, `showRequestedURL`, and `showResponse` below


### ⚙️ {TrailOptions}`.trailId`: `((req: Request, res: Response) => string) | (() => string)`

Provide a custom trace id generator, currently uses the native approach directly using
`import { randomUUID } from 'node:crypto';`
In Node (Bun is considerably slower), using UUID is the most efficient and secure way to generate identifiers
for filtering by a specific logging group. However, there are certain cases where efficiency at the initial
stage is not as important:

1- If you intend to store the logs in a database, it is recommended to use [ULID](https://www.npmjs.com/package/ulid) because, although generating a
UUID in Node is faster, ULID will have better performance over time when querying your database due to its inherent nature.

```ts
import { ulid } from 'ulid';
...
trail(app, { trailId: ulid })
```

2- If you already have some identifier in your Request or Response object coming from another service or assigned by some other middleware*
(or you simply want to obtain your identifier from another service), you can use that same identifier to filter your logging
group and maintain a consistent single source of truth.

Also see __{TrailOptions}`.initialImmutableMiddlewares`__

```ts
trail(app, { trailId: (req) => req.headers['X-Request-ID'] });
```

### ⚙️ {TrailOptions}`.logger`: `(message: string) => void`

`express-trail` uses the native `console.log` method (which is just a wrapper over `process.stdout.write`),
logging is not often viewed as a critical aspect in performance as is normally used just in basic cases
such as debugging the value of some variable, but in reality it is a relatively expensive process in
terms of performance, therefore this library gives the possibility to the consumer to bring their own
logger, the recommended by us is [Pino](https://github.com/pinojs/pino)

Also see __{TrailOptions}`.showColors`__

```ts
import { pino } from 'pino';
const pinologger = pino();
...
trail(app, { logger: (message) => pinologger.info(message), showColors: false })
```

### ⚙️ {TrailOptions}`.ignoreMiddlewares`: `string[]`

If you don't want to see __any__ logs related to middlewares you can set this property as `true`,
if you wan't to hide the logs related to __some__ middlewares you can include the name of the function of the middleware
you wan't to ignore in an array for this property

```ts
import express from "express";
const app = express();
app.use(express.json()); // --> In the logs you can see this middleware name is "jsonParser"
app.use(function cors(req, res, next) {
  // handle cors
  next();
});
app.get("/", (req, res) => {
  res.send({ working: true })
});
trail(app, {
  ignoreMiddlewares: ["query", "expressInit", "jsonParser"]
  // (query and expressInit are middlewares added by express directly)
  // The only middleware you will still see in the logs would be "cors" as you would need to
  // add it to the array to ignore it
});
```

Default value: `false`

### ⚙️ {TrailOptions}`.ignoreRoutes`: `RouteMatcher[]`

You can ignore all the logs related to certain routes, depending if the request match any of the cases
provided in this array of `RouteMatcher`

```ts
import express from "express";
const app = express();
app.get("/book/:id", (req, res) => {
  // Handle GET /book/:id
});
app.get("/book", (req, res) => {
  // Handle GET /book
});
app.post("/book", (req, res) => {
  // Handle POST /book
});
app.delete("/book", (req, res) => {
  // Handle DELETE /book
});
```

__Example:__ Ignore __all__ routes independent of the method for `/book`
```ts
...
trail(app, {
  // Would ignore the GET, POST and DELETE route for /book, logs for "GET /book/:id" will still showing
  ignoreRoutes: [{ route: "/book", method: "any" }]
});
```
__Example:__ Ignore __only__ the `GET /book` route
```ts
...
trail(app, {
  // Would ignore ONLY the "GET /book" route, "POST /book", "DELETE /book" and "GET /book/:id" will still showing
  ignoreRoutes: [{ route: "/book", method: "get" }]
});
```
__Example:__ Ignore POST __and__ DELETE `/book` routes
```ts
...
trail(app, {
  // Would ignore "POST /book" and "DELETE /book" routes, "GET /book" and "GET /book/:id" will still showing
  ignoreRoutes: [{ route: "/book", method: "post" }, { route: "/book", method: "delete" }]
});
```

### ⚙️ {TrailOptions}`.showRequestedURL`: `boolean | RouteMatcher[]`

For parameterized routes as `/:id` or `/book/:id`, the normal behaviour in the logs would be showing `GET /:id`, `GET /book/:id`,
but if you want to show the actual value for the parameterized route as `GET /123`, `GET /book/tom-sawyer` you can provide the
rule inside the array of `RouteMatcher` for this property

```ts
import express from "express";
const app = express();
app.get("/book/:id", (req, res) => {
  // Handle GET /book/:id
});
app.patch("/book/:id", (req, res) => {
  // Handle PATCH /book/:id
});
app.delete("/book/:id", (req, res) => {
  // Handle DELETE /book/:id
});
```

__Example:__ Show the requested url for __all__ routes independent of the method for `/book`
```ts
...
trail(app, {
 // Would show the requested url for /book/:id (as "<METHOD> /book/lord-of-the-rings"), independent of the method
 showRequestedURL: [{ route: "/book/:id", method: "any" }]
});
```

__Example:__ Show the requested url __only__ for `GET /book/:id` route
```ts
...
trail(app, {
  // Would show the requested url ONLY on the "GET /book/:id" route (as "GET /book/to-kill-a-mockingbird")
  // "PATCH /book/:id" and "DELETE /book/:id" will still show "<METHOD> /book/:id"
  showRequestedURL: [{ route: "/book/:id", method: "get" }]
});
```

__Example:__ Show the requested url for PATCH __and__ DELETE `/book/:id` routes
```ts
...
trail(app, {
  // Would show the requested url for "PATCH /book/:id" (as "PATCH /book/the-great-gatsby") and
  // "DELETE /book/:id" (as "DELETE /book/anna-karenina") routes, "GET /book/:id" will still show "GET /book/:id"
  showRequestedURL: [{ route: "/book/:id", method: "post" }, { route: "/book/:id", method: "delete" }]
});
```

Default value: `false`

### ⚙️ {TrailOptions}`.showResponse`: `boolean | RouteMatcher[]`

You can include in the logs the response payload from the routes that match any of the cases provided in this array of `RouteMatcher`

```ts
import express from "express";
const app = express();
app.get("/book/:id", (req, res) => {
  // Handle GET /book/:id
});
app.get("/book", (req, res) => {
  // Handle GET /book
});
app.post("/book", (req, res) => {
  // Handle POST /book
});
app.delete("/book/:id", (req, res) => {
  // Handle DELETE /book/:id
});
```

__Example:__ Show the response payload for __all__ routes independent of the method for `/book/:id`
```ts
...
trail(app, {
  // Always show the response payload for /book/:id, independent of the requested method
  showResponse: [{ route: "/book/:id", method: "any" }]
});
```

__Example:__ Show the response payload __only__ for the `GET /book/:id` route
```ts
...
trail(app, {
  // Would show the response payload only for "GET /book/:id" route
  showResponse: [{ route: "/book/:id", method: "get" }]
});
```

__Example:__ Show the response payload for "POST /book" __and__ "DELETE /book/:id" routes
```ts
...
trail(app, {
  // Would show the response payload for "POST /book" and "DELETE /book/:id" routes, "GET /book" and "GET /book/:id" are not going to
  // show their corresponding responses on logging
  showResponse: [{ route: "/book", method: "post" }, { route: "/book/:id", method: "delete" }]
});
```

### ⚙️ {TrailOptions}`.showRSS`: `boolean`

Monitoring the RSS of your application can help you identify issues with excessive memory usage. If the RSS keeps increasing or
reaches very high values, it may indicate that your application has memory leaks or is utilizing resources inefficiently.
Identifying and fixing these issues can significantly improve the performance and stability of the application.
This property helps you track the RSS throughout your application's lifecycle and between requests.

Default value: `false`

### ⚙️ {TrailOptions}`.showColors`: `boolean`

If you're using your custom logger or if the cloud solution you're using doesn't correctly interpret the colors that you usually
see on the developer console (or if you want to see uncolored logs), you can set this property to `false`.

Also see __{TrailOptions}`.logger`__

Default value: `true`

### ⚙️ {TrailOptions}`.report`: `(trailId: string, payload: object) => void`

The future purpose of this library is to provide analytics for performance metrics by keeping track of the logs in a
database. However, in the current version, this functionality is not yet included in the library itself. If you need
to implement it before it's natively supported, you can create your own implementation using the payload returned by
the callback of this property, or simply use this property to manage any useful side effects on your end.

The flow is as follows:
- report (the values obtained on different parts of the request lifecycle)
- log (the message obtained from the previous process, treated for their use on console)

Also see __{TrailOptions}`.logger`__

### ⚙️ {TrailOptions}`.timingFormatter`: `(elapsed: number) => number`

The functionality used for obtain the timing insights is `performance.now()`, which returns a high resolution timestamp
in milliseconds (e.g `0.5999999996`), if getting all the decimals is redundant for your use-case, you can provide a parser for
this property

__Example:__ Round `performance.now()` to two decimal places
```ts
trail(app, {
  // Instead of 0.5999999996 would return 0.6
  timingFormatter: (elapsed) => +elapsed.toFixed(2)
});
```

### ⚙️ {TrailOptions}`.initialImmutableMiddlewares`: `((req: Request, res: Response, next: Next) => void)[]`

This property is an array of middlewares, the middlewares you include here are not going to be mutated or iterated by this library,
they would work as they would work normally in a simple express app, and the middlewares you include here shouldn't be added to the
express app from your side `(app.use(...))`, the work would be done by this library

For example, if you want to use a value coming from a middleware or a different service for the trailId, you would need to include
that middleware inside this array of middlewares instead of using `app.use` directly from your side as you would do it normally

__Example:__ Let's say you want jsonParser and your custom traceId middleware to run first in the stack of middlewares
```ts
import express from "express";
import { traceMiddleware } from "./middleware"; // Injects the 'X-Request-ID' value on your request headers
...
// Instead of including the middlewares as you would do it normally
// app.use(express.json()); ❌
// app.use(traceMiddleware); ❌
...
trail(app, {
  // You need to include them here, in the same order you would include it on your normal app
  initialImmutableMiddlewares: [express.json(), traceMiddleware],
  // Now, you can set trailId as the value that was included in the list of headers previously by the traceMiddleware middleware
  trailId: (req, res) => req.headers['X-Request-ID'],
});
```

Also see __{TrailOptions}`.trailId`__

### ⚙️ {TrailOptions}`.logStrategy`: `"real-time" | "delay-all" | "delay-each" | "await-each"`

There are various strategies to minimize the performance impact caused by logging calls. Each strategy employs a different
approach that influences how the requested stack is presented.

`real-time`: Prints the current step of any requested stack as it occurs, providing more accuracy but at the cost of reduced performance.

`delay-all`: The most efficient strategy (but also danger), it defers all logging calls until the server remains idle for a specified period of time (delayMs).
In other words, it waits for the logging calls until the server enters an idle state without receiving any new requests or steps during
that time, the drawback is that as soon as it starts logging all those requested stacks, __the main thread is going to be blocked__ until all
logging instructions are done executing, therefore if you have your express app __only__ running on the main thread, the requests in that meantime
are going to be blocked and dispatched until the main thread is freed from the logging operations

`delay-each`: Debounce (delay) each individual request before logging the steps occur until that moment. It waits for a specific time
period (delayMs) without receiving any new instructions for that specific request, and then prints all the accumulated steps related
to that request, even if the request is still ongoing.

`await-each`: Groups logging calls based on requests. Once a request is completed, it prints all the relevant data for that specific
requested stack, ensuring that there will be no more steps or calls for that same request in the future.

__Example:__ Using the `"delay-all"` log strategy with a delay of one second (1000 ms)
```ts
trail(app, {
  // Delays logging calls until the server remains idle for 1000 ms
  logStrategy: "delay-all",
  delayMs: 1000, // If not provided, default value is 500
});
```

__Example:__ Using the `"await-each"` log strategy to only output requests that failed with a statusCode of 401 (Unauthorized)
```ts
trail(app, {
  // Ignore output requests whose responses received a 401 status code.
  logStrategy: "await-each",
  skip: (req, res) => res.statusCode !== 401,
});
```

Default value: `"real-time"`

### ⚙️ {TrailOptions.logStrategy = "delay-each" | "delay-all"}`.delayMs`: `number`

If the logStrategy provided is "delay-each" or "delay-all", you can set the amount (in milliseconds) to delay (debounce) logging calls
Default value: `500`

### ⚙️ {TrailOptions.logStrategy = "await-each"}`.skip`: `(req: Request, res: Response) => boolean`

If the logStrategy provided is "await-each", before logging out the requested stack this function is executed (if provided), if the execution of this property returns
true, the requested stack is not going to be logged and immediatly will be disposed, otherwise it will print the requested
stack as normal

__Example:__ Don't log `404` responses
```ts
import express from "express";
import { trail } from "express-trail";
...
trail(app, {
 logStrategy: "await-each",
 // If the response statusCode is equal to 404 (NOT_FOUND), ignore the requested stack
 skip: (req, res) => res.statusCode === 404,
});
```