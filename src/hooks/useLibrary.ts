import { useSyncExternalStore } from 'react';
import { loadDB, subscribe } from '../storage/db';
import type { DB } from '../types';

/**
 * Hook réactif : chaque composant qui l'utilise se re-render
 * à chaque saveDB() (via subscribe). Simple et suffisant à ce stade.
 */
export function useDB(): DB {
  return useSyncExternalStore(
    (cb) => subscribe(cb),
    () => loadDB(),
    () => loadDB()
  );
}
