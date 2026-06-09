// Patches Express 4 Router so async route handlers propagate errors to next(err).
// Without this, a thrown Promise rejection in an async handler is swallowed.
// Import once in server.mjs before routes are registered — no other changes needed.
import { Router } from "express";

const METHODS = ["get", "post", "put", "patch", "delete", "all", "use"];
for (const method of METHODS) {
  const orig = Router.prototype[method];
  if (typeof orig !== "function") continue;
  Router.prototype[method] = function (...args) {
    const wrapped = args.map((fn) => {
      if (typeof fn !== "function" || fn.length === 4) return fn; // skip error handlers
      return function asyncWrapper(req, res, next) {
        return Promise.resolve(fn(req, res, next)).catch(next);
      };
    });
    return orig.apply(this, wrapped);
  };
}
