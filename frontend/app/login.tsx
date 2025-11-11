import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  background: '#0f172a',
  surface: '#131c2f',
  surfaceSoft: '#1d2539',
  surfaceHighlight: '#1f2a44',
  accent: '#3b82f6',
  accentMuted: '#60a5fa',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5f5',
  placeholder: '#64748b',
  border: '#1f2a44',
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email,
        password,
      });

      const { token, user } = response.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      router.replace('/home');
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <View style={styles.iconBadge}>
              <Ionicons name="mail" size={20} color={COLORS.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.placeholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.iconBadge}>
              <Ionicons name="lock-closed" size={20} color={COLORS.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconBadge}>
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textPrimary} />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/signup')} style={styles.signupLinkWrapper}>
            <Text style={styles.signupText}>
              Don&apos;t have an account? <Text style={styles.signupLink}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    gap: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSoft,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  form: {
    marginTop: 32,
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 28,
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: 'rgba(8, 15, 35, 0.35)',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 58,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  loginButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: 'rgba(8, 15, 35, 0.35)',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.surfaceHighlight,
    shadowOpacity: 0,
  },
  loginButtonText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 16,
  },
  signupLink: {
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  signupLinkWrapper: {
    marginTop: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    marginRight: 12,
  },
});
