import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Auth is intentionally disabled for now. All requests are attributed to a fixed
 * demo user so the rest of the stack can be developed and demoed without setting
 * up Clerk.
 */
const DEMO_USER_ID = process.env.DEMO_USER_ID ?? "user_demo_seed";

console.warn(
  `[api] auth disabled — all requests treated as userId=${DEMO_USER_ID}`,
);

export const clerkAuth: RequestHandler = (_req, _res, next) => next();

export const requireClerkAuth: RequestHandler = (req, _res, next) => {
  (req as Request & { __demoUserId?: string }).__demoUserId = DEMO_USER_ID;
  next();
};

export function getUserId(_req: Request): string {
  return DEMO_USER_ID;
}

export function softAuth(req: Request, _res: Response, next: NextFunction) {
  (req as Request & { userId?: string }).userId = DEMO_USER_ID;
  next();
}
