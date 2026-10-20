// backend/src/contatos/snov-live.service.ts
// Enriquecimento ao vivo via Snov.io Domain Search, disparado quando um
// domínio ainda não tem contatos em cache (ver ContatosSnovController).
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DbService } from "../common/db.service";

interface SnovProspect {
  first_name?: string;
  last_name?: string;
  position?: string;
  source_page?: string;
}
interface SnovEmail { email?: string }
interface SnovDomainInfo {
  company_name?: string;
  city?: string;
  industry?: string;
  size?: string;
}

@Injectable()
export class SnovLiveService {
  private readonly log = new Logger(SnovLiveService.name);
  private token: string | null = null;
  private tokenExp = 0;

  constructor(private cfg: ConfigService, private db: DbService) {}

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExp) return this.token;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.cfg.get<string>("SNOV_CLIENT_ID", ""),
      client_secret: this.cfg.get<string>("SNOV_CLIENT_SECRET", ""),
    });
    const res: any = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }).then(r => r.json());
    this.token = res.access_token;
    this.tokenExp = Date.now() + (res.expires_in - 60) * 1000;
    return this.token!;
  }

  private async snovPost(path: string, params: Record<string, any>): Promise<any> {
    const token = await this.getToken();
    const qs = new URLSearchParams(params).toString();
    return fetch(`https://api.snov.io${path}?${qs}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }).then(r => r.json());
  }

  private async snovGet(path: string): Promise<any> {
    const token = await this.getToken();
    return fetch(`https://api.snov.io${path}`, {
      headers: { authorization: `Bearer ${token}` },
    }).then(r => r.json());
  }

  private async pollResult(getPath: string, maxTentativas = 15, delayMs = 4000): Promise<any> {
    for (let i = 0; i < maxTentativas; i++) {
      const res = await this.snovGet(getPath);
      if (res?.status === "completed") return res;
      if (res?.status === "in progress" || res?.status === "in_progress" || !res?.status) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw new Error(`Status inesperado: ${res?.status}`);
    }
    return { data: [], status: "timeout" };
  }

  private async buscarDominio(dominio: string) {
    try {
      const startRes = await this.snovPost("/v2/domain-search/start", { domain: dominio });
      if (!startRes?.meta?.task_hash) return null;
      const result = await this.pollResult(`/v2/domain-search/result/${startRes.meta.task_hash}`);
      if (!result?.data) return null;
      const info: SnovDomainInfo = result.data;

      let prospects: SnovProspect[] = [];
      const prosStart = await this.snovPost("/v2/domain-search/prospects/start", { domain: dominio, page: 1 });
      if (prosStart?.meta?.task_hash) {
        const prosResult = await this.pollResult(`/v2/domain-search/prospects/result/${prosStart.meta.task_hash}`);
        prospects = prosResult?.data || [];
      }

      let domainEmails: SnovEmail[] = [];
      const emailsStart = await this.snovPost("/v2/domain-search/domain-emails/start", { domain: dominio });
      if (emailsStart?.meta?.task_hash) {
        const emailsResult = await this.pollResult(`/v2/domain-search/domain-emails/result/${emailsStart.meta.task_hash}`);
        domainEmails = emailsResult?.data || [];
      }

      let genericEmails: SnovEmail[] = [];
      const genericStart = await this.snovPost("/v2/domain-search/generic-contacts/start", { domain: dominio });
      if (genericStart?.meta?.task_hash) {
        const genericResult = await this.pollResult(`/v2/domain-search/generic-contacts/result/${genericStart.meta.task_hash}`);
        genericEmails = genericResult?.data || [];
      }

      return { info, prospects, domainEmails, genericEmails };
    } catch (e: any) {
      this.log.warn(`Snov.io erro (${dominio}): ${e.message}`);
      return null;
    }
  }

  async enriquecerEsalvar(
    dominio: string,
    reclamada: string | null,
    numeroProcesso: string | null,
    vara: string | null,
  ): Promise<number> {
    const resultado = await this.buscarDominio(dominio);
    if (!resultado) return 0;
    const { info, prospects, domainEmails, genericEmails } = resultado;
    let salvos = 0;

    const upsert = async (tipo: string, campos: Record<string, any>) => {
      await this.db.query(
        `INSERT INTO contatos_snov
           (dominio, reclamada, numeroProcesso, vara, tipo,
            firstName, lastName, nomeCompleto, cargo, email, linkedinUrl,
            companyName, companyCity, companyIndustry, companySize)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           tipo         = CASE WHEN FIELD(VALUES(tipo),'prospect','domain_email','generic')
                                     < FIELD(tipo,'prospect','domain_email','generic')
                                THEN VALUES(tipo) ELSE tipo END,
           firstName    = COALESCE(firstName, VALUES(firstName)),
           lastName     = COALESCE(lastName,  VALUES(lastName)),
           nomeCompleto = COALESCE(nomeCompleto, VALUES(nomeCompleto)),
           cargo        = COALESCE(cargo, VALUES(cargo)),
           linkedinUrl  = COALESCE(linkedinUrl, VALUES(linkedinUrl)),
           companyName  = COALESCE(companyName, VALUES(companyName)),
           companyCity  = COALESCE(companyCity, VALUES(companyCity)),
           companyIndustry = COALESCE(companyIndustry, VALUES(companyIndustry)),
           companySize  = COALESCE(companySize, VALUES(companySize))`,
        [dominio, reclamada, numeroProcesso, vara, tipo,
         campos.firstName || null, campos.lastName || null, campos.nomeCompleto || null,
         campos.cargo || null, campos.email || null, campos.linkedinUrl || null,
         info?.company_name || null, info?.city || null, info?.industry || null, info?.size || null],
      );
      salvos++;
    };

    for (const p of prospects) {
      try {
        await upsert("prospect", {
          firstName: p.first_name,
          lastName: p.last_name,
          nomeCompleto: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
          cargo: p.position,
          linkedinUrl: p.source_page,
        });
      } catch {}
    }
    for (const e of domainEmails) {
      try { await upsert("domain_email", { email: e.email }); } catch {}
    }
    for (const e of genericEmails) {
      try { await upsert("generic", { email: e.email }); } catch {}
    }

    return salvos;
  }
}
