import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login, isLoading: authLoading } = useAuth();

  const handleLogin = async () => {
    // Basic validation
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const success = await login(email.trim(), password.trim());

      if (success) {
        router.replace('/select-cards');
      } else {
        Alert.alert('Login Failed', 'Invalid email or password');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push('/signup');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to TapRight</Text>
      <Text style={styles.subtitle}>Sign in to get personalized card suggestions</Text>

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
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading && !authLoading}
      />

      <TouchableOpacity
        style={[styles.button, (isLoading || authLoading) && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading || authLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading || authLoading ? 'Signing In...' : 'Sign In'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={handleSignUp}>
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 30, textAlign: 'center' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, marginBottom: 20 },
  button: { backgroundColor: '#000', paddingVertical: 14, paddingHorizontal: 50, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
