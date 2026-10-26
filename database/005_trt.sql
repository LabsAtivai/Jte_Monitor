-- ============================================================
--  JTe Monitor — Migration 005: coluna trt
--  Idempotente: o migrate.js reexecuta todas as migrations.
-- ============================================================
SET NAMES utf8mb4;
USE jte;

SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processos_sem_polo_passivo' AND COLUMN_NAME = 'trt');
SET @sql := IF(@tem = 0,
  "ALTER TABLE processos_sem_polo_passivo ADD COLUMN trt VARCHAR(10) NOT NULL DEFAULT 'TRT2' AFTER geradoEm",
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @tem := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processos_sem_polo_passivo' AND COLUMN_NAME = 'municipio');
SET @sql := IF(@tem = 0,
  "ALTER TABLE processos_sem_polo_passivo ADD COLUMN municipio VARCHAR(150) NULL AFTER trt",
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Dados existentes são do TRT2
UPDATE processos_sem_polo_passivo
   SET municipio = 'São Paulo - Zonas Central, Norte e Oeste'
 WHERE municipio IS NULL AND trt = 'TRT2';

SET @tem := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processos_sem_polo_passivo'
    AND INDEX_NAME = 'uq_proc' AND COLUMN_NAME = 'trt');
SET @sql := IF(@tem = 0,
  'ALTER TABLE processos_sem_polo_passivo DROP INDEX uq_proc, ADD UNIQUE KEY uq_proc (trt, vara, dataISO, numeroProcesso)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @tem := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processos_sem_polo_passivo' AND INDEX_NAME = 'ix_trt');
SET @sql := IF(@tem = 0,
  'ALTER TABLE processos_sem_polo_passivo ADD KEY ix_trt (trt)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
