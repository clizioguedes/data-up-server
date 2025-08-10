import type { MultipartFile } from '@fastify/multipart';
import { createHash } from 'node:crypto';
import { logger } from '../utils/logger.ts';
import type { UploadResult } from './storage/storage-provider.interface.ts';
import { getStorageProvider } from './storage/storage.factory.ts';

export interface FileMetadata {
  name: string;
  mimeType: string;
  size: number;
  checksum: string;
}

export interface UploadFileResult extends UploadResult {
  checksum: string;
}

export class FileUploadService {
  private readonly storageProvider = getStorageProvider();

  async uploadFile(file: MultipartFile): Promise<UploadFileResult> {
    logger.info(`Iniciando upload do arquivo: ${file.filename}`);

    // Validações básicas
    if (!file.filename) {
      logger.error('Nome do arquivo não fornecido');
      throw new Error('Nome do arquivo é obrigatório');
    }

    if (!file.mimetype) {
      logger.error('Tipo do arquivo não fornecido');
      throw new Error('Tipo do arquivo é obrigatório');
    }

    logger.info(`Arquivo: ${file.filename}, tipo: ${file.mimetype}`);

    try {
      // Fazer upload direto sem carregar tudo na memória
      logger.info('Fazendo upload usando storage provider');
      const uploadResult = await this.storageProvider.upload(
        file.file,
        file.filename,
        file.mimetype,
        0 // Tamanho será calculado durante o upload
      );

      logger.info(
        `Upload concluído - caminho: ${uploadResult.storagePath}, tamanho: ${uploadResult.size} bytes`
      );

      // Gerar checksum baseado no arquivo e timestamp para performance
      const checksum = createHash('sha256')
        .update(`${file.filename}_${uploadResult.size}_${Date.now()}`)
        .digest('hex');

      return {
        ...uploadResult,
        checksum,
      };
    } catch (error) {
      logger.error('Erro durante o upload do arquivo:', error);
      throw error;
    }
  }

  deleteFile(storagePath: string): Promise<void> {
    return this.storageProvider.delete(storagePath);
  }

  getFileUrl(storagePath: string): Promise<string> {
    return this.storageProvider.getUrl(storagePath);
  }

  fileExists(storagePath: string): Promise<boolean> {
    return this.storageProvider.exists(storagePath);
  }

  // Método para validar tipos de arquivo permitidos
  validateFileType(mimeType: string, allowedTypes: string[] = []): boolean {
    if (allowedTypes.length === 0) {
      return true; // Permite todos os tipos se não houver restrições
    }

    return allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        const baseType = type.slice(0, -2);
        return mimeType.startsWith(baseType);
      }
      return mimeType === type;
    });
  }

  // Método para validar tamanho do arquivo
  validateFileSize(size: number, maxSizeInBytes: number): boolean {
    return size <= maxSizeInBytes;
  }

  // Método para sanitizar nome do arquivo
  sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
