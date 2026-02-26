import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { getOrders } from '../services/orders';
import { signOut } from '../services/auth';
import { useTheme } from '../utils/ThemeContext';

export default function AdminDashboard({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const initialFetched = useRef(false);

  useEffect(() => {
    // Initial load
    loadOrders(false);

    // Refetch on every return to this screen
    const unsubscribe = navigation.addListener('focus', () => {
      if (initialFetched.current) {
        loadOrders(true);
      }
    });

    return unsubscribe;
  }, [navigation]);

  const loadOrders = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const data = await getOrders();
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
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

  const renderOrder = ({ item }) => (
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
      <View style={[styles.orderFooter, { borderTopColor: theme.border }]}>
        <Text style={[styles.driver, { color: theme.textPrimary }]}>👤 {item.driver?.full_name || 'Unassigned'}</Text>
        <Text style={[styles.distance, { color: theme.primaryBlue }]}>{item.planned_distance} km</Text>
      </View>
      {item.is_flagged && (
        <View style={[styles.flagReasonBox, { backgroundColor: theme.background }]}>
          <Text style={[styles.flagReasonText, { color: theme.error }]}>{item.flag_reason}</Text>
        </View>
      )}
      {item.status === 'delivered' && (
        <View style={[styles.deliveredBadge, { backgroundColor: theme.lightBlue }]}>
          <Text style={[styles.deliveredText, { color: theme.primaryBlue }]}>✓ Tap to view proof</Text>
        </View>
      )}
    </TouchableOpacity>
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
          onPress={() => navigation.navigate('DriverPerformance')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primaryBlueLight }]}>
            <Text style={[styles.actionIcon, { color: theme.white }]}>🏆</Text>
          </View>
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>Performance</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate('RouteOptimization')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primaryBlueLight }]}>
            <Text style={[styles.actionIcon, { color: theme.white }]}>🗺️</Text>
          </View>
          <Text style={[styles.actionText, { color: theme.textPrimary }]}>Optimize Routes</Text>
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
  orderCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
  distance: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
  },
  deliveredBadge: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
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
});
