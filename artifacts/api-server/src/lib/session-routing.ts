import session from "express-session";
import type { RequestHandler } from "express";

export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function createSessionRouter(memberStore: session.Store, adminStore: session.Store,
  secret: string, secure: boolean): RequestHandler {
  const options = { secret, resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, sameSite: "lax" as const, secure, maxAge: SESSION_MAX_AGE } };
  const member = session({ ...options, name: "connect.sid", store: memberStore });
  const admin = session({ ...options, name: "admin.sid", store: adminStore });
  return (req, res, next) => {
    const path = req.path;
    if (path === "/banana777" || path.startsWith("/banana777/") ||
      path === "/api/admin" || path.startsWith("/api/admin/")) {
      admin(req, res, next);
      return;
    }
    member(req, res, error => {
      if (error) { next(error); return; }
      // Older releases wrote administrator fields into member sessions.
      // Remove those fields only; the independent admin store is untouched.
      delete req.session.adminId;
      delete req.session.adminRole;
      if (!req.session.userId) delete req.session.userRole;
      next();
    });
  };
}
