// backend/src/processos/processos.controller.ts
import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "../common/guards/index";
import { DbService } from "../common/db.service";
import { User } from "../users/users.service";

// Free: sem restrição por enquanto (todos veem tudo).
// Para ativar limite: mude FREE_LIMIT para o número desejado e
// descomente as linhas marcadas com [FREE_LIMIT].
const FREE_LIMIT  = 999999; // sem limite no free por enquanto
const POR_PAGINA  = 50;

@Controller("api/processos")
@UseGuards(JwtAuthGuard)
export class ProcessosController {
  constructor(private db: DbService) {}

  @Get()
  async listar(
    @CurrentUser() user: User,
    @Query("vara")       vara       = "",
    @Query("dataInicio") dataInicio = "",
    @Query("dataFim")    dataFim    = "",
    @Query("numero")     numero     = "",
    @Query("reclamada")  reclamada  = "",
    @Query("pagina", new DefaultValuePipe(1), ParseIntPipe) pagina = 1,
  ) {
    const isPremium = user.tier === "premium" || user.tier === "admin";
    const limite    = isPremium ? POR_PAGINA : Math.min(FREE_LIMIT, POR_PAGINA);
    const offset    = (pagina - 1) * limite;

    const cond: string[] = [];
    const p:    any[]    = [];

    if (vara)       { cond.push("vara = ?");              p.push(vara); }
    if (dataInicio) { cond.push("dataISO >= ?");          p.push(dataInicio); }
    if (dataFim)    { cond.push("dataISO <= ?");          p.push(dataFim); }
    if (numero)     { cond.push("numeroProcesso LIKE ?"); p.push(`%${numero}%`); }
    if (reclamada)  { cond.push("reclamada LIKE ?");      p.push(`%${reclamada}%`); }

    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

    const [[{ total: totalReal }]] = await this.db.query<any>(
      `SELECT COUNT(*) AS total FROM processos_sem_polo_passivo ${where}`, p
    );

    const [rows] = await this.db.query<any[]>(
      `SELECT id,vara,dataBR,dataISO,numeroProcesso,sessao,juiz,reclamante,reclamada,createdAt
       FROM processos_sem_polo_passivo ${where}
       ORDER BY dataISO ASC, vara ASC LIMIT ? OFFSET ?`,
      [...p, limite, offset]
    );

    const [varas] = await this.db.query<any[]>(
      "SELECT DISTINCT vara FROM processos_sem_polo_passivo ORDER BY vara"
    );

    // Recursos exclusivos premium
    const extras = isPremium ? {
      exportacaoHabilitada: true,
      alertasHabilitados:   true,
    } : {
      exportacaoHabilitada: false,
      alertasHabilitados:   false,
    };

    return {
      rows,
      total:        totalReal,
      pagina,
      totalPaginas: Math.ceil(totalReal / limite),
      varas:        varas.map((v: any) => v.vara),
      tier:         user.tier,
      isPremium,
      ...extras,
    };
  }

  @Get("stats")
  async stats() {
    const [[row]] = await this.db.query<any>(`
      SELECT
        COUNT(*)              AS total,
        COUNT(DISTINCT vara)  AS totalVaras,
        MIN(dataISO)          AS dataMin,
        MAX(dataISO)          AS dataMax,
        (SELECT iniciadoEm FROM execucoes ORDER BY id DESC LIMIT 1) AS ultimaExecucao
      FROM processos_sem_polo_passivo`
    );
    return row;
  }
}

  @Get("stats")
  async stats() {
    const [[row]] = await this.db.query<any>(`
      SELECT
        COUNT(*)              AS total,
        COUNT(DISTINCT vara)  AS totalVaras,
        MIN(dataISO)          AS dataMin,
        MAX(dataISO)          AS dataMax,
        (SELECT iniciadoEm FROM execucoes ORDER BY id DESC LIMIT 1) AS ultimaExecucao
      FROM processos_sem_polo_passivo`
    );
    return row;
  }
}
