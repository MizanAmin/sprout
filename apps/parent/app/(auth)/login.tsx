import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';

// Parent login is OTP-only (no magic links on native — see Supabase Auth Setup).
// Step 1: collect email and request a 6-digit code, then go to the OTP screen.
export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const sendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { email: trimmed });
      router.push({ pathname: '/(auth)/otp', params: { email: trimmed } });
    } catch (e: any) {
      Alert.alert('Could not send code', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center bg-bg px-6">
      <Text className="mb-1 text-3xl font-semibold text-gray-900">🌱 Sprout</Text>
      <Text className="mb-8 text-base text-muted">Sign in to see your child's day.</Text>

      <Text className="mb-1 text-sm font-medium text-gray-700">Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
        className="mb-6 rounded-lg border border-border bg-surface px-3 py-3 text-base text-gray-900"
      />

      <Pressable
        onPress={sendCode}
        disabled={loading || !email.trim()}
        className="items-center rounded-lg bg-primary px-4 py-3 disabled:opacity-50"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-medium text-white">Send code</Text>
        )}
      </Pressable>
    </View>
  );
}
