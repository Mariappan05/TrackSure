import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { getActiveDriverLocations, subscribeToDriverLocations } from '../services/tracking';
import { reverseGeocode } from '../utils/geocoding';
import { useTheme } from '../utils/ThemeContext';

export default function LiveTrackingScreen({ navigation }) {
  const { theme } = useTheme();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDrivers();
    });
    
    const subscription = subscribeToDriverLocations((payload) => {
      const newLocation = payload.new;
      setDrivers(prev => {
        const updated = prev.filter(d => d.driver_id !== newLocation.driver_id);
        return [...updated, newLocation];
      });
      fetchAddress(newLocation.driver_id, newLocation.latitude, newLocation.longitude);
    });

    return () => {
      unsubscribe();
      subscription.unsubscribe();
    };
  }, [navigation]);

  const fetchAddress = async (driverId, lat, lng) => {
    const address = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    setAddresses(prev => ({ ...prev, [driverId]: address }));
  };

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const locations = await getActiveDriverLocations();
      setDrivers(locations);
      
      locations.forEach(driver => {
        fetchAddress(driver.driver_id, driver.latitude, driver.longitude);
      });
    } catch (error) {
      console.error('Failed to load drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = (lat, lng, name) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(err => console.error('Error opening maps:', err));
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primaryBlue} />
        <Text style={[styles.loadingText, { color: theme.textPrimary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primaryBlue }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backIcon, { color: theme.white }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.white }]}>Live Tracking</Text>
        <TouchableOpacity onPress={loadDrivers} style={styles.refreshButton}>
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.statsBar, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
        <Text style={[styles.statsText, { color: theme.textPrimary }]}>
          {drivers.length} Active Driver{drivers.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {drivers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textPrimary }]}>No active drivers</Text>
            <Text style={[styles.hintText, { color: theme.textSecondary }]}>Drivers must be logged in</Text>
          </View>
        ) : (
          drivers.map((driver) => (
            <View key={driver.driver_id} style={[styles.driverCard, { backgroundColor: theme.cardBackground }]}>
              <View style={styles.cardHeader}>
                <View style={styles.driverInfo}>
                  <View style={[styles.iconContainer, { backgroundColor: theme.lightBlue }]}>
                    <Text style={styles.driverIcon}>🚗</Text>
                  </View>
                  <View>
                    <Text style={[styles.driverName, { color: theme.textPrimary }]}>{driver.driver?.full_name}</Text>
                    <Text style={[styles.driverSubtext, { color: theme.textSecondary }]}>Active now</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: theme.error }]}>
                  <View style={[styles.statusDot, { backgroundColor: theme.white }]} />
                  <Text style={[styles.statusText, { color: theme.white }]}>LIVE</Text>
                </View>
              </View>
              
              <View style={[styles.locationSection, { backgroundColor: theme.background }]}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={[styles.locationText, { color: theme.textPrimary }]}>
                  {addresses[driver.driver_id] || 'Loading address...'}
                </Text>
              </View>
              
              <View style={styles.timeSection}>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                  Updated {new Date(driver.recorded_at).toLocaleTimeString()}
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.mapButton, { backgroundColor: theme.primaryBlue }]}
                onPress={() => openInGoogleMaps(driver.latitude, driver.longitude, driver.driver?.full_name)}
              >
                <Text style={[styles.mapButtonText, { color: theme.white }]}>View on Map</Text>
              </TouchableOpacity>
            </View>
          ))
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
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    width: 40,
  },
  backIcon: {
    fontSize: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  refreshButton: {
    width: 40,
    alignItems: 'flex-end',
  },
  refreshIcon: {
    fontSize: 20,
  },
  statsBar: {
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  statsText: {
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  driverCard: {
    margin: 15,
    padding: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverIcon: {
    fontSize: 24,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  driverSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  locationSection: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  timeSection: {
    marginBottom: 12,
  },
  timeText: {
    fontSize: 12,
  },
  mapButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  mapButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 10,
  },
  hintText: {
    fontSize: 14,
  },
});
