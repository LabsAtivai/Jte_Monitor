// backend/src/contratos/contratos-analise.controller.ts
import {
  Controller, Post, UseGuards, UseInterceptors, UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard, TierGuard, Tiers } from "../common/guards/index";
import { GeminiService } from "./gemini.service";

const TAMANHO_MAX = 15 * 1024 * 1024; // 15MB

@Controller("api/contratos/analise")
@UseGuards(JwtAuthGuard, TierGuard)
@Tiers("premium", "admin")
export class ContratosAnaliseController {
  constructor(private gemini: GeminiService) {}

  @Post()
  @UseInterceptors(FileInterceptor("contrato", { limits: { fileSize: TAMANHO_MAX } }))
  async analisar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Envie um arquivo no campo 'contrato'.");
    const analise = await this.gemini.analisarRisco(file);
    return { analise };
  }
}
