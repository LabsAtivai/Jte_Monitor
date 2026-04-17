// backend/src/common/db.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import mysql, { Pool } from "mysql2/promise";

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;
  private readonly log = new Logger(DbService.name);

  constructor(private cfg: ConfigService) {}

  async onModuleInit() {
    this.pool = mysql.createPool({
      host:               this.cfg.get("DB_HOST", "127.0.0.1"),
      port:               Number(this.cfg.get("DB_PORT", "3306")),
      user:               this.cfg.get("DB_USER", "jte"),
      password:           this.cfg.get("DB_PASS", ""),
      database:           this.cfg.get("DB_NAME", "jte"),
      waitForConnections: true,
      connectionLimit:    20,
      timezone:           "-03:00",
    });
    await this.pool.query("SELECT 1");
    this.log.log("MySQL conectado");
  }

  async onModuleDestroy() {
    await this.pool?.end().catch(() => {});
  }

  query<T = any>(sql: string, params?: any[]): Promise<[T, any]> {
    return this.pool.query(sql, params) as any;
  }
}
