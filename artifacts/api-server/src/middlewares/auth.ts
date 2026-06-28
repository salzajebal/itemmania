import { type Request, type Response, type NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const hasAdminSession = !!req.session?.adminId && req.session.adminRole === "admin";
  const hasUserAdminSession = !!req.session?.userId && req.session.userRole === "admin";
  if (!hasAdminSession && !hasUserAdminSession) {
    res.status(401).json({ error: "관리자 로그인이 필요합니다." });
    return;
  }
  next();
}
