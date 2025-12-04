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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/Colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type FormFields = {
  name: string;
  email: string;
  phone: string;
  password: string;
};



export default function SignupScreen() {
  const router = useRouter();
  const formValuesRef = React.useRef<FormFields>({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [isFormReady, setIsFormReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateFormValue = (field: keyof FormFields) => (value: string) => {
    formValuesRef.current[field] = value;
    const hasAllValues = Object.values(formValuesRef.current).every(
      (entry) => entry.trim().length > 0
    );
    setIsFormReady((prev) => (prev === hasAllValues ? prev : hasAllValues));
  };

  const promptUser = (title: string, message: string) => {
    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Allow',
          onPress: () => resolve(true),
        },
      ]);
    });
  };

  const requestNotificationPermission = async () => {
    try {
      const shouldRequest = await promptUser(
        'Stay in the loop?',
        'Would you like us to send you notifications for card recommendations?'
      );

      if (!shouldRequest) {
        return;
      }

      await Notifications.requestPermissionsAsync();
    } catch (err) {
      console.warn('Notification permission prompt failed', err);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const shouldRequest = await promptUser(
        'Share your location?',
        'Allow TapRight to access your location even in the background so we can send timely recommendations.'
      );

      if (!shouldRequest) {
        return;
      }

      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Location Needed',
          'We need location permission to suggest the best card based on where you are.'
        );
        return;
      }

      if (Constants.appOwnership !== 'expo') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

        if (backgroundStatus !== 'granted') {
          Alert.alert(
            'Background Location',
            'Background access lets us notify you even when the app is closed.'
          );
        }
      }
    } catch (err) {
      console.warn('Location permission prompt failed', err);
    }
  };

  const handleSignup = async () => {
    const { name, email, phone, password } = formValuesRef.current;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: password,
        options: {
          data: {
            full_name: trimmedName,
            phone: trimmedPhone,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        await AsyncStorage.setItem('token', data.session.access_token);
        await AsyncStorage.setItem('user', JSON.stringify({
          id: data.user?.id,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone
        }));

        await requestNotificationPermission();
        await requestLocationPermission();

        router.replace('/questionnaire');
      } else if (data.user) {
        Alert.alert(
          'Verify Email',
          'Please check your email to confirm your account before logging in.',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
      }
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.title}>Join TapRight</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <View style={styles.iconBadge}>
                <Ionicons name="person" size={20} color={COLORS.textSecondary} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={COLORS.placeholder}
                onChangeText={updateFormValue('name')}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.iconBadge}>
                <Ionicons name="mail" size={20} color={COLORS.textSecondary} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={COLORS.placeholder}
                onChangeText={updateFormValue('email')}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.iconBadge}>
                <Ionicons name="call" size={20} color={COLORS.textSecondary} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor={COLORS.placeholder}
                onChangeText={updateFormValue('phone')}
                keyboardType="phone-pad"
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
                onChangeText={updateFormValue('password')}
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
              style={[styles.signupButton, (!isFormReady || loading) && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={loading || !isFormReady}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.textPrimary} />
              ) : (
                <Text style={styles.signupButtonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginLinkWrapper}>
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginLink}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
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
    marginTop: 6,
  },
  form: {
    marginTop: 28,
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
    shadowColor: COLORS.border,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
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
  signupButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  signupButtonDisabled: {
    backgroundColor: COLORS.surfaceHighlight,
    shadowOpacity: 0,
  },
  signupButtonText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 16,
  },
  loginLink: {
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  loginLinkWrapper: {
    marginTop: 8,
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
