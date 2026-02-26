import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTheme } from './ThemeContext';

export const CustomAlert = ({ visible, title, message, buttons, onDismiss, imageUrl }) => {
  const { theme } = useTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.alertBox, { backgroundColor: theme.cardBackground }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primaryBlueLight }]}>
            <Text style={styles.iconText}>📦</Text>
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
          {imageUrl && (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.mapImage}
              resizeMode="cover"
            />
          )}
          <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
          
          <View style={styles.buttonContainer}>
            {buttons?.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  { 
                    backgroundColor: button.style === 'cancel' 
                      ? 'transparent' 
                      : theme.primaryBlue,
                    borderWidth: button.style === 'cancel' ? 1.5 : 0,
                    borderColor: button.style === 'cancel' ? theme.border : 'transparent'
                  },
                  buttons.length === 1 && styles.buttonFull
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
    textAlign: 'center',
  },
  mapImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginVertical: 16,
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
  buttonFull: {
    flex: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
