// backend/src/common/guards/index.ts

import { Injectable, CanActivate, ExecutionContext,
         ForbiddenException, SetMetadata } from "@nestjs/common";
import { AuthGuard }  from "@nestjs/passport";
import { Reflector }  from "@nestjs/core";

// ── JWT guard ──────────────────────────────────────────────
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}

// ── Tier guard ─────────────────────────────────────────────
export const TIERS_KEY = "tiers";
export const Tiers = (...t: string[]) => SetMetadata(TIERS_KEY, t);

@Injectable()
export class TierGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(TIERS_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required?.length) return true;
    const { user } = ctx.switchToHttp().getRequest();
    if (!required.includes(user?.tier)) {
      throw new ForbiddenException(
        "Disponível apenas no plano Premium. Acesse /upgrade para assinar."
      );
    }
    return true;
  }
}

// ── CurrentUser decorator ──────────────────────────────────
import { createParamDecorator } from "@nestjs/common";
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user
);
