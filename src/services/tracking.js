import { supabase } from './supabase';

export const getActiveDriverLocations = async () => {
  console.log('Fetching active driver locations...');
  const { data, error } = await supabase
    .from('driver_locations')
    .select(`
      *,
      driver:profiles!inner(id, full_name, role)
    `)
    .eq('driver.role', 'driver')
    .order('recorded_at', { ascending: false });
  
  if (error) {
    console.error('Get driver locations error:', error);
    throw error;
  }
  
  const latestLocations = {};
  data.forEach(loc => {
    if (!latestLocations[loc.driver_id]) {
      latestLocations[loc.driver_id] = loc;
    }
  });
  
  console.log('Active driver locations:', Object.keys(latestLocations).length, 'drivers');
  return Object.values(latestLocations);
};

export const subscribeToDriverLocations = (callback) => {
  console.log('Subscribing to driver location updates...');
  const subscription = supabase
    .channel('driver_locations')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'driver_locations' },
      (payload) => {
        console.log('New location update received:', payload.new);
        callback(payload);
      }
    )
    .subscribe();
  
  return subscription;
};

export const updateDriverLocation = async (driverId, latitude, longitude, orderId = null) => {
  console.log('Updating driver location:', { driverId, latitude, longitude, orderId });
  const { error } = await supabase
    .from('driver_locations')
    .insert({
      driver_id: driverId,
      latitude,
      longitude,
      order_id: orderId
    });
  
  if (error) {
    console.error('Update driver location error:', error);
    throw error;
  }
  console.log('Driver location updated successfully');
};
