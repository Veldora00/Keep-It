import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Keep It uses its own set of tables (keepit_*) inside a shared Supabase project.
const SUPABASE_URL = 'https://asajwviusixmnoolawnb.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzYWp3dml1c2l4bW5vb2xhd25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5ODU3ODksImV4cCI6MjEwNDU2MTc4OX0.9JuhUhnAhYbhgikYwqC0KIGAtmuJWy6DWs4RzggjDeQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Deep link target the app registers for magic-link / password-reset callbacks.
export const AUTH_REDIRECT_URL = 'keepit://auth/callback';
