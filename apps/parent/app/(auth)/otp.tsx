import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@sprout/db/native';
import { api } from '../../src/api';
import { cardShadow } from '../../src/theme';

// Step 2: verify the 6-digit code. The API returns a Supabase session, which we
// install into the native client so it persists in expo-secure-store and the api
// wrapper attaches it to subsequent requests.
export default function Otp() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const verify = async () => {
    if (!email || code.length < 6) return;
    setLoading(true);
    try {
      const res = await api.post<{ session: Session }>('/auth/verify-otp', {
        email,
        token: code,
      });
      const session = res.session;
      if (session?.access_token && session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }
      // The root layout's auth guard redirects to (tabs) once the session is set.
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Invalid code', e?.message ?? 'Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center bg-bg px-6">
      <View className="items-center">
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary-light">
          <Text className="text-4xl">✉️</Text>
        </View>
        <Text className="mt-4 text-2xl font-bold text-gray-900">Enter your code</Text>
        <Text className="mt-1 text-center text-base text-muted">
          We sent a 6-digit code to{'\n'}
          <Text className="font-semibold text-gray-700">{email}</Text>
        </Text>
      </View>

      <View className="mt-8 rounded-2xl bg-surface p-5" style={cardShadow}>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          placeholderTextColor="#cbd5e1"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          className="rounded-xl border border-border bg-bg px-3 py-3.5 text-center text-2xl tracking-[0.5em] text-gray-900"
        />
        <Pressable
          onPress={verify}
          disabled={loading || code.length < 6}
          className="mt-4 items-center rounded-xl bg-primary px-4 py-3.5 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Verify &amp; sign in</Text>
          )}
        </Pressable>
      </View>

      <Pressable onPress={() => router.back()} className="mt-6 items-center">
        <Text className="text-sm font-medium text-primary">Use a different email</Text>
      </Pressable>
    </View>
  );
}
