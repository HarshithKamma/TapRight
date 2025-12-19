import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Animated,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/Colors';
import { sendPasswordChangedEmail } from '../lib/email';
import PremiumAlert from '../components/PremiumAlert';

export default function ChangePasswordScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // States for flow
    const [resetStep, setResetStep] = useState<'email' | 'otp' | 'new_password'>('email');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Custom Alert State
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        icon: 'notifications' as any,
        onConfirm: () => { },
        confirmText: 'OK',
        cancelText: '', // Hide cancel button by default
    });

    const showAlert = (title: string, message: string, icon = 'alert-circle', onConfirm = () => setAlertConfig(prev => ({ ...prev, visible: false }))) => {
        setAlertConfig({
            visible: true,
            title,
            message,
            icon: icon as any,
            onConfirm,
            confirmText: 'OK',
            cancelText: '', // Ensure no cancel button for standard alerts
        });
    };

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

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

        // Pre-fill email for logged in user
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.email) setEmail(user.email);
        });
    }, []);

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

            // If successful, we have a session (freshly validated) and can proceed
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
                'Your password has been updated.',
                'checkmark-circle',
                () => {
                    setAlertConfig(prev => ({ ...prev, visible: false }));
                    router.back();
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
                confirmText={alertConfig.confirmText}
                cancelText={alertConfig.cancelText}
                onCancel={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>

                <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Change Password</Text>
                        <Text style={styles.subtitle}>
                            Secure your account by updating your password.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {/* Step 1: Email */}
                        {resetStep === 'email' && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Email Address</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="john@example.com"
                                        placeholderTextColor={COLORS.placeholder}
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                    <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginLeft: 4 }}>
                                        We'll send a verification code to this email.
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                                    onPress={handleResetEmail}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text style={styles.loginButtonText}>Send Code</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}

                        {/* Step 2: OTP */}
                        {resetStep === 'otp' && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Verification Code</Text>
                                    <Text style={{ color: COLORS.textSecondary, marginBottom: 8, fontSize: 13 }}>
                                        Check for email from info@tapright.app
                                    </Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="123456"
                                        placeholderTextColor={COLORS.placeholder}
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
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text style={styles.loginButtonText}>Verify Code</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}

                        {/* Step 3: New Password */}
                        {resetStep === 'new_password' && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>New Password</Text>
                                    <View style={styles.passwordContainer}>
                                        <TextInput
                                            style={styles.passwordInput}
                                            placeholder="New Password"
                                            placeholderTextColor={COLORS.placeholder}
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry={!showPassword}
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                            <Ionicons
                                                name={showPassword ? 'eye-off' : 'eye'}
                                                size={20}
                                                color={COLORS.textSecondary}
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
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text style={styles.loginButtonText}>Update Password</Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
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
        backgroundColor: COLORS.surfaceSoft,
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
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
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
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
    input: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 16,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    eyeIcon: {
        padding: 16,
    },
    loginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.accent,
        paddingVertical: 18,
        borderRadius: 100,
        marginTop: 16,
        gap: 8,
        shadowColor: COLORS.accent,
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    loginButtonDisabled: {
        backgroundColor: COLORS.surfaceHighlight,
        shadowOpacity: 0,
    },
    loginButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
});
