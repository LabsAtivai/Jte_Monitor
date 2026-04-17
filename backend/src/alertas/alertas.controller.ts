// backend/src/alertas/alertas.service.ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DbService } from "../common/db.service";
import * as nodemailer from "nodemailer";

@Injectable()
export class AlertasService {
  private mailer: any;

  constructor(private db: DbService, private cfg: ConfigService) {
    this.mailer = nodemailer.createTransport({
      host:   cfg.get("SMTP_HOST"),
      port:   Number(cfg.get("SMTP_PORT", "587")),
      secure: cfg.get("SMTP_SECURE") === "true",
      auth:   { user: cfg.get("SMTP_USER"), pass: cfg.get("SMTP_PASS") },
    });
  }

  listar(userId: number) {
    return this.db.query<any[]>(
      "SELECT * FROM alertas WHERE userId=? ORDER BY createdAt DESC", [userId]
    ).then(([r]) => r);
  }

  async criar(userId: number, dto: { nome: string; vara?: string; reclamada?: string }) {
    const [r] = await this.db.query<any>(
      "INSERT INTO alertas (userId,nome,vara,reclamada) VALUES (?,?,?,?)",
      [userId, dto.nome, dto.vara||null, dto.reclamada||null]
    );
    return { id: r.insertId, ...dto, userId, ativo: true };
  }

  async remover(userId: number, id: number) {
    await this.db.query("DELETE FROM alertas WHERE id=? AND userId=?", [id, userId]);
    return { ok: true };
  }

  async toggle(userId: number, id: number) {
    await this.db.query("UPDATE alertas SET ativo=NOT ativo WHERE id=? AND userId=?", [id, userId]);
    return { ok: true };
  }

  // Chamado pelo worker após cada execução
  async dispararNotificacoes() {
    const [processos] = await this.db.query<any[]>(`
      SELECT * FROM processos_sem_polo_passivo
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
      ORDER BY dataISO ASC`
    );
    if (!processos.length) return 0;

    const [alertas] = await this.db.query<any[]>(`
      SELECT a.*, u.email, u.nome AS nomeUser
      FROM alertas a JOIN users u ON u.id=a.userId
      WHERE a.ativo=1 AND u.tier IN ('premium','admin') AND u.ativo=1`
    );

    let enviados = 0;
    for (const alerta of alertas) {
      const batem = processos.filter(p =>
        (!alerta.vara      || p.vara === alerta.vara) &&
        (!alerta.reclamada || p.reclamada?.toLowerCase().includes(alerta.reclamada.toLowerCase()))
      );
      if (!batem.length) continue;

      const [jaIds] = await this.db.query<any[]>(
        "SELECT processoId FROM notificacoes WHERE userId=? AND processoId IN (?)",
        [alerta.userId, batem.map((p: any) => p.id)]
      );
      const jaSet  = new Set(jaIds.map((r: any) => r.processoId));
      const novos  = batem.filter((p: any) => !jaSet.has(p.id));
      if (!novos.length) continue;

      for (const p of novos) {
        await this.db.query(
          "INSERT IGNORE INTO notificacoes (userId,alertaId,processoId,enviadoEm) VALUES (?,?,?,NOW())",
          [alerta.userId, alerta.id, p.id]
        ).catch(() => {});
      }

      const linhas = novos.map((p: any) =>
        `• ${p.numeroProcesso}\n  Vara: ${p.vara}\n  Audiência: ${p.dataBR}\n  Reclamante: ${p.reclamante||"-"}\n  Reclamada: ${p.reclamada||"-"}`
      ).join("\n\n");

      await this.mailer.sendMail({
        from:    this.cfg.get("MAIL_FROM", this.cfg.get("SMTP_USER")),
        to:      alerta.email,
        subject: `[JTe] ${novos.length} processo(s) — "${alerta.nome}" — ${new Date().toLocaleDateString("pt-BR")}`,
        text:    `Olá, ${alerta.nomeUser}!\n\nAlerta "${alerta.nome}":\n\n${linhas}\n\n— JTe Monitor`,
      }).then(() => enviados++).catch((e: any) =>
        console.warn(`⚠️  E-mail ${alerta.email}: ${e.message}`)
      );
    }
    return enviados;
  }
}

// ── Controller ─────────────────────────────────────────────
import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards, ParseIntPipe } from "@nestjs/common";
import { JwtAuthGuard, TierGuard, Tiers, CurrentUser } from "../common/guards/index";
import { User } from "../users/users.service";

@Controller("api/alertas")
@UseGuards(JwtAuthGuard, TierGuard)
@Tiers("premium", "admin")
export class AlertasController {
  constructor(private svc: AlertasService) {}

  @Get()    listar(@CurrentUser() u: User)                         { return this.svc.listar(u.id); }
  @Post()   criar(@CurrentUser() u: User, @Body() b: any)          { return this.svc.criar(u.id, b); }
  @Delete(":id") remover(@CurrentUser() u: User, @Param("id", ParseIntPipe) id: number) { return this.svc.remover(u.id, id); }
  @Patch(":id/toggle") toggle(@CurrentUser() u: User, @Param("id", ParseIntPipe) id: number) { return this.svc.toggle(u.id, id); }
}
