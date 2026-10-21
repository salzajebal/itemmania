import { Router, type RequestHandler } from "express";
import { SUPPORT_WIDGET_SCRIPT } from "../support-widget-content";
import { SUPPORT_ADMIN_SCRIPT } from "../support-admin-content";

export const supportUiRouter = Router();
supportUiRouter.get("/api/support/widget.js", (_req, res) => {
  res.set("Cache-Control", "no-cache").type("application/javascript").send(SUPPORT_WIDGET_SCRIPT);
});
supportUiRouter.get("/api/support/admin-ui.js", (_req, res) => {
  res.set("Cache-Control", "no-cache").type("application/javascript").send(SUPPORT_ADMIN_SCRIPT);
});
// Covers snapshots, mobile HTML and the customer center without editing captured
// files. Shadow DOM isolates the controls from upstream CSS/event selectors.
export const injectSupportUi: RequestHandler = (req, res, next) => {
  if (req.query?.embedded === "1" || req.path === "/dev-trade-preview/chat" || req.path.startsWith("/dev-trade-preview/api/")) {
    next(); return;
  }
  const send = res.send.bind(res);
  res.send = (body: any) => {
    const type = res.get("Content-Type");
    const html = type ? type.includes("text/html") : typeof body === "string" && /<(?:!doctype\s+html|html[\s>]|body[\s>])/i.test(body);
    if (typeof body === "string" && html &&
        !body.includes('data-support-injected') && !req.path.startsWith("/api/")) {
      const admin = req.path === "/banana777" || req.path.startsWith("/banana777/");
      const source = admin ? "/api/support/admin-ui.js" : "/api/support/widget.js";
      // Keep captured restrictions, but permit our same-origin script and SSE.
      body = body.replace(/<meta\b[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/gi, (tag: string) =>
        tag.replace(/\bcontent=(["'])(.*?)\1/i, (_attr: string, quote: string, policy: string) => {
          const parts = policy.split(";").map(p => p.trim()).filter(Boolean);
          for (const directive of ["script-src", "connect-src"]) {
            const i = parts.findIndex(p => p.toLowerCase().startsWith(directive + " "));
            if (i < 0) parts.push(directive + " 'self'");
            else if (!parts[i].includes("'self'")) parts[i] = parts[i].replace(/'none'/g, "").trim() + " 'self'";
          }
          const elem = parts.findIndex(p => p.toLowerCase().startsWith("script-src-elem "));
          if (elem >= 0 && !parts[elem].includes("'self'")) parts[elem] = parts[elem].replace(/'none'/g, "").trim() + " 'self'";
          return "content=" + quote + parts.join("; ") + quote;
        }));
      const closing = body.toLowerCase().lastIndexOf("</body>");
      const script = `<script defer data-support-injected src="${source}"></script>`;
      body = closing < 0 ? body + script : body.slice(0, closing) + script + body.slice(closing);
    }
    return send(body);
  };
  next();
};
