import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/utils/ThemeContext';
import { supabase } from './src/services/supabase';
import SplashScreen from './src/components/SplashScreen';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Re-trigger Supabase session refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}
