import { supabase } from './supabase';

export const signIn = async (email, password) => {
  try {
    console.log('Attempting login with:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password 
    });
    
    if (error) {
      console.error('Login error:', error);
      // Check if it's a network/parse error
      if (error.message?.includes('JSON Parse')) {
        throw new Error('Network error: Unable to connect to authentication server. Please check your internet connection.');
      }
      throw new Error(error.message || 'Login failed');
    }
    
    console.log('Login successful, fetching profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();
    
    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }
    
    // If no profile exists, auto-create one with default role 'driver'
    if (!profile) {
      console.log('No profile found, creating default profile...');
      const defaultRole = 'driver';
      const { error: insertError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: data.user.email?.split('@')[0] || 'User',
        email: data.user.email,
        role: defaultRole
      });
      if (insertError) {
        console.error('Auto-create profile error:', insertError);
      }
      console.log('Default profile created with role:', defaultRole);
      return { user: data.user, role: defaultRole };
    }
    
    console.log('Profile data:', profile);
    return { user: data.user, role: profile.role };
  } catch (error) {
    console.error('SignIn error:', error.message);
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
    
    return { ...user, role: profile?.role || 'driver', fullName: profile?.full_name || user.email?.split('@')[0] };
  } catch (error) {
    // Silent fail - user not logged in
    return null;
  }
};
