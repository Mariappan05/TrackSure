import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from '../services/auth';
import { supabase } from '../services/supabase';
import Colors from '../utils/colors';

const USER_CACHE_KEY = 'tracksure_cached_user';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AdminDashboard from '../screens/AdminDashboard';
import DriverDashboard from '../screens/DriverDashboard';
import CreateOrderScreen from '../screens/CreateOrderScreen';
import LiveTrackingScreen from '../screens/LiveTrackingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import DeliveryProofScreen from '../screens/DeliveryProofScreen';
import DriverPerformanceScreen from '../screens/DriverPerformanceScreen';
import RouteOptimizationScreen from '../screens/RouteOptimizationScreen';
import ChatbotScreen from '../screens/ChatbotScreen';

const Stack = createStackNavigator();

const screenOptions = {
  headerShown: false,
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
};

export default function AppNavigator() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      // INITIAL_SESSION is already handled by checkUser() using local storage
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }
      if (session?.user) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      // getSession() reads from AsyncStorage — no network call, works on reload
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        return;
      }
      // Use full cached profile instantly — zero network, no Loading flicker
      const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
      const cachedUser = raw ? JSON.parse(raw) : null;
      if (cachedUser) {
        const u = {
          ...session.user,
          role: cachedUser.role || 'driver',
          fullName: cachedUser.fullName || session.user.email?.split('@')[0],
        };
        setUser(u);
        // Refresh from network in background to keep profile in sync
        getCurrentUser().then(fresh => { if (fresh) setUser(fresh); }).catch(() => {});
      } else {
        // No cache yet (first login) — must fetch from DB
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.accentYellow} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : user.role === 'admin' ? (
          <>
            <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
            <Stack.Screen name="CreateOrder" component={CreateOrderScreen} />
            <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
            <Stack.Screen name="DriverPerformance" component={DriverPerformanceScreen} />
            <Stack.Screen name="RouteOptimization" component={RouteOptimizationScreen} />
            <Stack.Screen name="AIChatbot" component={ChatbotScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="DriverDashboard" component={DriverDashboard} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
            <Stack.Screen name="DeliveryProof" component={DeliveryProofScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
