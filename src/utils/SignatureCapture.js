import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { useTheme } from './ThemeContext';

export const SignatureCapture = ({ visible, onSave, onCancel }) => {
  const { theme } = useTheme();
  const signatureRef = useRef();

  const handleSignature = (signature) => {
    onSave(signature);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primaryBlue }]}>
          <Text style={[styles.title, { color: theme.white }]}>Customer Signature</Text>
        </View>

        <View style={styles.signatureContainer}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={handleSignature}
            descriptionText="Sign above"
            clearText="Clear"
            confirmText="Save"
            webStyle={`
              .m-signature-pad {
                box-shadow: none;
                border: 2px dashed ${theme.border};
                border-radius: 12px;
              }
              .m-signature-pad--body {
                border: none;
              }
              .m-signature-pad--footer {
                display: none;
              }
            `}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.border }]}
            onPress={handleClear}
          >
            <Text style={[styles.buttonText, { color: theme.textPrimary }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.error }]}
            onPress={onCancel}
          >
            <Text style={[styles.buttonText, { color: theme.white }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.secondaryGreen }]}
            onPress={() => signatureRef.current?.readSignature()}
          >
            <Text style={[styles.buttonText, { color: theme.white }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  signatureContainer: {
    flex: 1,
    margin: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
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
    fontWeight: '600',
  },
});
