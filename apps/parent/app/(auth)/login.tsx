import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { cardShadow } from '../../src/theme';

// Parent login is OTP-only: collect email, request a 6-digit code, go to OTP.
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
      <View className="items-center">
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 150, height: 190 }}
          resizeMode="contain"
        />
        <Text className="mt-2 text-center text-base text-muted">
          Sign in to see your child&apos;s day.
        </Text>
      </View>

      <View className="mt-8 rounded-2xl bg-surface p-5" style={cardShadow}>
        <Text className="mb-1 text-sm font-semibold text-gray-700">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          className="rounded-xl border border-border bg-bg px-4 py-3 text-base text-gray-900"
        />
        <Pressable
          onPress={sendCode}
          disabled={loading || !email.trim()}
          className="mt-4 items-center rounded-xl bg-primary px-4 py-3.5 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Send code</Text>
          )}
        </Pressable>
      </View>

      <Text className="mt-6 text-center text-xs text-muted">
        We&apos;ll email you a 6-digit code to sign in securely.
      </Text>
    </View>
  );
}
