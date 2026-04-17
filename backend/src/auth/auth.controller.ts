// backend/src/auth/auth.controller.ts
import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService }  from "./auth.service";
import { JwtAuthGuard, CurrentUser } from "../common/guards/index";

const COOKIE = "jte_refresh";
const COPTS  = (prod: boolean) => ({
  httpOnly: true, secure: prod, sameSite: "lax" as const,
  maxAge: 7 * 86400000, path: "/api/auth",
});

@Controller("api/auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("register")
  async register(@Body() b: any, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.registrar(b.nome, b.email, b.senha);
    res.cookie(COOKIE, t.refreshToken, COPTS(process.env.NODE_ENV === "production"));
    return { accessToken: t.accessToken, user: t.user };
  }

  @Post("login") @HttpCode(200)
  async login(@Body() b: any, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.login(b.email, b.senha);
    res.cookie(COOKIE, t.refreshToken, COPTS(process.env.NODE_ENV === "production"));
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
