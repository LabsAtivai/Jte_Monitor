// backend/src/contatos/contatos-snov.controller.ts
import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "../common/guards/index";
import { DbService } from "../common/db.service";
import { SnovLiveService } from "./snov-live.service";
import { User } from "../users/users.service";

const POR_PAGINA = 50;
const DOMINIO_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

@Controller("api/contatos-snov")
@UseGuards(JwtAuthGuard)
export class ContatosSnovController {
  constructor(private db: DbService, private snovLive: SnovLiveService) {}

  @Get()
  async listar(
    @CurrentUser() user: User,
    @Query("reclamada")  reclamada  = "",
    @Query("dominio")    dominio    = "",
    @Query("cargo")      cargo      = "",
    @Query("tipo")       tipo       = "",
    @Query("vara")       vara       = "",
    @Query("pagina", new DefaultValuePipe(1), ParseIntPipe) pagina = 1,
  ) {
    const offset = (pagina - 1) * POR_PAGINA;

    // Domínio exato e ainda sem contatos em cache: busca ao vivo na Snov.io
    // antes de listar, para o resultado já aparecer nesta mesma consulta.
    const dominioExato = dominio.trim().toLowerCase();
    if (DOMINIO_REGEX.test(dominioExato)) {
      const [[{ cnt }]] = await this.db.query<any>(
        "SELECT COUNT(*) AS cnt FROM contatos_snov WHERE dominio = ?", [dominioExato],
      );
      if (cnt === 0) {
        await this.snovLive
          .enriquecerEsalvar(dominioExato, reclamada || null, null, vara || null)
          .catch(() => {});
      }
    }

    const cond: string[] = [];
    const p: any[]       = [];

    if (reclamada) { cond.push("reclamada LIKE ?");  p.push(`%${reclamada}%`); }
    if (dominio)   { cond.push("dominio LIKE ?");    p.push(`%${dominio}%`); }
    if (cargo)     { cond.push("cargo LIKE ?");      p.push(`%${cargo}%`); }
    if (tipo)      { cond.push("tipo = ?");          p.push(tipo); }
    if (vara)      { cond.push("vara = ?");          p.push(vara); }

    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

    const [[{ total }]] = await this.db.query<any>(
      `SELECT COUNT(*) AS total FROM contatos_snov ${where}`, p
    );

    const [rows] = await this.db.query<any[]>(
      `SELECT id, dominio, reclamada, vara, tipo, firstName, lastName,
              nomeCompleto, cargo, email, linkedinUrl,
              companyName, companyCity, companyIndustry, companySize, numeroProcesso
       FROM contatos_snov ${where}
       ORDER BY dominio, tipo, cargo
       LIMIT ? OFFSET ?`,
      [...p, POR_PAGINA, offset]
    );

    const [varas] = await this.db.query<any[]>(
      "SELECT DISTINCT vara FROM contatos_snov WHERE vara IS NOT NULL ORDER BY vara"
    );

    const [cargos] = await this.db.query<any[]>(
      "SELECT DISTINCT cargo FROM contatos_snov WHERE cargo IS NOT NULL ORDER BY cargo LIMIT 100"
    );

    return {
      rows:         Array.isArray(rows) ? rows : [],
      total,
      pagina,
      totalPaginas: Math.ceil(total / POR_PAGINA),
      varas:        Array.isArray(varas) ? varas.map((v: any) => v.vara) : [],
      cargos:       Array.isArray(cargos) ? cargos.map((c: any) => c.cargo) : [],
      isPremium:    user.tier === "premium" || user.tier === "admin",
    };
  }

  @Get("stats")
  async stats() {
    const [[row]] = await this.db.query<any>(`
      SELECT
        COUNT(*)                        AS total,
        COUNT(DISTINCT dominio)         AS totalDominios,
        COUNT(DISTINCT reclamada)       AS totalEmpresas,
        SUM(tipo = 'prospect')          AS totalProspects,
        SUM(tipo = 'domain_email')      AS totalDomainEmails,
        SUM(tipo = 'generic')           AS totalGenericos,
        SUM(email IS NOT NULL)          AS totalComEmail
      FROM contatos_snov
    `);
    return row;
  }
}