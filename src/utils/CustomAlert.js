import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { useTheme } from './ThemeContext';

export const CustomAlert = ({ visible, title, message, buttons, onDismiss, imageUrl, orders }) => {
  const { theme } = useTheme();
  const [selectedOrder, setSelectedOrder] = React.useState(0);
  const [mapKey, setMapKey] = React.useState(0);
  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  const orderColors = [
    { hex: '#10B981', name: 'green', light: '#D1FAE5' },
    { hex: '#3B82F6', name: 'blue', light: '#DBEAFE' },
    { hex: '#F59E0B', name: 'orange', light: '#FEF3C7' },
    { hex: '#8B5CF6', name: 'purple', light: '#EDE9FE' },
    { hex: '#EF4444', name: 'red', light: '#FEE2E2' },
  ];

  const generateCombinedMapUrl = () => {
    if (!orders || orders.length === 0) return imageUrl;
    
    const order = orders[selectedOrder];
    const routeColor = orderColors[selectedOrder % orderColors.length].hex.replace('#', '0x');
    const num = selectedOrder + 1;
    
    // Calculate distance and appropriate zoom level with padding
    const latDiff = Math.abs(parseFloat(order.pickup_lat) - parseFloat(order.drop_lat));
    const lngDiff = Math.abs(parseFloat(order.pickup_lng) - parseFloat(order.drop_lng));
    const maxDiff = Math.max(latDiff, lngDiff);
    
    // Add 30% padding to ensure both markers are visible
    const paddedDiff = maxDiff * 1.3;
    
    // Determine zoom level based on distance
    let zoom;
    if (paddedDiff > 1) zoom = 8;        // Very long distance
    else if (paddedDiff > 0.5) zoom = 9;  // Long distance
    else if (paddedDiff > 0.2) zoom = 10; // Medium distance
    else if (paddedDiff > 0.1) zoom = 11; // Short distance
    else if (paddedDiff > 0.05) zoom = 12; // Very short distance
    else zoom = 13;                     // Nearby locations
    
    const centerLat = (parseFloat(order.pickup_lat) + parseFloat(order.drop_lat)) / 2;
    const centerLng = (parseFloat(order.pickup_lng) + parseFloat(order.drop_lng)) / 2;
    
    // Green for pickup, Red for drop
    const markers = `&markers=size:mid|color:green|label:P${num}|${order.pickup_lat},${order.pickup_lng}` +
                   `&markers=size:mid|color:red|label:D${num}|${order.drop_lat},${order.drop_lng}`;
    
    const path = `&path=color:${routeColor}|weight:5|${order.pickup_lat},${order.pickup_lng}|${order.drop_lat},${order.drop_lng}`;
    
    return `https://maps.googleapis.com/maps/api/staticmap?center=${centerLat},${centerLng}&zoom=${zoom}&size=600x400&scale=2${markers}${path}&key=${GOOGLE_MAPS_API_KEY}`;
  };

  const handleOrderSelect = (index) => {
    setSelectedOrder(index);
    setMapKey(prev => prev + 1); // Force map reload
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.alertBox, { backgroundColor: theme.cardBackground }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
            <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
          
          <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
          
          {orders && orders.length > 0 ? (
            <>
              <Image 
                key={mapKey}
                source={{ uri: generateCombinedMapUrl() }} 
                style={styles.mapImage}
                resizeMode="cover"
              />
              
              <View style={styles.mapLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendMarker, { backgroundColor: '#10B981' }]}>
                    <Text style={styles.legendMarkerText}>P{selectedOrder + 1}</Text>
                  </View>
                  <Text style={[styles.legendText, { color: theme.textPrimary }]}>Pickup Location</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendMarker, { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.legendMarkerText}>D{selectedOrder + 1}</Text>
                  </View>
                  <Text style={[styles.legendText, { color: theme.textPrimary }]}>Drop Location</Text>
                </View>
              </View>
              
              <ScrollView style={styles.ordersScroll} showsVerticalScrollIndicator={false}>
                {orders.map((order, index) => {
                  const color = orderColors[index % orderColors.length];
                  const isSelected = selectedOrder === index;
                  
                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={[
                        styles.orderRow, 
                        { 
                          borderLeftColor: color.hex,
                          backgroundColor: isSelected ? color.light : 'transparent'
                        }
                      ]}
                      onPress={() => handleOrderSelect(index)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.orderNumber, { backgroundColor: color.hex }]}>
                        <Text style={[styles.orderNumberText, { color: theme.white }]}>{index + 1}</Text>
                      </View>
                      <View style={styles.orderInfo}>
                        <View style={styles.locationBlock}>
                          <View style={styles.locationHeader}>
                            <View style={[styles.colorDot, { backgroundColor: color.hex }]} />
                            <Text style={[styles.locationLabel, { color: theme.textSecondary }]}>PICKUP</Text>
                          </View>
                          <Text style={[styles.addressFull, { color: theme.textPrimary }]} numberOfLines={2}>
                            {order.pickup_address}
                          </Text>
                        </View>
                        
                        <View style={styles.arrowRow}>
                          <Text style={[styles.arrow, { color: color.hex }]}>↓</Text>
                        </View>
                        
                        <View style={styles.locationBlock}>
                          <View style={styles.locationHeader}>
                            <View style={[styles.colorDot, { backgroundColor: color.hex }]} />
                            <Text style={[styles.locationLabel, { color: theme.textSecondary }]}>DROP</Text>
                          </View>
                          <Text style={[styles.addressFull, { color: theme.textPrimary }]} numberOfLines={2}>
                            {order.drop_address}
                          </Text>
                        </View>
                        
                        <View style={styles.metaRow}>
                          <Text style={[styles.distance, { color: color.hex }]}>📏 {order.planned_distance}km</Text>
                          {index === 0 && (
                            <View style={[styles.mainBadge, { backgroundColor: color.hex }]}>
                              <Text style={[styles.mainBadgeText, { color: theme.white }]}>MAIN</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.mapImage}
              resizeMode="cover"
            />
          ) : null}
          
          {message && (
            <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
          )}
          
          <View style={styles.buttonContainer}>
            {buttons?.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  { 
                    backgroundColor: button.style === 'cancel' 
                      ? theme.background 
                      : theme.secondaryGreen,
                  }
                ]}
                onPress={() => {
                  button.onPress?.();
                  onDismiss();
                }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.buttonText,
                  { color: button.style === 'cancel' ? theme.textPrimary : theme.white }
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  alertBox: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    paddingRight: 40,
  },
  mapImage: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#E5E7EB',
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendMarkerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  legendText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ordersScroll: {
    maxHeight: 280,
    marginBottom: 16,
  },
  orderRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderRadius: 8,
  },
  orderNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 4,
  },
  orderNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderInfo: {
    flex: 1,
  },
  locationBlock: {
    marginBottom: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  marker: {
    fontSize: 10,
  },
  addressFull: {
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 16,
  },
  arrowRow: {
    paddingLeft: 6,
    paddingVertical: 2,
  },
  arrow: {
    fontSize: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  distance: {
    fontSize: 13,
    fontWeight: '700',
  },
  mainBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mainBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
