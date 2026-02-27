import { supabase } from './supabase';

export const getDashboardStats = async () => {
  console.log('Fetching dashboard stats...');
  
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('status, planned_distance, actual_distance, is_flagged, fuel_consumed_liters, vehicle_type, travel_time_minutes, started_at, completed_at');
  
  if (ordersError) {
    console.error('Get orders error:', ordersError);
  }
  
  const { data: drivers, error: driversError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'driver');
  
  if (driversError) {
    console.error('Get drivers error:', driversError);
  }
  
  const totalOrders = orders?.length || 0;
  const deliveredOrders = orders?.filter(o => o.status === 'delivered').length || 0;
  const flaggedOrders = orders?.filter(o => o.is_flagged === true).length || 0;
  const activeDrivers = drivers?.length || 0;
  const totalDistance = orders?.reduce((sum, o) => sum + (parseFloat(o.planned_distance) || 0), 0) || 0;
  const totalActualDistance = orders?.reduce((sum, o) => sum + (parseFloat(o.actual_distance) || 0), 0) || 0;
  
  // Calculate fuel metrics
  const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
  let estimatedFuel = 0;
  let actualFuel = 0;
  
  orders?.forEach(order => {
    const kmPerLiter = fuelRates[order.vehicle_type] || 15;
    estimatedFuel += (parseFloat(order.planned_distance) || 0) / kmPerLiter;
    actualFuel += parseFloat(order.fuel_consumed_liters) || 0;
  });
  
  // Calculate time metrics
  let totalEstimatedTime = 0;
  let totalActualTime = 0;
  
  orders?.forEach(order => {
    if (order.status === 'delivered') {
      totalEstimatedTime += (parseFloat(order.planned_distance) || 0) * 2; // Assume 2 min per km
      totalActualTime += parseFloat(order.travel_time_minutes) || 0;
    }
  });
  
  const stats = {
    totalOrders,
    deliveredOrders,
    activeDrivers,
    totalDistance: totalDistance.toFixed(2),
    totalActualDistance: totalActualDistance.toFixed(2),
    flaggedOrders,
    estimatedFuel: estimatedFuel.toFixed(2),
    actualFuel: actualFuel.toFixed(2),
    estimatedTime: totalEstimatedTime.toFixed(0),
    actualTime: totalActualTime.toFixed(0),
  };
  
  console.log('Dashboard stats:', stats);
  return stats;
};
