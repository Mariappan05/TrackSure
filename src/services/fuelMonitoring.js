import { supabase } from './supabase';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
};

export const calculateActualDistance = async (orderId, driverId) => {
  try {
    // Get GPS points for this specific order
    const { data: locations, error } = await supabase
      .from('driver_locations')
      .select('latitude, longitude, recorded_at')
      .eq('driver_id', driverId)
      .eq('order_id', orderId)
      .order('recorded_at', { ascending: true });

    if (error || !locations || locations.length < 2) {
      return 0;
    }

    // Calculate total distance from GPS points
    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      const dist = calculateDistance(
        parseFloat(locations[i - 1].latitude),
        parseFloat(locations[i - 1].longitude),
        parseFloat(locations[i].latitude),
        parseFloat(locations[i].longitude)
      );
      totalDistance += dist;
    }

    return parseFloat(totalDistance.toFixed(2));
  } catch (error) {
    console.error('Error calculating actual distance:', error);
    return 0;
  }
};

export const checkFuelMisuse = async (orderId) => {
  try {
    // Get order details
    const { data: order, error } = await supabase
      .from('orders')
      .select('planned_distance, actual_distance, driver_id')
      .eq('id', orderId)
      .single();

    if (error || !order) return;

    const plannedDistance = parseFloat(order.planned_distance);
    const actualDistance = parseFloat(order.actual_distance);
    
    // Check if actual distance exceeds planned by 20%
    const threshold = plannedDistance * 1.2;
    const deviation = actualDistance - plannedDistance;
    const deviationPercent = ((deviation / plannedDistance) * 100).toFixed(1);

    if (actualDistance > threshold) {
      // Flag the order
      await supabase
        .from('orders')
        .update({
          is_flagged: true,
          flag_reason: `Route deviation: +${deviation.toFixed(1)} km (+${deviationPercent}%)`
        })
        .eq('id', orderId);

      console.log(`Order ${orderId} flagged for fuel misuse`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking fuel misuse:', error);
    return false;
  }
};

export const updateActualDistance = async (orderId, driverId) => {
  try {
    const actualDistance = await calculateActualDistance(orderId, driverId);
    
    await supabase
      .from('orders')
      .update({ actual_distance: actualDistance })
      .eq('id', orderId);

    // Check for fuel misuse
    await checkFuelMisuse(orderId);

    return actualDistance;
  } catch (error) {
    console.error('Error updating actual distance:', error);
  }
};
