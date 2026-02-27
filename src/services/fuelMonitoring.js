import { supabase } from './supabase';

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Start order tracking
export const startOrderTracking = async (orderId) => {
  const { error } = await supabase
    .from('orders')
    .update({ 
      started_at: new Date().toISOString()
    })
    .eq('id', orderId);
  
  if (error) throw error;
};

// Calculate actual distance from driver locations
export const calculateActualDistance = async (orderId) => {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('latitude, longitude, recorded_at')
    .eq('order_id', orderId)
    .order('recorded_at', { ascending: true });
  
  if (error || !data || data.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < data.length; i++) {
    const dist = calculateDistance(
      data[i - 1].latitude,
      data[i - 1].longitude,
      data[i].latitude,
      data[i].longitude
    );
    totalDistance += dist;
  }
  
  return parseFloat(totalDistance.toFixed(2));
};

// Calculate fuel consumption
export const calculateFuelConsumption = async (orderId) => {
  const { data: order } = await supabase
    .from('orders')
    .select('actual_distance, vehicle_type')
    .eq('id', orderId)
    .single();
  
  if (!order || !order.actual_distance) return 0;
  
  const { data: fuelRate } = await supabase
    .from('fuel_rates')
    .select('km_per_liter')
    .eq('vehicle_type', order.vehicle_type)
    .single();
  
  const kmPerLiter = fuelRate?.km_per_liter || 15; // Default 15 km/liter
  const fuelConsumed = order.actual_distance / kmPerLiter;
  
  return parseFloat(fuelConsumed.toFixed(2));
};

// Complete order with all metrics
export const completeOrderTracking = async (orderId) => {
  const actualDistance = await calculateActualDistance(orderId);
  
  const { data: order } = await supabase
    .from('orders')
    .select('started_at, planned_distance, vehicle_type')
    .eq('id', orderId)
    .single();
  
  const completedAt = new Date();
  const travelTime = order?.started_at 
    ? Math.round((completedAt - new Date(order.started_at)) / 60000) 
    : 0;
  
  // Calculate fuel consumption
  const { data: fuelRate } = await supabase
    .from('fuel_rates')
    .select('km_per_liter')
    .eq('vehicle_type', order.vehicle_type)
    .single();
  
  const kmPerLiter = fuelRate?.km_per_liter || 15;
  const fuelConsumed = actualDistance / kmPerLiter;
  
  // Check if order should be flagged (actual > planned by 20%)
  const threshold = order.planned_distance * 1.2;
  const isFlagged = actualDistance > threshold;
  const flagReason = isFlagged 
    ? `Actual distance (${actualDistance}km) exceeded planned (${order.planned_distance}km) by ${((actualDistance - order.planned_distance) / order.planned_distance * 100).toFixed(1)}%`
    : null;
  
  const { error } = await supabase
    .from('orders')
    .update({
      actual_distance: actualDistance,
      fuel_consumed_liters: parseFloat(fuelConsumed.toFixed(2)),
      travel_time_minutes: travelTime,
      completed_at: completedAt.toISOString(),
      status: 'delivered',
      is_flagged: isFlagged,
      flag_reason: flagReason
    })
    .eq('id', orderId);
  
  if (error) throw error;
  
  return { actualDistance, fuelConsumed: parseFloat(fuelConsumed.toFixed(2)), travelTime };
};

// Get fuel statistics
export const getFuelStatistics = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select('fuel_consumed_liters, vehicle_type, actual_distance')
    .eq('status', 'delivered')
    .not('fuel_consumed_liters', 'is', null);
  
  if (error) throw error;
  
  const totalFuel = data.reduce((sum, o) => sum + (o.fuel_consumed_liters || 0), 0);
  const totalDistance = data.reduce((sum, o) => sum + (o.actual_distance || 0), 0);
  const avgEfficiency = totalDistance / totalFuel || 0;
  
  return {
    totalFuel: parseFloat(totalFuel.toFixed(2)),
    totalDistance: parseFloat(totalDistance.toFixed(2)),
    avgEfficiency: parseFloat(avgEfficiency.toFixed(2)),
    totalOrders: data.length
  };
};
