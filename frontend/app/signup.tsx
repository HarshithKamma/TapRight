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
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import PremiumAlert from '../components/PremiumAlert';
import { sendWelcomeEmail } from '../lib/email';

type FormFields = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

type AlertConfig = {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function SignupScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  const formValuesRef = React.useRef<FormFields>({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [isFormReady, setIsFormReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => { },
    onCancel: () => { },
  });

  // Animation for form entry
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const updateFormValue = (field: keyof FormFields) => (value: string) => {
    formValuesRef.current[field] = value;
    const hasAllValues = Object.values(formValuesRef.current).every(
      (entry) => entry.trim().length > 0
    );
    setIsFormReady((prev) => (prev === hasAllValues ? prev : hasAllValues));
  };

  const showPremiumConfirm = (title: string, message: string, icon: keyof typeof Ionicons.glyphMap = 'notifications') => {
    return new Promise<boolean>((resolve) => {
      setAlertConfig({
        visible: true,
        title,
        message,
        icon,
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          resolve(true);
        },
        onCancel: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          resolve(false);
        },
      });
    });
  };

  const showAlert = (title: string, message: string, icon: keyof typeof Ionicons.glyphMap = 'alert-circle', onConfirm?: () => void) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      icon,
      onConfirm: () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        if (onConfirm) onConfirm();
      },
      onCancel: () => setAlertConfig(prev => ({ ...prev, visible: false })),
    });
  };

  const requestNotificationPermission = async () => {
    try {
      const shouldRequest = await showPremiumConfirm(
        'Stay in the loop?',
        'Would you like us to send you notifications for card recommendations?',
        'notifications'
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
      const shouldRequest = await showPremiumConfirm(
        'Share your location?',
        'Allow TapRight to access your location even in the background so we can send timely recommendations.',
        'location'
      );

      if (!shouldRequest) {
        return;
      }

      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        showAlert(
          'Location Needed',
          'We need location permission to suggest the best card based on where you are.',
          'location'
        );
        return;
      }

      if (Constants.appOwnership !== 'expo') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

        if (backgroundStatus !== 'granted') {
          showAlert(
            'Background Location',
            'Background access lets us notify you even when the app is closed.',
            'navigate'
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
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters');
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

        // Send Welcome Email
        // Note: We use the trimmed email/name. This is a fire-and-forget call.
        sendWelcomeEmail(trimmedEmail, trimmedName).catch(err => console.error('Failed to send welcome email:', err));

        setLoading(false);

        setTimeout(async () => {
          await requestNotificationPermission();
          await requestLocationPermission();
          router.replace('/questionnaire');
        }, 500);
      } else if (data.user) {
        // Send Welcome Email even if confirmation is pending (optional, but requested)
        sendWelcomeEmail(trimmedEmail, trimmedName).catch(err => console.error('Failed to send welcome email:', err));

        showAlert(
          'Verify Email',
          'Please check your email to confirm your account before logging in.',
          'mail',
          () => router.replace('/login')
        );
      }
    } catch (error: any) {
      setLoading(false);

      const errorMessage = error.message || '';
      if (errorMessage.includes('already registered')) {
        showAlert(
          'Account Exists',
          'It looks like you already have an account with this email. Would you like to log in instead?',
          'person',
          () => router.replace('/login')
        );
      } else {
        showAlert('Signup Failed', errorMessage || 'Please try again', 'alert-circle');
      }
    }
  };

  return (
    <View style={styles.container}>
      <PremiumAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        icon={alertConfig.icon}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Creating your account...</Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join TapRight to maximize your rewards.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Jim Carrey"
                  placeholderTextColor={colors.placeholder}
                  onChangeText={updateFormValue('name')}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="truman@example.com"
                  placeholderTextColor={colors.placeholder}
                  onChangeText={updateFormValue('email')}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={colors.placeholder}
                  onChangeText={updateFormValue('phone')}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor={colors.placeholder}
                    onChangeText={updateFormValue('password')}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.signupButton, (!isFormReady || loading) && styles.signupButtonDisabled]}
                onPress={handleSignup}
                disabled={loading || !isFormReady}
                activeOpacity={0.8}
              >
                <Text style={[styles.signupButtonText, !isFormReady && styles.signupButtonTextDisabled]}>
                  Sign Up
                </Text>
                {isFormReady && <Ionicons name="arrow-forward" size={20} color={colors.surface} />}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginLinkWrapper}>
                <Text style={styles.loginText}>
                  Already have an account? <Text style={styles.loginLink}>Log in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  backButton: {
    marginTop: 60,
    marginLeft: 24,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.surfaceSoft,
  },
  content: {
    paddingHorizontal: 32,
    marginTop: 32,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 24,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.textPrimary,
  },
  eyeIcon: {
    padding: 16,
  },
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 100,
    marginTop: 16,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  signupButtonDisabled: {
    backgroundColor: colors.surfaceHighlight,
    shadowOpacity: 0,
  },
  signupButtonText: {
    color: colors.surface, // White text on dark button (or dark on white in dark mode? No, surface is opposite of accent usually)
    fontSize: 18,
    fontWeight: '700',
  },
  signupButtonTextDisabled: {
    color: colors.textSecondary,
  },
  loginLinkWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  loginLink: {
    fontWeight: '700',
    color: colors.accent,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)', // Dynamic overlay
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    shadowColor: 'black',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
