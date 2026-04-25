// ============================================
// ZAPATEAN2 — Trip Cost Calculator
// ============================================

import type { TransportProfile, CostConfig, TripCost } from './types';

/**
 * Calculate the estimated cost of a trip.
 */
export function calculateTripCost(
  distanceMeters: number,
  profile: TransportProfile,
  config: CostConfig
): TripCost {
  const distanceKm = distanceMeters / 1000;
  const pricePerKm = config.pricePerKm[profile] ?? 0;
  const totalCup = Math.round(distanceKm * pricePerKm);

  // Fuel calculation (only for motorized vehicles)
  let fuelLiters = 0;
  let fuelCostCup = 0;

  if (profile === 'driving-car') {
    fuelLiters = config.autoKmPerLiter > 0 ? distanceKm / config.autoKmPerLiter : 0;
    fuelCostCup = Math.round(fuelLiters * config.fuelPricePerLiter);
  } else if (profile === 'cycling-electric') {
    // Moto / electric cycling profile
    fuelLiters = config.motoKmPerLiter > 0 ? distanceKm / config.motoKmPerLiter : 0;
    fuelCostCup = Math.round(fuelLiters * config.fuelPricePerLiter);
  }

  return {
    totalCup: Math.max(totalCup, fuelCostCup), // Use the higher of tariff vs fuel cost
    fuelLiters: parseFloat(fuelLiters.toFixed(2)),
    fuelCostCup,
    pricePerKm,
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
