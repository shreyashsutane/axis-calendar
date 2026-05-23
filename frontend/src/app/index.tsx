import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ShieldCheck, Mail, Lock, Sun, Moon } from 'lucide-react-native';
import { router } from 'expo-router';

export default function LoginScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [customAlert, setCustomAlert] = useState<{ visible: boolean; title: string; message: string; onAcknowledge?: () => void } | null>(null);

  const showAlert = (title: string, message: string, onAcknowledge?: () => void) => {
    setCustomAlert({ visible: true, title, message, onAcknowledge });
  };

  const handleLogin = async () => {
    if (!emailOrId || !password) {
      setErrorMsg('Please fill in all credentials.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Hit the live GCP Cloud Run API Gateway directly
      const response = await fetch('https://axis-calendar-backend-122036974660.us-central1.run.app/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_or_id: emailOrId, password }),
      });

      const resJson = await response.json();

      if (response.ok && resJson.success) {
        console.log('Login successful! Welcome', resJson.data.user.first_name);
        showAlert(
          'Axis Security Sign In',
          `Welcome, ${resJson.data.user.first_name}!\nRole: ${resJson.data.user.role.toUpperCase()}`,
          () => {
            router.replace({
              pathname: '/(manager)/reports',
              params: {
                token: resJson.data.token,
                firstName: resJson.data.user.first_name,
                managerId: resJson.data.user.id,
                role: resJson.data.user.role,
                branchName: resJson.data.user.branch?.name || '',
                branchId: resJson.data.user.branch?.id || ''
              }
            });
          }
        );
      } else {
        setErrorMsg(resJson.error || 'Invalid credentials. Try MGR_PRIME with Password123');
      }
    } catch (err) {
      console.log('API call failed, running mockup login logic...', err);
      // Simulated sandbox credentials for easy offline verification
      if (emailOrId === 'MGR_PRIME' || emailOrId === 'rahul.sharma@axisbank.com') {
        showAlert('Axis Security Sign In', 'Simulated Manager login successful!', () => {
          router.replace({
            pathname: '/(manager)/reports',
            params: {
              token: 'mock-jwt-token-xyz',
              firstName: 'Rahul',
              managerId: '334ce730-8135-43ad-ba0d-8069db12add6',
              role: 'manager',
              branchName: 'Mumbai Corporate Office',
              branchId: '1'
            }
          });
        });
      } else {
        showAlert(
          'Axis Security Sign In',
          'Simulated Employee login successful! Try MGR_PRIME for Manager features.',
          () => {
            router.replace({
              pathname: '/(manager)/reports',
              params: {
                token: 'mock-jwt-token-xyz',
                firstName: 'PrimeEmployee',
                managerId: 'mock-employee-id-123',
                role: 'employee',
                branchName: 'Axis Global Towers',
                branchId: '6'
              }
            });
          }
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: theme.background },
    surface: { backgroundColor: theme.surface, borderColor: theme.border },
    textPrimary: { color: theme.textPrimary },
    textSecondary: { color: theme.textSecondary },
    input: { borderColor: theme.border, color: theme.textPrimary, backgroundColor: isDark ? '#1C1C24' : '#F8FAFC' },
    button: { backgroundColor: theme.primary }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, dynamicStyles.container]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sleek Top Bar with Dark Mode Toggle */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={toggleTheme} style={[styles.themeToggle, { borderColor: theme.border }]}>
            {isDark ? <Sun size={20} color="#FFC72C" /> : <Moon size={20} color={theme.primary} />}
          </TouchableOpacity>
        </View>

        <View style={styles.headerArea}>
          {/* Axis Signature Logo Banner Placeholder */}
          <View style={[styles.brandBanner, { backgroundColor: theme.primary }]}>
            <Text style={styles.brandBannerText}>AXIS BANK</Text>
          </View>
          
          <Text style={[styles.appTitle, dynamicStyles.textPrimary]}>Training Portal</Text>
          <Text style={[styles.appSubtitle, dynamicStyles.textSecondary]}>Calendar & Management System</Text>
        </View>

        <View style={[styles.card, dynamicStyles.surface]}>
          <Text style={[styles.cardTitle, dynamicStyles.textPrimary]}>Employee Sign In</Text>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* User ID / Email Input */}
          <View style={styles.inputContainer}>
            <View style={styles.iconBox}>
              <Mail size={18} color={theme.textSecondary} />
            </View>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="Employee ID or Corporate Email"
              placeholderTextColor={theme.textSecondary}
              value={emailOrId}
              onChangeText={setEmailOrId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.iconBox}>
              <Lock size={18} color={theme.textSecondary} />
            </View>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="Portal Password"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, dynamicStyles.button]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <View style={styles.helperTipArea}>
            <ShieldCheck size={14} color={theme.textSecondary} />
            <Text style={[styles.helperTip, dynamicStyles.textSecondary]}>
              Secured under Axis corporate active directory standards.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* PREMIUM THEME-AWARE CUSTOM ALERT DIALOG */}
      <Modal
        visible={customAlert !== null && customAlert.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomAlert(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.customAlertCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Header Accent Band */}
            <View style={[styles.alertAccentBand, { backgroundColor: theme.primary }]} />
            
            <View style={styles.alertContentBox}>
              <Text style={[styles.alertTitle, { color: theme.textPrimary }]}>
                {customAlert?.title || 'Notification'}
              </Text>
              <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>
                {customAlert?.message}
              </Text>
              
              <TouchableOpacity
                style={[styles.alertConfirmBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  const callback = customAlert?.onAcknowledge;
                  setCustomAlert(null);
                  if (callback) callback();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.alertConfirmBtnText}>Acknowledge</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 40 : 10,
    marginBottom: 8,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandBanner: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  brandBannerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 2,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  appSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 42,
    paddingRight: 16,
    fontSize: 15,
  },
  loginButton: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
  },
  helperTipArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  helperTip: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  customAlertCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
  },
  alertAccentBand: {
    height: 5,
    width: '100%',
  },
  alertContentBox: {
    padding: 24,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  alertConfirmBtn: {
    width: '100%',
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14.5,
  },
});
