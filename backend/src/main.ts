// backend/src/app.module.ts
import "reflect-metadata";
import { Module }          from "@nestjs/common";
import { ConfigModule }    from "@nestjs/config";
import { JwtModule }       from "@nestjs/jwt";
import { PassportModule }  from "@nestjs/passport";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD }       from "@nestjs/core";

import { DbService }           from "./common/db.service";
import { UsersService }        from "./users/users.service";
import { AuthService, JwtStrategy } from "./auth/auth.service";
import { AuthController }      from "./auth/auth.controller";
import { ProcessosController } from "./processos/processos.controller";
import { AlertasController, AlertasService } from "./alertas/alertas.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (cfg: any) => ({
        secret:      cfg.get("JWT_SECRET", "TROQUE"),
        signOptions: { expiresIn: cfg.get("JWT_ACCESS_EXPIRES", "15m") },
      }),
      inject:  [ConfigModule],
      imports: [ConfigModule],
    }),
  ],
  controllers: [AuthController, ProcessosController, AlertasController],
  providers: [
    DbService, UsersService, AuthService, JwtStrategy, AlertasService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

// ── main.ts ────────────────────────────────────────────────
import { NestFactory }      from "@nestjs/core";
import { ValidationPipe }   from "@nestjs/common";
import * as cookieParser    from "cookie-parser";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin:      process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  });
  await app.listen(process.env.PORT || 4000);
  console.log(`🚀 API em http://localhost:${process.env.PORT || 4000}`);
}
bootstrap();
