import type {
  StorageProvider,
  UploadResult,
} from './storage-provider.interface.ts';

export interface S3Config {
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

export class S3StorageProvider implements StorageProvider {
  upload(
    _file: NodeJS.ReadableStream,
    _fileName: string,
    _mimeType: string,
    _size: number
  ): Promise<UploadResult> {
    // TODO: Implementar upload para S3
    // Esta é uma estrutura base para futura implementação
    return Promise.reject(new Error('S3 provider not implemented yet'));
  }

  delete(_storagePath: string): Promise<void> {
    // TODO: Implementar delete para S3
    return Promise.reject(new Error('S3 provider not implemented yet'));
  }

  getUrl(_storagePath: string): Promise<string> {
    // TODO: Implementar getUrl para S3
    return Promise.reject(new Error('S3 provider not implemented yet'));
  }

  exists(_storagePath: string): Promise<boolean> {
    // TODO: Implementar exists para S3
    return Promise.reject(new Error('S3 provider not implemented yet'));
  }

  createReadStream(_storagePath: string): NodeJS.ReadableStream {
    // TODO: Implementar createReadStream para S3
    throw new Error('S3 provider not implemented yet');
  }
}
