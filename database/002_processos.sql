-- ============================================================
--  JTe Monitor — Migration 002: processos + execucoes
-- ============================================================
USE jte;

CREATE TABLE IF NOT EXISTS processos_sem_polo_passivo (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  geradoEm       DATETIME(3)     NOT NULL,
  vara           VARCHAR(255)    NOT NULL,
  dataBR         VARCHAR(10)     NOT NULL,
  dataISO        DATE            NOT NULL,
  numeroProcesso VARCHAR(64)     NOT NULL,
  sessao         VARCHAR(255)    NULL,
  juiz           VARCHAR(255)    NULL,
  reclamante     VARCHAR(255)    NULL,
  reclamada      VARCHAR(500)    NULL,
  createdAt      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_proc (vara, dataISO, numeroProcesso),
  KEY ix_data      (dataISO),
  KEY ix_vara      (vara(100)),
  KEY ix_reclamada (reclamada(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS execucoes (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo           ENUM('carga','diario')  NOT NULL DEFAULT 'diario',
  iniciadoEm     DATETIME(3)     NOT NULL,
  finalizadoEm   DATETIME(3)     NULL,
  totalJobs      INT UNSIGNED    NOT NULL DEFAULT 0,
  jobsConcluidos INT UNSIGNED    NOT NULL DEFAULT 0,
  jobsErro       INT UNSIGNED    NOT NULL DEFAULT 0,
  novosProcessos INT UNSIGNED    NOT NULL DEFAULT 0,
  status         ENUM('rodando','concluido','erro') NOT NULL DEFAULT 'rodando',
  PRIMARY KEY (id),
  KEY ix_inicio (iniciadoEm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
