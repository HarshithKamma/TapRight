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
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function QuestionnaireScreen() {
  const router = useRouter();
  const [monthlyRent, setMonthlyRent] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [cardPayments, setCardPayments] = useState('');
  const [carPayments, setCarPayments] = useState('');

  const handleSkip = () => {
    router.replace('/card-selection');
  };

  const handleSubmit = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BACKEND_URL}/api/profile/questionnaire`,
        {
          monthly_rent: monthlyRent ? parseFloat(monthlyRent) : null,
          monthly_expenses: monthlyExpenses ? parseFloat(monthlyExpenses) : null,
          card_payments: cardPayments ? parseFloat(cardPayments) : null,
          car_payments: carPayments ? parseFloat(carPayments) : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Ionicons name="help-circle" size={60} color="white" />
            <Text style={styles.title}>Quick Questions</Text>
            <Text style={styles.subtitle}>Help us understand your spending (optional)</Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="home" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Monthly Rent ($)"
                  placeholderTextColor="#999"
                  value={monthlyRent}
                  onChangeText={setMonthlyRent}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="card" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Monthly Card Payments ($)"
                  placeholderTextColor="#999"
                  value={cardPayments}
                  onChangeText={setCardPayments}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="cash" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Other Monthly Expenses ($)"
                  placeholderTextColor="#999"
                  value={monthlyExpenses}
                  onChangeText={setMonthlyExpenses}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="car" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Monthly Car Payments ($)"
                  placeholderTextColor="#999"
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
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
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
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    marginTop: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  skipButtonText: {
    color: 'white',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
