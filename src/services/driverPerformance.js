import { supabase } from './supabase';

// Calculate idle time from GPS points
export const calculateIdleTime = async (orderId) => {
  const { data: locations } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('order_id', orderId)
    .order('recorded_at', { ascending: true });

  if (!locations || locations.length < 2) return 0;

  let idleMinutes = 0;
  const IDLE_THRESHOLD = 50; // meters
  const TIME_THRESHOLD = 5; // minutes

  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    
    const distance = calculateDistance(
      parseFloat(prev.latitude),
      parseFloat(prev.longitude),
      parseFloat(curr.latitude),
      parseFloat(curr.longitude)
    );

    const timeDiff = (new Date(curr.recorded_at) - new Date(prev.recorded_at)) / 60000; // minutes

    if (distance < IDLE_THRESHOLD && timeDiff >= TIME_THRESHOLD) {
      idleMinutes += timeDiff;
    }
  }

  return Math.round(idleMinutes);
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Get driver performance metrics
export const getDriverPerformance = async (driverId) => {
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('driver_id', driverId)
    .eq('status', 'delivered');

  if (!orders || orders.length === 0) {
    return {
      totalDeliveries: 0,
      avgFuelEfficiency: 0,
      totalIdleTime: 0,
      fuelEfficiencyScore: 0
    };
  }

  let totalPlanned = 0;
  let totalActual = 0;
  let totalIdleTime = 0;

  for (const order of orders) {
    totalPlanned += parseFloat(order.planned_distance || 0);
    totalActual += parseFloat(order.actual_distance || 0);
    
    const idleTime = await calculateIdleTime(order.id);
    totalIdleTime += idleTime;
  }

  const avgFuelEfficiency = totalPlanned > 0 
    ? ((totalActual / totalPlanned) * 100).toFixed(1)
    : 100;

  const fuelEfficiencyScore = Math.max(0, 100 - (avgFuelEfficiency - 100));

  return {
    totalDeliveries: orders.length,
    avgFuelEfficiency: parseFloat(avgFuelEfficiency),
    totalIdleTime,
    fuelEfficiencyScore: Math.round(fuelEfficiencyScore),
    totalPlannedDistance: totalPlanned.toFixed(1),
    totalActualDistance: totalActual.toFixed(1)
  };
};

// Get all drivers ranked by fuel efficiency
export const getDriverRankings = async () => {
  const { data: drivers } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'driver');

  if (!drivers) return [];

  const rankings = await Promise.all(
    drivers.map(async (driver) => {
      const performance = await getDriverPerformance(driver.id);
      return {
        ...driver,
        ...performance
      };
    })
  );

  return rankings.sort((a, b) => b.fuelEfficiencyScore - a.fuelEfficiencyScore);
};
