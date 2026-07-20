import { type Request, type Response, type NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // userId(회원) 또는 adminId(어드민 전용 세션) 중 하나면 통과
  if (!req.session?.userId && !req.session?.adminId) {
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
