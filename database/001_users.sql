-- ============================================================
--  JTe Monitor — Migration 001: users + auth
-- ============================================================
USE jte;

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(255)     NOT NULL,
  email         VARCHAR(255)     NOT NULL,
  senhaHash     VARCHAR(255)     NOT NULL,
  tier          ENUM('free','premium','admin') NOT NULL DEFAULT 'free',
  ativo         TINYINT(1)       NOT NULL DEFAULT 1,
  createdAt     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email),
  KEY ix_tier (tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  userId      BIGINT UNSIGNED NOT NULL,
  token       VARCHAR(512)    NOT NULL,
  expiresAt   DATETIME        NOT NULL,
  revogado    TINYINT(1)      NOT NULL DEFAULT 0,
  createdAt   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_userId (userId),
  KEY ix_token (token(64)),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
