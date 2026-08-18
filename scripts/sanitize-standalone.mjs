import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const standaloneDirectory = join(process.cwd(), '.next', 'standalone');

try {
  const files = await readdir(standaloneDirectory);
  await Promise.all(
    files
      .filter((name) => name === '.env' || name.startsWith('.env.'))
      .map((name) => rm(join(standaloneDirectory, name), { force: true }))
  );
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
