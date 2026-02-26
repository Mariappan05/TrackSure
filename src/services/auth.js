import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_CACHE_KEY = 'tracksure_cached_user';   // full profile JSON
export const SAVED_EMAIL_KEY = 'tracksure_saved_email'; // remembered login email

/** Save email for Remember Me */
export const saveRememberedEmail = (email) => AsyncStorage.setItem(SAVED_EMAIL_KEY, email);
/** Clear remembered email */
export const clearRememberedEmail = () => AsyncStorage.removeItem(SAVED_EMAIL_KEY);
/** Get remembered email (returns null if not set) */
export const getRememberedEmail = () => AsyncStorage.getItem(SAVED_EMAIL_KEY);

// Retry helper for transient network errors (cold-start fetch binding race,
// Cloudflare 525, brief connectivity drop, etc.)
// AuthRetryableFetchError = Supabase's own signal that a retry is safe.
const isTransientError = (err) => {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('retryablefetch') ||
    msg.includes('525') ||
    msg.includes('fetch') ||
    msg.includes('timeout')
  );
};

const withRetry = async (fn, maxAttempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === maxAttempts) throw err;
      // Exponential backoff: 600ms → 1200ms → 2400ms
      await new Promise(r => setTimeout(r, 600 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
};

export const signIn = async (email, password) => {
  try {
    const { data, error } = await withRetry(() =>
      supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
    );

    if (error) {
      // Translate raw Supabase errors into user-friendly messages
      if (isTransientError(error)) {
        throw new Error('Connection error. Please check your internet and try again.');
      }
      if (error.message?.includes('Invalid login credentials')) {
        throw new Error('Incorrect email or password.');
      }
      if (error.message?.includes('Email not confirmed')) {
        throw new Error('Please verify your email address before logging in.');
      }
      throw new Error(error.message || 'Login failed');
    }
    
    console.log('Login successful, fetching profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .maybeSingle();
    
    // If no profile exists, auto-create one with default role 'driver'
    if (!profile) {
      const defaultRole = 'driver';
      const defaultName = data.user.email?.split('@')[0] || 'User';
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: defaultName,
        email: data.user.email,
        role: defaultRole
      });
      const cached = { id: data.user.id, email: data.user.email, role: defaultRole, fullName: defaultName };
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(cached));
      return { user: data.user, role: defaultRole, fullName: defaultName };
    }
    
    console.log('Profile data:', profile);
    // Cache full user profile locally for offline/network-error fallback
    const fullName = profile.full_name || data.user.email?.split('@')[0];
    const cached = { id: data.user.id, email: data.user.email, role: profile.role, fullName };
    await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(cached));
    return { user: data.user, role: profile.role, fullName };
  } catch (error) {
    throw error;
  }
};

export const signUp = async (email, password, fullName, role) => {
  try {
    console.log('Attempting signup:', { email, fullName, role });
    const { data, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      console.error('Signup error:', error);
      throw error;
    }
    
    console.log('User created, inserting profile...');
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      email,
      role
    });
    
    if (profileError) {
      console.error('Profile insert error:', profileError);
      throw profileError;
    }
    
    console.log('Signup complete!');
    return data;
  } catch (error) {
    console.error('SignUp error:', error.message);
    throw error;
  }
};

export const signOut = async () => {
  await AsyncStorage.removeItem(USER_CACHE_KEY);
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle();
    
    const role = profile?.role || 'driver';
    const fullName = profile?.full_name || user.email?.split('@')[0];
    // Keep full profile cache fresh on every successful fetch
    const cached = { id: user.id, email: user.email, role, fullName };
    await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(cached));
    return { ...user, role, fullName };
  } catch (error) {
    // Network failed — fall back to local session + full cached profile
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
        const cachedUser = raw ? JSON.parse(raw) : null;
        return {
          ...session.user,
          role: cachedUser?.role || 'driver',
          fullName: cachedUser?.fullName || session.user.email?.split('@')[0],
        };
      }
    } catch {}
    return null;
  }
};
