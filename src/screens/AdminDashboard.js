import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Modal } from 'react-native';
import { getOrders } from '../services/orders';
import { signOut } from '../services/auth';
import { useTheme } from '../utils/ThemeContext';
import { Toast } from '../utils/Toast';
import { subscribeToAdminOrders, requestNotificationPermissions, unsubscribeFromNotifications } from '../services/notifications';
import { supabase } from '../services/supabase';

export default function AdminDashboard({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const initialFetched = useRef(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [deleteAlert, setDeleteAlert] = useState({ visible: false, orderId: null, orderStatus: null });
  const channelRef = useRef(null);
  const ordersMapRef = useRef({});

  useEffect(() => {
    loadOrders(false);
    requestNotificationPermissions();

    console.log('Setting up admin realtime notifications');
    const channel = subscribeToAdminOrders(ordersMapRef);
    channelRef.current = channel;
    
    const orderUpdatesChannel = supabase
      .channel('admin-order-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => prev.map(order => 
          order.id === payload.new.id ? { ...order, ...payload.new } : order
        ));
      })
      .subscribe();

    const unsubscribe = navigation.addListener('focus', () => {
      if (initialFetched.current) {
        loadOrders(true);
      }
    });

    return () => {
      unsubscribe();
      if (channelRef.current) {
        console.log('Cleaning up admin subscription');
        unsubscribeFromNotifications(channelRef.current);
      }
      orderUpdatesChannel.unsubscribe();
    };
  }, [navigation]);

  const loadOrders = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const data = await getOrders();
      data.forEach(order => {
        ordersMapRef.current[order.id] = order.status;
      });
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      if (error.message?.includes('Network request failed')) {
        setToast({ visible: true, message: 'Network error. Check your internet connection.', type: 'error' });
      } else {
        setToast({ visible: true, message: 'Failed to load orders', type: 'error' });
      }
      if (!isRefresh) setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialFetched.current = true;
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

  const handleDeleteOrder = (orderId, orderStatus) => {
    if (orderStatus !== 'pending' && orderStatus !== 'delivered') {
      setToast({ visible: true, message: 'Only pending and delivered orders can be deleted', type: 'error' });
      return;
    }
    setDeleteAlert({ visible: true, orderId, orderStatus });
  };

  const confirmDelete = async () => {
    const { orderId } = deleteAlert;
    setDeleteAlert({ visible: false, orderId: null, orderStatus: null });
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      if (error) throw error;
      setOrders(prev => prev.filter(order => order.id !== orderId));
      setToast({ visible: true, message: 'Order deleted successfully', type: 'success' });
    } catch (error) {
      console.error('Delete order error:', error);
      setToast({ visible: true, message: `Failed to delete: ${error.message}`, type: 'error' });
    }
  };

  const renderOrder = ({ item }) => (
    <View style={styles.orderCardWrapper}>
      <TouchableOpacity 
        style={[styles.orderCard, { backgroundColor: theme.cardBackground }, item.status === 'assigned' && { backgroundColor: theme.lightBlue }]}
        onPress={() => navigation.navigate('OrderDetails', { order: item })}
      >
        <View style={styles.orderHeader}>
          <View style={[styles.statusBadge, styles[item.status]]}>
            <Text style={[styles.statusText, { color: theme.white }]}>{item.status}</Text>
          </View>
          {item.is_flagged && (
            <View style={[styles.flagBadge, { backgroundColor: theme.error }]}>
              <Text style={[styles.flagText, { color: theme.white }]}>⚠ FLAGGED</Text>
            </View>
          )}
        </View>
        <View style={styles.addressRow}>
          <Text style={styles.addressIcon}>📍</Text>
          <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={1}>{item.pickup_address}</Text>
        </View>
        <View style={styles.addressRow}>
          <Text style={styles.addressIcon}>🎯</Text>
          <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={1}>{item.drop_address}</Text>
        </View>
        
        {/* Distance & Time Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>📏 Planned</Text>
            <Text style={[styles.metricValue, { color: theme.primaryBlue }]}>{item.planned_distance} km</Text>
          </View>
          {item.actual_distance > 0 && (
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>🛣️ Actual</Text>
              <Text style={[styles.metricValue, { color: theme.secondaryGreen }]}>{item.actual_distance} km</Text>
            </View>
          )}
          {item.travel_time_minutes > 0 && (
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>⏱️ Time</Text>
              <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{item.travel_time_minutes} min</Text>
            </View>
          )}
        </View>
        
        {/* Fuel Consumption */}
        {item.fuel_consumed_liters > 0 && (
          <View style={[styles.fuelBadge, { backgroundColor: theme.lightBlue }]}>
            <Text style={[styles.fuelText, { color: theme.primaryBlue }]}>⛽ {item.fuel_consumed_liters}L consumed</Text>
          </View>
        )}
        
        <View style={[styles.orderFooter, { borderTopColor: theme.border }]}>
          <Text style={[styles.driver, { color: theme.textPrimary }]}>👤 {item.driver?.full_name || 'Unassigned'}</Text>
          <Text style={[styles.vehicle, { color: theme.textSecondary }]}>🚗 {item.vehicle_type || 'N/A'}</Text>
        </View>
        {item.is_flagged && (
          <View style={[styles.flagReasonBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.flagReasonText, { color: theme.error }]}>{item.flag_reason}</Text>
          </View>
        )}
      </TouchableOpacity>
      
      {item.status === 'delivered' && (
        <View style={styles.deliveredActions}>
          <TouchableOpacity 
            style={[styles.deliveredBadge, { backgroundColor: theme.lightBlue }]}
            onPress={() => navigation.navigate('OrderDetails', { order: item })}
          >
            <Text style={[styles.deliveredText, { color: theme.primaryBlue }]}>✓ Tap to view proof</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.deleteButton, { backgroundColor: theme.error }]}
            onPress={(e) => { e.stopPropagation(); handleDeleteOrder(item.id, item.status); }}
          >
            <Text style={[styles.deleteButtonText, { color: theme.white }]}>🗑️ Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.status === 'pending' && (
        <TouchableOpacity 
          style={[styles.deleteButtonFull, { backgroundColor: theme.error }]}
          onPress={(e) => { e.stopPropagation(); handleDeleteOrder(item.id, item.status); }}
        >
          <Text style={[styles.deleteButtonText, { color: theme.white }]}>🗑️ Delete Order</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primaryBlue} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primaryBlue }]}>
        <View>
          <Text style={[styles.title, { color: theme.white }]}>Admin Dashboard</Text>
          <Text style={[styles.subtitle, { color: theme.white }]}>Manage deliveries</Text>
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

      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate('CreateOrder')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primaryBlueLight }]}>
            <Text style={[styles.actionIcon, { color: theme.white }]}>+</Text>
          </View>
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>Create Order</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate('LiveTracking')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primaryBlueLight }]}>
            <Text style={[styles.actionIcon, { color: theme.white }]}>🗺️</Text>
          </View>
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>Live Tracking</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate('Dashboard')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primaryBlueLight }]}>
            <Text style={[styles.actionIcon, { color: theme.white }]}>📊</Text>
          </View>
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>Analytics</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate('AIChatbot')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primaryBlueLight }]}>
            <Text style={[styles.actionIcon, { color: theme.white }]}>🤖</Text>
          </View>
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>AI Assistant</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.ordersHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recent Orders</Text>
        <Text style={[styles.orderCount, { color: theme.primaryBlue }]}>{orders.length}</Text>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => loadOrders(true)}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No orders yet</Text>
        }
      />
      
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <Modal
        transparent
        visible={deleteAlert.visible}
        animationType="fade"
        onRequestClose={() => setDeleteAlert({ visible: false, orderId: null, orderStatus: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#FEE2E2' }]}>
              <Text style={styles.modalIcon}>🗑️</Text>
            </View>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Delete Order?</Text>
            <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>
              This will permanently delete the order and all associated records (delivery proof, location history). This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtnCancel, { borderColor: theme.border }]}
                onPress={() => setDeleteAlert({ visible: false, orderId: null, orderStatus: null })}
              >
                <Text style={[styles.modalBtnCancelText, { color: theme.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnDelete}
                onPress={confirmDelete}
              >
                <Text style={styles.modalBtnDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
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
  actionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  actionButton: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  orderCount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  list: {
    padding: 20,
    paddingTop: 0,
  },
  orderCardWrapper: {
    marginBottom: 12,
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
  },
  orderHeader: {
    marginBottom: 12,
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
  in_progress: {
    backgroundColor: '#8B5CF6',
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
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  driver: {
    fontSize: 14,
  },
  vehicle: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  fuelBadge: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  fuelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
  },
  deliveredBadge: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  deliveredActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButtonFull: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deliveredText: {
    fontSize: 11,
    fontWeight: '600',
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  flagText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  flagReasonBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
  },
  flagReasonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalBox: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalBtnDelete: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  modalBtnDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
