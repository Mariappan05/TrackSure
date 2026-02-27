import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { getDashboardStats } from '../services/analytics';
import { useTheme } from '../utils/ThemeContext';
import { calculateFuelCost } from '../utils/fuelCalculator';

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadStats();
    });
    
    return unsubscribe;
  }, [navigation]);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundLight }]}>
        <ActivityIndicator size="large" color={theme.primaryBlue} />
      </View>
    );
  }

  const completionRate = stats.totalOrders > 0 
    ? ((stats.deliveredOrders / stats.totalOrders) * 100).toFixed(1) 
    : 0;

  const avgDistance = stats.totalOrders > 0 
    ? (parseFloat(stats.totalDistance) / stats.totalOrders).toFixed(1) 
    : 0;

  const longestDelivery = stats.totalOrders > 0 && stats.totalDistance > 0
    ? (parseFloat(stats.totalDistance) / stats.totalOrders * 1.5).toFixed(1)
    : 0;

  // Calculate fuel costs
  const plannedFuelCost = calculateFuelCost(parseFloat(stats.totalDistance), 'bike');
  const actualFuelCost = calculateFuelCost(parseFloat(stats.totalActualDistance || 0), 'bike');
  const fuelSavings = parseFloat(plannedFuelCost.cost) - parseFloat(actualFuelCost.cost);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundLight }]}>
      <View style={[styles.header, { backgroundColor: theme.primaryBlue }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.white }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.white }]}>Analytics Dashboard</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.summaryValue, { color: theme.primaryBlue }]}>{stats.totalOrders}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Orders</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.summaryValue, { color: theme.secondaryGreen }]}>{completionRate}%</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Completion</Text>
          </View>
        </View>

        {/* Detailed Stats */}
        <View style={[styles.detailCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.detailHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryBlueLight }]}>
              <Text style={styles.detailIcon}>📦</Text>
            </View>
            <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>Order Statistics</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Total Orders</Text>
            <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{stats.totalOrders}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Delivered Orders</Text>
            <Text style={[styles.detailValue, { color: theme.secondaryGreen }]}>{stats.deliveredOrders}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Pending Orders</Text>
            <Text style={[styles.detailValue, { color: theme.warning }]}>{stats.totalOrders - stats.deliveredOrders}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Success Rate</Text>
            <Text style={[styles.detailValue, { color: theme.primaryBlue }]}>{completionRate}%</Text>
          </View>
        </View>

        <View style={[styles.detailCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.detailHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.secondaryGreen }]}>
              <Text style={styles.detailIcon}>🚚</Text>
            </View>
            <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>Driver Statistics</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Active Drivers</Text>
            <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{stats.activeDrivers}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Avg Orders per Driver</Text>
            <Text style={[styles.detailValue, { color: theme.textPrimary }]}>
              {stats.activeDrivers > 0 ? (stats.totalOrders / stats.activeDrivers).toFixed(1) : 0}
            </Text>
          </View>
        </View>

        <View style={[styles.detailCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.detailHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.warning }]}>
              <Text style={styles.detailIcon}>📍</Text>
            </View>
            <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>Distance Comparison</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Estimated Distance</Text>
            <Text style={[styles.detailValue, { color: theme.primaryBlue }]}>{stats.totalDistance} km</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Actual Distance</Text>
            <Text style={[styles.detailValue, { color: theme.secondaryGreen }]}>{stats.totalActualDistance} km</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Difference</Text>
            <Text style={[styles.detailValue, { color: parseFloat(stats.totalActualDistance) > parseFloat(stats.totalDistance) ? theme.error : theme.secondaryGreen }]}>
              {(parseFloat(stats.totalActualDistance) - parseFloat(stats.totalDistance)).toFixed(2)} km
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Average per Order</Text>
            <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{avgDistance} km</Text>
          </View>
        </View>

        <View style={[styles.detailCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.detailHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.warning }]}>
              <Text style={styles.detailIcon}>⛽</Text>
            </View>
            <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>Fuel Comparison</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Estimated Fuel</Text>
            <Text style={[styles.detailValue, { color: theme.primaryBlue }]}>{stats.estimatedFuel} L</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Actual Fuel</Text>
            <Text style={[styles.detailValue, { color: theme.secondaryGreen }]}>{stats.actualFuel} L</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Difference</Text>
            <Text style={[styles.detailValue, { color: parseFloat(stats.actualFuel) > parseFloat(stats.estimatedFuel) ? theme.error : theme.secondaryGreen }]}>
              {(parseFloat(stats.actualFuel) - parseFloat(stats.estimatedFuel)).toFixed(2)} L
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Fuel Cost (₹100/L)</Text>
            <Text style={[styles.detailValue, { color: theme.textPrimary }]}>₹{(parseFloat(stats.actualFuel) * 100).toFixed(2)}</Text>
          </View>
        </View>

        <View style={[styles.detailCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.detailHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryBlue }]}>
              <Text style={styles.detailIcon}>⏱️</Text>
            </View>
            <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>Time Comparison</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Estimated Time</Text>
            <Text style={[styles.detailValue, { color: theme.primaryBlue }]}>{stats.estimatedTime} min</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Actual Time</Text>
            <Text style={[styles.detailValue, { color: theme.secondaryGreen }]}>{stats.actualTime} min</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Difference</Text>
            <Text style={[styles.detailValue, { color: parseFloat(stats.actualTime) > parseFloat(stats.estimatedTime) ? theme.error : theme.secondaryGreen }]}>
              {(parseFloat(stats.actualTime) - parseFloat(stats.estimatedTime)).toFixed(0)} min
            </Text>
          </View>
        </View>

        {/* Performance Indicator */}
        <View style={[styles.performanceCard, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.performanceTitle, { color: theme.textPrimary }]}>Overall Performance</Text>
          <View style={[styles.performanceBar, { backgroundColor: theme.border }]}>
            <View 
              style={[
                styles.performanceFill, 
                { 
                  width: `${completionRate}%`,
                  backgroundColor: completionRate >= 80 ? theme.secondaryGreen : completionRate >= 50 ? theme.warning : theme.error
                }
              ]} 
            />
          </View>
          <Text style={[styles.performanceText, { color: theme.textSecondary }]}>
            {completionRate >= 80 ? 'Excellent' : completionRate >= 50 ? 'Good' : 'Needs Improvement'}
          </Text>
        </View>
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
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
  },
  detailCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailIcon: {
    fontSize: 20,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  performanceCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  performanceBar: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  performanceFill: {
    height: '100%',
    borderRadius: 6,
  },
  performanceText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
