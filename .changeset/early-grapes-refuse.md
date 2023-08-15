---
"express-insider": minor
---

__`trailAdditaments`__ and __middleware response__ support

### ⚙️ {TrailOptions}`.trailAdditaments`: `object`
New configuration to output information about the Request and/or Response

Do you need to print specific details from the request or response object that's being handled? Or perhaps you want to output
information from another service, and you might require the request or response object for that purpose. It's also possible
that you only want to display this information under certain conditions. For example, you might want to skip printing if a
particular header is present.

In such cases, you can use this callback function. It gets invoked at the very beginning of the request stack. If the callback
returns a falsy value, nothing will be printed. However, if it returns an object or an array, that returned
value will be included as part of the output in the requested stack.

```ts
trail(app, {
  traceAdditaments: {
    condition: (req: AuthRequest, res) => {
      if (!req.user) return null;
      return req.rawHeaders;
    },
  },
  initialImmutableMiddlewares: [authRouteGuard]
});
````

<img width="743" alt="image" src="https://github.com/walterdiazesa/express-insider/assets/58494087/a7456cbf-7cf7-4dce-a0c6-0333f1f89e88">

### 🧪 Support for response from Middlewares
In previous versions you were required to send a response from a route handler, that could had been a middleware or a route handler, but now you can return a response directly from any middleware, either asynchronous or synchronous

<img width="887" alt="image" src="https://github.com/walterdiazesa/express-insider/assets/58494087/f36bbb7c-9322-4f6a-911a-b3f0c2457361">

### Other changes:
```
+ Minor documentation changes
```