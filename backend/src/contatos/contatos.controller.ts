import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "../common/guards/index";
import { DbService } from "../common/db.service";
import { User } from "../users/users.service";

const POR_PAGINA = 50;

@Controller("api/contatos")
@UseGuards(JwtAuthGuard)
export class ContatosController {
  constructor(private db: DbService) {}

  @Get()
  async listar(
    @CurrentUser() user: User,
    @Query("reclamada")      reclamada      = "",
    @Query("email")          email          = "",
    @Query("numeroProcesso") numeroProcesso = "",
    @Query("qualidade")      qualidade      = "",
    @Query("vara")           vara           = "",
    @Query("pagina", new DefaultValuePipe(1), ParseIntPipe) pagina = 1,
  ) {
    const isPremium = user.tier === "premium" || user.tier === "admin";
    const offset    = (pagina - 1) * POR_PAGINA;

    const cond: string[] = ["email IS NOT NULL", "email != ''"];
    const p: any[]       = [];

    if (reclamada)      { cond.push("reclamada LIKE ?");      p.push(`%${reclamada}%`); }
    if (email)          { cond.push("email LIKE ?");           p.push(`%${email}%`); }
    if (numeroProcesso) { cond.push("numeroProcesso LIKE ?");  p.push(`%${numeroProcesso}%`); }
    if (vara)           { cond.push("vara = ?");               p.push(vara); }
    if (qualidade)      { cond.push("qualidadeEmail = ?");     p.push(qualidade); }

    const where = `WHERE ${cond.join(" AND ")}`;

    const [[{ total }]] = await this.db.query<any>(
      `SELECT COUNT(*) AS total FROM contatos_reclamadas ${where}`, p
    );

    const [rows] = await this.db.query<any[]>(
      `SELECT id, email, qualidadeEmail, reclamada, razaoSocial, nomeFantasia,
              numeroProcesso, cnpj, vara, dataBR, telefone
       FROM contatos_reclamadas ${where}
       ORDER BY
         CASE qualidadeEmail WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
         dataISO DESC
       LIMIT ? OFFSET ?`,
      [...p, POR_PAGINA, offset]
    );

    const [varas] = await this.db.query<any[]>(
      "SELECT DISTINCT vara FROM contatos_reclamadas WHERE vara IS NOT NULL ORDER BY vara"
    );

    return {
      rows,
      total,
      pagina,
      totalPaginas: Math.ceil(total / POR_PAGINA),
      varas: varas.map((v: any) => v.vara),
      isPremium,
    };
  }

  @Get("stats")
  async stats() {
    const [[row]] = await this.db.query<any>(`
      SELECT
        COUNT(*)                     AS total,
        SUM(qualidadeEmail = 'alta') AS totalAlta,
        SUM(qualidadeEmail = 'media')AS totalMedia,
        SUM(qualidadeEmail = 'baixa')AS totalBaixa,
        COUNT(DISTINCT reclamada)    AS totalEmpresas
      FROM contatos_reclamadas
      WHERE email IS NOT NULL AND email != ''
    `);
    return row;
  }
}
