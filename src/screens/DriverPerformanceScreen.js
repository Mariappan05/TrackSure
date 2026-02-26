import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { getDriverRankings } from '../services/driverPerformance';
import { useTheme } from '../utils/ThemeContext';

export default function DriverPerformanceScreen({ navigation }) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = async () => {
    try {
      const data = await getDriverRankings();
      setRankings(data);
    } catch (error) {
      console.error('Failed to load rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };

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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.white }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.white }]}>Driver Performance</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {rankings.map((driver, index) => (
          <View key={driver.id} style={[styles.driverCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.rankSection}>
              <Text style={styles.medal}>{getMedalEmoji(index)}</Text>
              <View style={styles.driverInfo}>
                <Text style={[styles.driverName, { color: theme.textPrimary }]}>{driver.full_name}</Text>
                <Text style={[styles.deliveryCount, { color: theme.textSecondary }]}>
                  {driver.totalDeliveries} deliveries
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Efficiency Score</Text>
                <Text style={[styles.metricValue, { color: theme.secondaryGreen }]}>
                  {driver.fuelEfficiencyScore}/100
                </Text>
              </View>

              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Idle Time</Text>
                <Text style={[styles.metricValue, { color: theme.warning }]}>
                  {driver.totalIdleTime} min
                </Text>
              </View>

              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Fuel Usage</Text>
                <Text style={[styles.metricValue, { color: theme.primaryBlue }]}>
                  {driver.avgFuelEfficiency}%
                </Text>
              </View>
            </View>

            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${driver.fuelEfficiencyScore}%`,
                    backgroundColor: driver.fuelEfficiencyScore >= 80 ? theme.secondaryGreen : 
                                   driver.fuelEfficiencyScore >= 60 ? theme.warning : theme.error
                  }
                ]} 
              />
            </View>
          </View>
        ))}

        {rankings.length === 0 && (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No driver data available
          </Text>
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
  driverCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  rankSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  medal: {
    fontSize: 32,
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  deliveryCount: {
    fontSize: 12,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 14,
  },
});
