-- ============================================================
--  JTe Monitor — Migration 003: alertas + notificacoes
-- ============================================================
USE jte;

CREATE TABLE IF NOT EXISTS alertas (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  userId     BIGINT UNSIGNED NOT NULL,
  nome       VARCHAR(100)    NOT NULL,
  vara       VARCHAR(255)    NULL,
  reclamada  VARCHAR(255)    NULL,
  ativo      TINYINT(1)      NOT NULL DEFAULT 1,
  createdAt  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_userId (userId),
  KEY ix_ativo  (ativo),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notificacoes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  userId      BIGINT UNSIGNED NOT NULL,
  alertaId    BIGINT UNSIGNED NULL,
  processoId  BIGINT UNSIGNED NOT NULL,
  enviadoEm   DATETIME        NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notif (userId, processoId),
  KEY ix_userId    (userId),
  KEY ix_processoId (processoId),
  FOREIGN KEY (userId)     REFERENCES users(id)                      ON DELETE CASCADE,
  FOREIGN KEY (processoId) REFERENCES processos_sem_polo_passivo(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
