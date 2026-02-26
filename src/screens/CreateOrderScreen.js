import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, Modal, Dimensions, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { WebView } from 'react-native-webview';
import { createOrder, getDrivers } from '../services/orders';
import { geocodeAddress, getDistance } from '../services/location';
import { useTheme } from '../utils/ThemeContext';
import * as Location from 'expo-location';
import { reverseGeocode } from '../utils/geocoding';
import { CustomAlert } from '../utils/CustomAlert';
import { Toast } from '../utils/Toast';
import { getVehicleTypes } from '../utils/fuelCalculator';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const buildMapHtml = (lat, lng, latDelta, lngDelta) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }

    #search-container {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
    }
    #search-row {
      display: flex;
      align-items: center;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.4);
      overflow: hidden;
    }
    #search-icon {
      padding: 0 10px 0 14px;
      font-size: 16px;
      color: #888;
      flex-shrink: 0;
    }
    #search-box {
      flex: 1;
      padding: 12px 6px;
      border: none;
      font-size: 15px;
      background: transparent;
      outline: none;
      color: #111;
    }
    #clear-btn {
      padding: 0 14px;
      font-size: 18px;
      color: #aaa;
      cursor: pointer;
      display: none;
      flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
    }
    #suggestions {
      background: #fff;
      border-radius: 12px;
      margin-top: 6px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.35);
      overflow: hidden;
      display: none;
      max-height: 320px;
      overflow-y: auto;
    }
    .suggestion-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 13px 14px;
      border-bottom: 1px solid #f0f0f0;
      -webkit-tap-highlight-color: rgba(74,144,217,0.12);
      cursor: pointer;
      user-select: none;
    }
    .suggestion-item:last-child { border-bottom: none; }
    .suggestion-item:active { background: #eef4fd; }
    .s-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #e8f0fe;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .s-text { flex: 1; min-width: 0; }
    .s-main {
      font-weight: 700;
      font-size: 14px;
      color: #111;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .s-main b { color: #1a73e8; }
    .s-secondary {
      font-size: 12px;
      color: #666;
      margin-top: 3px;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .s-types {
      font-size: 11px;
      color: #999;
      margin-top: 3px;
      text-transform: capitalize;
    }
    .no-results {
      padding: 16px;
      text-align: center;
      color: #888;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <div id="search-container">
    <div id="search-row">
      <span id="search-icon">🔍</span>
      <input id="search-box" type="text" placeholder="Search places, areas, landmarks..." autocomplete="off" />
      <span id="clear-btn" onclick="clearSearch()">✕</span>
    </div>
    <div id="suggestions"></div>
  </div>

  <script>
    var map, marker, autocompleteService, placesService;
    var centerLat = ${lat};
    var centerLng = ${lng};
    var searchTimeout = null;
    var currentPredictions = [];

    function clearSearch() {
      document.getElementById('search-box').value = '';
      document.getElementById('clear-btn').style.display = 'none';
      document.getElementById('suggestions').style.display = 'none';
      currentPredictions = [];
    }

    function highlightMatch(text, query) {
      if (!query || !text) return text;
      var idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx === -1) return text;
      return text.slice(0, idx) + '<b>' + text.slice(idx, idx + query.length) + '</b>' + text.slice(idx + query.length);
    }

    function getPlaceIcon(types) {
      if (!types) return '📍';
      if (types.includes('restaurant') || types.includes('food')) return '🍽️';
      if (types.includes('hospital') || types.includes('health')) return '🏥';
      if (types.includes('school') || types.includes('university')) return '🎓';
      if (types.includes('airport')) return '✈️';
      if (types.includes('train_station') || types.includes('transit_station')) return '🚉';
      if (types.includes('hotel') || types.includes('lodging')) return '🏨';
      if (types.includes('shopping_mall') || types.includes('store')) return '🛍️';
      if (types.includes('park')) return '🌳';
      if (types.includes('bank')) return '🏦';
      if (types.includes('gas_station')) return '⛽';
      if (types.includes('locality') || types.includes('administrative_area_level')) return '🏙️';
      if (types.includes('route') || types.includes('street_address')) return '🛣️';
      return '📍';
    }

    function placeMarker(latlng) {
      var latVal = typeof latlng.lat === 'function' ? latlng.lat() : latlng.lat;
      var lngVal = typeof latlng.lng === 'function' ? latlng.lng() : latlng.lng;
      var pos = { lat: latVal, lng: lngVal };
      if (marker) { marker.setMap(null); }
      marker = new google.maps.Marker({
        position: pos,
        map: map,
        title: 'Drop Location',
        animation: google.maps.Animation.DROP,
      });
      map.panTo(pos);
      map.setZoom(17);
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latVal, lng: lngVal }));
    }

    function selectPrediction(index) {
      var p = currentPredictions[index];
      if (!p) return;
      var main = p.structured_formatting ? (p.structured_formatting.main_text || p.description) : p.description;
      document.getElementById('search-box').value = main;
      document.getElementById('clear-btn').style.display = 'block';
      document.getElementById('suggestions').style.display = 'none';
      placesService.getDetails(
        { placeId: p.place_id, fields: ['geometry'] },
        function(result, status) {
          if (status === 'OK' && result && result.geometry && result.geometry.location) {
            placeMarker(result.geometry.location);
          }
        }
      );
    }

    function showSuggestions(predictions, query) {
      var box = document.getElementById('suggestions');
      box.innerHTML = '';
      currentPredictions = predictions || [];
      if (!predictions || predictions.length === 0) {
        box.innerHTML = '<div class="no-results">No places found</div>';
        box.style.display = 'block';
        return;
      }
      predictions.forEach(function(p, index) {
        var main = p.structured_formatting ? (p.structured_formatting.main_text || p.description) : p.description;
        var secondary = p.structured_formatting ? (p.structured_formatting.secondary_text || '') : '';
        var types = p.types || [];
        var icon = getPlaceIcon(types);
        var typeLabel = types.length > 0 ? types[0].replace(/_/g, ' ') : '';

        var item = document.createElement('div');
        item.className = 'suggestion-item';
        item.setAttribute('data-index', index);
        item.innerHTML =
          '<div class="s-icon">' + icon + '</div>' +
          '<div class="s-text">' +
            '<div class="s-main">' + highlightMatch(main, query) + '</div>' +
            (secondary ? '<div class="s-secondary">' + secondary + '</div>' : '') +
            (typeLabel ? '<div class="s-types">' + typeLabel + '</div>' : '') +
          '</div>';

        // Use touchend for reliable tap on Android WebView
        item.addEventListener('touchend', function(e) {
          e.preventDefault();
          e.stopPropagation();
          selectPrediction(parseInt(this.getAttribute('data-index')));
        });
        // Fallback for desktop/iOS
        item.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          selectPrediction(parseInt(this.getAttribute('data-index')));
        });

        box.appendChild(item);
      });
      box.style.display = 'block';
    }

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: centerLat, lng: centerLng },
        zoom: ${latDelta < 0.1 ? 15 : latDelta < 1 ? 12 : 5},
        mapTypeId: 'hybrid',
        disableDefaultUI: false,
        gestureHandling: 'greedy',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      autocompleteService = new google.maps.places.AutocompleteService();
      placesService = new google.maps.places.PlacesService(map);

      map.addListener('click', function(e) {
        document.getElementById('suggestions').style.display = 'none';
        document.getElementById('search-box').blur();
        placeMarker(e.latLng);
      });

      var searchBox = document.getElementById('search-box');

      searchBox.addEventListener('input', function() {
        var val = this.value.trim();
        document.getElementById('clear-btn').style.display = val.length > 0 ? 'block' : 'none';
        clearTimeout(searchTimeout);
        if (val.length < 2) {
          document.getElementById('suggestions').style.display = 'none';
          return;
        }
        searchTimeout = setTimeout(function() {
          var center = map.getCenter();
          autocompleteService.getPlacePredictions(
            {
              input: val,
              location: new google.maps.LatLng(center.lat(), center.lng()),
              radius: 50000,
            },
            function(predictions, status) {
              if (status === 'OK' && predictions && predictions.length > 0) {
                showSuggestions(predictions, val);
              } else if (status === 'ZERO_RESULTS') {
                showSuggestions([], val);
              } else {
                document.getElementById('suggestions').style.display = 'none';
              }
            }
          );
        }, 300);
      });

      searchBox.addEventListener('focus', function() {
        if (this.value.trim().length >= 2 && currentPredictions.length > 0) {
          document.getElementById('suggestions').style.display = 'block';
        }
      });
    }
  <\/script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap" async defer></script>
