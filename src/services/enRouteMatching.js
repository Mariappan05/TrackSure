import { supabase } from './supabase';

// Calculate if point C is along the route from A to B
const isPointAlongRoute = (pointA, pointB, pointC, thresholdKm = 2) => {
  // Calculate distance A to B (direct route)
  const directDistance = calculateDistance(pointA.lat, pointA.lng, pointB.lat, pointB.lng);
  
  // Calculate distance A to C to B (via C)
  const viaDistance = 
    calculateDistance(pointA.lat, pointA.lng, pointC.lat, pointC.lng) +
    calculateDistance(pointC.lat, pointC.lng, pointB.lat, pointB.lng);
  
  // If detour is less than threshold, it's along the route
  const detour = viaDistance - directDistance;
  return {
    isAlong: detour <= thresholdKm,
    detourKm: detour.toFixed(2),
    directDistance: directDistance.toFixed(2),
    viaDistance: viaDistance.toFixed(2)
  };
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Find orders that can be delivered along the route
export const findOrdersAlongRoute = async (currentOrder, driverId) => {
  try {
    console.log('=== Finding orders along route ===');
    console.log('Current order:', currentOrder.id);
    console.log('Driver:', driverId);
    
    // Get all pending orders for this driver
    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'pending')
      .neq('id', currentOrder.id);

    console.log('Found pending orders:', pendingOrders?.length || 0);

    if (!pendingOrders || pendingOrders.length === 0) {
      return [];
    }

    const routeStart = {
      lat: parseFloat(currentOrder.pickup_lat),
      lng: parseFloat(currentOrder.pickup_lng)
    };
    const routeEnd = {
      lat: parseFloat(currentOrder.drop_lat),
      lng: parseFloat(currentOrder.drop_lng)
    };

    // Check each pending order
    const recommendations = [];
    
    for (const order of pendingOrders) {
      const orderPickup = {
        lat: parseFloat(order.pickup_lat),
        lng: parseFloat(order.pickup_lng)
      };
      const orderDrop = {
        lat: parseFloat(order.drop_lat),
        lng: parseFloat(order.drop_lng)
      };

      // Check for return trip (A→D, then D→A)
      const isReturnTrip = checkReturnTrip(routeStart, routeEnd, orderPickup, orderDrop);
      
      if (isReturnTrip.isReturn) {
        recommendations.push({
          order,
          pickupDetour: '0.00',
          dropDetour: '0.00',
          isPickupAlong: true,
          isDropAlong: true,
          totalDetour: 0,
          isReturnTrip: true,
          savings: {
            distanceSaved: isReturnTrip.savings.toFixed(2),
            percentSaved: '100'
          }
        });
        continue;
      }

      // Check if pickup is along the route
      const pickupCheck = isPointAlongRoute(routeStart, routeEnd, orderPickup, 2);
      
      // Check if drop is along the route
      const dropCheck = isPointAlongRoute(routeStart, routeEnd, orderDrop, 2);

      // If either pickup or drop is along the route, recommend it
      if (pickupCheck.isAlong || dropCheck.isAlong) {
        recommendations.push({
          order,
          pickupDetour: pickupCheck.detourKm,
          dropDetour: dropCheck.detourKm,
          isPickupAlong: pickupCheck.isAlong,
          isDropAlong: dropCheck.isAlong,
          totalDetour: parseFloat(pickupCheck.detourKm) + parseFloat(dropCheck.detourKm),
          isReturnTrip: false,
          savings: calculateSavings(order, pickupCheck, dropCheck)
        });
      }
    }

    // Sort by return trips first, then by least detour
    const sorted = recommendations.sort((a, b) => {
      if (a.isReturnTrip && !b.isReturnTrip) return -1;
      if (!a.isReturnTrip && b.isReturnTrip) return 1;
      return a.totalDetour - b.totalDetour;
    });
    
    console.log('Total recommendations:', sorted.length);
    console.log('Recommendations:', sorted.map(r => ({
      orderId: r.order.id,
      isReturnTrip: r.isReturnTrip,
      detour: r.totalDetour
    })));
    
    return sorted;
  } catch (error) {
    console.error('Error finding orders along route:', error);
    return [];
  }
};

// Check if order is a return trip (A→D, then D→A)
const checkReturnTrip = (routeStart, routeEnd, orderPickup, orderDrop) => {
  const THRESHOLD = 3; // 3km tolerance
  
  console.log('Checking return trip:');
  console.log('Current route:', routeStart, '→', routeEnd);
  console.log('New order:', orderPickup, '→', orderDrop);
  
  // Check if order pickup is near current order drop (D ≈ D)
  const pickupNearDrop = calculateDistance(
    routeEnd.lat, routeEnd.lng,
    orderPickup.lat, orderPickup.lng
  );
  
  // Check if order drop is near current order pickup (A ≈ A)
  const dropNearPickup = calculateDistance(
    routeStart.lat, routeStart.lng,
    orderDrop.lat, orderDrop.lng
  );
  
  console.log('Pickup near drop distance:', pickupNearDrop, 'km');
  console.log('Drop near pickup distance:', dropNearPickup, 'km');
  
  // Return trip if:
  // 1. Both ends are within threshold (strict return trip)
  // 2. One end is perfect match (<0.5km) and other is within 10km (loose return trip)
  const isPerfectMatch = dropNearPickup < 0.5 || pickupNearDrop < 0.5;
  const bothWithinThreshold = pickupNearDrop <= THRESHOLD && dropNearPickup <= THRESHOLD;
  const looseReturnTrip = isPerfectMatch && (pickupNearDrop <= 10 && dropNearPickup <= 10);
  const isReturn = bothWithinThreshold || looseReturnTrip;
  
  console.log('isPerfectMatch:', isPerfectMatch, '| bothWithinThreshold:', bothWithinThreshold, '| looseReturnTrip:', looseReturnTrip);
  console.log('Is return trip?', isReturn);
  
  if (isReturn) {
    // Calculate savings (almost 100% since it's on the way back)
    const orderDistance = calculateDistance(
      orderPickup.lat, orderPickup.lng,
      orderDrop.lat, orderDrop.lng
    );
    
    console.log('Return trip detected! Savings:', orderDistance, 'km');
    
    return {
      isReturn: true,
      savings: orderDistance // Full distance saved
    };
  }
  
  return { isReturn: false, savings: 0 };
};

const calculateSavings = (order, pickupCheck, dropCheck) => {
  const orderDistance = parseFloat(order.planned_distance || 0);
  const detour = parseFloat(pickupCheck.detourKm) + parseFloat(dropCheck.detourKm);
  const savings = orderDistance - detour;
  
  return {
    distanceSaved: savings.toFixed(2),
    percentSaved: orderDistance > 0 ? ((savings / orderDistance) * 100).toFixed(0) : 0
  };
};
