export const logger = {
  error: (message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    process.stderr.write(`[${timestamp}] ERROR: ${message}\n`);
    if (error) {
      process.stderr.write(`${error}\n`);
    }
  },
  info: (message: string) => {
    const timestamp = new Date().toISOString();
    process.stdout.write(`[${timestamp}] INFO: ${message}\n`);
  },
  warn: (message: string) => {
    const timestamp = new Date().toISOString();
    process.stdout.write(`[${timestamp}] WARN: ${message}\n`);
  },
};
