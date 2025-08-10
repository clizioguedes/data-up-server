import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { URL } from 'node:url';
import { logger } from '../../utils/logger.ts';
import type {
  StorageProvider,
  UploadResult,
} from './storage-provider.interface.ts';

export class LocalStorageProvider implements StorageProvider {
  private readonly uploadsDir: string;
  private readonly baseUrl: string;

  constructor(uploadsDir: string, baseUrl = 'http://localhost:3333') {
    this.uploadsDir = uploadsDir;
    this.baseUrl = baseUrl;
  }

  async upload(
    file: NodeJS.ReadableStream,
    fileName: string,
    mimeType: string,
    _size: number
  ): Promise<UploadResult> {
    // Gerar hash único para o arquivo
    const hash = createHash('sha256');
    const timestamp = Date.now();
    const extension = extname(fileName);
    const uniqueFileName = `${timestamp}_${hash
      .update(`${fileName}_${timestamp}`)
      .digest('hex')
      .substring(0, 16)}${extension}`;

    // Criar estrutura de diretórios baseada na data
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const subDir = join(String(year), month, day);
    const fullDir = join(this.uploadsDir, subDir);

    // Garantir que o diretório existe
    logger.info(`Criando diretório: ${fullDir}`);
    await mkdir(fullDir, { recursive: true });

    const filePath = join(fullDir, uniqueFileName);
    const storagePath = join(subDir, uniqueFileName).replace(/\\/g, '/'); // Normalize path separators

    logger.info(`Salvando arquivo em: ${filePath}`);

    try {
      // Fazer upload do arquivo
      const writeStream = createWriteStream(filePath);

      logger.info('Iniciando pipeline para salvar arquivo...');

      await pipeline(file, writeStream);

      logger.info('Pipeline concluído com sucesso');

      // Usar statSync para obter o tamanho real do arquivo salvo
      const fs = await import('node:fs');
      const stats = fs.statSync(filePath);
      const totalSize = stats.size;

      logger.info(`Arquivo salvo com tamanho: ${totalSize} bytes`);

      return {
        storagePath,
        size: totalSize,
        mimeType,
        originalName: fileName,
      };
    } catch (error) {
      logger.error(`Erro durante o upload do arquivo: ${error}`);

      // Tentar limpar o arquivo parcial em caso de erro
      try {
        const fs = await import('node:fs');
        if (fs.existsSync(filePath)) {
          await unlink(filePath);
          logger.info('Arquivo parcial removido após erro');
        }
      } catch (cleanupError) {
        logger.error(`Erro ao limpar arquivo parcial: ${cleanupError}`);
      }

      throw error;
    }
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = join(this.uploadsDir, storagePath);

    try {
      await unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getUrl(storagePath: string): Promise<string> {
    return Promise.resolve(
      new URL(`/uploads/${storagePath}`, this.baseUrl).toString()
    );
  }

  async exists(storagePath: string): Promise<boolean> {
    const fullPath = join(this.uploadsDir, storagePath);

    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  createReadStream(storagePath: string): NodeJS.ReadableStream {
    const fullPath = join(this.uploadsDir, storagePath);
    return createReadStream(fullPath);
  }
}
