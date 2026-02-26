import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Linking } from 'react-native';
import { useTheme } from '../utils/ThemeContext';
import { supabase } from '../services/supabase';
import { reverseGeocode } from '../utils/geocoding';
import { getCurrentUser } from '../services/auth';

export default function OrderDetailsScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { order } = route.params;
  const [deliveryProof, setDeliveryProof] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [driverName, setDriverName] = useState('Unassigned');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadUserAndDriverInfo();
    if (order.status === 'delivered') {
      loadDeliveryProof();
    }
  }, []);

  const loadUserAndDriverInfo = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
    
    if (order.driver_id) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', order.driver_id)
          .single();
        
        if (!error && data) {
          setDriverName(data.full_name);
        }
      } catch (error) {
        console.error('Failed to load driver info:', error);
      }
    }
  };

  const loadDeliveryProof = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_proofs')
        .select('*')
        .eq('order_id', order.id)
        .single();

      if (error) throw error;
      setDeliveryProof(data);
      console.log('Delivery proof loaded:', data);
      
      if (data.latitude && data.longitude) {
        const address = await reverseGeocode(parseFloat(data.latitude), parseFloat(data.longitude));
        setDeliveryAddress(address);
      }
    } catch (error) {
      console.error('Failed to load delivery proof:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primaryBlue }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.white }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.white }]}>Order Details</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Status</Text>
          <View style={[styles.statusBadge, styles[order.status]]}>
            <Text style={[styles.statusText, { color: theme.white }]}>{order.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>👤 Driver</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>{driverName}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>📍 Pickup Address</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>{order.pickup_address}</Text>
          <Text style={[styles.coordinates, { color: theme.textSecondary }]}>
            {order.pickup_lat}, {order.pickup_lng}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>🎯 Drop Address</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>{order.drop_address}</Text>
          <Text style={[styles.coordinates, { color: theme.textSecondary }]}>
            {order.drop_lat}, {order.drop_lng}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.routeButton, { backgroundColor: theme.primaryBlue }]}
          onPress={() => {
            const url = `https://www.google.com/maps/dir/?api=1&origin=${order.pickup_lat},${order.pickup_lng}&destination=${order.drop_lat},${order.drop_lng}&travelmode=driving`;
            Linking.openURL(url);
          }}
        >
          <Text style={[styles.routeButtonText, { color: theme.white }]}>🗺️ View Route in Google Maps</Text>
        </TouchableOpacity>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>📏 Distance</Text>
          <View style={styles.distanceRow}>
            <View style={styles.distanceItem}>
              <Text style={[styles.distanceLabel, { color: theme.textSecondary }]}>Planned</Text>
              <Text style={[styles.value, { color: theme.textPrimary }]}>{order.planned_distance} km</Text>
            </View>
            {order.actual_distance > 0 && (
              <View style={styles.distanceItem}>
                <Text style={[styles.distanceLabel, { color: theme.textSecondary }]}>Actual</Text>
                <Text style={[styles.value, { color: order.actual_distance > order.planned_distance * 1.2 ? theme.error : theme.secondaryGreen }]}>
                  {order.actual_distance} km
                </Text>
              </View>
            )}
          </View>
          {order.is_flagged && (
            <View style={[styles.flagAlert, { backgroundColor: theme.error }]}>
              <Text style={[styles.flagAlertText, { color: theme.white }]}>⚠ {order.flag_reason}</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>📅 Created At</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {formatDate(order.created_at)}
          </Text>
        </View>

        {order.status === 'delivered' && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>📸 Delivery Proof</Text>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primaryBlue} />
              </View>
            ) : deliveryProof ? (
              <>
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>📷 Delivery Photo</Text>
                  {deliveryProof.image_url ? (
                    deliveryProof.image_url.includes('placeholder') || deliveryProof.image_url.includes('via.placeholder') ? (
                      <View style={[styles.placeholderImage, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>📷 Photo upload failed</Text>
                        <Text style={[styles.placeholderSubtext, { color: theme.textSecondary }]}>Image was not uploaded to storage</Text>
                      </View>
                    ) : (
                      <Image 
                        source={{ uri: deliveryProof.image_url }} 
                        style={styles.proofImage}
                        resizeMode="cover"
                      />
                    )
                  ) : (
                    <View style={[styles.placeholderImage, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>📷 No photo available</Text>
                    </View>
                  )}
                </View>

                {deliveryProof.signature_data && (
                  <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>✍️ Customer Signature</Text>
                    <Image 
                      source={{ uri: deliveryProof.signature_data }} 
                      style={styles.signatureImage}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {deliveryProof.delivery_notes && (
                  <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>📝 Delivery Notes</Text>
                    <Text style={[styles.value, { color: theme.textPrimary }]}>{deliveryProof.delivery_notes}</Text>
                  </View>
                )}

                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>📍 Delivery Location</Text>
                  <Text style={[styles.value, { color: theme.textPrimary }]}>
                    {deliveryAddress || 'Loading address...'}
                  </Text>
                  <Text style={[styles.coordinates, { color: theme.textSecondary }]}>
                    {parseFloat(deliveryProof.latitude).toFixed(6)}, {parseFloat(deliveryProof.longitude).toFixed(6)}
                  </Text>
                </View>

                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>⏰ Delivered At</Text>
                  <Text style={[styles.value, { color: theme.textPrimary }]}>
                    {formatDate(deliveryProof.delivered_at)}
                  </Text>
                </View>

                <View style={[styles.successCard, { backgroundColor: theme.secondaryGreen }]}>
                  <Text style={[styles.successIcon, { color: theme.white }]}>✓</Text>
                  <Text style={[styles.successText, { color: theme.white }]}>Delivery Completed Successfully</Text>
                </View>
              </>
            ) : (
              <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.noProofText, { color: theme.textSecondary }]}>No delivery proof available</Text>
              </View>
            )}
          </>
        )}

        {order.status === 'assigned' && currentUser?.role === 'driver' && currentUser?.id === order.driver_id && (
          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: theme.secondaryGreen }]}
            onPress={() => navigation.navigate('DeliveryProof', { order })}
          >
            <Text style={[styles.startButtonText, { color: theme.white }]}>Start Delivery</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 24,
  },
  content: {
    padding: 20,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  coordinates: {
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pending: {
    backgroundColor: '#F59E0B',
  },
  assigned: {
    backgroundColor: '#3B82F6',
  },
  delivered: {
    backgroundColor: '#10B981',
  },
  divider: {
    height: 2,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  proofImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#E5E7EB',
  },
  signatureImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  placeholderImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
  },
  placeholderSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  successCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  noProofText: {
    fontSize: 14,
    textAlign: 'center',
  },
  startButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  routeButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  routeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  distanceRow: {
    flexDirection: 'row',
    gap: 20,
  },
  distanceItem: {
    flex: 1,
  },
  distanceLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  flagAlert: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  flagAlertText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
