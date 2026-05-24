import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Platform, KeyboardAvoidingView, Modal, Animated, Easing } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useLocalSearchParams } from 'expo-router';
import { Calendar as CalendarIcon, Users, Award, CheckSquare, RefreshCw, BarChart2, Sun, Moon, MapPin, ChevronDown, ChevronUp, Plus, Clock, FileText, Bell, ChevronLeft, X, Edit3, Flame, Trophy, TrendingUp, CheckCircle2, UserPlus, Sparkles, Zap, MapPinOff, ArrowRight } from 'lucide-react-native';
import { Calendar as CalendarWidget } from 'react-native-calendars';
import { scheduleTrainingReminders } from '../../context/notificationHelper';
import * as Location from 'expo-location';

// Curated additional color tokens for gamification
const AMBER = '#D97706';
const EMERALD = '#10B981';
const COBALT = '#2563EB';

export default function ReportsDashboard() {
  const { theme, isDark, toggleTheme } = useTheme();
  const params = useLocalSearchParams();
  
  // Basic session details
  const token = params.token as string;
  const firstName = (params.firstName as string) || 'Rahul';
  const managerId = params.managerId as string;
  const userRole = (params.role as string) || 'manager'; // 'manager' | 'employee'
  const userBranchName = (params.branchName as string) || 'Axis Global Towers';
  const userBranchId = (params.branchId as string) || '';

  // Tab State
  // Managers: 'reports' | 'calendar' | 'create' | 'register'
  // Employees: 'dashboard' | 'calendar' | 'tasks'
  const [activeTab, setActiveTab] = useState<string>(userRole === 'manager' ? 'reports' : 'dashboard');
  const [loading, setLoading] = useState(false);

  // Live timer for check-in countdowns
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- STORES & DATA ---
  // Analytics & Trainings List
  const [trainingsCount, setTrainingsCount] = useState({ total: 0, scheduled: 0, cancelled: 0, rescheduled: 0 });
  const [attendanceRates, setAttendanceRates] = useState([
    { label: 'Attended', percentage: 82.7, color: '#107C41', count: 182 },
    { label: 'Absent', percentage: 12.7, color: '#EF4444', count: 28 },
    { label: 'Excused', percentage: 4.6, color: '#6C757D', count: 10 }
  ]);
  const [branchPerformance, setBranchPerformance] = useState([
    { branch_id: '1', branch_name: 'Mumbai Corporate Office', branch_code: 'AXIS0001', branch_attendance_rate_percent: 94.5, branch_task_completion_rate_percent: 88.2, total_branch_employees: 12 },
    { branch_id: '2', branch_name: 'Gigaplex Navi Mumbai Branch', branch_code: 'AXIS0002', branch_attendance_rate_percent: 88.6, branch_task_completion_rate_percent: 82.4, total_branch_employees: 8 },
    { branch_id: '3', branch_name: 'Connaught Place Branch', branch_code: 'AXIS0003', branch_attendance_rate_percent: 79.8, branch_task_completion_rate_percent: 70.5, total_branch_employees: 10 },
    { branch_id: '4', branch_name: 'Indiranagar Wealth Management', branch_code: 'AXIS0004', branch_attendance_rate_percent: 84.1, branch_task_completion_rate_percent: 79.0, total_branch_employees: 15 },
    { branch_id: '6', branch_name: 'Axis Global Towers', branch_code: 'AXIS0006', branch_attendance_rate_percent: 92.0, branch_task_completion_rate_percent: 85.0, total_branch_employees: 10 }
  ]);
  const [trainingsList, setTrainingsList] = useState<any[]>([]);
  const [expandedTraining, setExpandedTraining] = useState<string | null>(null);
  
  // NEW: Subordinate Team Attendance Report state (for Managers)
  const [teamAttendance, setTeamAttendance] = useState<any[]>([]);
  const [expandedTeamCourse, setExpandedTeamCourse] = useState<string | null>(null);

  // Calendar parameters
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isDayViewModalOpen, setIsDayViewModalOpen] = useState(false);
  const timelineScrollRef = useRef<ScrollView>(null);

  // Edit Training Modal state (Managers only)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editStatus, setEditStatus] = useState<'scheduled' | 'cancelled' | 'rescheduled'>('scheduled');
  const [editTrainingType, setEditTrainingType] = useState<'online' | 'offline'>('online');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Create Training Form states (Managers only)
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [formStartTime, setFormStartTime] = useState('10:00');
  const [formEndTime, setFormEndTime] = useState('12:00');
  const [formTrainingType, setFormTrainingType] = useState<'online' | 'offline'>('online');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // NEW: Employee Registration Form states (Managers only)
  const [regEmpId, setRegEmpId] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<'employee' | 'manager'>('employee');
  const [regBranchId, setRegBranchId] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);

  // --- GAMIFICATION DYNAMIC CLIENT-SIDE ECOSYSTEM (Employees) ---
  const [employeeXp, setEmployeeXp] = useState(380); // Near level up (500 threshold)
  const [employeeStreak, setEmployeeStreak] = useState(4);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [badgeTriggerAlert, setBadgeTriggerAlert] = useState<{ visible: boolean; badgeName: string; desc: string; icon: any } | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  
  // Gamified Badge List (Unlocked states react dynamically to stats)
  const isComplianceChamp = employeeXp > 400; // High compliance indicator
  const isStreakMaster = employeeStreak >= 3;
  const isEliteScholar = employeeXp >= 500; // Level 2+ reached

  // Personal employee tasks list (Employee Tab 3)
  const [employeeTasksList, setEmployeeTasksList] = useState<any[]>([
    { id: 't-1', title: 'Review Axis Bank Information Security Policy v4', description: 'Review guidelines on password complexity, network access restrictions, and phishing reports.', is_completed: true, xp: 50 },
    { id: 't-2', title: 'Complete LMS Compliance Assessment', description: 'Score above 85% on the InfoSec compliance validation quiz.', is_completed: false, xp: 50 },
    { id: 't-3', title: 'Review Case Study: retail-lending-default-risk.pdf', description: 'Deconstruct default trends from retail portfolios in 2025.', is_completed: false, xp: 50 }
  ]);

  // Coordinates Simulator Toggle (for geofencing manual testing when coordinates are locked)
  const [simLocationMode, setSimLocationMode] = useState<'pune_inside' | 'mumbai_outside' | 'gps'>('pune_inside');

  // Interactive micro-animations (Pulse & Level-Up Spring)
  const streakPulseAnim = useRef(new Animated.Value(1)).current;
  const checkinPulseAnim = useRef(new Animated.Value(1)).current;
  const levelUpScale = useRef(new Animated.Value(0.2)).current;
  const levelUpRotate = useRef(new Animated.Value(0)).current;

  // Custom Alert Popups
  const [customAlert, setCustomAlert] = useState<{ visible: boolean; title: string; message: string } | null>(null);

  const showAlert = (title: string, message: string) => {
    setCustomAlert({ visible: true, title, message });
  };

  // Streaks Pulse micro-animation loop running continuously for gamified visual premiumness
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(streakPulseAnim, { toValue: 1.12, duration: 900, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(streakPulseAnim, { toValue: 1, duration: 950, easing: Easing.ease, useNativeDriver: true })
      ])
    ).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(checkinPulseAnim, { toValue: 1.05, duration: 800, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(checkinPulseAnim, { toValue: 1, duration: 800, easing: Easing.ease, useNativeDriver: true })
      ])
    ).start();
  }, []);

  // Update live timer every second to drive the checkout countdown displays
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync scheduled alarm reminders dynamically whenever trainingsList updates
  useEffect(() => {
    if (trainingsList && trainingsList.length > 0) {
      scheduleTrainingReminders(trainingsList);
    }
  }, [trainingsList]);

  // Fetch data on load or when token changes
  useEffect(() => {
    fetchTrainings();
    fetchAnalytics();
    if (userRole === 'manager') {
      fetchTeamAttendance();
    }
  }, [token]);

  // --- API OPERATIONS ---
  const fetchAnalytics = async () => {
    if (!token || token === 'mock-jwt-token-xyz') return;
    try {
      const response = await fetch('https://axis-calendar-backend.onrender.com/api/v1/reports/branch-completion', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resJson = await response.json();
      if (resJson.success && Array.isArray(resJson.data) && resJson.data.length > 0) {
        setBranchPerformance(resJson.data);
      }
    } catch (err) {
      console.log('Failed fetching live analytics leaderboard:', err);
    }
  };

  const fetchTrainings = async () => {
    setLoading(true);
    try {
      const headers: any = {};
      if (token && token !== 'mock-jwt-token-xyz') {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('https://axis-calendar-backend.onrender.com/api/v1/trainings', {
        headers
      });
      const resJson = await response.json();
      if (resJson.success && Array.isArray(resJson.data)) {
        setTrainingsList(resJson.data);
        
        // Sync total counts dynamically from live db
        const total = resJson.data.length;
        const scheduled = resJson.data.filter((t: any) => t.status === 'scheduled').length;
        const rescheduled = resJson.data.filter((t: any) => t.status === 'rescheduled').length;
        const cancelled = resJson.data.filter((t: any) => t.status === 'cancelled').length;
        setTrainingsCount({ total, scheduled, cancelled, rescheduled });
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (err) {
      console.log('Failed fetching live trainings, loading high-fidelity mock data:', err);
      // Fallback robust mock schedule for offline sandbox liveness (incorporating online/offline types)
      const nowMs = Date.now();
      setTrainingsList([
        {
          id: 'mock-1',
          title: 'InfoSec & Cyber Safeguards',
          description: 'Mandatory certification course covering phishing simulations, corporate active directory password protocols, and clean desk security regulations.',
          scheduled_start: new Date(nowMs - 3600000).toISOString(), // Started 1 hour ago
          scheduled_end: new Date(nowMs - 600000).toISOString(),   // Ended 10 minutes ago -> Within check-in window!
          status: 'scheduled',
          training_type: 'offline', // Requires Pune geofence verification!
          attendance_status: 'pending',
          manager_first: 'Rahul',
          manager_last: 'Sharma'
        },
        {
          id: 'mock-2',
          title: 'Privilege Customer Onboarding',
          description: 'High-touch banking product masterclass covering onboarding compliance checkoffs, KYC verification pipelines, and wealth manager coordination.',
          scheduled_start: new Date(nowMs + 86400000).toISOString(),
          scheduled_end: new Date(nowMs + 93600000).toISOString(),
          status: 'rescheduled',
          training_type: 'online', // Standard bypass geofencing
          attendance_status: 'pending',
          manager_first: 'Rahul',
          manager_last: 'Sharma'
        },
        {
          id: 'mock-3',
          title: 'Retail Credit Risk & Underwriting',
          description: 'Review of domestic loan risk matrices, debt service ratio protection (DSCR), and dynamic collateral evaluation algorithms.',
          scheduled_start: new Date(nowMs + 172800000).toISOString(),
          scheduled_end: new Date(nowMs + 180000000).toISOString(),
          status: 'scheduled',
          training_type: 'online',
          attendance_status: 'pending',
          manager_first: 'Neha',
          manager_last: 'Patel'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamAttendance = async () => {
    if (!token || token === 'mock-jwt-token-xyz') {
      // Offline fallback simulated cohort
      setTeamAttendance([
        {
          id: 'team-mock-1',
          title: 'InfoSec & Cyber Safeguards',
          manager_first: 'Rahul',
          manager_last: 'Sharma',
          scheduled_by_self: true,
          scheduled_start: new Date(Date.now() - 172800000).toISOString(),
          scheduled_end: new Date(Date.now() - 162000000).toISOString(),
          training_type: 'offline',
          attendees: [
            { first_name: 'PrimeEmployee', last_name: '1', employee_id: 'EMP_PRIME_01', attendance_status: 'attended', marked_at: new Date(Date.now() - 162500000).toISOString() },
            { first_name: 'PrimeEmployee', last_name: '2', employee_id: 'EMP_PRIME_02', attendance_status: 'attended', marked_at: new Date(Date.now() - 162100000).toISOString() },
            { first_name: 'PrimeEmployee', last_name: '3', employee_id: 'EMP_PRIME_03', attendance_status: 'absent' },
            { first_name: 'PrimeEmployee', last_name: '4', employee_id: 'EMP_PRIME_04', attendance_status: 'excused' }
          ]
        },
        {
          id: 'team-mock-2',
          title: 'Retail Credit Risk & Underwriting',
          manager_first: 'Rahul',
          manager_last: 'Sharma',
          scheduled_by_self: true,
          scheduled_start: new Date(Date.now() - 86400000).toISOString(),
          scheduled_end: new Date(Date.now() - 72000000).toISOString(),
          training_type: 'online',
          attendees: [
            { first_name: 'PrimeEmployee', last_name: '1', employee_id: 'EMP_PRIME_01', attendance_status: 'attended', marked_at: new Date(Date.now() - 75000000).toISOString() },
            { first_name: 'PrimeEmployee', last_name: '2', employee_id: 'EMP_PRIME_02', attendance_status: 'attended', marked_at: new Date(Date.now() - 73000000).toISOString() },
            { first_name: 'PrimeEmployee', last_name: '5', employee_id: 'EMP_PRIME_05', attendance_status: 'pending' }
          ]
        },
        {
          id: 'team-mock-3',
          title: 'Axis Privilege Customer HNWI Advising',
          manager_first: 'Neha',
          manager_last: 'Patel',
          scheduled_by_self: false,
          scheduled_start: new Date(Date.now() + 86400000).toISOString(),
          scheduled_end: new Date(Date.now() + 93600000).toISOString(),
          training_type: 'online',
          attendees: [
            { first_name: 'Employee', last_name: '101', employee_id: 'EMP_0101', attendance_status: 'pending' },
            { first_name: 'Employee', last_name: '102', employee_id: 'EMP_0102', attendance_status: 'pending' }
          ]
        }
      ]);
      return;
    }

    try {
      const response = await fetch('https://axis-calendar-backend.onrender.com/api/v1/reports/team-attendance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resJson = await response.json();
      if (resJson.success && Array.isArray(resJson.data)) {
        setTeamAttendance(resJson.data);
      }
    } catch (err) {
      console.log('Failed fetching live team reports:', err);
    }
  };

  const handleCreateTraining = async () => {
    if (!formTitle || !formDate || !formStartTime || !formEndTime) {
      showAlert('Axis Course Scheduler', 'Please enter a Title, Date, and Start/End times.');
      return;
    }

    setFormSubmitting(true);
    try {
      const scheduled_start = new Date(`${formDate}T${formStartTime}:00`).toISOString();
      const scheduled_end = new Date(`${formDate}T${formEndTime}:00`).toISOString();

      const payload = {
        title: formTitle,
        description: formDescription,
        scheduled_start,
        scheduled_end,
        target_branch_ids: selectedBranches,
        training_type: formTrainingType
      };

      const headers: any = { 'Content-Type': 'application/json' };
      if (token && token !== 'mock-jwt-token-xyz') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('https://axis-calendar-backend.onrender.com/api/v1/trainings', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const resJson = await response.json();

      if (response.ok && resJson.success) {
        showAlert('Axis Course Scheduler', 'Training Session Created Successfully!');
        setFormTitle('');
        setFormDescription('');
        setSelectedBranches([]);
        fetchTrainings();
        fetchAnalytics();
        if (userRole === 'manager') {
          fetchTeamAttendance();
        }
        setActiveTab('calendar');
      } else {
        showAlert('Axis Course Scheduler', resJson.error || 'Failed to create training.');
      }
    } catch (err) {
      console.log('Error creating training:', err);
      showAlert('Axis Course Scheduler', 'Simulated course scheduled successfully (offline fallback)!');
      const simulated = {
        id: `sim-${Date.now()}`,
        title: formTitle,
        description: formDescription,
        scheduled_start: new Date(`${formDate}T${formStartTime}:00`).toISOString(),
        scheduled_end: new Date(`${formDate}T${formEndTime}:00`).toISOString(),
        status: 'scheduled',
        training_type: formTrainingType,
        attendance_status: 'pending',
        manager_first: 'Rahul',
        manager_last: 'Sharma'
      };
      setTrainingsList((prev) => [simulated, ...prev]);
      setFormTitle('');
      setFormDescription('');
      setSelectedBranches([]);
      setActiveTab('calendar');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdateTraining = async () => {
    if (!editTitle || !editDate || !editStartTime || !editEndTime) {
      showAlert('Axis Course Editor', 'Please enter a Title, Date, and Start/End times.');
      return;
    }

    setEditSubmitting(true);
    try {
      const scheduled_start = new Date(`${editDate}T${editStartTime}:00`).toISOString();
      const scheduled_end = new Date(`${editDate}T${editEndTime}:00`).toISOString();

      const payload = {
        title: editTitle,
        description: editDescription,
        scheduled_start,
        scheduled_end,
        status: editStatus,
        training_type: editTrainingType
      };

      const headers: any = { 'Content-Type': 'application/json' };
      if (token && token !== 'mock-jwt-token-xyz') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`https://axis-calendar-backend.onrender.com/api/v1/trainings/${editingTraining.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });

      const resJson = await response.json();

      if (response.ok && resJson.success) {
        showAlert('Axis Course Editor', 'Training Session Updated Successfully!');
        setEditModalOpen(false);
        setEditingTraining(null);
        fetchTrainings();
        fetchAnalytics();
        if (userRole === 'manager') {
          fetchTeamAttendance();
        }
      } else {
        showAlert('Axis Course Editor', resJson.error || 'Failed to update training.');
      }
    } catch (err) {
      console.log('Error updating training:', err);
      showAlert('Axis Course Editor', 'Simulated update successful (offline fallback)!');
      setTrainingsList((prev) => 
        prev.map(t => t.id === editingTraining.id ? {
          ...t,
          title: editTitle,
          description: editDescription,
          scheduled_start: new Date(`${editDate}T${editStartTime}:00`).toISOString(),
          scheduled_end: new Date(`${editDate}T${editEndTime}:00`).toISOString(),
          status: editStatus,
          training_type: editTrainingType
        } : t)
      );
      setEditModalOpen(false);
      setEditingTraining(null);
    } finally {
      setEditSubmitting(false);
    }
  };

  // NEW: SECURE MANAGER REGISTRATION CALL
  const handleRegisterEmployee = async () => {
    if (!regEmpId || !regFirstName || !regLastName || !regEmail || !regBranchId) {
      showAlert('Axis Directory Services', 'Please fill in all employee fields.');
      return;
    }

    setRegSubmitting(true);
    try {
      const payload = {
        employee_id: regEmpId,
        first_name: regFirstName,
        last_name: regLastName,
        email: regEmail,
        role: regRole,
        branch_id: regBranchId
      };

      const headers: any = { 'Content-Type': 'application/json' };
      if (token && token !== 'mock-jwt-token-xyz') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('https://axis-calendar-backend.onrender.com/api/v1/auth/register', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const resJson = await response.json();

      if (response.ok && resJson.success) {
        showAlert(
          'Axis Directory Services', 
          `Employee registered successfully!\nUnique Code: ${resJson.data.employee_id}\nDefault password seeded: "Password123"`
        );
        // Reset form
        setRegEmpId('');
        setRegFirstName('');
        setRegLastName('');
        setRegEmail('');
        setRegRole('employee');
        fetchAnalytics();
      } else {
        showAlert('Axis Directory Services', resJson.error || 'Registration failed.');
      }
    } catch (err) {
      console.log('Error registering employee:', err);
      showAlert(
        'Axis Directory Services', 
        `[Offline Fallback] Employee registration simulated successfully!\nID: ${regEmpId}\nInitial default credential: Password123`
      );
      setRegEmpId('');
      setRegFirstName('');
      setRegLastName('');
      setRegEmail('');
    } finally {
      setRegSubmitting(false);
    }
  };

  // --- CLIENT-SIDE GEOFENCING & TIMER CHECKS ---
  const handleMarkAttendance = async (training: any) => {
    setLoading(true);
    try {
      let lat = 18.5479; // Default Pune branch coords
      let lng = 73.7728;

      // Coordinate selection setup
      if (simLocationMode === 'gps') {
        // Fetch actual device coordinates
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Location Security', 'Access denied to GPS services. Please grant permission.');
          setLoading(false);
          return;
        }
        const devLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = devLoc.coords.latitude;
        lng = devLoc.coords.longitude;
      } else if (simLocationMode === 'pune_inside') {
        //Pune branch Axis Global Towers inside 50m (approx 10 meters offset)
        lat = 18.54795; 
        lng = 73.77285;
      } else if (simLocationMode === 'mumbai_outside') {
        //Mumbai office (coordinates 18.9219, 72.8336) -> Will fail geofence for Pune!
        lat = 18.9219;
        lng = 72.8336;
      }

      // Hit live backend attendance logger
      const payload = {
        attendance: [{ employee_id: managerId || 'mock-employee-id-123', status: 'attended' }],
        latitude: lat,
        longitude: lng
      };

      const headers: any = { 'Content-Type': 'application/json' };
      if (token && token !== 'mock-jwt-token-xyz') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`https://axis-calendar-backend.onrender.com/api/v1/trainings/${training.id}/attendance`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });

      const resJson = await response.json();

      if (response.ok && resJson.success) {
        triggerAttendanceSuccess(training);
      } else {
        showAlert('Axis Security Check-in', resJson.error || 'Attendance logging rejected.');
      }
    } catch (err: any) {
      console.log('Offline attendance processing...', err);
      // Offline fallback: perform local calculations to ensure fully working simulator testing
      if (training.training_type === 'offline') {
        // Verify geofence locally
        let lat = 18.5479;
        let lng = 73.7728;
        if (simLocationMode === 'pune_inside') {
          lat = 18.54792;
          lng = 73.77282;
        } else if (simLocationMode === 'mumbai_outside') {
          lat = 18.9219;
          lng = 72.8336;
        }

        // Target Pune location
        const targetLat = 18.5479;
        const targetLng = 73.7728;

        const distance = getHaversineDistance(lat, lng, targetLat, targetLng);
        if (distance > 50) {
          showAlert(
            'Axis Geofence Security', 
            `Verification failed. You are currently ${Math.round(distance)}m away from assigned branch (Axis Global Towers Pune), which exceeds the 50m geofence limit.`
          );
          setLoading(false);
          return;
        }
      }
      triggerAttendanceSuccess(training);
    } finally {
      setLoading(false);
    }
  };

  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const triggerAttendanceSuccess = (training: any) => {
    // Modify dynamic state
    setHasCheckedInToday(true);
    setEmployeeStreak(prev => prev + 1);
    
    // Update local trainingsList status
    setTrainingsList(prev => 
      prev.map(t => t.id === training.id ? { ...t, attendance_status: 'attended' } : t)
    );

    // Dynamic XP Reward (+100 XP)
    const newXp = employeeXp + 100;
    setEmployeeXp(newXp);

    // Animate Level Up if crossing threshold
    if (newXp >= 500 && employeeXp < 500) {
      setTimeout(() => {
        setShowLevelUpModal(true);
        Animated.parallel([
          Animated.spring(levelUpScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
          Animated.timing(levelUpRotate, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true })
        ]).start();
      }, 500);
    } else {
      showAlert(
        'Check-in Verified!', 
        `Attendance recorded successfully!\n+100 XP gained!\nYour current check-in streak is now ${employeeStreak + 1} trainings!`
      );
    }
  };

  // Complete personal employee task checklist (Employee Tab 3)
  const handleToggleEmployeeTask = async (taskId: string, isCompleted: boolean) => {
    try {
      // Hit backend API to toggle task state
      if (token && token !== 'mock-jwt-token-xyz') {
        await fetch(`https://axis-calendar-backend.onrender.com/api/v1/trainings/tasks/${taskId}/complete`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ is_completed: !isCompleted })
        });
      }
    } catch (e) {
      console.log('Failed to update task completion remotely, updating local state:', e);
    }

    setEmployeeTasksList(prev => 
      prev.map(t => {
        if (t.id === taskId) {
          const toggledState = !t.is_completed;
          if (toggledState) {
            // Reward +50 XP on dynamic client
            const newXp = employeeXp + 50;
            setEmployeeXp(newXp);
            if (newXp >= 500 && employeeXp < 500) {
              setShowLevelUpModal(true);
              Animated.parallel([
                Animated.spring(levelUpScale, { toValue: 1, friction: 6, useNativeDriver: true }),
                Animated.timing(levelUpRotate, { toValue: 1, duration: 800, useNativeDriver: true })
              ]).start();
            }
          }
          return { ...t, is_completed: toggledState };
        }
        return t;
      })
    );
  };

  // Formulates busy marks and focused highlighting rings on dates
  const getMarkedDates = () => {
    const marked: any = {};
    
    trainingsList.forEach((training) => {
      try {
        const dateStr = new Date(training.scheduled_start).toISOString().split('T')[0];
        
        let dotColor = theme.primary;
        if (training.status === 'rescheduled') {
          dotColor = '#E06B26';
        } else if (training.status === 'cancelled') {
          dotColor = '#6C757D';
        } else if (training.attendance_status === 'attended') {
          dotColor = EMERALD;
        }
 
        marked[dateStr] = {
          marked: true,
          dotColor: dotColor,
        };
      } catch (err) {
        console.log('Error parsing date for marked dot:', err);
      }
    });

    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: theme.primary,
      selectedTextColor: '#FFFFFF',
    };

    return marked;
  };

  const toggleBranchSelection = (branchId: string) => {
    if (selectedBranches.includes(branchId)) {
      setSelectedBranches(selectedBranches.filter(id => id !== branchId));
    } else {
      setSelectedBranches([...selectedBranches, branchId]);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: theme.background },
    textPrimary: { color: theme.textPrimary },
    textSecondary: { color: theme.textSecondary },
    card: { backgroundColor: theme.surface, borderColor: theme.border },
    progressBackground: { backgroundColor: isDark ? '#2D2D3B' : '#E2E8F0' },
    tabBar: { backgroundColor: theme.surface, borderColor: theme.border },
    input: { borderColor: theme.border, color: theme.textPrimary, backgroundColor: isDark ? '#1C1C24' : '#F8FAFC' }
  };

  const spin = levelUpRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // --- RENDERING HELPERS FOR DAY VIEW TIMELINE & EDIT MODAL ---
  const renderDayViewModal = () => {
    const dayTrainings = trainingsList.filter(t => {
      try {
        const tDate = new Date(t.scheduled_start).toISOString().split('T')[0];
        return tDate === selectedDate;
      } catch (e) {
        return false;
      }
    });

    const HOUR_HEIGHT = 80;
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getHourLabel = (h: number) => {
      if (h === 0) return '12 AM';
      if (h < 12) return `${h} AM`;
      if (h === 12) return '12 PM';
      return `${h - 12} PM`;
    };

    let weekdayName = 'MON';
    let dayNum = '25';
    try {
      const parsedDate = new Date(selectedDate);
      weekdayName = parsedDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      dayNum = parsedDate.getDate().toString();
    } catch (e) {}

    return (
      <Modal
        visible={isDayViewModalOpen}
        animationType="slide"
        onRequestClose={() => setIsDayViewModalOpen(false)}
      >
        <View style={[styles.timelineModalRoot, { backgroundColor: theme.background }]}>
          {/* HEADER BAR */}
          <View style={[styles.timelineHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity 
              style={[styles.timelineBackBtn, { borderColor: theme.border }]} 
              onPress={() => setIsDayViewModalOpen(false)}
            >
              <ChevronLeft size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            
            <View style={styles.timelineDateHeader}>
              <Text style={[styles.timelineWeekdayText, dynamicStyles.textSecondary]}>{weekdayName}</Text>
              <Text style={[styles.timelineDayText, dynamicStyles.textPrimary]}>{dayNum}</Text>
            </View>
            
            <View style={{ width: 44 }} />
          </View>

          {/* Timezone Label Tick */}
          <View style={styles.timezoneBar}>
            <Text style={[styles.timezoneText, dynamicStyles.textSecondary]}>GMT+05:30</Text>
          </View>

          {/* Timeline Grid Scroll */}
          <ScrollView 
            ref={timelineScrollRef}
            contentContainerStyle={{ height: 24 * HOUR_HEIGHT + 40 }}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.timelineGridContainer}>
              {/* Hour Grid Rows */}
              {hours.map((h) => (
                <View key={h} style={[styles.hourRow, { height: HOUR_HEIGHT }]}>
                  <View style={styles.hourLabelCol}>
                    <Text style={[styles.hourLabelText, dynamicStyles.textSecondary]}>
                      {h > 0 ? getHourLabel(h) : ''}
                    </Text>
                  </View>
                  <View style={[styles.gridLineRight, { borderTopColor: theme.border }]} />
                </View>
              ))}

              {/* Vertical timeline axis border line */}
              <View style={[styles.verticalTimelineDivider, { left: 75, backgroundColor: theme.border }]} />

              {/* Event Cards Overlay */}
              <View style={[styles.eventsOverlayContainer, { left: 75 }]}>
                {dayTrainings.map((training, index) => {
                  try {
                    const start = new Date(training.scheduled_start);
                    const end = new Date(training.scheduled_end);

                    const startHour = start.getHours() + start.getMinutes() / 60;
                    const endHour = end.getHours() + end.getMinutes() / 60;
                    const duration = Math.max(0.75, endHour - startHour);

                    const cardTop = startHour * HOUR_HEIGHT;
                    const cardHeight = duration * HOUR_HEIGHT;

                    let statusColor = theme.primary;
                    if (training.status === 'rescheduled') {
                      statusColor = '#E06B26';
                    } else if (training.status === 'cancelled') {
                      statusColor = '#6C757D';
                    } else if (training.attendance_status === 'attended') {
                      statusColor = EMERALD;
                    }

                    const startTimeStr = start.toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit', hour12: false
                    });
                    const endTimeStr = end.toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit', hour12: false
                    });

                    const cardLeft = index * 12;
                    const cardRight = 10;

                    return (
                      <TouchableOpacity
                        key={training.id || index}
                        style={[
                          styles.timelineEventCard, 
                          { 
                            top: cardTop, 
                            height: cardHeight, 
                            left: cardLeft, 
                            right: cardRight,
                            borderLeftColor: statusColor,
                            backgroundColor: isDark ? 'rgba(132, 20, 57, 0.25)' : 'rgba(132, 20, 57, 0.12)'
                          }
                        ]}
                        activeOpacity={0.85}
                        onPress={() => {
                          if (userRole === 'manager') {
                            setEditingTraining(training);
                            setEditTitle(training.title);
                            setEditDescription(training.description || '');
                            setEditDate(selectedDate);
                            setEditStartTime(startTimeStr);
                            setEditEndTime(endTimeStr);
                            setEditStatus(training.status);
                            setEditTrainingType(training.training_type || 'online');
                            setEditModalOpen(true);
                          } else {
                            setExpandedTraining(training.id);
                            setIsDayViewModalOpen(false);
                          }
                        }}
                      >
                        <Text style={[styles.timelineCardTitle, dynamicStyles.textPrimary]} numberOfLines={1}>
                          {training.title}
                        </Text>
                        <Text style={[styles.timelineCardTime, dynamicStyles.textSecondary]} numberOfLines={1}>
                          {startTimeStr} - {endTimeStr} ({training.training_type?.toUpperCase()})
                        </Text>
                        
                        {userRole === 'manager' && (
                          <View style={styles.timelineEditIndicator}>
                            <Edit3 size={10} color={statusColor} />
                            <Text style={[styles.timelineEditText, { color: statusColor }]}>Modify</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  } catch (err) {
                    console.log('Error rendering timeline event card:', err);
                    return null;
                  }
                })}
              </View>

            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderEditCourseModal = () => {
    if (!editingTraining) return null;

    return (
      <Modal
        visible={editModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setEditModalOpen(false);
          setEditingTraining(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidCenter}
          >
            <View style={[styles.editModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.alertAccentBand, { backgroundColor: theme.primary }]} />
              
              <ScrollView contentContainerStyle={styles.editModalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.editModalHeader}>
                  <Text style={[styles.editModalTitle, dynamicStyles.textPrimary]}>Modify Course Session</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setEditModalOpen(false);
                      setEditingTraining(null);
                    }}
                  >
                    <X size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Course Title */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Training Title</Text>
                  <TextInput
                    style={[styles.formInput, dynamicStyles.input]}
                    placeholder="e.g. Retail Credit Risk Masterclass"
                    placeholderTextColor={theme.textSecondary}
                    value={editTitle}
                    onChangeText={setEditTitle}
                  />
                </View>

                {/* Course Description */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Description / Syllabus</Text>
                  <TextInput
                    style={[styles.formInput, dynamicStyles.input, styles.textArea]}
                    placeholder="Enter training syllabus..."
                    placeholderTextColor={theme.textSecondary}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Date selection */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Scheduled Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[styles.formInput, dynamicStyles.input]}
                    placeholder="e.g. 2026-05-24"
                    placeholderTextColor={theme.textSecondary}
                    value={editDate}
                    onChangeText={setEditDate}
                  />
                </View>

                {/* Time fields */}
                <View style={styles.timeRow}>
                  <View style={[styles.formGroup, styles.halfCol]}>
                    <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Start Time (HH:MM)</Text>
                    <TextInput
                      style={[styles.formInput, dynamicStyles.input]}
                      placeholder="e.g. 10:00"
                      placeholderTextColor={theme.textSecondary}
                      value={editStartTime}
                      onChangeText={setEditStartTime}
                    />
                  </View>

                  <View style={[styles.formGroup, styles.halfCol]}>
                    <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>End Time (HH:MM)</Text>
                    <TextInput
                      style={[styles.formInput, dynamicStyles.input]}
                      placeholder="e.g. 12:00"
                      placeholderTextColor={theme.textSecondary}
                      value={editEndTime}
                      onChangeText={setEditEndTime}
                    />
                  </View>
                </View>

                {/* Training Session Type (Online vs Offline) */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Training Mode</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity 
                      style={[styles.toggleBtn, editTrainingType === 'online' && { backgroundColor: theme.primary }]}
                      onPress={() => setEditTrainingType('online')}
                    >
                      <Text style={[styles.toggleBtnText, editTrainingType === 'online' ? styles.whiteText : dynamicStyles.textPrimary]}>Online (No Geofence)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.toggleBtn, editTrainingType === 'offline' && { backgroundColor: theme.primary }]}
                      onPress={() => setEditTrainingType('offline')}
                    >
                      <Text style={[styles.toggleBtnText, editTrainingType === 'offline' ? styles.whiteText : dynamicStyles.textPrimary]}>Offline (Geofenced)</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Status Selection */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Session Status</Text>
                  <View style={styles.statusSelectRow}>
                    {(['scheduled', 'rescheduled', 'cancelled'] as const).map((st) => {
                      const isSelected = editStatus === st;
                      let activeColor = theme.primary;
                      if (st === 'rescheduled') activeColor = '#E06B26';
                      if (st === 'cancelled') activeColor = '#6C757D';

                      return (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.statusSelectItem,
                            { borderColor: theme.border },
                            isSelected && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderColor: activeColor }
                          ]}
                          onPress={() => setEditStatus(st)}
                        >
                          <View style={[
                            styles.checkboxIndicator,
                            { borderColor: activeColor },
                            isSelected && { backgroundColor: activeColor }
                          ]} />
                          <Text style={[styles.statusSelectLabel, dynamicStyles.textPrimary, isSelected && { fontWeight: 'bold' }]}>
                            {st.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Submit & Cancel Buttons */}
                <View style={styles.editActionRow}>
                  <TouchableOpacity
                    style={[styles.editCancelBtn, { borderColor: theme.border }]}
                    onPress={() => {
                      setEditModalOpen(false);
                      setEditingTraining(null);
                    }}
                  >
                    <Text style={[styles.editCancelBtnText, dynamicStyles.textPrimary]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.editSaveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleUpdateTraining}
                    disabled={editSubmitting}
                  >
                    {editSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.editSaveBtnText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  // --- RENDERING MAIN INTERFACE BY ROLE ---
  return (
    <View style={[styles.root, dynamicStyles.container]}>
      {/* HEADER BAR */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.flexShrink}>
          <Text style={[styles.title, dynamicStyles.textPrimary]} numberOfLines={1}>
            {userRole === 'manager' ? 'Axis Manager Portal' : 'Axis Employee Hub'}
          </Text>
          <Text style={[styles.subtitle, dynamicStyles.textSecondary]} numberOfLines={1}>
            Welcome, {firstName} • {userBranchName}
          </Text>
        </View>
        
        {/* Sleek Dark Mode Toggle Header Button */}
        <TouchableOpacity style={[styles.headerBtn, { borderColor: theme.border }]} onPress={toggleTheme}>
          {isDark ? (
            <Sun size={20} color="#FFC72C" />
          ) : (
            <Moon size={20} color={theme.primary} />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.flexBox} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* ======================================================== */}
          {/* MANAGER DASHBOARD VIEW                                   */}
          {/* ======================================================== */}
          {userRole === 'manager' && activeTab === 'reports' && (
            <View>
              {/* Metric Card Summary Row */}
              <View style={styles.cardRow}>
                <View style={[styles.miniCard, dynamicStyles.card]}>
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(132, 20, 57, 0.1)' }]}>
                    <CalendarIcon size={20} color={theme.primary} />
                  </View>
                  <Text style={[styles.miniCardVal, dynamicStyles.textPrimary]}>{trainingsCount.total}</Text>
                  <Text style={[styles.miniCardLabel, dynamicStyles.textSecondary]}>Total Courses</Text>
                </View>

                <View style={[styles.miniCard, dynamicStyles.card]}>
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 124, 65, 0.1)' }]}>
                    <Users size={20} color="#107C41" />
                  </View>
                  <Text style={[styles.miniCardVal, { color: '#107C41' }]}>{attendanceRates[0].percentage}%</Text>
                  <Text style={[styles.miniCardLabel, dynamicStyles.textSecondary]}>Compliance Rate</Text>
                </View>
              </View>

              {/* NEW: Subordinate Team Attendance Report Tracker (User Brain integration) */}
              <View style={[styles.sectionCard, dynamicStyles.card]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionTitle, dynamicStyles.textPrimary]}>Team Attendance Tracker</Text>
                    <Text style={[styles.sectionSub, dynamicStyles.textSecondary]}> Roster details of sessions scheduled by you or subordinates</Text>
                  </View>
                  <TouchableOpacity style={styles.smallRefresh} onPress={fetchTeamAttendance}>
                    <RefreshCw size={14} color={theme.primary} />
                  </TouchableOpacity>
                </View>

                {teamAttendance.length === 0 ? (
                  <Text style={[styles.emptyLabel, dynamicStyles.textSecondary]}>No team training data loaded.</Text>
                ) : (
                  teamAttendance.map((teamCourse) => {
                    const isCourseExpanded = expandedTeamCourse === teamCourse.id;
                    const attendedCount = teamCourse.attendees?.filter((a: any) => a.attendance_status === 'attended').length || 0;
                    const totalInvites = teamCourse.attendees?.length || 0;
                    const rate = totalInvites > 0 ? Math.round((attendedCount / totalInvites) * 100) : 0;

                    return (
                      <View key={teamCourse.id} style={[styles.teamCourseBlock, { borderColor: theme.border }]}>
                        <TouchableOpacity 
                          style={styles.teamCourseHeader}
                          onPress={() => setExpandedTeamCourse(isCourseExpanded ? null : teamCourse.id)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.flexBox}>
                            <Text style={[styles.teamCourseTitle, dynamicStyles.textPrimary]}>{teamCourse.title}</Text>
                            <Text style={[styles.teamCourseMeta, dynamicStyles.textSecondary]}>
                              Lead: {teamCourse.manager_first} {teamCourse.manager_last} ({teamCourse.training_type?.toUpperCase()})
                            </Text>
                          </View>
                          
                          <View style={styles.teamCourseStatusCol}>
                            <Text style={[styles.teamCourseRate, { color: rate >= 80 ? EMERALD : theme.primary }]}>
                              {attendedCount}/{totalInvites} ({rate}%)
                            </Text>
                            {isCourseExpanded ? (
                              <ChevronUp size={16} color={theme.textSecondary} />
                            ) : (
                              <ChevronDown size={16} color={theme.textSecondary} />
                            )}
                          </View>
                        </TouchableOpacity>

                        {isCourseExpanded && (
                          <View style={[styles.teamRosterBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }]}>
                            <Text style={[styles.rosterHeadline, dynamicStyles.textPrimary]}>Enrolled Staff Attendance Details</Text>
                            {teamCourse.attendees.length === 0 ? (
                              <Text style={[styles.rosterEmpty, dynamicStyles.textSecondary]}>No attendees registered to this program.</Text>
                            ) : (
                              teamCourse.attendees.map((attendee: any, aIdx: number) => {
                                let badgeColor = '#6C757D';
                                if (attendee.attendance_status === 'attended') badgeColor = EMERALD;
                                if (attendee.attendance_status === 'absent') badgeColor = '#EF4444';
                                if (attendee.attendance_status === 'excused') badgeColor = AMBER;

                                return (
                                  <View key={aIdx} style={[styles.rosterRow, { borderBottomColor: theme.border }]}>
                                    <View>
                                      <Text style={[styles.rosterName, dynamicStyles.textPrimary]}>
                                        {attendee.first_name} {attendee.last_name}
                                      </Text>
                                      <Text style={[styles.rosterEmpId, dynamicStyles.textSecondary]}>
                                        {attendee.employee_id} • {attendee.branch_name}
                                      </Text>
                                    </View>
                                    
                                    <View style={styles.rosterStatusBlock}>
                                      <View style={[styles.rosterBadge, { backgroundColor: badgeColor }]}>
                                        <Text style={styles.rosterBadgeText}>{attendee.attendance_status.toUpperCase()}</Text>
                                      </View>
                                      {attendee.marked_at && (
                                        <Text style={[styles.markedAtText, dynamicStyles.textSecondary]}>
                                          {new Date(attendee.marked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                );
                              })
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>

              {/* Stacked Attendance Distribution */}
              <View style={[styles.sectionCard, dynamicStyles.card]}>
                <Text style={[styles.sectionTitle, dynamicStyles.textPrimary]}>Global Attendance Distribution</Text>
                <Text style={[styles.sectionSub, dynamicStyles.textSecondary]}>Overall stats for enrolled employee rosters</Text>
                
                <View style={styles.graphContainer}>
                  <View style={styles.stackedBar}>
                    {attendanceRates.map((rate, idx) => (
                      <View 
                        key={idx} 
                        style={{
                          flex: rate.percentage, 
                          backgroundColor: rate.color, 
                          height: 12,
                          borderTopLeftRadius: idx === 0 ? 6 : 0,
                          borderBottomLeftRadius: idx === 0 ? 6 : 0,
                          borderTopRightRadius: idx === attendanceRates.length - 1 ? 6 : 0,
                          borderBottomRightRadius: idx === attendanceRates.length - 1 ? 6 : 0,
                        }} 
                      />
                    ))}
                  </View>

                  <View style={styles.legendContainer}>
                    {attendanceRates.map((rate, idx) => (
                      <View key={idx} style={styles.legendItem}>
                        <View style={[styles.legendIndicator, { backgroundColor: rate.color }]} />
                        <Text style={[styles.legendLabel, dynamicStyles.textPrimary]}>
                          {rate.label}: <Text style={styles.boldText}>{rate.percentage}%</Text> ({rate.count} users)
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {/* Leaderboard branch rates */}
              <View style={[styles.sectionCard, dynamicStyles.card]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionTitle, dynamicStyles.textPrimary]}>Branch Leaderboards</Text>
                    <Text style={[styles.sectionSub, dynamicStyles.textSecondary]}>Completion index across 5 major corporate hubs</Text>
                  </View>
                  <TouchableOpacity style={styles.smallRefresh} onPress={fetchAnalytics}>
                    <RefreshCw size={14} color={theme.primary} />
                  </TouchableOpacity>
                </View>

                {branchPerformance.map((branch, idx) => (
                  <View key={idx} style={styles.branchRow}>
                    <View style={styles.branchMeta}>
                      <Text style={[styles.branchName, dynamicStyles.textPrimary]}>{branch.branch_name}</Text>
                      <Text style={[styles.branchCode, dynamicStyles.textSecondary]}>
                        {branch.branch_code} • {branch.total_branch_employees} Employees
                      </Text>
                    </View>

                    <View style={styles.branchMetrics}>
                      <View style={styles.barBlock}>
                        <View style={styles.barLabelRow}>
                          <Text style={[styles.barLabel, dynamicStyles.textSecondary]}>Attendance</Text>
                          <Text style={[styles.barVal, dynamicStyles.textPrimary]}>
                            {Math.round(branch.branch_attendance_rate_percent || 0)}%
                          </Text>
                        </View>
                        <View style={[styles.progressBarBg, dynamicStyles.progressBackground]}>
                          <View style={[styles.progressBarFill, { width: `${branch.branch_attendance_rate_percent || 0}%`, backgroundColor: theme.primary }]} />
                        </View>
                      </View>

                      <View style={styles.barBlock}>
                        <View style={styles.barLabelRow}>
                          <Text style={[styles.barLabel, dynamicStyles.textSecondary]}>Tasks Complete</Text>
                          <Text style={[styles.barVal, dynamicStyles.textPrimary]}>
                            {Math.round(branch.branch_task_completion_rate_percent || 0)}%
                          </Text>
                        </View>
                        <View style={[styles.progressBarBg, dynamicStyles.progressBackground]}>
                          <View style={[styles.progressBarFill, { width: `${branch.branch_task_completion_rate_percent || 0}%`, backgroundColor: '#107C41' }]} />
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* MANAGER: SCHEDULING FORM TAB                             */}
          {/* ======================================================== */}
          {userRole === 'manager' && activeTab === 'create' && (
            <View style={[styles.formContainer, dynamicStyles.card]}>
              <View style={styles.formHeader}>
                <View style={[styles.formIconCircle, { backgroundColor: 'rgba(132, 20, 57, 0.1)' }]}>
                  <Plus size={22} color={theme.primary} />
                </View>
                <Text style={[styles.formMainTitle, dynamicStyles.textPrimary]}>Schedule Training Course</Text>
              </View>
              <Text style={[styles.formSubtitle, dynamicStyles.textSecondary]}>
                Schedule a new development course and register employee rosters from selected branches automatically.
              </Text>

              {/* Course Title */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Training Title</Text>
                <TextInput
                  style={[styles.formInput, dynamicStyles.input]}
                  placeholder="e.g. Retail Credit Risk Masterclass"
                  placeholderTextColor={theme.textSecondary}
                  value={formTitle}
                  onChangeText={setFormTitle}
                />
              </View>

              {/* Course Description */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Description / Syllabus</Text>
                <TextInput
                  style={[styles.formInput, dynamicStyles.input, styles.textArea]}
                  placeholder="Enter training syllabus, required compliance tasks..."
                  placeholderTextColor={theme.textSecondary}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Date selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Scheduled Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.formInput, dynamicStyles.input]}
                  placeholder="e.g. 2026-05-24"
                  placeholderTextColor={theme.textSecondary}
                  value={formDate}
                  onChangeText={setFormDate}
                />
              </View>

              {/* Time fields */}
              <View style={styles.timeRow}>
                <View style={[styles.formGroup, styles.halfCol]}>
                  <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Start Time (HH:MM)</Text>
                  <TextInput
                    style={[styles.formInput, dynamicStyles.input]}
                    placeholder="e.g. 10:00"
                    placeholderTextColor={theme.textSecondary}
                    value={formStartTime}
                    onChangeText={setFormStartTime}
                  />
                </View>

                <View style={[styles.formGroup, styles.halfCol]}>
                  <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>End Time (HH:MM)</Text>
                  <TextInput
                    style={[styles.formInput, dynamicStyles.input]}
                    placeholder="e.g. 12:00"
                    placeholderTextColor={theme.textSecondary}
                    value={formEndTime}
                    onChangeText={setFormEndTime}
                  />
                </View>
              </View>

              {/* NEW: Training Session Mode selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Training Location Mode</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, formTrainingType === 'online' && { backgroundColor: theme.primary }]}
                    onPress={() => setFormTrainingType('online')}
                  >
                    <Text style={[styles.toggleBtnText, formTrainingType === 'online' ? styles.whiteText : dynamicStyles.textPrimary]}>Online (Virtual Bypass)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, formTrainingType === 'offline' && { backgroundColor: theme.primary }]}
                    onPress={() => setFormTrainingType('offline')}
                  >
                    <Text style={[styles.toggleBtnText, formTrainingType === 'offline' ? styles.whiteText : dynamicStyles.textPrimary]}>Offline (Geofenced)</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.branchTip, dynamicStyles.textSecondary, { marginTop: 6 }]}>
                  {formTrainingType === 'offline' 
                    ? 'Offline trainings enforce a strict 50m branch geofence boundary constraint upon attendance marking.' 
                    : 'Online sessions allow employees to check-in instantly from any location.'
                  }
                </Text>
              </View>

              {/* Target branches list */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Target Hubs / Branches</Text>
                <Text style={[styles.branchTip, dynamicStyles.textSecondary]}>
                  Enrolls all staff assigned to checked branches automatically.
                </Text>
                
                <View style={styles.checkboxList}>
                  {branchPerformance.map((branch) => {
                    const isSelected = selectedBranches.includes(branch.branch_id);
                    return (
                      <TouchableOpacity
                        key={branch.branch_id}
                        style={[
                          styles.checkboxItem, 
                          { borderColor: theme.border },
                          isSelected && { backgroundColor: 'rgba(132, 20, 57, 0.05)', borderColor: theme.primary }
                        ]}
                        onPress={() => toggleBranchSelection(branch.branch_id)}
                        activeOpacity={0.8}
                      >
                        <View style={[
                          styles.checkboxIndicator,
                          { borderColor: theme.primary },
                          isSelected && { backgroundColor: theme.primary }
                        ]} />
                        <Text style={[styles.checkboxLabel, dynamicStyles.textPrimary, isSelected && { fontWeight: 'bold' }]}>
                          {branch.branch_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: theme.primary }]}
                onPress={handleCreateTraining}
                disabled={formSubmitting}
              >
                {formSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Schedule Course Session</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ======================================================== */}
          {/* NEW TAB: MANAGER REGISTER NEW EMPLOYEES                   */}
          {/* ======================================================== */}
          {userRole === 'manager' && activeTab === 'register' && (
            <View style={[styles.formContainer, dynamicStyles.card]}>
              <View style={styles.formHeader}>
                <View style={[styles.formIconCircle, { backgroundColor: 'rgba(16, 124, 65, 0.1)' }]}>
                  <UserPlus size={22} color={EMERALD} />
                </View>
                <Text style={[styles.formMainTitle, dynamicStyles.textPrimary]}>Register New Employee</Text>
              </View>
              <Text style={[styles.formSubtitle, dynamicStyles.textSecondary]}>
                Securely provision new employee records inside Axis Active Directory to link payroll and training calendars.
              </Text>

              {/* Employee Code / ID */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Employee ID (e.g. EMP_PRIME_11)</Text>
                <TextInput
                  style={[styles.formInput, dynamicStyles.input]}
                  placeholder="e.g. EMP_PRIME_11"
                  placeholderTextColor={theme.textSecondary}
                  value={regEmpId}
                  onChangeText={setRegEmpId}
                  autoCapitalize="characters"
                />
              </View>

              {/* First Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>First Name</Text>
                <TextInput
                  style={[styles.formInput, dynamicStyles.input]}
                  placeholder="First name"
                  placeholderTextColor={theme.textSecondary}
                  value={regFirstName}
                  onChangeText={setRegFirstName}
                />
              </View>

              {/* Last Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Last Name</Text>
                <TextInput
                  style={[styles.formInput, dynamicStyles.input]}
                  placeholder="Last name"
                  placeholderTextColor={theme.textSecondary}
                  value={regLastName}
                  onChangeText={setRegLastName}
                />
              </View>

              {/* Corporate Email */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Corporate Email Address</Text>
                <TextInput
                  style={[styles.formInput, dynamicStyles.input]}
                  placeholder="e.g. employee.name@axisbank.com"
                  placeholderTextColor={theme.textSecondary}
                  value={regEmail}
                  onChangeText={setRegEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Role Toggle */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Organizational Role</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, regRole === 'employee' && { backgroundColor: EMERALD }]}
                    onPress={() => setRegRole('employee')}
                  >
                    <Text style={[styles.toggleBtnText, regRole === 'employee' ? styles.whiteText : dynamicStyles.textPrimary]}>Standard Employee</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, regRole === 'manager' && { backgroundColor: EMERALD }]}
                    onPress={() => setRegRole('manager')}
                  >
                    <Text style={[styles.toggleBtnText, regRole === 'manager' ? styles.whiteText : dynamicStyles.textPrimary]}>Branch Manager</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Branch Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, dynamicStyles.textPrimary]}>Assigned Branch Hub</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchSelectScroll}>
                  {branchPerformance.map((br) => {
                    const isSelected = regBranchId === br.branch_id;
                    return (
                      <TouchableOpacity
                        key={br.branch_id}
                        style={[
                          styles.branchSelectCard,
                          { borderColor: theme.border },
                          isSelected && { borderColor: EMERALD, backgroundColor: 'rgba(16, 124, 65, 0.05)' }
                        ]}
                        onPress={() => setRegBranchId(br.branch_id)}
                      >
                        <Text style={[styles.branchSelectName, dynamicStyles.textPrimary, isSelected && { fontWeight: 'bold' }]}>
                          {br.branch_name}
                        </Text>
                        <Text style={[styles.branchSelectCode, dynamicStyles.textSecondary]}>
                          {br.branch_code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Submit Registration */}
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: EMERALD }]}
                onPress={handleRegisterEmployee}
                disabled={regSubmitting}
              >
                {regSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Provision Active Account</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ======================================================== */}
          {/* ======================================================== */}
          {/* EMPLOYEE GAMIFIED DASHBOARD VIEW (Role logic bypass)       */}
          {/* ======================================================== */}
          {/* ======================================================== */}
          {userRole === 'employee' && activeTab === 'dashboard' && (
            <View>
              {/* Premium Glassmorphic Personal Level Card */}
              <View style={[styles.gamifiedLevelCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {/* Visual Glow Header */}
                <View style={styles.gamifiedGlowHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(132, 20, 57, 0.12)' }]}>
                    <Trophy size={22} color={theme.primary} />
                  </View>
                  
                  <View style={styles.flexBox}>
                    <Text style={[styles.gamifiedRankTitle, dynamicStyles.textPrimary]}>
                      {employeeXp >= 500 ? 'Level 2: Compliance Specialist' : 'Level 1: Compliance Cadet'}
                    </Text>
                    <Text style={[styles.gamifiedRankSubtitle, dynamicStyles.textSecondary]}>
                      {employeeXp} / 500 XP to next credential
                    </Text>
                  </View>
                  
                  <View style={[styles.gamifiedStreakBadge, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FEF3C7' }]}>
                    <Animated.View style={{ transform: [{ scale: streakPulseAnim }] }}>
                      <Flame size={18} color={AMBER} fill={AMBER} />
                    </Animated.View>
                    <Text style={[styles.gamifiedStreakText, { color: AMBER }]}>{employeeStreak} Day Streak</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={[styles.xpBarBg, dynamicStyles.progressBackground]}>
                  <View style={[styles.xpBarFill, { width: `${(employeeXp % 500) / 5}%`, backgroundColor: theme.primary }]} />
                </View>

                <View style={styles.xpCaptionRow}>
                  <Text style={[styles.xpCaptionText, dynamicStyles.textSecondary]}>
                    Keep up your check-in streak to multiply XP multiplier!
                  </Text>
                  <View style={styles.sparkleIconRow}>
                    <Sparkles size={12} color={theme.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.xpBonusText, { color: theme.primary }]}>x1.2 Boost Active</Text>
                  </View>
                </View>
              </View>

              {/* Compliance circular progress score row */}
              <View style={styles.cardRow}>
                {/* Circular indicator style box */}
                <View style={[styles.circularMetricCard, dynamicStyles.card]}>
                  <View style={styles.circularRow}>
                    {/* Visual styled indicator ring */}
                    <View style={[styles.outerProgressCircle, { borderColor: EMERALD }]}>
                      <Text style={[styles.innerProgressPercent, dynamicStyles.textPrimary]}>92%</Text>
                    </View>
                    <View style={styles.flexBox}>
                      <Text style={[styles.circularTitle, dynamicStyles.textPrimary]}>Compliance Index</Text>
                      <Text style={[styles.circularDesc, dynamicStyles.textSecondary]}>Overall attendance success rate</Text>
                    </View>
                  </View>
                </View>

                {/* Mini Metric Card: Completed Tasks */}
                <View style={[styles.miniTasksCard, dynamicStyles.card]}>
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                    <CheckSquare size={20} color={COBALT} />
                  </View>
                  <Text style={[styles.miniCardVal, dynamicStyles.textPrimary]}>
                    {employeeTasksList.filter(t => t.is_completed).length} / {employeeTasksList.length}
                  </Text>
                  <Text style={[styles.miniCardLabel, dynamicStyles.textSecondary]}>Checklist Tasks Done</Text>
                </View>
              </View>

              {/* Achievement Badges Carousel Section */}
              <View style={[styles.sectionCard, dynamicStyles.card]}>
                <Text style={[styles.sectionTitle, dynamicStyles.textPrimary]}>Unlocked Achievement Badges</Text>
                <Text style={[styles.sectionSub, dynamicStyles.textSecondary]}>Earn visual medals for compliant behaviors</Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
                  
                  {/* Badge 1: Compliance Champion */}
                  <TouchableOpacity 
                    style={[styles.badgeCard, isComplianceChamp ? styles.activeBadgeBorder : styles.lockedBadgeBorder]}
                    onPress={() => setBadgeTriggerAlert({
                      visible: true,
                      badgeName: 'Compliance Champion',
                      desc: 'Awarded to elite employees maintaining an overall training attendance index above 90%. Ensures solid institutional risk control!',
                      icon: <Award size={48} color={isComplianceChamp ? '#FFD700' : '#9CA3AF'} fill={isComplianceChamp ? '#FFD700' : 'none'} />
                    })}
                  >
                    <View style={[styles.badgeIconBox, !isComplianceChamp && styles.dimmedFilter]}>
                      <Award size={36} color={isComplianceChamp ? '#FFD700' : '#9CA3AF'} fill={isComplianceChamp ? '#FFD700' : 'none'} />
                    </View>
                    <Text style={[styles.badgeLabelText, dynamicStyles.textPrimary]} numberOfLines={1}>Compliance Champ</Text>
                    <Text style={[styles.badgeStatusText, { color: isComplianceChamp ? EMERALD : theme.textSecondary }]}>
                      {isComplianceChamp ? 'Unlocked' : 'Locked'}
                    </Text>
                  </TouchableOpacity>

                  {/* Badge 2: Streak Starter */}
                  <TouchableOpacity 
                    style={[styles.badgeCard, isStreakMaster ? styles.activeBadgeBorder : styles.lockedBadgeBorder]}
                    onPress={() => setBadgeTriggerAlert({
                      visible: true,
                      badgeName: 'Streak Master',
                      desc: 'Awarded for checking in for 3 or more courses consecutively! Demonstrates rigorous compliance commitment.',
                      icon: <Flame size={48} color={isStreakMaster ? AMBER : '#9CA3AF'} fill={isStreakMaster ? AMBER : 'none'} />
                    })}
                  >
                    <View style={[styles.badgeIconBox, !isStreakMaster && styles.dimmedFilter]}>
                      <Flame size={36} color={isStreakMaster ? AMBER : '#9CA3AF'} fill={isStreakMaster ? AMBER : 'none'} />
                    </View>
                    <Text style={[styles.badgeLabelText, dynamicStyles.textPrimary]} numberOfLines={1}>Streak Master</Text>
                    <Text style={[styles.badgeStatusText, { color: isStreakMaster ? EMERALD : theme.textSecondary }]}>
                      {isStreakMaster ? 'Unlocked' : 'Locked'}
                    </Text>
                  </TouchableOpacity>

                  {/* Badge 3: Elite Scholar */}
                  <TouchableOpacity 
                    style={[styles.badgeCard, isEliteScholar ? styles.activeBadgeBorder : styles.lockedBadgeBorder]}
                    onPress={() => setBadgeTriggerAlert({
                      visible: true,
                      badgeName: 'Elite Scholar',
                      desc: 'Reach Level 2 (500+ XP) by completing courses and checklist task sheets. Represents compliance mastery.',
                      icon: <Trophy size={48} color={isEliteScholar ? COBALT : '#9CA3AF'} fill={isEliteScholar ? COBALT : 'none'} />
                    })}
                  >
                    <View style={[styles.badgeIconBox, !isEliteScholar && styles.dimmedFilter]}>
                      <Trophy size={36} color={isEliteScholar ? COBALT : '#9CA3AF'} fill={isEliteScholar ? COBALT : 'none'} />
                    </View>
                    <Text style={[styles.badgeLabelText, dynamicStyles.textPrimary]} numberOfLines={1}>Elite Scholar</Text>
                    <Text style={[styles.badgeStatusText, { color: isEliteScholar ? EMERALD : theme.textSecondary }]}>
                      {isEliteScholar ? 'Unlocked' : 'Locked'}
                    </Text>
                  </TouchableOpacity>

                  {/* Badge 4: Location Pathfinder */}
                  <TouchableOpacity 
                    style={[styles.badgeCard, hasCheckedInToday ? styles.activeBadgeBorder : styles.lockedBadgeBorder]}
                    onPress={() => setBadgeTriggerAlert({
                      visible: true,
                      badgeName: 'Location Pathfinder',
                      desc: 'Awarded for executing a high-precision geofenced branch check-in! Shows secure physical workplace authentication.',
                      icon: <MapPin size={48} color={hasCheckedInToday ? EMERALD : '#9CA3AF'} />
                    })}
                  >
                    <View style={[styles.badgeIconBox, !hasCheckedInToday && styles.dimmedFilter]}>
                      <MapPin size={36} color={hasCheckedInToday ? EMERALD : '#9CA3AF'} />
                    </View>
                    <Text style={[styles.badgeLabelText, dynamicStyles.textPrimary]} numberOfLines={1}>Pathfinder</Text>
                    <Text style={[styles.badgeStatusText, { color: hasCheckedInToday ? EMERALD : theme.textSecondary }]}>
                      {hasCheckedInToday ? 'Unlocked' : 'Locked'}
                    </Text>
                  </TouchableOpacity>

                </ScrollView>
              </View>

              {/* Dynamic compliance prompt banner */}
              <View style={[styles.complianceTipBox, { backgroundColor: isDark ? 'rgba(132, 20, 57, 0.08)' : 'rgba(132, 20, 57, 0.04)', borderColor: theme.primary }]}>
                <Bell size={18} color={theme.primary} style={{ marginRight: 12 }} />
                <View style={styles.flexBox}>
                  <Text style={[styles.complianceTipTitle, { color: theme.primary }]}>Upcoming Secure Check-in Alert</Text>
                  <Text style={[styles.complianceTipText, dynamicStyles.textSecondary]}>
                    Ensure your location services are enabled. Offline course attendance is strictly geofenced to within 50m of your branch.
                  </Text>
                </View>
              </View>

            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CORPORATE CALENDAR VIEW (SHARED MANAGER/EMPLOYEE)  */}
          {/* ======================================================== */}
          {activeTab === 'calendar' && (
            <View>
              {/* Monthly Interactive Calendar Widget */}
              <View style={[styles.calendarContainer, dynamicStyles.card]}>
                <CalendarWidget
                  current={selectedDate}
                  onDayPress={(day: any) => {
                    setSelectedDate(day.dateString);
                    setIsDayViewModalOpen(true);
                  }}
                  markedDates={getMarkedDates()}
                  theme={{
                    backgroundColor: theme.surface,
                    calendarBackground: theme.surface,
                    textSectionTitleColor: theme.textSecondary,
                    selectedDayBackgroundColor: theme.primary,
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: theme.primary,
                    dayTextColor: theme.textPrimary,
                    textDisabledColor: isDark ? '#4E4E5A' : '#D1D5DB',
                    dotColor: theme.primary,
                    selectedDotColor: '#ffffff',
                    arrowColor: theme.primary,
                    monthTextColor: theme.textPrimary,
                    indicatorColor: theme.primary,
                    textDayFontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                    textMonthFontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                    textDayHeaderFontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                    textDayFontWeight: '300',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '500',
                    textDayFontSize: 14,
                    textMonthFontSize: 15,
                    textDayHeaderFontSize: 11
                  }}
                />
              </View>

              {/* Day Agenda Timeline Header */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.flexShrink}>
                  <Text style={[styles.sectionTitle, dynamicStyles.textPrimary]}>
                    Agenda: {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={[styles.sectionSub, dynamicStyles.textSecondary]}>
                    Corporate training agenda timeline
                  </Text>
                </View>
                <TouchableOpacity style={[styles.refreshBtn, { borderColor: theme.border }]} onPress={fetchTrainings} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <RefreshCw size={18} color={theme.primary} />
                  )}
                </TouchableOpacity>
              </View>

              {/* NEW Simulator Location Mode Bar for testing geofencing failures/successes */}
              {userRole === 'employee' && (
                <View style={[styles.simulatorBar, { borderColor: theme.border }]}>
                  <Text style={[styles.simulatorBarTitle, dynamicStyles.textPrimary]}>Geofence Simulator Controls:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity 
                      style={[styles.simTab, simLocationMode === 'pune_inside' && { backgroundColor: theme.primary }]}
                      onPress={() => setSimLocationMode('pune_inside')}
                    >
                      <Text style={[styles.simTabText, simLocationMode === 'pune_inside' ? styles.whiteText : dynamicStyles.textPrimary]}>
                        At Pune Branch (Inside geofence)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.simTab, simLocationMode === 'mumbai_outside' && { backgroundColor: theme.primary }]}
                      onPress={() => setSimLocationMode('mumbai_outside')}
                    >
                      <Text style={[styles.simTabText, simLocationMode === 'mumbai_outside' ? styles.whiteText : dynamicStyles.textPrimary]}>
                        At Mumbai Branch (Outside geofence)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.simTab, simLocationMode === 'gps' && { backgroundColor: theme.primary }]}
                      onPress={() => setSimLocationMode('gps')}
                    >
                      <Text style={[styles.simTabText, simLocationMode === 'gps' ? styles.whiteText : dynamicStyles.textPrimary]}>
                        Actual GPS Location
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}

              {/* Filtered Agenda list */}
              {(() => {
                const dayTrainings = trainingsList.filter(t => {
                  try {
                    const tDate = new Date(t.scheduled_start).toISOString().split('T')[0];
                    return tDate === selectedDate;
                  } catch (e) {
                    return false;
                  }
                });

                if (dayTrainings.length === 0) {
                  return (
                    <View style={[styles.emptyBox, dynamicStyles.card]}>
                      <CalendarIcon size={40} color={theme.textSecondary} style={{ marginBottom: 12 }} />
                      <Text style={[styles.emptyTitle, dynamicStyles.textPrimary]}>No Sessions Scheduled</Text>
                      <Text style={[styles.emptyDesc, dynamicStyles.textSecondary, { marginBottom: 16 }]}>
                        There are no corporate trainings scheduled for this date.
                      </Text>
                      {userRole === 'manager' && (
                        <TouchableOpacity 
                          style={[styles.quickScheduleBtn, { backgroundColor: theme.primary }]}
                          onPress={() => setActiveTab('create')}
                        >
                          <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.quickScheduleText}>Schedule Course</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }

                return dayTrainings.map((training, index) => {
                  const isExpanded = expandedTraining === training.id;
                  const startTime = new Date(training.scheduled_start);
                  const endTime = new Date(training.scheduled_end);
                  
                  const startTimeStr = startTime.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: false
                  });
                  const endTimeStr = endTime.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: false
                  });

                  // Color tag depending on status
                  let statusBg = 'rgba(132, 20, 57, 0.1)';
                  let statusText = theme.primary;
                  if (training.status === 'rescheduled') {
                    statusBg = 'rgba(224, 107, 38, 0.1)';
                    statusText = '#E06B26';
                  } else if (training.status === 'cancelled') {
                    statusBg = 'rgba(108, 117, 125, 0.1)';
                    statusText = '#6C757D';
                  } else if (training.attendance_status === 'attended') {
                    statusBg = 'rgba(16, 124, 65, 0.1)';
                    statusText = EMERALD;
                  }

                  const hasActiveReminder = startTime.getTime() > Date.now() && training.status !== 'cancelled';
                  
                  // NEW: DYNAMIC TIME CONSTRAINTS LOGIC
                  const hasEnded = currentTime >= endTime;
                  const diffMinutes = (currentTime.getTime() - endTime.getTime()) / (60 * 1000);
                  const isWindowActive = hasEnded && diffMinutes <= 15;
                  const isCheckinExpired = hasEnded && diffMinutes > 15;

                  return (
                    <TouchableOpacity 
                      key={training.id || index}
                      style={[styles.trainingCard, dynamicStyles.card, { borderLeftWidth: 5, borderLeftColor: statusText }]}
                      onPress={() => setExpandedTraining(isExpanded ? null : training.id)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.flexShrink}>
                          <Text style={[styles.cardTitleText, dynamicStyles.textPrimary]}>{training.title}</Text>
                          <View style={styles.metaRow}>
                            <Clock size={12} color={theme.textSecondary} />
                            <Text style={[styles.metaText, dynamicStyles.textSecondary]}>
                              {startTimeStr} - {endTimeStr}
                            </Text>
                            
                            <View style={[styles.typeBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }]}>
                              <Text style={[styles.typeBadgeText, dynamicStyles.textSecondary]}>
                                {training.training_type?.toUpperCase() || 'ONLINE'}
                              </Text>
                            </View>
                            
                            {hasActiveReminder && (
                              <View style={[styles.reminderMiniBadge, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#DCFCE7' }]}>
                                <Bell size={10} color="#15803D" style={{ marginRight: 3 }} />
                                <Text style={[styles.reminderMiniText, { color: '#15803D' }]}>Active</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        
                        <View style={[styles.statusTag, { backgroundColor: statusBg }]}>
                          <Text style={[styles.statusTagText, { color: statusText }]}>
                            {training.attendance_status === 'attended' ? 'ATTENDED' : training.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Dynamic Check-in Banner inside Card for Employees */}
                      {userRole === 'employee' && training.attendance_status !== 'attended' && training.status !== 'cancelled' && (
                        <View style={styles.employeeActionsBox}>
                          {isWindowActive ? (
                            <View>
                              <View style={styles.liveTimerRow}>
                                <Animated.View style={{ transform: [{ scale: checkinPulseAnim }] }}>
                                  <Zap size={14} color={AMBER} fill={AMBER} />
                                </Animated.View>
                                <Text style={[styles.liveTimerText, { color: AMBER }]}>
                                  Live check-in window active: {Math.max(0, Math.floor((endTime.getTime() + 15 * 60 * 1000 - currentTime.getTime()) / 1000 / 60))}:
                                  {Math.max(0, Math.floor((endTime.getTime() + 15 * 60 * 1000 - currentTime.getTime()) / 1000) % 60).toString().padStart(2, '0')} remaining
                                </Text>
                              </View>
                              
                              <TouchableOpacity
                                style={[styles.checkinButton, { backgroundColor: theme.primary }]}
                                onPress={() => handleMarkAttendance(training)}
                                disabled={loading}
                              >
                                {loading ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text style={styles.checkinButtonText}>Mark Attendance Securely</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          ) : isCheckinExpired ? (
                            <View style={styles.expiredRow}>
                              <MapPinOff size={14} color="#EF4444" />
                              <Text style={styles.expiredText}>Check-in Expired (Absent)</Text>
                            </View>
                          ) : (
                            <View style={styles.upcomingTimerRow}>
                              <Clock size={14} color={theme.textSecondary} />
                              <Text style={[styles.upcomingTimerText, dynamicStyles.textSecondary]}>
                                Upcoming. Check-in opens exactly when training ends.
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {isExpanded && (
                        <View style={styles.expandedContent}>
                          <View style={[styles.divider, { backgroundColor: theme.border }]} />
                          <Text style={[styles.descTitle, dynamicStyles.textPrimary]}>Course Syllabus / Description</Text>
                          <Text style={[styles.descText, dynamicStyles.textSecondary]}>
                            {training.description || 'No course syllabus provided. Please refer to training manual.'}
                          </Text>

                          <View style={styles.instructorRow}>
                            <Users size={14} color={theme.textSecondary} />
                            <Text style={[styles.instructorText, dynamicStyles.textSecondary]}>
                              Lead Coordinator: <Text style={styles.boldText}>{training.manager_first || 'Rahul'} {training.manager_last || 'Sharma'}</Text>
                            </Text>
                          </View>

                          {/* Training tasks checklist */}
                          <View style={[styles.syllabusBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)' }]}>
                            <Text style={[styles.syllabusTitle, dynamicStyles.textPrimary]}>Assigned Tasks & Sign-offs</Text>
                            <View style={styles.checkoffRow}>
                              <CheckSquare size={14} color="#107C41" />
                              <Text style={[styles.checkoffText, dynamicStyles.textSecondary]}>KYC Document Verification Pipeline Check</Text>
                            </View>
                            <View style={styles.checkoffRow}>
                              <CheckSquare size={14} color="#107C41" />
                              <Text style={[styles.checkoffText, dynamicStyles.textSecondary]}>Axis Secure Sandbox Testing Completion</Text>
                            </View>
                          </View>

                          {/* Edit Training Button for Manager */}
                          {userRole === 'manager' && (
                            <TouchableOpacity
                              style={[styles.editSessionBtn, { borderColor: theme.primary }]}
                              onPress={() => {
                                setEditingTraining(training);
                                setEditTitle(training.title);
                                setEditDescription(training.description || '');
                                setEditTrainingType(training.training_type || 'online');
                                
                                try {
                                  const start = new Date(training.scheduled_start);
                                  const end = new Date(training.scheduled_end);
                                  const dateStr = start.toISOString().split('T')[0];
                                  const startStr = start.toTimeString().split(' ')[0].substring(0, 5);
                                  const endStr = end.toTimeString().split(' ')[0].substring(0, 5);
                                  
                                  setEditDate(dateStr);
                                  setEditStartTime(startStr);
                                  setEditEndTime(endStr);
                                } catch (e) {
                                  setEditDate(selectedDate);
                                  setEditStartTime('10:00');
                                  setEditEndTime('12:00');
                                }
                                
                                setEditStatus(training.status);
                                setEditModalOpen(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <Edit3 size={14} color={theme.primary} style={{ marginRight: 6 }} />
                              <Text style={[styles.editSessionBtnText, { color: theme.primary }]}>Modify Training Session</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      <View style={styles.expandRow}>
                        <Text style={[styles.expandText, { color: theme.primary }]}>
                          {isExpanded ? 'Show less' : 'View full schedule details'}
                        </Text>
                        {isExpanded ? (
                          <ChevronUp size={14} color={theme.primary} />
                        ) : (
                          <ChevronDown size={14} color={theme.primary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          )}

          {/* ======================================================== */}
          {/* EMPLOYEE: DYNAMIC CHECKLIST MODULE (Tab 3 Employee only)   */}
          {/* ======================================================== */}
          {userRole === 'employee' && activeTab === 'tasks' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, dynamicStyles.textPrimary]}>My Secure Checklist</Text>
                  <Text style={[styles.sectionSub, dynamicStyles.textSecondary]}>Complete learning milestones to earn bonus XP!</Text>
                </View>
              </View>

              {employeeTasksList.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskItemCard, dynamicStyles.card, task.is_completed && styles.taskCompletedBorder]}
                  onPress={() => handleToggleEmployeeTask(task.id, task.is_completed)}
                  activeOpacity={0.8}
                >
                  <View style={styles.taskCheckWrapper}>
                    <View style={[
                      styles.taskCheckbox, 
                      { borderColor: theme.primary },
                      task.is_completed && { backgroundColor: EMERALD, borderColor: EMERALD }
                    ]}>
                      {task.is_completed && <CheckCircle2 size={14} color="#FFFFFF" />}
                    </View>
                    
                    <View style={styles.flexBox}>
                      <Text style={[
                        styles.taskTitleText, 
                        dynamicStyles.textPrimary,
                        task.is_completed && styles.taskTitleCompleted
                      ]}>
                        {task.title}
                      </Text>
                      <Text style={[styles.taskDescText, dynamicStyles.textSecondary]}>
                        {task.description}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.taskAwardBlock}>
                    <Text style={[styles.taskXpText, { color: task.is_completed ? EMERALD : theme.primary }]}>
                      {task.is_completed ? 'COMPLETED' : `+${task.xp} XP`}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ======================================================== */}
      {/* FLOATING BOTTOM NAV BAR                                  */}
      {/* ======================================================== */}
      <View style={[styles.tabBar, dynamicStyles.tabBar]}>
        
        {/* TAB 1: DASHBOARD (Managers: Reports / Employees: Personal Stats) */}
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab(userRole === 'manager' ? 'reports' : 'dashboard')}
          activeOpacity={0.8}
        >
          <BarChart2 size={22} color={(activeTab === 'reports' || activeTab === 'dashboard') ? theme.primary : theme.textSecondary} />
          <Text style={[
            styles.tabText, 
            { color: (activeTab === 'reports' || activeTab === 'dashboard') ? theme.primary : theme.textSecondary },
            (activeTab === 'reports' || activeTab === 'dashboard') && { fontWeight: 'bold' }
          ]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        {/* TAB 2: SHARED CALENDAR TIMELINE VIEW */}
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('calendar')}
          activeOpacity={0.8}
        >
          <CalendarIcon size={22} color={activeTab === 'calendar' ? theme.primary : theme.textSecondary} />
          <Text style={[
            styles.tabText, 
            { color: activeTab === 'calendar' ? theme.primary : theme.textSecondary },
            activeTab === 'calendar' && { fontWeight: 'bold' }
          ]}>
            Calendar View
          </Text>
        </TouchableOpacity>

        {/* TAB 3: MANAGER CREATE TRAINING vs EMPLOYEE LEARNING CHECKLIST */}
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab(userRole === 'manager' ? 'create' : 'tasks')}
          activeOpacity={0.8}
        >
          {userRole === 'manager' ? (
            <Plus size={22} color={activeTab === 'create' ? theme.primary : theme.textSecondary} />
          ) : (
            <CheckSquare size={22} color={activeTab === 'tasks' ? theme.primary : theme.textSecondary} />
          )}
          <Text style={[
            styles.tabText, 
            { color: (activeTab === 'create' || activeTab === 'tasks') ? theme.primary : theme.textSecondary },
            (activeTab === 'create' || activeTab === 'tasks') && { fontWeight: 'bold' }
          ]}>
            {userRole === 'manager' ? 'New Course' : 'Tasks'}
          </Text>
        </TouchableOpacity>

        {/* TAB 4: NEW MANAGER EMPLOYEE REGISTRATION FORM PORTAL */}
        {userRole === 'manager' && (
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => setActiveTab('register')}
            activeOpacity={0.8}
          >
            <UserPlus size={22} color={activeTab === 'register' ? theme.primary : theme.textSecondary} />
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'register' ? theme.primary : theme.textSecondary },
              activeTab === 'register' && { fontWeight: 'bold' }
            ]}>
              Add Staff
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ======================================================== */}
      {/* DIALOGS AND ALERTS OVERLAYS (GAMIFICATION WOW EFFECTS)    */}
      {/* ======================================================== */}

      {/* PREMIUM THEME-AWARE CUSTOM ALERT DIALOG */}
      <Modal
        visible={customAlert !== null && customAlert.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomAlert(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.customAlertCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
                onPress={() => setCustomAlert(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.alertConfirmBtnText}>Acknowledge</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* NEW: DYNAMIC LEVEL-UP ANNOUNCEMENT OVERLAY */}
      <Modal visible={showLevelUpModal} transparent animationType="none">
        <View style={styles.congratsBackdrop}>
          <Animated.View style={[
            styles.congratsCard, 
            { 
              backgroundColor: theme.surface, 
              borderColor: theme.primary,
              transform: [{ scale: levelUpScale }, { rotate: spin }]
            }
          ]}>
            <View style={styles.congratsAccent} />
            
            <View style={styles.congratsContent}>
              <Sparkles size={40} color={AMBER} style={{ marginBottom: 12 }} />
              <Text style={[styles.congratsHeadline, { color: theme.primary }]}>LEVEL UP ACHIEVED!</Text>
              <Text style={[styles.congratsRank, dynamicStyles.textPrimary]}>Level 2: Compliance Specialist</Text>
              <Text style={[styles.congratsDesc, dynamicStyles.textSecondary]}>
                Congratulations, Rahul! Your consistent attendance check-ins and checklist completion have promoted your rank. You've earned the Elite Scholar Badge!
              </Text>

              <View style={styles.unlockedBadgeBadge}>
                <Trophy size={20} color={COBALT} style={{ marginRight: 6 }} />
                <Text style={[styles.unlockedBadgeLabel, { color: COBALT }]}>Elite Scholar Badge Unlocked</Text>
              </View>

              <TouchableOpacity 
                style={[styles.congratsBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setShowLevelUpModal(false);
                  showAlert('Compliance Upgrade', 'Level 2 privileges successfully loaded! Keep scanning geofences to reach Level 3.');
                }}
              >
                <Text style={styles.congratsBtnText}>Let's Go!</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* NEW: BADGE PROFILE EXPLAINER OVERLAY */}
      <Modal visible={badgeTriggerAlert !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          {badgeTriggerAlert && (
            <View style={[styles.badgeExplainerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.badgeExplainerClose}>
                <TouchableOpacity onPress={() => setBadgeTriggerAlert(null)}>
                  <X size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.badgeExplainerIconWrap}>
                {badgeTriggerAlert.icon}
              </View>
              
              <Text style={[styles.badgeExplainerName, dynamicStyles.textPrimary]}>
                {badgeTriggerAlert.badgeName}
              </Text>
              
              <Text style={[styles.badgeExplainerDesc, dynamicStyles.textSecondary]}>
                {badgeTriggerAlert.desc}
              </Text>

              <TouchableOpacity 
                style={[styles.badgeExplainerBtn, { backgroundColor: theme.primary }]}
                onPress={() => setBadgeTriggerAlert(null)}
              >
                <Text style={styles.badgeExplainerBtnText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* DAY VIEW AND SCHEDULE EDIT MODALS */}
      {renderDayViewModal()}
      {renderEditCourseModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flexBox: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  title: {
    fontSize: 21,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  miniCard: {
    flex: 0.48,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.01,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  miniCardVal: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  miniCardLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.01,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
    maxWidth: '90%',
  },
  emptyLabel: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  graphContainer: {
    marginTop: 8,
  },
  stackedBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  legendContainer: {
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 12.5,
  },
  boldText: {
    fontWeight: 'bold',
  },
  whiteText: {
    color: '#FFFFFF',
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  branchMeta: {
    flex: 0.45,
  },
  branchName: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  branchCode: {
    fontSize: 11,
    marginTop: 2,
  },
  branchMetrics: {
    flex: 0.52,
  },
  barBlock: {
    marginBottom: 8,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  barLabel: {
    fontSize: 10,
  },
  barVal: {
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  calendarContainer: {
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    borderRadius: 16,
    padding: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  quickScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  quickScheduleText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13.5,
  },
  trainingCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleText: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11.5,
    marginLeft: 4,
    marginRight: 8,
  },
  reminderMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reminderMiniText: {
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  descTitle: {
    fontSize: 12.5,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  descText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  instructorText: {
    fontSize: 11.5,
    marginLeft: 6,
  },
  syllabusBox: {
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  syllabusTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  checkoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  checkoffText: {
    fontSize: 11.5,
    marginLeft: 6,
  },
  editSessionBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    flexDirection: 'row',
  },
  editSessionBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  expandRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  expandText: {
    fontSize: 12,
    marginRight: 4,
  },
  formContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  formIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  formMainTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  formSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfCol: {
    flex: 0.48,
  },
  branchTip: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 8,
  },
  checkboxList: {
    marginTop: 6,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  checkboxIndicator: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    marginRight: 10,
  },
  checkboxLabel: {
    fontSize: 12.5,
  },
  submitButton: {
    height: 46,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14.5,
  },
  tabBar: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabText: {
    fontSize: 9.5,
    marginTop: 4,
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
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  alertConfirmBtn: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14.5,
  },
  timelineModalRoot: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timelineBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDateHeader: {
    alignItems: 'center',
  },
  timelineWeekdayText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  timelineDayText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  timezoneBar: {
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  timezoneText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  timelineGridContainer: {
    flexDirection: 'column',
    position: 'relative',
    paddingTop: 10,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
  },
  hourLabelCol: {
    width: 75,
    alignItems: 'center',
    paddingTop: 2,
  },
  hourLabelText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  gridLineRight: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
  },
  verticalTimelineDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  eventsOverlayContainer: {
    position: 'absolute',
    top: 10,
    bottom: 0,
    right: 0,
  },
  timelineEventCard: {
    position: 'absolute',
    borderLeftWidth: 3.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  timelineCardTitle: {
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  timelineCardTime: {
    fontSize: 10.5,
    marginTop: 2,
  },
  timelineEditIndicator: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineEditText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  keyboardAvoidCenter: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
  editModalScroll: {
    padding: 20,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleBtn: {
    flex: 0.48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnText: {
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  statusSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusSelectItem: {
    flex: 0.31,
    borderWidth: 1,
    borderRadius: 6,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  statusSelectLabel: {
    fontSize: 9,
  },
  editActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  editCancelBtn: {
    flex: 0.45,
    borderWidth: 1,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCancelBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  editSaveBtn: {
    flex: 0.5,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  smallRefresh: {
    padding: 4,
  },

  // --- NEW MANAGER WORKSPACE SPECIFIC STYLES ---
  teamCourseBlock: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  teamCourseHeader: {
    flexDirection: 'row',
    padding: 14,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamCourseTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  teamCourseMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  teamCourseStatusCol: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  teamCourseRate: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 6,
  },
  teamRosterBox: {
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  rosterHeadline: {
    fontSize: 11.5,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  rosterEmpty: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rosterName: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  rosterEmpId: {
    fontSize: 10,
    marginTop: 1,
  },
  rosterStatusBlock: {
    alignItems: 'flex-end',
  },
  rosterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rosterBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: 'bold',
  },
  markedAtText: {
    fontSize: 8.5,
    marginTop: 2,
  },
  branchSelectScroll: {
    marginTop: 6,
  },
  branchSelectCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    width: 140,
  },
  branchSelectName: {
    fontSize: 11,
  },
  branchSelectCode: {
    fontSize: 9.5,
    marginTop: 2,
  },

  // --- NEW EMPLOYEE WORKSPACE SPECIFIC STYLES ---
  gamifiedLevelCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  gamifiedGlowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  gamifiedRankTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  gamifiedRankSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  gamifiedStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gamifiedStreakText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  xpBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  xpCaptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  xpCaptionText: {
    fontSize: 10,
    flex: 0.7,
  },
  sparkleIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xpBonusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  circularMetricCard: {
    flex: 0.52,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  circularRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outerProgressCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  innerProgressPercent: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  circularTitle: {
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  circularDesc: {
    fontSize: 8.5,
    marginTop: 1,
  },
  miniTasksCard: {
    flex: 0.44,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  badgesScroll: {
    marginTop: 10,
  },
  badgeCard: {
    width: 105,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  badgeLabelText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  badgeStatusText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  dimmedFilter: {
    opacity: 0.35,
  },
  activeBadgeBorder: {
    borderColor: EMERALD,
    backgroundColor: 'rgba(16, 124, 65, 0.02)',
  },
  lockedBadgeBorder: {
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  complianceTipBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  complianceTipTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  complianceTipText: {
    fontSize: 11,
    lineHeight: 15,
  },
  simulatorBar: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.015)',
  },
  simulatorBarTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  simTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    marginRight: 6,
  },
  simTabText: {
    fontSize: 9.5,
  },
  employeeActionsBox: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 10,
  },
  liveTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveTimerText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  checkinButton: {
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkinButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  expiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiredText: {
    color: '#EF4444',
    fontSize: 11.5,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  upcomingTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingTimerText: {
    fontSize: 11,
    marginLeft: 6,
  },

  // --- checklist tasks styling ---
  taskItemCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskCheckWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 0.8,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    marginRight: 12,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitleText: {
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  taskDescText: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  taskAwardBlock: {
    alignItems: 'flex-end',
    flex: 0.18,
  },
  taskXpText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  taskCompletedBorder: {
    borderColor: EMERALD,
  },

  // --- overlays styling ---
  congratsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  congratsCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
  },
  congratsAccent: {
    height: 6,
    width: '100%',
    backgroundColor: '#D97706',
  },
  congratsContent: {
    padding: 24,
    alignItems: 'center',
  },
  congratsHeadline: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  congratsRank: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  congratsDesc: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 16,
  },
  unlockedBadgeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    marginBottom: 20,
  },
  unlockedBadgeLabel: {
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  congratsBtn: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  congratsBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Explainer badges
  badgeExplainerCard: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
  badgeExplainerClose: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  badgeExplainerIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeExplainerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  badgeExplainerDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  badgeExplainerBtn: {
    width: '100%',
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeExplainerBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13.5,
  },
});
