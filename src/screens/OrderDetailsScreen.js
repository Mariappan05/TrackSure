import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Linking } from 'react-native';
import { useTheme } from '../utils/ThemeContext';
import { supabase } from '../services/supabase';
import { reverseGeocode } from '../utils/geocoding';
import { getCurrentUser } from '../services/auth';
import { startOrderTracking } from '../services/fuelMonitoring';
import { generateBill } from '../services/billGenerator';

export default function OrderDetailsScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { order } = route.params;
  const [deliveryProof, setDeliveryProof] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [driverName, setDriverName] = useState('Unassigned');
  const [currentUser, setCurrentUser] = useState(null);
  const [downloadingBill, setDownloadingBill] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState({ actualDistance: 0, actualFuel: 0 });
  const [testMode, setTestMode] = useState(false);

  const simulateMovement = async () => {
    const testLocations = [
      { lat: order.pickup_lat + 0.001, lng: order.pickup_lng + 0.001 },
      { lat: order.pickup_lat + 0.002, lng: order.pickup_lng + 0.002 },
      { lat: order.pickup_lat + 0.003, lng: order.pickup_lng + 0.003 },
      { lat: order.pickup_lat + 0.004, lng: order.pickup_lng + 0.004 },
      { lat: order.pickup_lat + 0.005, lng: order.pickup_lng + 0.005 },
    ];
    
    for (const loc of testLocations) {
      await supabase.from('driver_locations').insert({
        driver_id: order.driver_id,
        order_id: order.id,
        latitude: loc.lat,
        longitude: loc.lng,
        recorded_at: new Date().toISOString()
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setTestMode(false);
  };

  useEffect(() => {
    loadUserAndDriverInfo();
    if (order.status === 'delivered') {
      loadDeliveryProof();
    } else if (order.status === 'assigned') {
      const interval = setInterval(() => {
        updateLiveMetrics();
      }, 15000);
      updateLiveMetrics();
      
      const subscription = supabase
        .channel(`order-${order.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload) => {
          if (payload.new.actual_distance || payload.new.fuel_consumed_liters) {
            setLiveMetrics({
              actualDistance: payload.new.actual_distance || 0,
              actualFuel: payload.new.fuel_consumed_liters || 0
            });
          }
        })
        .subscribe();
      
      return () => {
        clearInterval(interval);
        subscription.unsubscribe();
      };
    }
  }, []);

  const updateLiveMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('latitude, longitude')
        .eq('order_id', order.id)
        .order('recorded_at', { ascending: true });
      
      if (error || !data || data.length < 2) return;
      
      let totalDistance = 0;
      for (let i = 1; i < data.length; i++) {
        const R = 6371;
        const dLat = (data[i].latitude - data[i-1].latitude) * Math.PI / 180;
        const dLon = (data[i].longitude - data[i-1].longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(data[i-1].latitude * Math.PI / 180) * Math.cos(data[i].latitude * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        totalDistance += R * c;
      }
      
      const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
      const kmPerLiter = fuelRates[order.vehicle_type] || 15;
      const estimatedFuel = totalDistance / kmPerLiter;
      
      setLiveMetrics({
        actualDistance: parseFloat(totalDistance.toFixed(2)),
        actualFuel: parseFloat(estimatedFuel.toFixed(2))
      });
    } catch (error) {
      console.error('Live metrics update error:', error);
    }
  };

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
        .order('delivered_at', { ascending: false })
        .limit(1)
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
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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
          <Text style={[styles.label, { color: theme.textSecondary }]}>📏 Distance & Time</Text>
          {order.status === 'assigned' && (
            <TouchableOpacity 
              style={[styles.testButton, { backgroundColor: theme.primaryBlue }]}
              onPress={() => { setTestMode(true); simulateMovement(); }}
              disabled={testMode}
            >
              <Text style={[styles.testButtonText, { color: theme.white }]}>
                {testMode ? '⏳ Simulating...' : '🧪 Test Live Updates'}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.distanceRow}>
            <View style={styles.distanceItem}>
              <Text style={[styles.distanceLabel, { color: theme.textSecondary }]}>Estimated Distance</Text>
              <Text style={[styles.value, { color: theme.textPrimary }]}>{order.planned_distance} km</Text>
            </View>
            {(order.status === 'assigned' || order.actual_distance > 0 || liveMetrics.actualDistance > 0) && (
              <View style={styles.distanceItem}>
                <Text style={[styles.distanceLabel, { color: theme.textSecondary }]}>Actual Distance {order.status === 'assigned' && '🔴'}</Text>
                <Text style={[styles.value, { color: (order.actual_distance || liveMetrics.actualDistance) > order.planned_distance * 1.2 ? theme.error : theme.secondaryGreen }]}>
                  {order.actual_distance || liveMetrics.actualDistance} km
                </Text>
              </View>
            )}
            {order.travel_time_minutes > 0 && (
              <View style={styles.distanceItem}>
                <Text style={[styles.distanceLabel, { color: theme.textSecondary }]}>Time</Text>
                <Text style={[styles.value, { color: theme.textPrimary }]}>{order.travel_time_minutes} min</Text>
              </View>
            )}
          </View>
          <View style={styles.distanceRow}>
            <View style={styles.distanceItem}>
              <Text style={[styles.distanceLabel, { color: theme.textSecondary }]}>Estimated Fuel</Text>
              <Text style={[styles.value, { color: theme.textPrimary }]}>
                {(() => {
                  const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
                  const kmPerLiter = fuelRates[order.vehicle_type] || 15;
                  return (order.planned_distance / kmPerLiter).toFixed(2);
                })()} L
              </Text>
            </View>
            <View style={styles.distanceItem}>
              <Text style={[styles.distanceLabel, { color: theme.textSecondary }]}>Actual Fuel {order.status === 'assigned' && '🔴'}</Text>
              <Text style={[styles.value, { color: (() => {
                const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
                const kmPerLiter = fuelRates[order.vehicle_type] || 15;
                const estimatedFuel = order.planned_distance / kmPerLiter;
                let actualFuel = 0;
                if (order.fuel_consumed_liters) {
                  actualFuel = parseFloat(order.fuel_consumed_liters);
                } else if (liveMetrics.actualFuel > 0) {
                  actualFuel = liveMetrics.actualFuel;
                } else if (order.actual_distance > 0) {
                  actualFuel = order.actual_distance / kmPerLiter;
                }
                return actualFuel > estimatedFuel ? theme.error : theme.secondaryGreen;
              })() }]}>
                {(() => {
                  if (order.fuel_consumed_liters) {
                    return parseFloat(order.fuel_consumed_liters).toFixed(2);
                  }
                  if (liveMetrics.actualFuel > 0) {
                    return liveMetrics.actualFuel.toFixed(2);
                  }
                  if (order.actual_distance > 0) {
                    const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
                    const kmPerLiter = fuelRates[order.vehicle_type] || 15;
                    return (order.actual_distance / kmPerLiter).toFixed(2);
                  }
                  return '0.00';
                })()} L
              </Text>
            </View>
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
            <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>📊 Performance Comparison</Text>
              
              {/* Distance Comparison */}
              <View style={styles.comparisonRow}>
                <View style={styles.comparisonItem}>
                  <Text style={[styles.comparisonLabel, { color: theme.textSecondary }]}>Distance</Text>
                  <View style={styles.comparisonValues}>
                    <View style={styles.comparisonValue}>
                      <Text style={[styles.comparisonType, { color: theme.textSecondary }]}>Estimated</Text>
                      <Text style={[styles.comparisonNumber, { color: theme.primaryBlue }]}>{order.planned_distance} km</Text>
                    </View>
                    <Text style={[styles.comparisonArrow, { color: theme.textSecondary }]}>→</Text>
                    <View style={styles.comparisonValue}>
                      <Text style={[styles.comparisonType, { color: theme.textSecondary }]}>Actual</Text>
                      <Text style={[styles.comparisonNumber, { 
                        color: order.actual_distance > order.planned_distance * 1.2 ? theme.error : theme.secondaryGreen 
                      }]}>{order.actual_distance || 0} km</Text>
                    </View>
                  </View>
                  {order.actual_distance > 0 && (
                    <Text style={[styles.comparisonDiff, { 
                      color: order.actual_distance > order.planned_distance ? theme.error : theme.secondaryGreen 
                    }]}>
                      {order.actual_distance > order.planned_distance ? '+' : ''}
                      {(order.actual_distance - order.planned_distance).toFixed(2)} km 
                      ({((order.actual_distance - order.planned_distance) / order.planned_distance * 100).toFixed(1)}%)
                    </Text>
                  )}
                </View>
              </View>

              {/* Fuel Comparison */}
              {(order.fuel_consumed_liters > 0 || order.actual_distance > 0) && (
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: theme.textSecondary }]}>Fuel Consumption</Text>
                    <View style={styles.comparisonValues}>
                      <View style={styles.comparisonValue}>
                        <Text style={[styles.comparisonType, { color: theme.textSecondary }]}>Estimated</Text>
                        <Text style={[styles.comparisonNumber, { color: theme.primaryBlue }]}>
                          {(() => {
                            const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
                            const kmPerLiter = fuelRates[order.vehicle_type] || 15;
                            return (order.planned_distance / kmPerLiter).toFixed(2);
                          })()} L
                        </Text>
                      </View>
                      <Text style={[styles.comparisonArrow, { color: theme.textSecondary }]}>→</Text>
                      <View style={styles.comparisonValue}>
                        <Text style={[styles.comparisonType, { color: theme.textSecondary }]}>Actual</Text>
                        <Text style={[styles.comparisonNumber, { 
                          color: (() => {
                            const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
                            const kmPerLiter = fuelRates[order.vehicle_type] || 15;
                            const estimatedFuel = order.planned_distance / kmPerLiter;
                            const actualFuel = order.fuel_consumed_liters || (order.actual_distance / kmPerLiter);
                            return actualFuel > estimatedFuel ? theme.error : theme.secondaryGreen;
                          })()
                        }]}>{order.fuel_consumed_liters || (order.actual_distance / (() => {
                          const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
                          return fuelRates[order.vehicle_type] || 15;
                        })()).toFixed(2)} L</Text>
                      </View>
                    </View>
                    <Text style={[styles.comparisonDiff, { 
                      color: (() => {
                        const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
                        const kmPerLiter = fuelRates[order.vehicle_type] || 15;
                        const estimatedFuel = order.planned_distance / kmPerLiter;
                        const actualFuel = order.fuel_consumed_liters || (order.actual_distance / kmPerLiter);
                        return actualFuel > estimatedFuel ? theme.error : theme.secondaryGreen;
                      })()
                    }]}>
                      {(() => {
                        const fuelRates = { bike: 40, car: 15, van: 10, truck: 6 };
                        const kmPerLiter = fuelRates[order.vehicle_type] || 15;
                        const estimatedFuel = order.planned_distance / kmPerLiter;
                        const actualFuel = order.fuel_consumed_liters || (order.actual_distance / kmPerLiter);
                        const diff = actualFuel - estimatedFuel;
                        return `${diff > 0 ? '+' : ''}${diff.toFixed(2)} L (${((diff / estimatedFuel) * 100).toFixed(1)}%)`;
                      })()
                      }
                    </Text>
                  </View>
                </View>
              )}

              {/* Time Comparison */}
              {order.travel_time_minutes > 0 && order.started_at && order.completed_at && (
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: theme.textSecondary }]}>Delivery Time</Text>
                    <View style={styles.comparisonValues}>
                      <View style={styles.comparisonValue}>
                        <Text style={[styles.comparisonType, { color: theme.textSecondary }]}>Started</Text>
                        <Text style={[styles.comparisonNumber, { color: theme.primaryBlue }]}>{formatDate(order.started_at)}</Text>
                      </View>
                      <Text style={[styles.comparisonArrow, { color: theme.textSecondary }]}>→</Text>
                      <View style={styles.comparisonValue}>
                        <Text style={[styles.comparisonType, { color: theme.textSecondary }]}>Completed</Text>
                        <Text style={[styles.comparisonNumber, { color: theme.secondaryGreen }]}>{formatDate(order.completed_at)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.comparisonDiff, { color: theme.textPrimary }]}>
                      Total: {order.travel_time_minutes} minutes
                    </Text>
                  </View>
                </View>
              )}
            </View>

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

                {currentUser?.role === 'admin' && (
                  <TouchableOpacity 
                    style={[styles.downloadButton, { backgroundColor: theme.primaryBlue }]}
                    onPress={async () => {
                      setDownloadingBill(true);
                      try {
                        await generateBill(order, deliveryProof);
                      } catch (error) {
                        console.error('Download bill error:', error);
                      } finally {
                        setDownloadingBill(false);
                      }
                    }}
                    disabled={downloadingBill}
                  >
                    {downloadingBill ? (
                      <ActivityIndicator color={theme.white} size="small" />
                    ) : (
                      <Text style={[styles.downloadButtonText, { color: theme.white }]}>💾 Download Invoice</Text>
                    )}
                  </TouchableOpacity>
                )}
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
            onPress={async () => {
              try {
                await startOrderTracking(order.id);
                navigation.navigate('DeliveryProof', { order });
              } catch (error) {
                console.error('Start delivery error:', error);
              }
            }}
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
  fuelInfo: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  fuelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  comparisonRow: {
    marginBottom: 16,
  },
  comparisonItem: {
    gap: 8,
  },
  comparisonLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  comparisonValues: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comparisonValue: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonType: {
    fontSize: 11,
    marginBottom: 4,
  },
  comparisonNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  comparisonArrow: {
    fontSize: 20,
    marginHorizontal: 8,
  },
  comparisonDiff: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  downloadButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  testButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
