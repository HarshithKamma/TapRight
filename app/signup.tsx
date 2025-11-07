import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useAuth } from '../hooks/useAuth';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { signup, isLoading: authLoading } = useAuth();

  const handleSignUp = async () => {
    // Basic validation
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Name validation
    if (name.trim().length < 2) {
      Alert.alert('Error', 'Please enter a valid name');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Phone validation (basic)
    if (phone.trim().length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    // Password validation
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    // Password confirmation
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const success = await signup(name.trim(), email.trim(), phone.trim(), password);

      if (success) {
        router.replace('/select-cards');
      } else {
        Alert.alert('Signup Failed', 'An account with this email already exists');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>Sign up to get personalized card recommendations</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#888"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          editable={!isLoading && !authLoading}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading && !authLoading}
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#888"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!isLoading && !authLoading}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading && !authLoading}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#888"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!isLoading && !authLoading}
        />

        <TouchableOpacity
          style={[styles.button, (isLoading || authLoading) && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={isLoading || authLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading || authLoading ? 'Creating Account...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={handleSignIn}>
          <Text style={styles.linkText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 20, justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 30 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 14,
    marginBottom: 15,
    fontSize: 16
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10
  },
  buttonDisabled: { backgroundColor: '#666' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16, textAlign: 'center' },
  linkButton: { marginTop: 20 },
  linkText: { color: '#007AFF', fontSize: 16, textAlign: 'center' },
});