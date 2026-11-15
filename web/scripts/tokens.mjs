// brand/tokens.css is the one source. In the repo the copy is refreshed; a deploy that uploads only web/ builds from the committed copy.
import { copyFile, access } from 'node:fs/promises';
const source = new URL('../../brand/tokens.css', import.meta.url);
try { await access(source); } catch { process.exit(0); }
await copyFile(source, new URL('../app/tokens.css', import.meta.url));
