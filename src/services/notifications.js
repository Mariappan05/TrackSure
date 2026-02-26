import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
};

// Show local notification
export const showLocalNotification = async (title, body, data = {}) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Show immediately
  });
};

// Subscribe to order changes for drivers
export const subscribeToDriverOrders = (driverId, onNotification) => {
  const channel = supabase
    .channel('driver-orders')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => {
        showLocalNotification(
          '📦 New Order Assigned!',
          `You have a new delivery order. Distance: ${payload.new.planned_distance}km`,
          { orderId: payload.new.id, type: 'new_order' }
        );
        onNotification?.({ type: 'new_order', data: payload.new });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => {
        if (payload.new.status === 'assigned' && payload.old.status === 'pending') {
          showLocalNotification(
            '✅ Order Confirmed',
            'Your order acceptance has been confirmed',
            { orderId: payload.new.id, type: 'order_confirmed' }
          );
        }
        onNotification?.({ type: 'order_updated', data: payload.new });
      }
    )
    .subscribe();

  return channel;
};

// Subscribe to order changes for admins
export const subscribeToAdminOrders = (onNotification) => {
  const channel = supabase
    .channel('admin-orders')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        // Order accepted by driver
        if (payload.new.status === 'assigned' && payload.old.status === 'pending') {
          showLocalNotification(
            '✅ Order Accepted',
            `Driver accepted order #${payload.new.id.substring(0, 8)}`,
            { orderId: payload.new.id, type: 'order_accepted' }
          );
          onNotification?.({ type: 'order_accepted', data: payload.new });
        }
        
        // Order completed
        if (payload.new.status === 'delivered' && payload.old.status === 'assigned') {
          showLocalNotification(
            '🎉 Order Completed!',
            `Order #${payload.new.id.substring(0, 8)} has been delivered successfully`,
            { orderId: payload.new.id, type: 'order_completed' }
          );
          onNotification?.({ type: 'order_completed', data: payload.new });
        }
      }
    )
    .subscribe();

  return channel;
};

// Unsubscribe from notifications
export const unsubscribeFromNotifications = (channel) => {
  if (channel) {
    supabase.removeChannel(channel);
  }
};
