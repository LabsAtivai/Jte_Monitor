// backend/src/users/users.service.ts
import { Injectable, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { DbService } from "../common/db.service";

export type Tier = "free" | "premium" | "admin";
export interface User {
  id: number; nome: string; email: string;
  tier: Tier; ativo: boolean; createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private db: DbService) {}

  async findByEmail(email: string) {
    const [rows] = await this.db.query<any[]>(
      "SELECT * FROM users WHERE email=? AND ativo=1 LIMIT 1",
      [email.toLowerCase().trim()]
    );
    return rows[0] ?? null;
  }

  async findById(id: number): Promise<User | null> {
    const [rows] = await this.db.query<any[]>(
      "SELECT id,nome,email,tier,ativo,createdAt FROM users WHERE id=? LIMIT 1", [id]
    );
    return rows[0] ?? null;
  }

  async criar(nome: string, email: string, senha: string): Promise<User> {
    const norm = email.toLowerCase().trim();
    if (await this.findByEmail(norm)) throw new ConflictException("E-mail já cadastrado");
    const hash = await bcrypt.hash(senha, 12);
    const [r]  = await this.db.query<any>(
      "INSERT INTO users (nome,email,senhaHash) VALUES (?,?,?)", [nome.trim(), norm, hash]
    );
    return this.findById(r.insertId) as Promise<User>;
  }

  async atualizarTier(id: number, tier: Tier) {
    await this.db.query("UPDATE users SET tier=? WHERE id=?", [tier, id]);
  }
}
