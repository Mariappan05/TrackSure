import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/utils/ThemeContext';
import { supabase } from './src/services/supabase';

export default function App() {
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

  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}
