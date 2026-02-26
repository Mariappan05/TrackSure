const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Optimize route for multiple stops using Google Maps Directions API
export const optimizeMultiStopRoute = async (startLocation, orders) => {
  if (!orders || orders.length === 0) {
    return { optimizedOrder: [], totalDistance: 0, totalDuration: 0 };
  }

  // For single order, no optimization needed
  if (orders.length === 1) {
    return {
      optimizedOrder: [{ ...orders[0], sequence: 1 }],
      totalDistance: parseFloat(orders[0].planned_distance || 0),
      totalDuration: 0
    };
  }

  try {
    // Build waypoints string for Google Maps API
    const waypoints = orders.map(order => `${order.drop_lat},${order.drop_lng}`).join('|');
    
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLocation.lat},${startLocation.lng}&destination=${startLocation.lat},${startLocation.lng}&waypoints=optimize:true|${waypoints}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.routes[0]) {
      throw new Error('Route optimization failed');
    }

    const route = data.routes[0];
    const waypointOrder = route.waypoint_order || orders.map((_, i) => i);
    
    // Calculate total distance and duration
    let totalDistance = 0;
    let totalDuration = 0;
    
    route.legs.forEach(leg => {
      totalDistance += leg.distance.value / 1000; // Convert to km
      totalDuration += leg.duration.value / 60; // Convert to minutes
    });

    // Reorder orders based on optimized sequence
    const optimizedOrder = waypointOrder.map((originalIndex, newIndex) => ({
      ...orders[originalIndex],
      sequence: newIndex + 1,
      originalSequence: originalIndex + 1
    }));

    return {
      optimizedOrder,
      totalDistance: totalDistance.toFixed(2),
      totalDuration: Math.round(totalDuration),
      savings: calculateSavings(orders, optimizedOrder)
    };
  } catch (error) {
    console.error('Route optimization error:', error);
    // Fallback: return orders in original sequence
    return {
      optimizedOrder: orders.map((order, i) => ({ ...order, sequence: i + 1 })),
      totalDistance: orders.reduce((sum, o) => sum + parseFloat(o.planned_distance || 0), 0).toFixed(2),
      totalDuration: 0,
      error: error.message
    };
  }
};

// Calculate potential savings from optimization
const calculateSavings = (originalOrders, optimizedOrders) => {
  const originalDistance = originalOrders.reduce((sum, o) => sum + parseFloat(o.planned_distance || 0), 0);
  const optimizedDistance = parseFloat(optimizedOrders.reduce((sum, o) => sum + parseFloat(o.planned_distance || 0), 0));
  
  const distanceSaved = originalDistance - optimizedDistance;
  const percentSaved = originalDistance > 0 ? ((distanceSaved / originalDistance) * 100).toFixed(1) : 0;
  
  return {
    distanceSaved: distanceSaved.toFixed(2),
    percentSaved,
    timeSaved: Math.round(distanceSaved * 2) // Rough estimate: 2 min per km
  };
};

// Get driver's current location or last known location
export const getDriverLocation = async (driverId) => {
  // This would fetch from driver_locations table
  // For now, return a default location
  return {
    lat: 0,
    lng: 0
  };
};