</body>
</html>
`;

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

  // Map picker state
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerCoords, setMapPickerCoords] = useState(null);
  const [mapPickerAddress, setMapPickerAddress] = useState('');
  const [reverseGeoLoading, setReverseGeoLoading] = useState(false);
  const [initialRegion, setInitialRegion] = useState({
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 10,
    longitudeDelta: 10,
  });
  const webViewRef = useRef(null);

  useEffect(() => {
    loadDrivers();
    getUserLocationForMap();
  }, []);

  // Get user's location to center the map
  const getUserLocationForMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setInitialRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } catch (error) {
      // Silent fail — use default India center
    }
  };

  // Handle message from WebView map
  const handleWebViewMessage = async (event) => {
    try {
      const { lat, lng } = JSON.parse(event.nativeEvent.data);
      setMapPickerCoords({ latitude: lat, longitude: lng });
      setReverseGeoLoading(true);
      setMapPickerAddress('Loading address...');
      try {
        const address = await reverseGeocode(lat, lng);
        setMapPickerAddress(address);
      } catch (error) {
        setMapPickerAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      } finally {
        setReverseGeoLoading(false);
      }
    } catch (e) {
      // ignore parse errors
    }
  };

  // Confirm map selection as drop address
  const confirmMapSelection = () => {
    if (mapPickerCoords && mapPickerAddress) {
      setDropAddress(mapPickerAddress);
      setToast({ visible: true, message: 'Drop location set from map', type: 'success' });
      setShowMapPicker(false);
      setMapPickerCoords(null);
      setMapPickerAddress('');
    }
  };

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
            navigation.goBack();
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
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>🎯 Drop Address</Text>
            <TouchableOpacity 
              style={[styles.locationButton, { backgroundColor: theme.secondaryGreen }]}
              onPress={() => setShowMapPicker(true)}
            >
              <Text style={[styles.locationButtonText, { color: theme.white }]}>🗺️ Pick from Map</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.textPrimary, borderColor: theme.border }]}
            placeholder="Enter drop address or pick from map"
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
    
    {/* Map Picker Modal */}
    <Modal
      visible={showMapPicker}
      animationType="slide"
      onRequestClose={() => setShowMapPicker(false)}
    >
      <View style={[styles.mapModalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.mapHeader, { backgroundColor: theme.primaryBlue }]}>
          <TouchableOpacity onPress={() => { setShowMapPicker(false); setMapPickerCoords(null); setMapPickerAddress(''); }}>
            <Text style={[styles.mapHeaderBtn, { color: theme.white }]}>✕ Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.mapHeaderTitle, { color: theme.white }]}>Pick Drop Location</Text>
          <TouchableOpacity
            onPress={confirmMapSelection}
            disabled={!mapPickerCoords || reverseGeoLoading}
            style={{ opacity: (!mapPickerCoords || reverseGeoLoading) ? 0.4 : 1 }}
          >
            <Text style={[styles.mapHeaderBtn, { color: theme.white }]}>Confirm ✓</Text>
          </TouchableOpacity>
        </View>

        <WebView
          ref={webViewRef}
          style={{ flex: 1 }}
          source={{
            html: buildMapHtml(
              initialRegion.latitude,
              initialRegion.longitude,
              initialRegion.latitudeDelta,
              initialRegion.longitudeDelta
            ),
            baseUrl: 'https://localhost'
          }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
              <ActivityIndicator size="large" color="#4A90D9" />
              <Text style={{ color: '#fff', marginTop: 12, fontSize: 14 }}>Loading satellite map...</Text>
            </View>
          )}
          allowsInlineMediaPlayback={true}
          mixedContentMode="always"
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
        />

        {/* Address preview bar */}
        <View style={[styles.mapAddressBar, { backgroundColor: theme.cardBackground }]}>
          {!mapPickerCoords ? (
            <View style={styles.mapHintContainer}>
              <Text style={[styles.mapHintIcon]}>👆</Text>
              <Text style={[styles.mapHintText, { color: theme.textSecondary }]}>
                Tap anywhere on the map to set the drop location
              </Text>
            </View>
          ) : (
            <View style={styles.mapAddressContent}>
              <Text style={[styles.mapAddressLabel, { color: theme.textSecondary }]}>📍 Selected Location</Text>
              <View style={styles.mapAddressRow}>
                {reverseGeoLoading ? (
                  <ActivityIndicator size="small" color={theme.primaryBlue} style={{ marginRight: 8 }} />
                ) : null}
                <Text style={[styles.mapAddressText, { color: theme.textPrimary }]} numberOfLines={2}>
                  {mapPickerAddress}
                </Text>
              </View>
              <Text style={[styles.mapCoordText, { color: theme.textSecondary }]}>
                {mapPickerCoords.latitude.toFixed(6)}, {mapPickerCoords.longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>

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
  // Map Picker Modal styles
  mapModalContainer: {
    flex: 1,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 14,
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapHeaderBtn: {
    fontSize: 15,
    fontWeight: '600',
  },
  mapView: {
    width: '100%',
    height: '100%',
  },
  mapAddressBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
    minHeight: 90,
  },
  mapHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapHintIcon: {
    fontSize: 24,
  },
  mapHintText: {
    fontSize: 15,
    fontWeight: '500',
  },
  mapAddressContent: {
    gap: 4,
  },
  mapAddressLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapAddressText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    lineHeight: 21,
  },
  mapCoordText: {
    fontSize: 12,
    marginTop: 2,
  },
});
