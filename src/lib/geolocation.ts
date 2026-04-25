// ============================================
// ZAPATEAN2 — Geolocation & Battery Saver
// ============================================

import { $userPosition, $gpsWatchId } from './stores';
import type { UserPosition } from './types';

/** Minimum speed (m/s) to consider user "moving" — below this, reduce GPS updates */
const MOVING_THRESHOLD = 1.0;

/** Interval for polling position when stationary (ms) */
const STATIONARY_INTERVAL = 10_000;

/** Cached timeout ID for battery saver mode */
let stationaryTimeoutId: ReturnType<typeof setTimeout> | null = null;
let lastUpdateTime = 0;

/**
 * Start watching user's GPS position with high accuracy.
 * Implements Battery Saver: reduces GPS frequency when user is stationary.
 */
export function startWatching(): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.warn('[Zapatean2] Geolocation API not available');
    return;
  }

  // Clean up any existing watch
  stopWatching();

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const now = Date.now();
      const { latitude, longitude, accuracy, speed, heading } =
        position.coords;

      // Battery Saver: skip update if stationary and last update was recent
      const currentSpeed = speed ?? 0;
      const isStationary = currentSpeed < MOVING_THRESHOLD;

      if (isStationary && now - lastUpdateTime < STATIONARY_INTERVAL) {
        return;
      }

      lastUpdateTime = now;

      const userPos: UserPosition = {
        lat: latitude,
        lng: longitude,
        accuracy,
        speed,
        heading,
        timestamp: position.timestamp,
      };

      $userPosition.set(userPos);
    },
    (error) => {
      console.error('[Zapatean2] Geolocation error:', error.message);

      // Don't clear position on timeout errors — keep last known position
      if (error.code !== error.TIMEOUT) {
        // For permission denied or unavailable, set null
        if (error.code === error.PERMISSION_DENIED) {
          $userPosition.set(null);
        }
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 5_000,
    }
  );

  $gpsWatchId.set(watchId);
}

/**
 * Stop watching GPS position.
 */
export function stopWatching(): void {
  const watchId = $gpsWatchId.get();

  if (watchId !== null && typeof navigator !== 'undefined') {
    navigator.geolocation.clearWatch(watchId);
    $gpsWatchId.set(null);
  }

  if (stationaryTimeoutId !== null) {
    clearTimeout(stationaryTimeoutId);
    stationaryTimeoutId = null;
  }
}

/**
 * Get a single position reading (one-shot).
 * Returns a promise that resolves with the position or rejects with an error.
 */
export function getOneTimePosition(): Promise<UserPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation API not available'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, speed, heading } =
          position.coords;

        const userPos: UserPosition = {
          lat: latitude,
          lng: longitude,
          accuracy,
          speed,
          heading,
          timestamp: position.timestamp,
        };

        $userPosition.set(userPos);
        resolve(userPos);
      },
      (error) => {
        reject(new Error(`GPS Error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      }
    );
  });
}
