export const logger = {
  error: (message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    process.stderr.write(`[${timestamp}] ❌ ERROR: ${message}\n`);
    if (error) {
      if (error instanceof Error) {
        process.stderr.write(`Stack: ${error.stack}\n`);
        process.stderr.write(`Message: ${error.message}\n`);
      } else {
        process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
      }
    }
  },
  info: (message: string) => {
    const timestamp = new Date().toISOString();
    process.stdout.write(`[${timestamp}] ℹ️  INFO: ${message}\n`);
  },
  warn: (message: string) => {
    const timestamp = new Date().toISOString();
    process.stdout.write(`[${timestamp}] ⚠️  WARN: ${message}\n`);
  },
  debug: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      process.stdout.write(`[${timestamp}] 🐛 DEBUG: ${message}\n`);
    }
  },
};
