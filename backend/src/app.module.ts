import "reflect-metadata";
import { Module }         from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule }      from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD }      from "@nestjs/core";
import { DbService }                from "./common/db.service";
import { UsersService }             from "./users/users.service";
import { AuthService, JwtStrategy } from "./auth/auth.service";
import { AuthController }           from "./auth/auth.controller";
import { ProcessosController }      from "./processos/processos.controller";
import { AlertasController, AlertasService } from "./alertas/alertas.controller";
import { ContatosController }       from "./contatos/contatos.controller";
import { ContatosSnovController }   from "./contatos/contatos-snov.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PassportModule,
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret:      cfg.get<string>("JWT_SECRET", "TROQUE"),
        signOptions: { expiresIn: cfg.get<string>("JWT_ACCESS_EXPIRES", "15m") },
      }),
    }),
  ],
  controllers: [
    AuthController,
    ProcessosController,
    AlertasController,
    ContatosController,
    ContatosSnovController,
  ],
  providers: [
    DbService, UsersService, AuthService, JwtStrategy, AlertasService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}