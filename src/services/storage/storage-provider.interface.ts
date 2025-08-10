export interface UploadResult {
  storagePath: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface StorageProvider {
  upload(
    file: NodeJS.ReadableStream,
    fileName: string,
    mimeType: string,
    size: number
  ): Promise<UploadResult>;

  delete(storagePath: string): Promise<void>;

  getUrl(storagePath: string): Promise<string>;

  exists(storagePath: string): Promise<boolean>;

  createReadStream(storagePath: string): NodeJS.ReadableStream;
}
