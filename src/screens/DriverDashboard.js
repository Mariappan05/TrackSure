import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { getDriverOrders } from '../services/driverOrders';
import { getCurrentUser, signOut } from '../services/auth';
import { useLocationTracking } from '../utils/useLocationTracking';
import { useTheme } from '../utils/ThemeContext';
import { supabase } from '../services/supabase';
import { Toast } from '../utils/Toast';
import { findOrdersAlongRoute } from '../services/enRouteMatching';
import { CustomAlert } from '../utils/CustomAlert';
import { subscribeToDriverOrders, requestNotificationPermissions, unsubscribeFromNotifications } from '../services/notifications';

export default function DriverDashboard({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [user, setUser] = useState(null);
  const { theme } = useTheme();
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', buttons: [] });
  const [notificationChannel, setNotificationChannel] = useState(null);

  // Get current assigned order ID for location tracking
  const currentOrderId = orders.find(o => o.status === 'assigned')?.id || null;
  // Only track location when there's an active assigned order (not delivered)
  useLocationTracking(user?.id, !!currentOrderId, currentOrderId);

  useEffect(() => {
    loadUser();
    requestNotificationPermissions();
    
    return () => {
      if (notificationChannel) {
        unsubscribeFromNotifications(notificationChannel);
      }
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      console.log('Setting up notifications for driver:', user.id);
      const channel = subscribeToDriverOrders(user.id, (notification) => {
        console.log('Notification received:', notification);
        if (notification.type === 'new_order') {
          loadOrders(user.id);
          setToast({ visible: true, message: 'New order assigned!', type: 'success' });
        }
      });
      setNotificationChannel(channel);
      console.log('Notification channel created');
    }
  }, [user]);

  const loadUser = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    loadOrders(currentUser.id);
  };

  const loadOrders = async (driverId) => {
    try {
      setLoadError(null);
      const data = await getDriverOrders(driverId);
      // Sort by sequence for optimized route display
      const sortedData = data.sort((a, b) => (a.sequence || 999) - (b.sequence || 999));
      setOrders(sortedData);
    } catch (error) {
      const msg = error?.message || '';
      if (msg.includes('525') || msg.includes('Network request failed')) {
        setLoadError('Connection issue (SSL/network). Please check your internet and retry.');
      } else {
        setLoadError('Failed to load orders. Tap Retry to try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      if (global.location) {
        global.location.reload();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const acceptOrder = async (orderId) => {
    try {
      const orderToAccept = orders.find(o => o.id === orderId);
      const recommendations = await findOrdersAlongRoute(orderToAccept, user.id);
      
      if (recommendations.length > 0) {
        const toShow = recommendations.slice(0, 3);
        const allOrders = [orderToAccept, ...toShow.map(r => r.order)];
        
        setAlertConfig({
          visible: true,
          title: '💡 Smart Route Recommendations',
          message: `Accept multiple orders along your route to maximize efficiency!`,
          orders: allOrders,
          buttons: [
            { 
              text: `Accept All (${allOrders.length})`, 
              onPress: async () => {
                await acceptMultipleOrders(allOrders.map(o => o.id));
              }
            },
            { 
              text: 'Just Main Order', 
              style: 'cancel',
              onPress: async () => {
                await acceptSingleOrder(orderId);
              }
            }
          ]
        });
      } else {
        setAlertConfig({
          visible: true,
          title: '📦 Accept Order?',
          message: null,
          orders: [orderToAccept],
          buttons: [
            { 
              text: 'Accept', 
              onPress: async () => {
                await acceptSingleOrder(orderId);
              }
            },
            { 
              text: 'Cancel', 
              style: 'cancel'
            }
          ]
        });
      }
    } catch (error) {
      console.error('Failed to accept order:', error);
      setToast({ visible: true, message: 'Failed to accept order', type: 'error' });
    }
  };

  const acceptSingleOrder = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'assigned' })
        .eq('id', orderId);
      
      if (error) throw error;
      
      setToast({ visible: true, message: 'Order accepted! Location tracking started.', type: 'success' });
      loadOrders(user.id);
    } catch (error) {
      throw error;
    }
  };

  const acceptMultipleOrders = async (orderIds) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'assigned' })
        .in('id', orderIds);
      
      if (error) throw error;
      
      setToast({ visible: true, message: `${orderIds.length} orders accepted! Route optimized.`, type: 'success' });
      loadOrders(user.id);
    } catch (error) {
      console.error('Failed to accept orders:', error);
      setToast({ visible: true, message: 'Failed to accept orders', type: 'error' });
    }
  };

  const renderOrder = ({ item }) => (
    <TouchableOpacity 
      style={[styles.orderCard, { backgroundColor: theme.cardBackground }, item.status === 'assigned' && { backgroundColor: theme.lightBlue }]}
      onPress={() => navigation.navigate('OrderDetails', { order: item })}
    >
      <View style={styles.orderHeader}>
        {item.sequence && item.sequence > 1 && (
          <View style={[styles.sequenceBadge, { backgroundColor: theme.primaryBlue }]}>
            <Text style={[styles.sequenceText, { color: theme.white }]}>#{item.sequence}</Text>
          </View>
        )}
        <View style={[styles.statusBadge, styles[item.status]]}>
          <Text style={[styles.statusText, { color: theme.white }]}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.detailsSection}>
        <View style={styles.addressContainer}>
          <Text style={[styles.addressLabel, { color: theme.textSecondary }]}>📍 Pickup</Text>
          <Text style={[styles.addressText, { color: theme.textPrimary }]} numberOfLines={2}>{item.pickup_address}</Text>
        </View>
        
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        
        <View style={styles.addressContainer}>
          <Text style={[styles.addressLabel, { color: theme.textSecondary }]}>🎯 Drop</Text>
          <Text style={[styles.addressText, { color: theme.textPrimary }]} numberOfLines={2}>{item.drop_address}</Text>
        </View>
      </View>
      
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>📏 Distance</Text>
          <Text style={[styles.metaValue, { color: theme.primaryBlue }]}>{item.planned_distance} km</Text>
        </View>
        {item.vehicle_type && (
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>🚗 Vehicle</Text>
            <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{item.vehicle_type}</Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>📅 Created</Text>
          <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      
      {item.status === 'pending' && (
        <TouchableOpacity 
          style={[styles.acceptButton, { backgroundColor: theme.secondaryGreen }]}
          onPress={() => acceptOrder(item.id)}
        >
          <Text style={[styles.acceptButtonText, { color: theme.white }]}>Accept Order</Text>
        </TouchableOpacity>
      )}
      
      {item.status === 'assigned' && (
        <TouchableOpacity 
          style={[styles.startButton, { backgroundColor: theme.primaryBlue }]}
          onPress={() => navigation.navigate('OrderDetails', { order: item })}
        >
          <Text style={[styles.startButtonText, { color: theme.white }]}>View Details →</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundLight }]}>
        <ActivityIndicator size="large" color={theme.primaryBlue} />
        <Text style={{ color: theme.textSecondary, marginTop: 12, fontSize: 13 }}>Loading orders...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundLight }]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
          Could not load orders
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 24, paddingHorizontal: 32 }}>
          {loadError}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: theme.primaryBlue, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10 }}
          onPress={() => { setLoading(true); loadOrders(user?.id); }}
        >
          <Text style={{ color: theme.white, fontWeight: '700', fontSize: 15 }}>🔄 Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundLight }]}>
      <View style={[styles.header, { backgroundColor: theme.primaryBlueLight }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: theme.white }]}>My Orders</Text>
          <View style={styles.subtitleRow}>
            <Text style={[styles.subtitle, { color: theme.white }]}>{user?.fullName}</Text>
            {currentOrderId && (
              <View style={[styles.trackingIndicator, { backgroundColor: theme.secondaryGreen }]}>
                <View style={[styles.trackingDot, { backgroundColor: theme.white }]} />
                <Text style={[styles.trackingText, { color: theme.white }]}>LIVE</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: theme.white }]} 
          onPress={() => {
            console.log('Logout pressed');
            handleLogout();
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.logoutText, { color: theme.primaryBlue }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={() => loadOrders(user.id)}
        ListHeaderComponent={
          orders.length > 1 && orders.some(o => o.sequence > 1) ? (
            <View style={[styles.optimizationBanner, { backgroundColor: theme.secondaryGreen }]}>
              <Text style={[styles.bannerText, { color: theme.white }]}>
                🗺️ Route Optimized! Follow the sequence numbers for fastest delivery
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No orders assigned</Text>
        }
      />
      
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
      
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        orders={alertConfig.orders}
        buttons={alertConfig.buttons}
        onDismiss={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
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
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  subtitle: {
    fontSize: 14,
  },
  trackingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  trackingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trackingText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 20,
  },
  optimizationBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  orderCard: {
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sequenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sequenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pending: {
    backgroundColor: '#F59E0B',
  },
  assigned: {
    backgroundColor: '#2563EB',
  },
  delivered: {
    backgroundColor: '#10B981',
  },
  detailsSection: {
    marginBottom: 12,
  },
  addressContainer: {
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  acceptButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  startButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
  },
});
