import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { sendPasswordChangedEmail } from '../lib/email';
import PremiumAlert from '../components/PremiumAlert';


export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Custom Alert State
  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    icon: 'notifications' as any,
    onConfirm: () => { },
    onCancel: undefined as (() => void) | undefined,
    confirmText: 'OK',
    cancelText: '',
  });

  const showAlert = (title: string, message: string, icon = 'alert-circle', onConfirm = () => setAlertConfig(prev => ({ ...prev, visible: false }))) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      icon: icon as any,
      onConfirm,
      onCancel: undefined,
      confirmText: 'OK',
      cancelText: '',
    });
  };

  // Join the existing animation ref
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // New state for Reset Password mode
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'otp' | 'new_password'>('email');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
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

  // Update back button logic when mode changes
  useEffect(() => {
    if (!isResetMode) {
      setResetStep('email');
      setOtp('');
      setNewPassword('');
    }
  }, [isResetMode]);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting login with URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.session) {
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user?.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        await AsyncStorage.setItem('token', data.session.access_token);
        await AsyncStorage.setItem('user', JSON.stringify({
          id: data.user?.id,
          email: data.user?.email,
          name: profile?.full_name || data.user?.user_metadata?.full_name,
          phone: profile?.phone || data.user?.user_metadata?.phone,
          ...profile
        }));
      }

      router.replace('/home');
    } catch (error: any) {
      console.log('Login Error Details:', error);
      // Map generic credential error to user's preferred messaging
      let message = error.message || 'Invalid credentials';
      if (message.includes('Invalid login credentials')) {
        message = "User doesn't exist or invalid password.";
      }

      setAlertConfig({
        visible: true,
        title: 'Login Failed',
        message: message,
        icon: 'alert-circle',
        confirmText: 'Try Again',
        cancelText: 'Forgot Password',
        onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false })),
        onCancel: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          setIsResetMode(true);
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetEmail = async () => {
    if (!email) {
      showAlert('Error', 'Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      // Trigger the password reset flow
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

      if (error) {
        throw error;
      }

      showAlert(
        'Code Sent',
        `A verification code has been sent to ${email} from info@tapright.app.`,
        'mail',
        () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          setResetStep('otp');
        }
      );
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send reset email. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      showAlert('Error', 'Please enter a valid code');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'recovery',
      });

      if (error) throw error;

      // If successful, we have a session and can proceed to update password
      if (data.session) {
        setResetStep('new_password');
      } else {
        throw new Error('Verification failed. Use the link in the email or try again.');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Send confirmation email
      sendPasswordChangedEmail(email.trim()).catch(err => console.error('Failed to send password changed email:', err));

      showAlert(
        'Success',
        'Your password has been updated. Please log in with your new password.',
        'checkmark-circle',
        () => {
          // Sign out ensuring clean state for re-login
          supabase.auth.signOut().then(() => {
            setAlertConfig(prev => ({ ...prev, visible: false }));
            setIsResetMode(false);
            setPassword('');
          });
        }
      );
    } catch (error: any) {
      showAlert('Error', 'Failed to update password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={styles.container}>
      <PremiumAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        icon={alertConfig.icon as any}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel || (() => setAlertConfig(prev => ({ ...prev, visible: false })))}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (isResetMode) {
              setIsResetMode(false);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{isResetMode ? 'Reset Password' : 'Welcome Back'}</Text>
            <Text style={styles.subtitle}>
              {isResetMode
                ? 'Enter your email to receive a reset link.'
                : 'Sign in to continue your journey.'}
            </Text>
          </View>

          <View style={styles.form}>
            {/* Login View */}
            {!isResetMode && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="john@example.com"
                    placeholderTextColor={colors.placeholder}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="••••••••"
                      placeholderTextColor={colors.placeholder}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsResetMode(true)}
                    style={{ alignSelf: 'flex-end', marginTop: 8 }}
                  >
                    <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Log In</Text>
                      <Ionicons name="arrow-forward" size={20} color={colors.surface} />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/signup')} style={styles.signupLinkWrapper}>
                  <Text style={styles.signupText}>
                    Don't have an account? <Text style={styles.signupLink}>Sign Up</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Reset Step 1: Email */}
            {isResetMode && resetStep === 'email' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="john@example.com"
                    placeholderTextColor={colors.placeholder}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                  onPress={handleResetEmail}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.loginButtonText}>Send Verification Code</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Reset Step 2: OTP */}
            {isResetMode && resetStep === 'otp' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Verification Code</Text>
                  <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 13 }}>
                    Check for email from info@tapright.app
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123456"
                    placeholderTextColor={colors.placeholder}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={8}
                    autoFocus
                  />
                </View>
                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.loginButtonText}>Verify Code</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Reset Step 3: New Password */}
            {isResetMode && resetStep === 'new_password' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="New Password"
                      placeholderTextColor={colors.placeholder}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
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
                  style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                  onPress={handleUpdatePassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.loginButtonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
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
    flex: 1,
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
  loginButton: {
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
  loginButtonDisabled: {
    backgroundColor: colors.surfaceHighlight,
    shadowOpacity: 0,
  },
  loginButtonText: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  signupText: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 15,
  },
  signupLink: {
    fontWeight: '700',
    color: colors.accent,
  },
  signupLinkWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
});
