// ============================================
// ZAPATEAN2 — IndexedDB Offline Storage
// Lightweight wrapper for persisting app data
// ============================================

import type { CostConfig, FavoriteRoute, TripRecord, OfflineRouteCache } from './types';
import { DEFAULT_COST_CONFIG } from './types';

const DB_NAME = 'zapatean2';
const DB_VERSION = 2;

// Store names
const STORES = {
  FAVORITES: 'favorites',
  CONFIG: 'config',
  TRIPS: 'trips',
  ROUTE_CACHE: 'route_cache',
} as const;

/** Open (or create) the database */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
        db.createObjectStore(STORES.FAVORITES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.CONFIG)) {
        db.createObjectStore(STORES.CONFIG);
      }
      if (!db.objectStoreNames.contains(STORES.TRIPS)) {
        db.createObjectStore(STORES.TRIPS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.ROUTE_CACHE)) {
        db.createObjectStore(STORES.ROUTE_CACHE, { keyPath: 'hash' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Generic get-all from a store */
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

/** Generic put into a store */
async function put<T>(storeName: string, value: T, key?: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = key !== undefined ? store.put(value, key) : store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Generic delete from a store */
async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// FAVORITES
// ============================================

export async function saveFavorite(favorite: FavoriteRoute): Promise<void> {
  await put(STORES.FAVORITES, favorite);
}

export async function loadFavorites(): Promise<FavoriteRoute[]> {
  try {
    const favorites = await getAll<FavoriteRoute>(STORES.FAVORITES);
    return favorites.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteFavorite(id: string): Promise<void> {
  await remove(STORES.FAVORITES, id);
}

// ============================================
// COST CONFIG
// ============================================

export async function saveCostConfig(config: CostConfig): Promise<void> {
  await put(STORES.CONFIG, config, 'cost');
}

export async function loadCostConfig(): Promise<CostConfig> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.CONFIG, 'readonly');
      const store = tx.objectStore(STORES.CONFIG);
      const request = store.get('cost');
      request.onsuccess = () => resolve(request.result ?? DEFAULT_COST_CONFIG);
      request.onerror = () => resolve(DEFAULT_COST_CONFIG);
    });
  } catch {
    return DEFAULT_COST_CONFIG;
  }
}

// ============================================
// TRIPS / WALLET
// ============================================

export async function saveTripRecord(trip: TripRecord): Promise<void> {
  await put(STORES.TRIPS, trip);
}

export async function loadTripRecords(): Promise<TripRecord[]> {
  try {
    const trips = await getAll<TripRecord>(STORES.TRIPS);
    return trips.sort((a, b) => b.date - a.date);
  } catch {
    return [];
  }
}

export async function clearTripRecords(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRIPS, 'readwrite');
    const store = tx.objectStore(STORES.TRIPS);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// OFFLINE ROUTE CACHE
// ============================================

export async function saveRouteCache(cacheItem: OfflineRouteCache): Promise<void> {
  await put(STORES.ROUTE_CACHE, cacheItem);
}

export async function loadRouteCache(hash: string): Promise<OfflineRouteCache | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.ROUTE_CACHE, 'readonly');
      const store = tx.objectStore(STORES.ROUTE_CACHE);
      const request = store.get(hash);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
