import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { verifyLocation, uploadDeliveryImage, submitDeliveryProof } from '../services/deliveryProof';
import { getCurrentUser } from '../services/auth';
import { completeOrderTracking } from '../services/fuelMonitoring';
import { useTheme } from '../utils/ThemeContext';
import { CustomAlert } from '../utils/CustomAlert';
import { Toast } from '../utils/Toast';
import { SignatureCapture } from '../utils/SignatureCapture';

export default function DeliveryProofScreen({ route, navigation }) {
  const { order } = route.params;
  const { theme } = useTheme();
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', buttons: [] });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [showSignature, setShowSignature] = useState(false);
  const [signature, setSignature] = useState(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const captureImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setAlertConfig({
        visible: true,
        title: 'Permission Required',
        message: 'Camera access is required to capture delivery photo',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      setToast({ visible: true, message: 'Please capture delivery photo first', type: 'error' });
      return;
    }

    if (!signature) {
      setToast({ visible: true, message: 'Please get customer signature', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const verification = await verifyLocation(
        parseFloat(order.drop_lat),
        parseFloat(order.drop_lng)
      );

      if (!verification.isValid) {
        setAlertConfig({
          visible: true,
          title: '📍 Location Error',
          message: `You are ${verification.distance}m away from delivery location. You must be within 50 meters to complete delivery.`,
          buttons: [{ text: 'OK', style: 'cancel' }]
        });
        setLoading(false);
        return;
      }

      const user = await getCurrentUser();
      
      let imageUrl = null;
      try {
        console.log('Starting image upload...');
        imageUrl = await uploadDeliveryImage(image, order.id);
        console.log('Image uploaded successfully:', imageUrl);
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        setAlertConfig({
          visible: true,
          title: 'Upload Failed',
          message: 'Photo could not be uploaded. Do you want to continue without photo?',
          buttons: [
            { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
            { 
              text: 'Continue', 
              onPress: async () => {
                try {
                  await submitDeliveryProof(
                    order.id,
                    user.id,
                    'https://via.placeholder.com/400',
                    verification.currentLat,
                    verification.currentLng,
                    signature,
                    deliveryNotes
                  );
                  setAlertConfig({
                    visible: true,
                    title: '✓ Delivery Complete',
                    message: 'Order has been marked as delivered successfully (without photo)',
                    buttons: [{ text: 'Back to Dashboard', onPress: () => navigation.navigate('DriverDashboard') }]
                  });
                } catch (error) {
                  setToast({ visible: true, message: error.message, type: 'error' });
                  setLoading(false);
                }
              }
            }
          ]
        });
        return;
      }

      await submitDeliveryProof(
        order.id,
        user.id,
        imageUrl,
        verification.currentLat,
        verification.currentLng,
        signature,
        deliveryNotes
      );

      // Calculate fuel and distance metrics
      try {
        const metrics = await completeOrderTracking(order.id);
        setAlertConfig({
          visible: true,
          title: '🎉 Delivery Complete!',
          message: `Order delivered successfully!\n\n🛣️ Distance Covered: ${metrics.actualDistance} km\n⛽ Fuel Consumed: ${metrics.fuelConsumed}L`,
          buttons: [{ text: 'Back to Dashboard', onPress: () => navigation.navigate('DriverDashboard') }]
        });
      } catch (metricsError) {
        console.error('Metrics calculation error:', metricsError);
        setAlertConfig({
          visible: true,
          title: '🎉 Delivery Complete!',
          message: 'Order delivered successfully!',
          buttons: [{ text: 'Back to Dashboard', onPress: () => navigation.navigate('DriverDashboard') }]
        });
      }
    } catch (error) {
      console.error('Delivery proof error:', error);
      setToast({ visible: true, message: error.message, type: 'error' });
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primaryBlue }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.white }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.white }]}>Delivery Proof</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>🎯 Drop Location</Text>
          <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{order.drop_address}</Text>
        </View>

        <View style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={[styles.cameraIcon, { backgroundColor: theme.primaryBlueLight }]}>
                <Text style={styles.cameraIconText}>📷</Text>
              </View>
              <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>No photo captured</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={[styles.captureButton, { backgroundColor: theme.primaryBlueLight }]} onPress={captureImage}>
          <Text style={[styles.captureButtonText, { color: theme.white }]}>
            {image ? '📷 Retake Photo' : '📷 Capture Photo'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.notesContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.notesLabel, { color: theme.textPrimary }]}>📝 Delivery Notes (Optional)</Text>
          <TextInput
            style={[styles.notesInput, { color: theme.textPrimary }]}
            placeholder="e.g., Left with neighbor, Gate code: 1234"
            placeholderTextColor={theme.textSecondary}
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            multiline
            numberOfLines={2}
          />
        </View>

        <TouchableOpacity 
          style={[styles.signatureButton, { backgroundColor: signature ? theme.secondaryGreen : theme.primaryBlue }]}
          onPress={() => setShowSignature(true)}
        >
          <Text style={[styles.signatureButtonText, { color: theme.white }]}>
            {signature ? '✓ Signature Captured' : '✍️ Get Customer Signature'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.submitButton, { backgroundColor: theme.secondaryGreen }, (!image || !signature || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!image || !signature || loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.white} />
          ) : (
            <Text style={[styles.submitButtonText, { color: theme.white }]}>✓ Mark as Delivered</Text>
          )}
        </TouchableOpacity>


      </View>
      
      <SignatureCapture
        visible={showSignature}
        onSave={(sig) => {
          setSignature(sig);
          setShowSignature(false);
          setToast({ visible: true, message: 'Signature captured successfully', type: 'success' });
        }}
        onCancel={() => setShowSignature(false)}
      />
      
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
      
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  imageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  cameraIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraIconText: {
    fontSize: 40,
  },
  placeholderText: {
    fontSize: 14,
  },
  captureButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  captureButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  notesContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesInput: {
    fontSize: 14,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  signatureButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  signatureButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    borderLeftWidth: 4,
  },
  noteIcon: {
    fontSize: 16,
  },
  note: {
    fontSize: 12,
    flex: 1,
  },
});
