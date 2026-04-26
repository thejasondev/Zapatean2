// ============================================
// ZAPATEAN2 — Trip Cost Calculator
// ============================================

import { type CostConfig, type TripCost, type RouteResult, type TransportProfile } from './types';

/**
 * Calculates the trip cost simply based on total distance and global price per km.
 */
export function calculateTripCost(
  route: RouteResult,
  config: CostConfig
): TripCost {
  // Distance is provided in meters by ORS
  const distanceKm = route.distance / 1000;
  const suggestedCup = distanceKm * config.pricePerKm;

  return {
    suggestedCup: Math.max(0, suggestedCup),
    totalCup: Math.max(0, suggestedCup), // User can override this later in the UI
  };
}

/**
 * Format CUP amount for display.
 */
export function formatCUP(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k CUP`;
  }
  return `${amount} CUP`;
}

/**
 * Format fuel for display.
 */
export function formatFuel(liters: number): string {
  if (liters <= 0) return '';
  return `${liters.toFixed(1)}L`;
}
