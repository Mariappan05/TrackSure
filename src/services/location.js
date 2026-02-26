const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export const geocodeAddress = async (address) => {
  console.log('Geocoding with API key:', GOOGLE_MAPS_API_KEY ? 'Present' : 'Missing');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  
  console.log('Geocoding URL:', url);
  const response = await fetch(url);
  const data = await response.json();
  
  console.log('Geocoding response:', JSON.stringify(data, null, 2));
  
  if (data.status !== 'OK' || !data.results[0]) {
    throw new Error(`Address not found. Status: ${data.status}. ${data.error_message || ''}`);
  }
  
  const location = data.results[0].geometry.location;
  return {
    lat: location.lat,
    lng: location.lng,
    formattedAddress: data.results[0].formatted_address
  };
};

export const getDistance = async (originLat, originLng, destLat, destLng) => {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&departure_time=now&traffic_model=best_guess&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK' || !data.routes[0]) {
    throw new Error('Route not found');
  }
  
  // Get all alternative routes
  const routes = data.routes.map((route, index) => {
    const leg = route.legs[0];
    const distance = parseFloat((leg.distance.value / 1000).toFixed(2));
    const duration = Math.round(leg.duration.value / 60);
    const trafficDuration = leg.duration_in_traffic ? Math.round(leg.duration_in_traffic.value / 60) : duration;
    
    return {
      routeIndex: index,
      distance,
      duration,
      trafficDuration,
      trafficDelay: trafficDuration - duration,
      summary: route.summary || `Route ${index + 1}`,
      isFastest: false,
      isShortest: false
    };
  });
  
  // Mark fastest and shortest
  if (routes.length > 0) {
    const fastestRoute = routes.reduce((prev, curr) => prev.trafficDuration < curr.trafficDuration ? prev : curr);
    const shortestRoute = routes.reduce((prev, curr) => prev.distance < curr.distance ? prev : curr);
    fastestRoute.isFastest = true;
    shortestRoute.isShortest = true;
  }
  
  // Return primary route data + alternatives
  const primary = routes[0];
  return {
    distance: primary.distance,
    duration: primary.duration,
    trafficDuration: primary.trafficDuration,
    trafficDelay: primary.trafficDelay,
    routes: routes
  };
};
