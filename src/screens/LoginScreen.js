import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signIn } from '../services/auth';
import { useTheme } from '../utils/ThemeContext';
import { fadeIn, slideUp } from '../utils/animations';
import { Toast } from '../utils/Toast';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      fadeIn(fadeAnim),
      slideUp(slideAnim)
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setToast({ visible: true, message: 'Please enter both email and password', type: 'error' });
      return;
    }

    if (!email.includes('@')) {
      setToast({ visible: true, message: 'Please enter a valid email address', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      setToast({ visible: true, message: 'Login successful!', type: 'success' });
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'Unable to sign in. Please try again.';
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (error.message?.includes('Network request failed')) {
        errorMessage = 'Network error. Check your internet connection';
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email address';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setToast({ visible: true, message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.gradientTop, theme.gradientBottom]}
      style={styles.container}
    >
      <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
        <Text style={styles.themeIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.logoContainer}>
          <View style={[styles.iconCircle, { backgroundColor: theme.white }]}>
            <Text style={styles.icon}>🚚</Text>
          </View>
          <Text style={[styles.title, { color: theme.white }]}>TrackSure</Text>
          <Text style={[styles.subtitle, { color: theme.white }]}>Delivery Monitoring System</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.white }]}>
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

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.secondaryGreen }, loading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={[styles.buttonText, { color: theme.white }]}>{loading ? 'Logging in...' : 'Login'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.link, { color: theme.primaryBlue }]}>Don't have an account? Register</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  themeToggle: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeIcon: {
    fontSize: 24,
  },
  content: {
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  card: {
    borderRadius: 16,
    padding: 24,
  },
  input: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
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
