// backend/src/conversoes/conversoes.controller.ts
import {
  Controller, Post, UseGuards, UseInterceptors, UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard, TierGuard, Tiers } from "../common/guards/index";
import { NanonetsService } from "./nanonets.service";

const TAMANHO_MAX = 15 * 1024 * 1024; // 15MB

@Controller("api/conversoes")
@UseGuards(JwtAuthGuard, TierGuard)
@Tiers("premium", "admin")
export class ConversoesController {
  constructor(private nanonets: NanonetsService) {}

  @Post("ocr")
  @UseInterceptors(FileInterceptor("documento", { limits: { fileSize: TAMANHO_MAX } }))
  async ocr(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Envie um arquivo no campo 'documento'.");
    const texto = await this.nanonets.extrairTexto(file);
    return { texto };
  }
}
