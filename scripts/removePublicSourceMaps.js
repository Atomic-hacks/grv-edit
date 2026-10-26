// Runs only after Vite/Sentry upload hooks have completed. Keep source maps
// out of the public artifact; the originals remain available to Sentry.
import { readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const removeMaps = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) removeMaps(path);
    else if (entry.name.endsWith('.map')) unlinkSync(path);
  }
};
removeMaps(fileURLToPath(new URL('../dist', import.meta.url)));
