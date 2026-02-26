import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { updateDriverLocation } from '../services/tracking';

export const useLocationTracking = (driverId, isActive = true, orderId = null) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isActive || !driverId) return;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission denied');
        return;
      }

      const updateLocation = async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          await updateDriverLocation(
            driverId,
            location.coords.latitude,
            location.coords.longitude,
            orderId
          );
        } catch (error) {
          console.error('Failed to update location:', error);
        }
      };

      updateLocation();
      intervalRef.current = setInterval(updateLocation, 15000);
    };

    startTracking();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [driverId, isActive, orderId]);
};
