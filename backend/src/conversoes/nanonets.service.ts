// backend/src/conversoes/nanonets.service.ts
// OCR documento→texto via Nanonets Extraction API v2.
// https://agents.nanonets.com/docs/api-reference/file-upload/upload-file
// https://agents.nanonets.com/docs/api-reference/document-parsing/synchronous-parse
//
// Fluxo em 2 passos: upload do arquivo (recebe file://<uuid>), depois parse
// síncrono desse file_id para markdown. O endpoint legado /api/v2/OCR/FullText
// (usado no protótipo original) não existe mais na API atual.
import { Injectable, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const BASE = "https://extraction-api.nanonets.com/api/v2";

@Injectable()
export class NanonetsService {
  constructor(private cfg: ConfigService) {}

  private token(): string {
    const token = this.cfg.get<string>("NANONETS_API_TOKEN", "");
    if (!token) {
      throw new InternalServerErrorException("NANONETS_API_TOKEN não configurado no backend.");
    }
    return token;
  }

  async extrairTexto(file: Express.Multer.File): Promise<string> {
    const token = this.token();

    const form = new FormData();
    form.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);

    const upload = await fetch(`${BASE}/files`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    if (!upload.ok) {
      throw new BadRequestException(`Nanonets (upload) respondeu ${upload.status}: ${await upload.text()}`);
    }
    const uploaded: any = await upload.json();
    const fileId = uploaded?.file_id;
    if (!fileId) {
      throw new InternalServerErrorException("Nanonets não retornou file_id no upload.");
    }

    const parse = await fetch(`${BASE}/parse/sync`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ input: fileId, parse_config: { output_format: "markdown" } }),
    });
    if (!parse.ok) {
      throw new BadRequestException(`Nanonets (parse) respondeu ${parse.status}: ${await parse.text()}`);
    }
    const data: any = await parse.json();
    if (data?.status && data.status !== "completed") {
      throw new BadRequestException(`Nanonets: extração não concluída (status "${data.status}").`);
    }
    const content = data?.result?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new BadRequestException("Nanonets não retornou texto extraído.");
    }
    return content.trim();
  }
}
