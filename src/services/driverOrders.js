import { supabase } from './supabase';

// Retry a Supabase call up to `maxAttempts` times on transient network/SSL errors.
// Error 525 = Cloudflare SSL handshake failed (transient infrastructure hiccup).
const withRetry = async (fn, maxAttempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err?.message || '';
      const isTransient =
        msg.includes('525') ||
        msg.includes('Network request failed') ||
        msg.includes('fetch') ||
        msg.includes('timeout');
      if (!isTransient || attempt === maxAttempts) throw err;
      // Exponential backoff: 500ms, 1000ms, 2000ms ...
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
};

export const getDriverOrders = async (driverId) => {
  const { data, error } = await withRetry(() =>
    supabase
      .from('orders')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
  );

  if (error) throw error;
  return data;
};

export const updateOrderStatus = async (orderId, status) => {
  const { error } = await withRetry(() =>
    supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
  );

  if (error) throw error;
};
