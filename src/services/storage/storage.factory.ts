import { join } from 'node:path';
import { env } from '../../env.ts';
import { LocalStorageProvider } from './local-storage.provider.ts';
import { type S3Config, S3StorageProvider } from './s3-storage.provider.ts';
import type { StorageProvider } from './storage-provider.interface.ts';

export type StorageType = 'local' | 's3';

export interface StorageConfig {
  type: StorageType;
  local?: {
    uploadsDir: string;
    baseUrl: string;
  };
  s3?: S3Config;
}

let storageInstance: StorageProvider | null = null;

export function createStorageProvider(config: StorageConfig): StorageProvider {
  if (storageInstance) {
    return storageInstance;
  }

  switch (config.type) {
    case 'local': {
      const localConfig = config.local ?? {
        uploadsDir: join(process.cwd(), 'uploads'),
        baseUrl: `http://localhost:${env.PORT}`,
      };

      storageInstance = new LocalStorageProvider(
        localConfig.uploadsDir,
        localConfig.baseUrl
      );
      break;
    }
    case 's3': {
      if (!config.s3) {
        throw new Error('S3 configuration is required when using S3 storage');
      }
      storageInstance = new S3StorageProvider();
      break;
    }
    default: {
      throw new Error(`Unsupported storage type: ${config.type}`);
    }
  }

  return storageInstance;
}

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    // Default to local storage
    storageInstance = createStorageProvider({
      type: 'local',
    });
  }
  return storageInstance;
}

export function resetStorageInstance(): void {
  storageInstance = null;
}
