import { supabase } from './supabase';

export const getDriverOrders = async (driverId) => {
  console.log('Fetching orders for driver:', driverId);
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Get driver orders error:', error);
    throw error;
  }
  console.log('Driver orders fetched:', data?.length, 'orders');
  return data;
};

export const updateOrderStatus = async (orderId, status) => {
  console.log('Updating order status:', { orderId, status });
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);
  
  if (error) {
    console.error('Update order status error:', error);
    throw error;
  }
  console.log('Order status updated successfully');
};
