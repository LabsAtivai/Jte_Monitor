-- ============================================================
--  JTe Monitor — Init: cria banco e usuários MySQL
--  Execute como root: mysql -u root -p < 000_init.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS jte
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Usuário da aplicação (leitura + escrita)
CREATE USER IF NOT EXISTS 'jte'@'localhost' IDENTIFIED BY 'TROQUE_AQUI';
GRANT ALL PRIVILEGES ON jte.* TO 'jte'@'localhost';

-- Usuário somente-leitura (frontend / relatórios)
CREATE USER IF NOT EXISTS 'jte_ro'@'localhost' IDENTIFIED BY 'TROQUE_RO_AQUI';
GRANT SELECT ON jte.* TO 'jte_ro'@'localhost';

FLUSH PRIVILEGES;
