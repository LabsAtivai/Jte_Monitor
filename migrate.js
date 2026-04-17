// database/migrate.js
// Roda: node database/migrate.js
require("dotenv").config({ path: "./backend/.env" });
const mysql = require("mysql2/promise");
const fs    = require("fs");
const path  = require("path");

async function main() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || "127.0.0.1",
    port:     Number(process.env.DB_PORT || 3306),
    user:     process.env.DB_USER || "jte",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "jte",
    multipleStatements: true,
  });

  const dir   = path.join(__dirname, "database");
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".sql") && f !== "000_init.sql")
    .sort();

  console.log(`\n🗄️  Rodando ${files.length} migration(s)...\n`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await conn.query(sql);
    console.log(`  ✅ ${file}`);
  }

  await conn.end();
  console.log("\n✅ Migrations concluídas!\n");
}

main().catch(err => { console.error("❌", err.message); process.exit(1); });
