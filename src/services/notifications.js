import { supabase } from './supabase';
import { Platform } from 'react-native';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
  // Configure notification behavior
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (error) {
  console.log('Notifications module not available, running without notifications');
}

// Request notification permissions
export const requestNotificationPermissions = async () => {
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  } catch (error) {
    console.log('Permission request failed:', error);
    return false;
  }
};

// Show local notification
export const showLocalNotification = async (title, body, data = {}) => {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.log('Failed to show notification:', error);
  }
};

// Subscribe to order changes for drivers
export const subscribeToDriverOrders = (driverId, onNotification) => {
  console.log('Subscribing to driver orders for:', driverId);
  
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
        console.log('New order INSERT detected:', payload);
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
        console.log('Order UPDATE detected:', payload);
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
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });

  return channel;
};

// Subscribe to order changes for admins
export const subscribeToAdminOrders = (ordersMapRef) => {
  const channel = supabase
    .channel('admin-orders-realtime')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        const oldStatus = ordersMapRef.current[payload.new.id];
        const newStatus = payload.new.status;
        
        if (oldStatus === 'pending' && newStatus === 'assigned') {
          showLocalNotification(
            '✅ Order Accepted',
            'Driver has accepted a delivery order',
            { orderId: payload.new.id, type: 'order_accepted' }
          );
        }
        
        if (oldStatus === 'assigned' && newStatus === 'delivered') {
          showLocalNotification(
            '🎉 Order Completed!',
            'A delivery has been completed successfully',
            { orderId: payload.new.id, type: 'order_completed' }
          );
        }
        
        ordersMapRef.current[payload.new.id] = newStatus;
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
