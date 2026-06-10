// backend/src/admin/analytics.controller.ts
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { DbService }            from "../common/db.service";
import { JwtAuthGuard, TierGuard, Tiers } from "../common/guards";

@Controller("api/admin/analytics")
@UseGuards(JwtAuthGuard, TierGuard)
@Tiers("admin")
export class AnalyticsController {
  constructor(private db: DbService) {}

  @Get("stats")
  async stats(@Query("dias") dias = "7") {
    const n = Math.min(Number(dias) || 7, 90);

    const [totais] = await this.db.query<any[]>(`
      SELECT
        COUNT(*)                                                      AS totalSessoes,
        COUNT(DISTINCT userId)                                        AS totalUsuarios,
        SUM(CASE WHEN DATE(criadoEm) = CURDATE() THEN 1 ELSE 0 END)  AS sessoesHoje,
        SUM(CASE WHEN dispositivo = 'mobile'  THEN 1 ELSE 0 END)     AS mobile,
        SUM(CASE WHEN dispositivo = 'desktop' THEN 1 ELSE 0 END)     AS desktop
      FROM sessoes_acesso
      WHERE criadoEm >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [n]).catch(() => [[{}]]);

    const [novos] = await this.db.query<any[]>(`
      SELECT COUNT(*) AS novosCadastros
      FROM users
      WHERE criadoEm >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [n]).catch(() => [[{ novosCadastros: 0 }]]);

    const [ativos] = await this.db.query<any[]>(`
      SELECT COUNT(DISTINCT userId) AS usuariosAtivos
      FROM sessoes_acesso
      WHERE criadoEm >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `).catch(() => [[{ usuariosAtivos: 0 }]]);

    const t = (totais as any[])[0] || {};
    const nv = (novos as any[])[0] || {};
    const at = (ativos as any[])[0] || {};

    return {
      totalSessoes:   Number(t.totalSessoes   || 0),
      totalUsuarios:  Number(t.totalUsuarios  || 0),
      sessoesHoje:    Number(t.sessoesHoje    || 0),
      mobile:         Number(t.mobile         || 0),
      desktop:        Number(t.desktop        || 0),
      novosCadastros: Number(nv.novosCadastros || 0),
      usuariosAtivos: Number(at.usuariosAtivos || 0),
    };
  }

  @Get("acessos")
  async acessos(@Query("dias") dias = "7") {
    const n = Math.min(Number(dias) || 7, 90);
    const [rows] = await this.db.query<any[]>(`
      SELECT
        DATE_FORMAT(criadoEm, '%d/%m') AS data,
        COUNT(*)                        AS sessoes,
        COUNT(DISTINCT userId)          AS usuarios
      FROM sessoes_acesso
      WHERE criadoEm >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(criadoEm)
      ORDER BY DATE(criadoEm) ASC
    `, [n]).catch(() => [[]]);
    return rows;
  }

  @Get("usuarios")
  async usuarios() {
    const [rows] = await this.db.query<any[]>(`
      SELECT
        u.id, u.nome, u.email, u.tier,
        u.criadoEm,
        MAX(s.criadoEm) AS ultimoAcesso,
        u.ativo
      FROM users u
      LEFT JOIN sessoes_acesso s ON s.userId = u.id
      GROUP BY u.id
      ORDER BY u.criadoEm DESC
      LIMIT 100
    `).catch(() => [[]]);
    return rows;
  }
}