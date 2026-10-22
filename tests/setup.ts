import { afterEach } from 'vitest';
import { closeAllDbs } from './helpers';

afterEach(async () => { await closeAllDbs(); });
