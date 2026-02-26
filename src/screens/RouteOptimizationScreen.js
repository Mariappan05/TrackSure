import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import { optimizeMultiStopRoute } from '../services/routeOptimization';
import { useTheme } from '../utils/ThemeContext';

export default function RouteOptimizationScreen({ navigation }) {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [orders, setOrders] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    loadDriversWithOrders();
  }, []);

  const loadDriversWithOrders = async () => {
    try {
      const { data: driversData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'driver');

      const driversWithOrders = await Promise.all(
        driversData.map(async (driver) => {
          const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .eq('driver_id', driver.id)
            .in('status', ['pending', 'assigned'])
            .order('created_at', { ascending: true });

          return {
            ...driver,
            orderCount: ordersData?.length || 0,
            orders: ordersData || []
          };
        })
      );

      setDrivers(driversWithOrders.filter(d => d.orderCount > 1));
    } catch (error) {
      console.error('Failed to load drivers:', error);
    }
  };

  const handleOptimize = async (driver) => {
    setLoading(true);
    setSelectedDriver(driver);
    setOrders(driver.orders);

    try {
      // Use first order pickup as start location
      const startLocation = {
        lat: parseFloat(driver.orders[0].pickup_lat),
        lng: parseFloat(driver.orders[0].pickup_lng)
      };

      const result = await optimizeMultiStopRoute(startLocation, driver.orders);
      setOptimizedRoute(result);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyOptimization = async () => {
    if (!optimizedRoute || !selectedDriver) return;

    setLoading(true);
    try {
      // Update order sequences in database
      await Promise.all(
        optimizedRoute.optimizedOrder.map((order) =>
          supabase
            .from('orders')
            .update({ sequence: order.sequence })
            .eq('id', order.id)
        )
      );

      alert('Route optimized successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Failed to apply optimization:', error);
      alert('Failed to apply optimization');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !optimizedRoute) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primaryBlue} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primaryBlue }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.white }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.white }]}>Route Optimization</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {!optimizedRoute ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Select Driver with Multiple Orders
            </Text>

            {drivers.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No drivers with multiple orders found
              </Text>
            ) : (
              drivers.map((driver) => (
                <TouchableOpacity
                  key={driver.id}
                  style={[styles.driverCard, { backgroundColor: theme.cardBackground }]}
                  onPress={() => handleOptimize(driver)}
                >
                  <View style={styles.driverInfo}>
                    <Text style={[styles.driverName, { color: theme.textPrimary }]}>
                      {driver.full_name}
                    </Text>
                    <Text style={[styles.orderCount, { color: theme.textSecondary }]}>
                      {driver.orderCount} orders
                    </Text>
                  </View>
                  <Text style={[styles.optimizeText, { color: theme.primaryBlue }]}>
                    Optimize →
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            <View style={[styles.savingsCard, { backgroundColor: theme.secondaryGreen }]}>
              <Text style={[styles.savingsTitle, { color: theme.white }]}>
                Optimization Results
              </Text>
              <Text style={[styles.savingsValue, { color: theme.white }]}>
                Save {optimizedRoute.savings?.distanceSaved || 0} km
              </Text>
              <Text style={[styles.savingsSubtext, { color: theme.white }]}>
                {optimizedRoute.savings?.percentSaved || 0}% reduction • ~{optimizedRoute.savings?.timeSaved || 0} min faster
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              Optimized Delivery Sequence
            </Text>

            {optimizedRoute.optimizedOrder.map((order, index) => (
              <View
                key={order.id}
                style={[styles.orderCard, { backgroundColor: theme.cardBackground }]}
              >
                <View style={styles.sequenceContainer}>
                  <View style={[styles.sequenceBadge, { backgroundColor: theme.primaryBlue }]}>
                    <Text style={[styles.sequenceText, { color: theme.white }]}>
                      {order.sequence}
                    </Text>
                  </View>
                  {order.originalSequence !== order.sequence && (
                    <Text style={[styles.originalSequence, { color: theme.textSecondary }]}>
                      was #{order.originalSequence}
                    </Text>
                  )}
                </View>
                <View style={styles.orderInfo}>
                  <Text style={[styles.orderAddress, { color: theme.textPrimary }]}>
                    📍 {order.pickup_address}
                  </Text>
                  <Text style={[styles.orderAddress, { color: theme.textPrimary }]}>
                    🎯 {order.drop_address}
                  </Text>
                  <Text style={[styles.orderDistance, { color: theme.primaryBlue }]}>
                    {order.planned_distance} km
                  </Text>
                </View>
              </View>
            ))}

            <View style={[styles.totalCard, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
                Total Distance
              </Text>
              <Text style={[styles.totalValue, { color: theme.primaryBlue }]}>
                {optimizedRoute.totalDistance} km
              </Text>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
                Estimated Time
              </Text>
              <Text style={[styles.totalValue, { color: theme.primaryBlue }]}>
                {optimizedRoute.totalDuration} min
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: theme.secondaryGreen }]}
              onPress={applyOptimization}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <Text style={[styles.applyButtonText, { color: theme.white }]}>
                  Apply Optimization
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  driverCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderCount: {
    fontSize: 12,
    marginTop: 4,
  },
  optimizeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  savingsCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  savingsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  savingsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  savingsSubtext: {
    fontSize: 12,
  },
  orderCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sequenceContainer: {
    marginRight: 12,
    alignItems: 'center',
  },
  sequenceBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sequenceText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  originalSequence: {
    fontSize: 10,
    marginTop: 4,
  },
  orderInfo: {
    flex: 1,
  },
  orderAddress: {
    fontSize: 13,
    marginBottom: 4,
  },
  orderDistance: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  totalCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 12,
    marginTop: 8,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  applyButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 14,
  },
});
