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

export default function DriverDashboard({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [user, setUser] = useState(null);
  const { theme } = useTheme();
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', buttons: [] });

  // Get current assigned order ID for location tracking
  const currentOrderId = orders.find(o => o.status === 'assigned')?.id || null;
  // Only track location when there's an active assigned order (not delivered)
  useLocationTracking(user?.id, !!currentOrderId, currentOrderId);

  useEffect(() => {
    loadUser();
  }, []);

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
      // Find the order being accepted
      const orderToAccept = orders.find(o => o.id === orderId);
      
      // Check for orders along the route
      const recommendations = await findOrdersAlongRoute(orderToAccept, user.id);
      
      if (recommendations.length > 0) {
        // Show both return trips and on-the-way orders (up to 3 total)
        const toShow = recommendations.slice(0, 3);
        const hasReturnTrip = toShow.some(r => r.isReturnTrip);
        
        const message = toShow.map((rec, i) => {
          const type = rec.isReturnTrip ? '🔄 Return Trip' : '📍 On-the-Way';
          const detourText = rec.isReturnTrip 
            ? 'Perfect return trip!' 
            : `Only +${rec.totalDetour}km detour`;
          
          return `${i + 1}. ${type}\n` +
                 `   ${rec.order.drop_address.substring(0, 40)}...\n` +
                 `   ${detourText} • Save ${rec.savings.percentSaved}%`;
        }).join('\n\n');
        
        const title = hasReturnTrip 
          ? '🔄 Perfect Return Trip!' 
          : '💡 Smart Recommendation';
        
        setAlertConfig({
          visible: true,
          title: title,
          message: `You can also deliver these orders along your route:\n\n${message}`,
          buttons: [
            { 
              text: 'Accept All', 
              onPress: async () => {
                await acceptMultipleOrders([orderId, ...toShow.map(r => r.order.id)]);
              }
            },
            { 
              text: 'Just This One', 
              style: 'cancel',
              onPress: async () => {
                await acceptSingleOrder(orderId);
              }
            }
          ]
        });
      } else {
        // No recommendations, accept directly
        await acceptSingleOrder(orderId);
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
          <Text style={[styles.statusText, { color: theme.white }]}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.addressRow}>
        <Text style={styles.addressIcon}>📍</Text>
        <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={1}>{item.pickup_address}</Text>
      </View>
      <View style={styles.addressRow}>
        <Text style={styles.addressIcon}>🎯</Text>
        <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={1}>{item.drop_address}</Text>
      </View>
      <Text style={[styles.distance, { color: theme.primaryBlue }]}>{item.planned_distance} km</Text>
      {item.status === 'pending' && (
        <TouchableOpacity 
          style={[styles.acceptButton, { backgroundColor: theme.secondaryGreen }]}
          onPress={() => acceptOrder(item.id)}
        >
          <Text style={[styles.acceptButtonText, { color: theme.white }]}>Accept Order</Text>
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    textTransform: 'uppercase',
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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  address: {
    fontSize: 14,
    flex: 1,
  },
  distance: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  acceptButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
  },
});
