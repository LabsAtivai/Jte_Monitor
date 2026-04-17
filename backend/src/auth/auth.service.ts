// backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService }   from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt  from "bcrypt";
import * as crypto  from "crypto";
import { UsersService, User } from "../users/users.service";
import { DbService } from "../common/db.service";

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService, private jwt: JwtService,
    private cfg: ConfigService,  private db:  DbService,
  ) {}

  async registrar(nome: string, email: string, senha: string) {
    if (senha.length < 8) throw new BadRequestException("Senha deve ter ao menos 8 caracteres");
    const user = await this.users.criar(nome, email, senha);
    return this._tokens(user);
  }

  async login(email: string, senha: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException("Credenciais inválidas");
    if (!await bcrypt.compare(senha, user.senhaHash)) throw new UnauthorizedException("Credenciais inválidas");
    const { senhaHash: _, ...safe } = user;
    return this._tokens(safe as User);
  }

  async refresh(rt: string) {
    const [[row]] = await this.db.query<any[]>(
      "SELECT * FROM refresh_tokens WHERE token=? AND revogado=0 AND expiresAt>NOW() LIMIT 1", [rt]
    );
    if (!row) throw new UnauthorizedException("Refresh token inválido");
    await this.db.query("UPDATE refresh_tokens SET revogado=1 WHERE id=?", [row.id]);
    const user = await this.users.findById(row.userId);
    if (!user?.ativo) throw new UnauthorizedException();
    return this._tokens(user);
  }

  async logout(rt: string) {
    await this.db.query("UPDATE refresh_tokens SET revogado=1 WHERE token=?", [rt]);
  }

  private async _tokens(user: User) {
    const access = this.jwt.sign(
      { sub: user.id, email: user.email, tier: user.tier },
      { expiresIn: this.cfg.get("JWT_ACCESS_EXPIRES", "15m") }
    );
    const refresh  = crypto.randomBytes(64).toString("hex");
    const dias     = Number(this.cfg.get("JWT_REFRESH_DAYS", "7"));
    const expiresAt= new Date(Date.now() + dias * 86400000);
    await this.db.query(
      "INSERT INTO refresh_tokens (userId,token,expiresAt) VALUES (?,?,?)",
      [user.id, refresh, expiresAt]
    );
    // Mantém só os 5 refresh tokens mais recentes
    await this.db.query(`
      DELETE FROM refresh_tokens WHERE userId=? AND id NOT IN (
        SELECT id FROM (SELECT id FROM refresh_tokens WHERE userId=? ORDER BY createdAt DESC LIMIT 5) s
      )`, [user.id, user.id]
    );
    return { accessToken: access, refreshToken: refresh, user };
  }
}

// ── JWT Strategy ───────────────────────────────────────────
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService, private usersService: UsersService) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      cfg.get("JWT_SECRET", "TROQUE"),
    });
  }
  async validate(payload: { sub: number }) {
    const user = await this.usersService.findById(payload.sub);
    if (!user?.ativo) throw new UnauthorizedException();
    return user;
  }
}
