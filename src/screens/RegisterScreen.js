import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signUp, signIn } from '../services/auth';
import { useTheme } from '../utils/ThemeContext';
import { fadeIn, slideUp } from '../utils/animations';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('driver');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      fadeIn(fadeAnim),
      slideUp(slideAnim)
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, fullName, role);
      Alert.alert('Success', 'Account created! Logging you in...');
      await signIn(email, password);
    } catch (error) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.gradientTop, theme.gradientBottom]}
      style={styles.container}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={[styles.title, { color: theme.white }]}>Create Account</Text>

        <View style={[styles.card, { backgroundColor: theme.white }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.textPrimary }]}
            placeholder="Full Name"
            placeholderTextColor="#999"
            value={fullName}
            onChangeText={setFullName}
          />

          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.textPrimary }]}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View style={[styles.passwordContainer, { backgroundColor: theme.background }]}>
            <TextInput
              style={[styles.passwordInput, { color: theme.textPrimary }]}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️🗨️'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: theme.textPrimary }]}>Select Role:</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[styles.roleButton, { backgroundColor: theme.background, borderColor: theme.border }, role === 'driver' && { backgroundColor: theme.primaryBlue, borderColor: theme.primaryBlue }]}
              onPress={() => setRole('driver')}
            >
              <Text style={[styles.roleText, { color: theme.textPrimary }, role === 'driver' && { color: theme.white }]}>
                Driver
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleButton, { backgroundColor: theme.background, borderColor: theme.border }, role === 'admin' && { backgroundColor: theme.primaryBlue, borderColor: theme.primaryBlue }]}
              onPress={() => setRole('admin')}
            >
              <Text style={[styles.roleText, { color: theme.textPrimary }, role === 'admin' && { color: theme.white }]}>
                Admin
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.secondaryGreen }, loading && styles.buttonDisabled]} 
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={[styles.buttonText, { color: theme.white }]}>{loading ? 'Creating...' : 'Register'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.link, { color: theme.primaryBlue }]}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  card: {
    borderRadius: 16,
    padding: 24,
  },
  input: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 16,
  },
  eyeText: {
    fontSize: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '600',
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  roleText: {
    fontSize: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
    fontWeight: '600',
  },
});
