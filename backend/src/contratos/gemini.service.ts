// backend/src/contratos/gemini.service.ts
// Análise de risco de contrato via Google Gemini (multimodal: recebe o
// arquivo direto, sem precisar extrair texto antes).
import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PROMPT = `Você é um advogado especialista em análise de risco contratual.
Analise o contrato anexo e responda em português, em formato Markdown, com:

1. Um resumo de até 3 frases sobre o objeto do contrato.
2. Uma tabela com até 4 riscos identificados, com as colunas:
   | Cláusula | Risco | Como mitigar | Nova redação sugerida |
3. Uma lista de outros pontos de atenção, se houver.

Seja objetivo e cite o trecho da cláusula original sempre que possível.`;

// Gemini multimodal só lê PDF e texto direto no inlineData. DOC/DOCX
// precisaria de conversão prévia (ex.: libreoffice) — fora de escopo aqui.
const MIME_PERMITIDOS = new Set(["application/pdf", "text/plain"]);

@Injectable()
export class GeminiService {
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(private cfg: ConfigService) {
    this.client = new GoogleGenerativeAI(this.cfg.get<string>("GEMINI_API_KEY", ""));
    this.modelName = this.cfg.get<string>("GEMINI_MODEL", "gemini-2.5-flash");
  }

  async analisarRisco(file: Express.Multer.File): Promise<string> {
    if (!MIME_PERMITIDOS.has(file.mimetype)) {
      throw new BadRequestException("Formato não suportado. Envie PDF, DOC, DOCX ou TXT.");
    }

    const model = this.client.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent([
      PROMPT,
      { inlineData: { data: file.buffer.toString("base64"), mimeType: file.mimetype } },
    ]);

    return result.response.text();
  }
}
