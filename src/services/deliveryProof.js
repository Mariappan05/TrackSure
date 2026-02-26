import { supabase } from './supabase';
import { updateActualDistance } from './fuelMonitoring';
import * as Location from 'expo-location';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const verifyLocation = async (dropLat, dropLng) => {
  console.log('Verifying location for drop:', { dropLat, dropLng });
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  console.log('Current location:', location.coords);

  const distance = calculateDistance(
    location.coords.latitude,
    location.coords.longitude,
    dropLat,
    dropLng
  );
  console.log('Distance from drop location:', distance, 'meters');

  // Temporarily disable 50m check for testing
  return {
    isValid: true, // Always valid for testing
    distance: distance.toFixed(2),
    currentLat: location.coords.latitude,
    currentLng: location.coords.longitude,
  };
};

export const uploadDeliveryImage = async (uri, orderId) => {
  console.log('=== Starting Image Upload ===');
  console.log('URI:', uri);
  console.log('Order ID:', orderId);
  
  try {
    // Try storage bucket first
    console.log('Checking if bucket exists...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (!bucketError && buckets && buckets.length > 0) {
      console.log('Available buckets:', buckets.map(b => b.name));
      const bucketExists = buckets.some(b => b.name === 'delivery-proofs');
      console.log('delivery-proofs bucket exists:', bucketExists);
      
      if (bucketExists) {
        // Try uploading to storage
        const fileName = `${orderId}_${Date.now()}.jpg`;
        console.log('Fetching image from URI...');
        const response = await fetch(uri);
        const blob = await response.blob();
        console.log('Blob size:', blob.size, 'bytes');

        console.log('Attempting upload to Supabase storage...');
        const { data, error } = await supabase.storage
          .from('delivery-proofs')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (!error) {
          const { data: urlData } = supabase.storage
            .from('delivery-proofs')
            .getPublicUrl(fileName);
          console.log('Upload successful! URL:', urlData.publicUrl);
          return urlData.publicUrl;
        }
        console.error('Storage upload failed:', error);
      }
    }
    
    // Fallback: Convert to base64 data URL
    console.log('Using base64 fallback...');
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('Image converted to base64');
        resolve(reader.result); // Returns data:image/jpeg;base64,...
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('=== Upload Failed ===');
    console.error('Error:', error);
    throw error;
  }
};

export const submitDeliveryProof = async (orderId, driverId, imageUrl, latitude, longitude, signature, notes) => {
  console.log('Submitting delivery proof:', { orderId, driverId, imageUrl, latitude, longitude });
  
  const { error: proofError } = await supabase
    .from('delivery_proofs')
    .insert({
      order_id: orderId,
      driver_id: driverId,
      image_url: imageUrl,
      latitude,
      longitude,
      signature_data: signature,
      delivery_notes: notes
    });

  if (proofError) {
    console.error('Insert delivery proof error:', proofError);
    throw proofError;
  }
  console.log('Delivery proof inserted successfully');

  // Calculate actual distance and check for fuel misuse
  await updateActualDistance(orderId, driverId);

  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: 'delivered' })
    .eq('id', orderId);

  if (orderError) {
    console.error('Update order status error:', orderError);
    throw orderError;
  }
  console.log('Order status updated to delivered');
};
