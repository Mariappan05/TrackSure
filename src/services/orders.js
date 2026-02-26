import { supabase } from './supabase';

export const createOrder = async (orderData) => {
  console.log('Creating order with data:', orderData);
  const { data, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();
  
  if (error) {
    console.error('Create order error:', error);
    throw error;
  }
  console.log('Order created successfully:', data);
  return data;
};

export const getDrivers = async () => {
  console.log('Fetching drivers...');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'driver');
  
  if (error) {
    console.error('Get drivers error:', error);
    throw error;
  }
  console.log('Drivers fetched:', data);
  return data;
};

export const getOrders = async () => {
  console.log('Fetching orders...');
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      driver:profiles(full_name)
    `)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Get orders error:', error);
    throw error;
  }
  console.log('Orders fetched:', data?.length, 'orders');
  return data;
};
