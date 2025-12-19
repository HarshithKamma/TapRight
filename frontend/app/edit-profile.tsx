import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/Colors';
import PremiumAlert from '../components/PremiumAlert';

export default function EditProfileScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [monthlyRent, setMonthlyRent] = useState('');
    const [monthlyExpenses, setMonthlyExpenses] = useState('');
    const [cardPayments, setCardPayments] = useState('');
    const [carPayments, setCarPayments] = useState('');
    const [loading, setLoading] = useState(false);

    // Custom Alert State
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        icon: 'notifications' as any,
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => { },
    });

    const showAlert = (title: string, message: string, icon = 'alert-circle', onConfirm?: () => void) => {
        setAlertConfig({
            visible: true,
            title,
            message,
            icon: icon as any,
            confirmText: 'OK',
            cancelText: '',
            onConfirm: () => {
                setAlertConfig(prev => ({ ...prev, visible: false }));
                if (onConfirm) onConfirm();
            },
        });
    };

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setName(user.user_metadata?.full_name || '');
            setEmail(user.email || '');

            const { data: profile } = await supabase
                .from('profiles')
                .select('monthly_rent, monthly_expenses, card_payments, car_payments')
                .eq('id', user.id)
                .single();

            if (profile) {
                setMonthlyRent(profile.monthly_rent?.toString() || '');
                setMonthlyExpenses(profile.monthly_expenses?.toString() || '');
                setCardPayments(profile.card_payments?.toString() || '');
                setCarPayments(profile.car_payments?.toString() || '');
            }
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            showAlert('Error', 'Name cannot be empty', 'alert-circle');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            // 1. Update Auth Metadata (Name)
            const { error: authError } = await supabase.auth.updateUser({
                data: { full_name: name },
            });
            if (authError) throw authError;

            // 2. Update Financial Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    monthly_rent: monthlyRent ? parseFloat(monthlyRent) : null,
                    monthly_expenses: monthlyExpenses ? parseFloat(monthlyExpenses) : null,
                    card_payments: cardPayments ? parseFloat(cardPayments) : null,
                    car_payments: carPayments ? parseFloat(carPayments) : null,
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            showAlert('Success', 'Profile updated successfully', 'checkmark-circle', () => router.back());
        } catch (error: any) {
            showAlert('Error', error.message, 'alert-circle');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <StatusBar barStyle="dark-content" />
            <PremiumAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                icon={alertConfig.icon}
                confirmText={alertConfig.confirmText}
                cancelText={alertConfig.cancelText}
                onConfirm={alertConfig.onConfirm}
                onCancel={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter your name"
                        placeholderTextColor={COLORS.textSecondary}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <View style={[styles.input, styles.disabledInput]}>
                        <Text style={{ color: COLORS.textSecondary }}>{email}</Text>
                    </View>
                    <Text style={styles.helperText}>Email cannot be changed</Text>
                </View>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Financial Profile</Text>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Monthly Rent ($)</Text>
                        <TextInput
                            style={styles.input}
                            value={monthlyRent}
                            onChangeText={setMonthlyRent}
                            placeholder="0"
                            placeholderTextColor={COLORS.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Card Payments ($)</Text>
                        <TextInput
                            style={styles.input}
                            value={cardPayments}
                            onChangeText={setCardPayments}
                            placeholder="0"
                            placeholderTextColor={COLORS.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Expenses ($)</Text>
                        <TextInput
                            style={styles.input}
                            value={monthlyExpenses}
                            onChangeText={setMonthlyExpenses}
                            placeholder="0"
                            placeholderTextColor={COLORS.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Car Payments ($)</Text>
                        <TextInput
                            style={styles.input}
                            value={carPayments}
                            onChangeText={setCarPayments}
                            placeholder="0"
                            placeholderTextColor={COLORS.textSecondary}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    content: {
        padding: 24,
        gap: 24,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginLeft: 4,
    },
    input: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: COLORS.textPrimary,
        borderWidth: 1,
        borderColor: COLORS.surfaceHighlight,
    },
    row: {
        flexDirection: 'row',
        gap: 16,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.surfaceHighlight,
        marginVertical: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    disabledInput: {
        backgroundColor: COLORS.surfaceSoft,
        borderColor: 'transparent',
    },
    helperText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
    saveButton: {
        backgroundColor: COLORS.textPrimary,
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: COLORS.surface,
        fontSize: 16,
        fontWeight: 'bold',
    },
});
