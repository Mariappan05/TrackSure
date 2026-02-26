// Fuel efficiency rates (km per liter)
const FUEL_EFFICIENCY = {
  bike: 40,    // 40 km/L
  car: 15,     // 15 km/L
  van: 10      // 10 km/L
};

// Average fuel price per liter (in your currency)
const FUEL_PRICE_PER_LITER = 100; // ₹100 per liter

export const calculateFuelCost = (distance, vehicleType = 'bike') => {
  const efficiency = FUEL_EFFICIENCY[vehicleType] || FUEL_EFFICIENCY.bike;
  const litersUsed = distance / efficiency;
  const cost = litersUsed * FUEL_PRICE_PER_LITER;
  
  return {
    litersUsed: litersUsed.toFixed(2),
    cost: cost.toFixed(2),
    efficiency,
    vehicleType
  };
};

export const calculateFuelSavings = (plannedDistance, actualDistance, vehicleType = 'bike') => {
  const plannedCost = calculateFuelCost(plannedDistance, vehicleType);
  const actualCost = calculateFuelCost(actualDistance, vehicleType);
  const savings = parseFloat(plannedCost.cost) - parseFloat(actualCost.cost);
  
  return {
    plannedCost: plannedCost.cost,
    actualCost: actualCost.cost,
    savings: savings.toFixed(2),
    savingsPercent: plannedDistance > 0 ? ((savings / parseFloat(plannedCost.cost)) * 100).toFixed(1) : 0
  };
};

export const getVehicleTypes = () => [
  { label: 'Bike/Scooter (40 km/L)', value: 'bike' },
  { label: 'Car (15 km/L)', value: 'car' },
  { label: 'Van/Truck (10 km/L)', value: 'van' }
];
