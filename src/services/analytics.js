import { supabase } from './supabase';

export const getDashboardStats = async () => {
  console.log('Fetching dashboard stats...');
  
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('status, planned_distance, actual_distance, is_flagged');
  
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
  const flaggedOrders = orders?.filter(o => o.is_flagged).length || 0;
  const activeDrivers = drivers?.length || 0;
  const totalDistance = orders?.reduce((sum, o) => sum + (parseFloat(o.planned_distance) || 0), 0) || 0;
  const totalActualDistance = orders?.reduce((sum, o) => sum + (parseFloat(o.actual_distance) || 0), 0) || 0;
  
  const stats = {
    totalOrders,
    deliveredOrders,
    activeDrivers,
    totalDistance: totalDistance.toFixed(2),
    totalActualDistance: totalActualDistance.toFixed(2),
    flaggedOrders,
  };
  
  console.log('Dashboard stats:', stats);
  return stats;
};
