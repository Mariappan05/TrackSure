import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { createOrder, getDrivers } from '../services/orders';
import { geocodeAddress, getDistance } from '../services/location';
import { useTheme } from '../utils/ThemeContext';
import * as Location from 'expo-location';
import { reverseGeocode } from '../utils/geocoding';
import { CustomAlert } from '../utils/CustomAlert';
import { Toast } from '../utils/Toast';
import { getVehicleTypes } from '../utils/fuelCalculator';

export default function CreateOrderScreen({ navigation }) {
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleType, setVehicleType] = useState('bike');
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [routeCoords, setRouteCoords] = useState(null);
  const { theme } = useTheme();
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', buttons: [], imageUrl: null });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      const data = await getDrivers();
      setDrivers(data);
    } catch (error) {
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to load drivers',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
    } finally {
      setLoadingDrivers(false);
    }
  };

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAlertConfig({
          visible: true,
          title: 'Permission Required',
          message: 'Location permission is needed to get your current location',
          buttons: [{ text: 'OK', style: 'cancel' }]
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const address = await reverseGeocode(
        location.coords.latitude,
        location.coords.longitude
      );

      setPickupAddress(address);
      setToast({ visible: true, message: 'Current location set as pickup address', type: 'success' });
    } catch (error) {
      setToast({ visible: true, message: 'Failed to get current location', type: 'error' });
      console.error('Location error:', error);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!pickupAddress || !dropAddress || !driverId) {
      setAlertConfig({
        visible: true,
        title: 'Missing Information',
        message: 'Please fill in all fields to create an order',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
      return;
    }

    setLoading(true);
    try {
      // Geocode addresses to get coordinates
      const pickupGeo = await geocodeAddress(pickupAddress);
      const dropGeo = await geocodeAddress(dropAddress);

      if (!pickupGeo || !dropGeo) {
        setAlertConfig({
          visible: true,
          title: 'Invalid Address',
          message: 'Could not find the addresses. Please check and try again.',
          buttons: [{ text: 'OK', style: 'cancel' }]
        });
        setLoading(false);
        return;
      }

      // Calculate actual distance using Google Maps API with traffic
      const routeInfo = await getDistance(
        pickupGeo.lat,
        pickupGeo.lng,
        dropGeo.lat,
        dropGeo.lng
      );

      setRouteCoords({ pickup: pickupGeo, drop: dropGeo });

      await createOrder({
        pickup_address: pickupGeo.formattedAddress,
        drop_address: dropGeo.formattedAddress,
        pickup_lat: pickupGeo.lat,
        pickup_lng: pickupGeo.lng,
        drop_lat: dropGeo.lat,
        drop_lng: dropGeo.lng,
        driver_id: driverId,
        status: 'pending',
        planned_distance: routeInfo.distance,
        vehicle_type: vehicleType
      });

      setLoading(false);
      
      console.log('Route info received:', routeInfo);
      console.log('Routes array:', routeInfo.routes);
      
      const trafficMsg = routeInfo.trafficDelay > 5 
        ? `\n⚠️ Traffic delay: +${routeInfo.trafficDelay} min` 
        : '';
      
      // Show route alternatives if available
      let routeOptions = '';
      if (routeInfo.routes && routeInfo.routes.length > 0) {
        routeOptions = '\n\nRoute Options:\n' + routeInfo.routes.map((r, i) => 
          `${i + 1}. ${r.summary} - ${r.distance}km, ${r.trafficDuration}min${r.isFastest ? ' ⚡' : ''}${r.isShortest ? ' 📏' : ''}`
        ).join('\n');
      }
      
      // Generate static map URL
      const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=400x200&markers=color:green|label:A|${pickupGeo.lat},${pickupGeo.lng}&markers=color:red|label:B|${dropGeo.lat},${dropGeo.lng}&path=color:0x0000ff|weight:3|${pickupGeo.lat},${pickupGeo.lng}|${dropGeo.lat},${dropGeo.lng}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
      
      setRouteCoords({ pickup: pickupGeo, drop: dropGeo, mapUrl });
      
      setAlertConfig({
        visible: true,
        title: '✓ Order Created',
        message: `Distance: ${routeInfo.distance} km\nDuration: ${routeInfo.trafficDuration} min${trafficMsg}${routeOptions}`,
        imageUrl: mapUrl,
        buttons: [
          { text: 'View Route', onPress: () => {
            const url = `https://www.google.com/maps/dir/?api=1&origin=${pickupGeo.lat},${pickupGeo.lng}&destination=${dropGeo.lat},${dropGeo.lng}&travelmode=driving`;
            Linking.openURL(url);
          }},
          { text: 'Done', onPress: () => navigation.goBack() }
        ]
      });
    } catch (error) {
      setLoading(false);
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: error.message || 'Failed to create order',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
    }
  };

  if (loadingDrivers) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primaryBlue} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primaryBlue }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.white }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.white }]}>Create Order</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>📍 Pickup Address</Text>
            <TouchableOpacity 
              style={[styles.locationButton, { backgroundColor: theme.primaryBlue }]}
              onPress={getCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color={theme.white} />
              ) : (
                <Text style={[styles.locationButtonText, { color: theme.white }]}>📍 Current Location</Text>
              )}
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.textPrimary, borderColor: theme.border }]}
            placeholder="Enter pickup address"
            placeholderTextColor={theme.textSecondary}
            value={pickupAddress}
            onChangeText={setPickupAddress}
            multiline
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>🎯 Drop Address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.textPrimary, borderColor: theme.border }]}
            placeholder="Enter drop address"
            placeholderTextColor={theme.textSecondary}
            value={dropAddress}
            onChangeText={setDropAddress}
            multiline
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>👤 Assign Driver</Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <Picker
              selectedValue={driverId}
              onValueChange={setDriverId}
              style={[styles.picker, { color: theme.textPrimary }]}
              dropdownIconColor={theme.textPrimary}
            >
              <Picker.Item label="Select a driver" value="" />
              {drivers.map(driver => (
                <Picker.Item 
                  key={driver.id} 
                  label={driver.full_name} 
                  value={driver.id}
                />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textPrimary }]}>🚗 Vehicle Type</Text>
          <View style={[styles.pickerContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <Picker
              selectedValue={vehicleType}
              onValueChange={setVehicleType}
              style={[styles.picker, { color: theme.textPrimary }]}
              dropdownIconColor={theme.textPrimary}
            >
              {getVehicleTypes().map(vehicle => (
                <Picker.Item 
                  key={vehicle.value} 
                  label={vehicle.label} 
                  value={vehicle.value}
                />
              ))}
            </Picker>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.primaryBlueLight }, loading && styles.buttonDisabled]} 
          onPress={handleCreateOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.white} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.white }]}>Create Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    
    <CustomAlert
      visible={alertConfig.visible}
      title={alertConfig.title}
      message={alertConfig.message}
      imageUrl={alertConfig.imageUrl}
      buttons={alertConfig.buttons}
      onDismiss={() => setAlertConfig({ ...alertConfig, visible: false })}
    />
    
    <Toast
      visible={toast.visible}
      message={toast.message}
      type={toast.type}
      onHide={() => setToast({ ...toast, visible: false })}
    />
    </>
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
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  locationButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 50,
    borderWidth: 1,
  },
  pickerContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  picker: {
    height: 50,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
