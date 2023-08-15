# express-insider

## 1.1.0

### Minor Changes

- 5ccc288: **`trailAdditaments`** and **middleware response** support

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
    initialImmutableMiddlewares: [authRouteGuard],
  });
  ```

  <img width="743" alt="image" src="https://github.com/walterdiazesa/express-insider/assets/58494087/a7456cbf-7cf7-4dce-a0c6-0333f1f89e88">

  ### 🧪 Support for response from Middlewares

  In previous versions you were required to send a response from a route handler, that could had been a middleware or a route handler, but now you can return a response directly from any middleware, either asynchronous or synchronous

  <img width="887" alt="image" src="https://github.com/walterdiazesa/express-insider/assets/58494087/f36bbb7c-9322-4f6a-911a-b3f0c2457361">

  ### Other changes:

  ```
  + Minor documentation changes
  ```

## 1.0.2

### Patch Changes

- f8f1093: Fix ignoreMiddlewares types README documentation

## 1.0.1

### Patch Changes

- 02d228c: Documentation updates.

## 1.0.0

### Major Changes

- aae3f5a: First publish of express-insider

  # What is express-insider?

  Consider having an advanced partner for your Express app, similar to [Morgan](https://www.npmjs.com/package/morgan) but with a greater focus and depth. Our request logger enhances your app! Think of it as a thorough investigator that not only records requests but also provides insights into the performance of middlewares, routes, and even the finer details of your app. By meticulously monitoring and analyzing requests, responses, and execution, you'll possess a powerful tool to optimize your app for superior speed and efficiency.

  # Roadmap

  \*Dependent of community acceptance

  - [ ] Save logs in a database natively
  - [ ] Provide a route to check insights on how your app is performing, like a lightweight NewRelic
  - [ ] Compatibility with Express versions earlier than 4.x.x.
  - [ ] Compatibility with Node.js versions earlier than 14.x.x.
