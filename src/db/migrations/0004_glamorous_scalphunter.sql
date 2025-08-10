-- Adiciona a coluna original_name como nullable primeiro
ALTER TABLE "files" ADD COLUMN "original_name" text;

-- Atualiza registros existentes copiando o valor de name para original_name
UPDATE "files" SET "original_name" = "name" WHERE "original_name" IS NULL;

-- Torna a coluna NOT NULL depois de atualizar os dados
ALTER TABLE "files" ALTER COLUMN "original_name" SET NOT NULL;

-- Adiciona a coluna checksum
ALTER TABLE "files" ADD COLUMN "checksum" text;