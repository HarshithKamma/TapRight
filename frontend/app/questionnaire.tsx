import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/Colors';





export default function QuestionnaireScreen() {
  const router = useRouter();
  const [monthlyRent, setMonthlyRent] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [cardPayments, setCardPayments] = useState('');
  const [carPayments, setCarPayments] = useState('');
  const logoSource = require('../assets/images/tapright-logo.png');

  const handleSkip = () => {
    router.replace('/card-selection');
  };

  const handleSubmit = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'No user found');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          monthly_rent: monthlyRent ? parseFloat(monthlyRent) : null,
          monthly_expenses: monthlyExpenses ? parseFloat(monthlyExpenses) : null,
          card_payments: cardPayments ? parseFloat(cardPayments) : null,
          car_payments: carPayments ? parseFloat(carPayments) : null,
        })
        .eq('id', user.id);

      if (error) throw error;

      router.replace('/card-selection');
    } catch (error: any) {
      console.error('Failed to save questionnaire:', error);
      Alert.alert('Error', 'Failed to save questionnaire');
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

          <View style={styles.iconWrap}>
            <Image
              source={logoSource}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Quick Questions</Text>
          <Text style={styles.subtitle}>Help us understand your spending (optional)</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <View style={styles.inputIconWrap}>
                <Ionicons name="home" size={20} color={COLORS.textSecondary} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Monthly Rent ($)"
                placeholderTextColor={COLORS.placeholder}
                value={monthlyRent}
                onChangeText={setMonthlyRent}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIconWrap}>
                <Ionicons name="card" size={20} color={COLORS.textSecondary} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Monthly Card Payments ($)"
                placeholderTextColor={COLORS.placeholder}
                value={cardPayments}
                onChangeText={setCardPayments}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIconWrap}>
                <Ionicons name="cash" size={20} color={COLORS.textSecondary} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Other Monthly Expenses ($)"
                placeholderTextColor={COLORS.placeholder}
                value={monthlyExpenses}
                onChangeText={setMonthlyExpenses}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIconWrap}>
                <Ionicons name="car" size={20} color={COLORS.textSecondary} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Monthly Car Payments ($)"
                placeholderTextColor={COLORS.placeholder}
                value={carPayments}
                onChangeText={setCarPayments}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Skip for Now</Text>
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
    paddingTop: 80,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    marginTop: 28,
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 28,
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
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
  submitButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  submitButtonText: {
    color: 'white', // Force white text on dark button
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  skipButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  iconWrap: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  inputIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    marginRight: 12,
  },
  iconImage: {
    width: 88,
    height: 88,
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: COLORS.surfaceSoft,
    marginBottom: 20,
  },
});
