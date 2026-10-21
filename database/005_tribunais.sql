-- Add tribunal and region dimensions while retaining existing TRT-2 rows.
USE jte;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='processos_sem_polo_passivo' AND column_name='tribunal')=0,
  "ALTER TABLE processos_sem_polo_passivo ADD COLUMN tribunal VARCHAR(100) NOT NULL DEFAULT 'TRT2 - São Paulo' AFTER geradoEm", "SELECT 1");
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Existing alerts remain scoped to their original TRT-2 audience.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='alertas' AND column_name='tribunal')=0,
  "ALTER TABLE alertas ADD COLUMN tribunal VARCHAR(100) NOT NULL DEFAULT 'TRT2 - São Paulo' AFTER nome", "SELECT 1");
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='alertas' AND column_name='regiao')=0,
  "ALTER TABLE alertas ADD COLUMN regiao VARCHAR(255) NOT NULL DEFAULT 'São Paulo - Zonas Central, Norte e Oeste' AFTER tribunal", "SELECT 1");
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='processos_sem_polo_passivo' AND column_name='regiao')=0,
  "ALTER TABLE processos_sem_polo_passivo ADD COLUMN regiao VARCHAR(255) NOT NULL DEFAULT 'São Paulo - Zonas Central, Norte e Oeste' AFTER tribunal", "SELECT 1");
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='processos_sem_polo_passivo' AND index_name='uq_proc_tribunal_regiao')=0,
  "ALTER TABLE processos_sem_polo_passivo ADD UNIQUE KEY uq_proc_tribunal_regiao (tribunal, regiao, vara, dataISO, numeroProcesso)", "SELECT 1");
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='processos_sem_polo_passivo' AND index_name='uq_proc')>0,
  "ALTER TABLE processos_sem_polo_passivo DROP INDEX uq_proc", "SELECT 1");
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='processos_sem_polo_passivo' AND index_name='ix_tribunal_data')=0,
  "ALTER TABLE processos_sem_polo_passivo ADD KEY ix_tribunal_data (tribunal, dataISO)", "SELECT 1");
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
