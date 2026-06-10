// backend/src/auth/auth.controller.ts
import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService }  from "./auth.service";
import { JwtAuthGuard, CurrentUser } from "../common/guards/index";
import { DbService } from "../common/db.service";

const COOKIE = "jte_refresh";
const COPTS  = (prod: boolean) => ({
  httpOnly: true, secure: prod, sameSite: "lax" as const,
  maxAge: 7 * 86400000, path: "/api/auth",
});

function detectarDispositivo(ua: string): "mobile" | "desktop" | "unknown" {
  if (!ua) return "unknown";
  return /mobile|android|iphone|ipad|tablet/i.test(ua) ? "mobile" : "desktop";
}

async function registrarSessao(db: DbService, userId: number, req: Request) {
  try {
    const ua   = String(req.headers["user-agent"] || "").slice(0, 512);
    const ip   = String((req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || "").slice(0, 64);
    const disp = detectarDispositivo(ua);
    await db.query(
      `INSERT INTO sessoes_acesso (userId, dispositivo, userAgent, ip, rota) VALUES (?,?,?,?,?)`,
      [userId, disp, ua, ip, "/dashboard"]
    ).catch(() => {});
  } catch {}
}

@Controller("api/auth")
export class AuthController {
  constructor(private auth: AuthService, private db: DbService) {}

  @Post("register")
  async register(@Body() b: any, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const t = await this.auth.registrar(b.nome, b.email, b.senha);
    res.cookie(COOKIE, t.refreshToken, COPTS(process.env.NODE_ENV === "production"));
    await registrarSessao(this.db, t.user.id, req);
    return { accessToken: t.accessToken, user: t.user };
  }

  @Post("login") @HttpCode(200)
  async login(@Body() b: any, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const t = await this.auth.login(b.email, b.senha);
    res.cookie(COOKIE, t.refreshToken, COPTS(process.env.NODE_ENV === "production"));
    await registrarSessao(this.db, t.user.id, req);
    return { accessToken: t.accessToken, user: t.user };
  }

  @Post("refresh") @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.[COOKIE];
    if (!rt) return res.status(401).json({ message: "Sem refresh token" });
    const t = await this.auth.refresh(rt);
    res.cookie(COOKIE, t.refreshToken, COPTS(process.env.NODE_ENV === "production"));
    return { accessToken: t.accessToken, user: t.user };
  }

  @Post("logout") @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.[COOKIE];
    if (rt) await this.auth.logout(rt);
    res.clearCookie(COOKIE, { path: "/api/auth" });
    return { ok: true };
  }

  @Get("me") @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) { return user; }
}