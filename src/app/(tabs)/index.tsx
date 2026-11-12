import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { baseURL } from "../../../baseurl/baseURL";
import {
  setAttendanceState,
  setCheckInSuccess,
  setCheckOutSuccess,
} from "../../../store/authSice";
import { AppDispatch, RootState } from "../../../store/store";

// ==========================================
// INTERFACES (Matching Live APIs)
// ==========================================

interface LiveOrder {
  id: number;
  prefix?: string | null;
  order_no?: string | null;
  full_number?: string | null;
  total_qty?: string | number;
  produced_qty?: string | number;
  status: number | string;
  concrete_pump?: string | null;
  pump_type?: string | null;
  scheduled_start?: string | null;
  customer?: {
    id: number;
    legal_name: string;
  } | null;
  site?: {
    id: number;
    name: string;
  } | null;
  mix_design?: {
    id: number;
    design_name?: string | null;
    name?: string | null;
  } | null;
}

interface LiveLead {
  id: number;
  lead_number?: string;
  contact_name?: string;
  company_name?: string;
  project_name?: string;
  requirement?: string;
  mix_design_id?: number | null;
  mix_design?: any;
  estimated_quantity?: string | number;
  delivery_location?: string;
  expected_value?: string | number;
  status?: string;
  priority?: string;
  created_at?: string;
}

interface LiveQuotation {
  id: number | string;
  reference?: string;
  amount_total?: string;
  status: number;
}

// Fallback initial samples matching live schemas
const SAMPLE_ORDERS: LiveOrder[] = [
  {
    id: 31,
    full_number: "SO/2627/0030",
    order_no: "0030",
    concrete_pump: "boom",
    total_qty: "50.000",
    produced_qty: "18.000",
    status: 2, // In Production
    customer: { id: 25, legal_name: "Prestige Projects Ltd" },
    site: { id: 10, name: "Falcon City Phase 2, Pier 18" },
    mix_design: { id: 15, design_name: "M20 MP" },
  },
  {
    id: 32,
    full_number: "SO/2627/0031",
    order_no: "0031",
    concrete_pump: "line",
    total_qty: "25.000",
    produced_qty: "25.000",
    status: 3, // Completed
    customer: { id: 22, legal_name: "Srinivasan Associates" },
    site: { id: 8, name: "Kodangipalayam, Karanampettai." },
    mix_design: { id: 10, design_name: "M 7.5 MP" },
  },
];

const SAMPLE_LEADS: LiveLead[] = [
  {
    id: 1,
    lead_number: "LD/2026/00001",
    contact_name: "Kavin Builders",
    company_name: "Kavin Builders Infrastructure",
    project_name: "Kavin Grand Towers",
    requirement: "M25 Grade",
    estimated_quantity: "120.000",
    delivery_location: "Avinashi Road Bypass",
    expected_value: "540000.00",
    status: "New",
    priority: "High",
  },
  {
    id: 2,
    lead_number: "LD/2026/00002",
    contact_name: "Vikram Mehta",
    company_name: "Skyline Infra Developers",
    project_name: "Skyline Heights Wing B",
    requirement: "M30 Grade",
    estimated_quantity: "85.000",
    delivery_location: "Electronic City Phase 1",
    expected_value: "425000.00",
    status: "In Progress",
    priority: "Medium",
  },
];

// Helper: Format Currency
const formatCurrency = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined || val === "") return "₹0";
  const num =
    typeof val === "number"
      ? val
      : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return "₹0";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${Math.round(num).toLocaleString("en-IN")}`;
};

// Helper: Status Meta for Orders
const getOrderStatusMeta = (status: number | string) => {
  const s = Number(status);
  switch (s) {
    case 0:
      return {
        label: "Draft",
        bg: "#F1F5F9",
        text: "#475569",
        border: "#CBD5E1",
      };
    case 1:
      return {
        label: "Approved",
        bg: "#EFF6FF",
        text: "#1E40AF",
        border: "#BFDBFE",
      };
    case 2:
      return {
        label: "In Production",
        bg: "#FEF3C7",
        text: "#B45309",
        border: "#FDE68A",
      };
    case 3:
      return {
        label: "Completed",
        bg: "#ECFDF5",
        text: "#065F46",
        border: "#A7F3D0",
      };
    case 4:
      return {
        label: "Cancelled",
        bg: "#FEF2F2",
        text: "#991B1B",
        border: "#FECACA",
      };
    default:
      return {
        label: "Active",
        bg: "#EFF6FF",
        text: "#2563EB",
        border: "#BFDBFE",
      };
  }
};

// Standalone API helper
async function fetchDashboardApis(
  token: string | null,
  plantId: number | null | undefined,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (plantId !== null && plantId !== undefined) {
    headers["X-Plant-Id"] = String(plantId);
  }

  return Promise.allSettled([
    axios.get(`${baseURL}v1/orders`, {
      headers,
      params: { per_page: 20 },
      timeout: 15000,
    }),
    axios.get(`${baseURL}v1/leads`, {
      headers,
      params: { per_page: 20 },
      timeout: 15000,
    }),
    axios.get(`${baseURL}v1/quotations`, {
      headers,
      params: { per_page: 30 },
      timeout: 15000,
    }),
  ]);
}

// Attendance Modal State Interface
interface AttendanceModalState {
  visible: boolean;
  type: "checkin" | "checkout" | "error" | "info";
  title: string;
  subtitle: string;
  badge?: string;
  details?: {
    attendanceId?: number | string | null;
    date?: string;
    time?: string;
    shiftName?: string;
    workingHours?: number | string;
    workedHours?: string | number;
    status?: string;
    isLate?: boolean;
    lateHours?: string | number;
    notes?: string;
    message?: string;
  };
}

// Standalone Attendance Check-In API helper
async function callAttendanceCheckInApi(
  token: string | null,
  plantId: number | null | undefined,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (plantId !== null && plantId !== undefined) {
    headers["X-Plant-Id"] = String(plantId);
  }

  const urlV1 = `${baseURL}v1/attendances/check-in`;
  const urlDirect = `${baseURL}attendances/check-in`;

  try {
    const res = await axios.post(urlV1, {}, { headers, timeout: 15000 });
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      const res = await axios.post(urlDirect, {}, { headers, timeout: 15000 });
      return res.data;
    }
    throw err;
  }
}

// Standalone Attendance Check-Out API helper
// api - /attendances/{attendance}/check-out
// params - {attendance: id}
async function callAttendanceCheckOutApi(
  attendanceId: number | string | null | undefined,
  token: string | null,
  plantId: number | null | undefined,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (plantId !== null && plantId !== undefined) {
    headers["X-Plant-Id"] = String(plantId);
  }

  const queryParams = attendanceId ? { attendance: attendanceId } : undefined;

  // Primary URL with {attendance} route parameter: /attendances/{attendance}/check-out
  const urlV1 = attendanceId
    ? `${baseURL}v1/attendances/${attendanceId}/check-out`
    : `${baseURL}v1/attendances/check-out`;
  const urlDirect = attendanceId
    ? `${baseURL}attendances/${attendanceId}/check-out`
    : `${baseURL}attendances/check-out`;

  try {
    const res = await axios.post(
      urlV1,
      attendanceId ? { attendance: attendanceId } : {},
      { headers, params: queryParams, timeout: 15000 },
    );
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        const resDirect = await axios.post(
          urlDirect,
          attendanceId ? { attendance: attendanceId } : {},
          { headers, params: queryParams, timeout: 15000 },
        );
        return resDirect.data;
      } catch (err2: any) {
        if (err2?.response?.status === 404 && attendanceId) {
          const resFallback = await axios.post(
            `${baseURL}v1/attendances/check-out`,
            { attendance: attendanceId },
            { headers, params: queryParams, timeout: 15000 },
          );
          return resFallback.data;
        }
        throw err2;
      }
    }
    throw err;
  }
}

export default function HomeScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    token,
    plant_id,
    plant_name,
    user,
    shift,
    working_hours,
    isCheckedIn,
    checkInTime,
    checkInTimestamp,
    attendanceId,
  } = useSelector((state: RootState) => state.auth);

  const [orders, setOrders] = useState<LiveOrder[]>(SAMPLE_ORDERS);
  const [leads, setLeads] = useState<LiveLead[]>(SAMPLE_LEADS);
  const [quotations, setQuotations] = useState<LiveQuotation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [attendanceLoading, setAttendanceLoading] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Animated Modal State
  const [modalAnim] = useState(() => new Animated.Value(0));
  const [modalData, setModalData] = useState<AttendanceModalState>({
    visible: false,
    type: "checkin",
    title: "",
    subtitle: "",
  });

  const showAttendanceModal = useCallback(
    (data: Omit<AttendanceModalState, "visible">) => {
      setModalData({ ...data, visible: true });
      modalAnim.setValue(0);
      Animated.spring(modalAnim, {
        toValue: 1,
        tension: 65,
        friction: 7,
        useNativeDriver: true,
      }).start();
    },
    [modalAnim],
  );

  const hideAttendanceModal = useCallback(() => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setModalData((prev) => ({ ...prev, visible: false }));
    });
  }, [modalAnim]);

  // Working Hours calculation (from shift in login response / auth state)
  const shiftHours = useMemo(() => {
    const hrs = Number(
      shift?.working_hours ??
        user?.shift?.working_hours ??
        working_hours ??
        10,
    );
    return hrs > 0 ? hrs : 10;
  }, [shift, user, working_hours]);

  const maxDurationMs = shiftHours * 60 * 60 * 1000;

  // Auto-checkout when working hours have elapsed without manual checkout
  const performAutoCheckout = useCallback(
    async (timestamp: number, currentAttendanceId?: number | null) => {
      const elapsed = Date.now() - timestamp;
      if (elapsed >= maxDurationMs) {
        console.log(
          `[AutoCheckout] Working hours exceeded (${elapsed}ms >= ${maxDurationMs}ms). Triggering check-out API directly.`,
        );
        const idToSend = currentAttendanceId ?? attendanceId;
        try {
          await callAttendanceCheckOutApi(idToSend, token, plant_id);
        } catch (err: any) {
          console.log(
            "[AutoCheckout] Check-out API call error (proceeding with local reset):",
            err?.response?.data || err?.message || err,
          );
        } finally {
          dispatch(setCheckOutSuccess());
          await AsyncStorage.removeItem("rmc_attendance").catch(() => {});
          showAttendanceModal({
            type: "info",
            title: "Shift Concluded Automatically",
            subtitle: `Your ${shiftHours}-hour working shift has concluded. You have been automatically checked out.`,
            badge: "AUTO CHECK-OUT",
            details: {
              attendanceId: idToSend,
              shiftName: shift?.name || "Personnel shift",
              workingHours: shiftHours,
            },
          });
        }
      }
    },
    [
      maxDurationMs,
      attendanceId,
      token,
      plant_id,
      dispatch,
      showAttendanceModal,
      shiftHours,
      shift,
    ],
  );

  // Sync attendance state from AsyncStorage on initial load
  useEffect(() => {
    AsyncStorage.getItem("rmc_attendance")
      .then((stored) => {
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (data && typeof data.isCheckedIn === "boolean") {
              dispatch(
                setAttendanceState({
                  isCheckedIn: data.isCheckedIn,
                  checkInTime: data.checkInTime || null,
                  checkInTimestamp: data.checkInTimestamp || null,
                  attendanceId: data.attendanceId ?? null,
                }),
              );
              if (data.isCheckedIn && data.checkInTimestamp) {
                performAutoCheckout(
                  data.checkInTimestamp,
                  data.attendanceId ?? null,
                );
              }
            }
          } catch (e) {
            console.log("Error parsing stored attendance:", e);
          }
        }
      })
      .catch((err) => console.log("Error loading saved attendance:", err));
  }, [dispatch, performAutoCheckout]);

  // Regular interval to tick time & verify working hours auto checkout
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
      if (isCheckedIn && checkInTimestamp) {
        performAutoCheckout(checkInTimestamp, attendanceId);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isCheckedIn, checkInTimestamp, attendanceId, performAutoCheckout]);

  // Status Bar Sync & auto checkout check on screen focus
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0B2A4A");
      }
      setNowTick(Date.now());
      if (isCheckedIn && checkInTimestamp) {
        performAutoCheckout(checkInTimestamp, attendanceId);
      }
    }, [isCheckedIn, checkInTimestamp, attendanceId, performAutoCheckout]),
  );

  // Manual Check In Handler
  const handleCheckIn = async () => {
    if (attendanceLoading) return;
    setAttendanceLoading(true);
    try {
      const res = await callAttendanceCheckInApi(token, plant_id);
      console.log("Check-in API success:", res);

      const record = res?.data || {};
      const newAttendanceId = record?.id ?? res?.id ?? null;

      // Extract time from response or fallback to current local time
      let displayTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const displayDate =
        record?.attendance_date || new Date().toISOString().split("T")[0];

      if (record?.check_in) {
        try {
          const d = new Date(record.check_in.replace(" ", "T"));
          if (!isNaN(d.getTime())) {
            displayTime = d.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
          }
        } catch {
          // Fallback to local time if parsing fails
        }
      }

      const now = Date.now();

      dispatch(
        setCheckInSuccess({
          timestamp: now,
          timeStr: displayTime,
          attendanceId: newAttendanceId,
        }),
      );
      await AsyncStorage.setItem(
        "rmc_attendance",
        JSON.stringify({
          isCheckedIn: true,
          checkInTimestamp: now,
          checkInTime: displayTime,
          attendanceId: newAttendanceId,
        }),
      );

      // Trigger animated model UI with full response details
      showAttendanceModal({
        type: "checkin",
        title: "Checked In Successfully!",
        subtitle: "Your attendance check-in has been registered.",
        badge: "CHECK-IN CONFIRMED",
        details: {
          attendanceId: newAttendanceId,
          time: displayTime,
          date: displayDate,
          status: record?.status || "present",
          shiftName: record?.shift?.name || shift?.name || "Personnel shift",
          workingHours:
            record?.shift?.working_hours ||
            record?.scheduled_hours ||
            shiftHours,
          isLate: Boolean(record?.is_late),
          lateHours: record?.late_hours,
          notes: record?.notes || "Starting work",
        },
      });
    } catch (err: any) {
      console.log("Check-in error:", err?.response?.data || err?.message || err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to check in. Please try again.";

      showAttendanceModal({
        type: "error",
        title: "Check-In Unsuccessful",
        subtitle: errMsg,
        badge: "ATTENDANCE NOTICE",
      });
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Manual Check Out Handler
  const handleCheckOut = async () => {
    if (attendanceLoading) return;

    Alert.alert(
      "Confirm Check Out",
      "Are you sure you want to end your shift and check out now?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check Out",
          style: "destructive",
          onPress: async () => {
            setAttendanceLoading(true);
            try {
              const idToSend = attendanceId;
              console.log("Checking out with attendance id:", idToSend);
              const res = await callAttendanceCheckOutApi(
                idToSend,
                token,
                plant_id,
              );
              console.log("Check-out API success:", res);

              const record = res?.data || {};

              let displayOutTime = new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });
              if (record?.check_out) {
                try {
                  const d = new Date(record.check_out.replace(" ", "T"));
                  if (!isNaN(d.getTime())) {
                    displayOutTime = d.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    });
                  }
                } catch {
          // Fallback to local time if parsing fails
        }
              }

              dispatch(setCheckOutSuccess());
              await AsyncStorage.removeItem("rmc_attendance").catch(() => {});

              // Trigger animated model UI with full checkout details
              showAttendanceModal({
                type: "checkout",
                title: "Checked Out Successfully!",
                subtitle:
                  "Your shift attendance has ended. Have a great evening!",
                badge: "SHIFT COMPLETED",
                details: {
                  attendanceId: idToSend,
                  time: displayOutTime,
                  date:
                    record?.attendance_date ||
                    new Date().toISOString().split("T")[0],
                  status: record?.status || "completed",
                  shiftName: shift?.name || "Personnel shift",
                  workedHours: record?.worked_hours,
                  message: res?.message,
                },
              });
            } catch (err: any) {
              console.log(
                "Check-out error:",
                err?.response?.data || err?.message || err,
              );
              const errMsg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                "Failed to check out. Please try again.";

              showAttendanceModal({
                type: "error",
                title: "Check-Out Unsuccessful",
                subtitle: errMsg,
                badge: "ATTENDANCE NOTICE",
              });
            } finally {
              setAttendanceLoading(false);
            }
          },
        },
      ],
    );
  };

  // Live formatted elapsed duration
  const elapsedFormatted = useMemo(() => {
    if (!isCheckedIn || !checkInTimestamp) return "";
    const diffSec = Math.max(0, Math.floor((nowTick - checkInTimestamp) / 1000));
    const hrs = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m elapsed`;
    return `${mins}m elapsed`;
  }, [isCheckedIn, checkInTimestamp, nowTick]);

  const shiftTimingText = useMemo(() => {
    const start = shift?.start_time ? shift.start_time.slice(0, 5) : "";
    const end = shift?.end_time ? shift.end_time.slice(0, 5) : "";
    if (start && end) {
      return `${start} - ${end} (${shiftHours} hrs)`;
    }
    return `${shiftHours} Hours Shift`;
  }, [shift, shiftHours]);

  useEffect(() => {
    let isCancelled = false;

    fetchDashboardApis(token, plant_id)
      .then(([ordersRes, leadsRes, quotesRes]) => {
        if (isCancelled) return;

        if (ordersRes.status === "fulfilled" && ordersRes.value.data) {
          const raw = ordersRes.value.data;
          const list = Array.isArray(raw.data?.data)
            ? raw.data.data
            : Array.isArray(raw.data)
              ? raw.data
              : [];
          if (list.length > 0) setOrders(list);
        }

        if (leadsRes.status === "fulfilled" && leadsRes.value.data) {
          const raw = leadsRes.value.data;
          const list = Array.isArray(raw.data?.data)
            ? raw.data.data
            : Array.isArray(raw.data)
              ? raw.data
              : [];
          if (list.length > 0) setLeads(list);
        }

        if (quotesRes.status === "fulfilled" && quotesRes.value.data) {
          const raw = quotesRes.value.data;
          const list = Array.isArray(raw.data?.data)
            ? raw.data.data
            : Array.isArray(raw.data)
              ? raw.data
              : [];
          if (list.length > 0) setQuotations(list);
        }
      })
      .catch((err) => {
        console.log("Error loading dashboard data:", err?.message || err);
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [token, plant_id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [ordersRes, leadsRes, quotesRes] = await fetchDashboardApis(
        token,
        plant_id,
      );
      if (ordersRes.status === "fulfilled" && ordersRes.value.data) {
        const raw = ordersRes.value.data;
        const list = Array.isArray(raw.data?.data)
          ? raw.data.data
          : Array.isArray(raw.data)
            ? raw.data
            : [];
        if (list.length > 0) setOrders(list);
      }
      if (leadsRes.status === "fulfilled" && leadsRes.value.data) {
        const raw = leadsRes.value.data;
        const list = Array.isArray(raw.data?.data)
          ? raw.data.data
          : Array.isArray(raw.data)
            ? raw.data
            : [];
        if (list.length > 0) setLeads(list);
      }
      if (quotesRes.status === "fulfilled" && quotesRes.value.data) {
        const raw = quotesRes.value.data;
        const list = Array.isArray(raw.data?.data)
          ? raw.data.data
          : Array.isArray(raw.data)
            ? raw.data
            : [];
        if (list.length > 0) setQuotations(list);
      }
    } catch (err: any) {
      console.log("Error refreshing dashboard:", err?.message || err);
    } finally {
      setRefreshing(false);
    }
  };

  // Aggregated KPI Metrics
  const metrics = useMemo(() => {
    // Total Ordered Volume
    const totalOrderQty = orders.reduce((sum, ord) => {
      const q = parseFloat(String(ord.total_qty || "0"));
      return sum + (isNaN(q) ? 0 : q);
    }, 0);

    // Total Produced Volume
    const totalProducedQty = orders.reduce((sum, ord) => {
      const q = parseFloat(String(ord.produced_qty || "0"));
      return sum + (isNaN(q) ? 0 : q);
    }, 0);

    // Production Progress %
    const dispatchPercent =
      totalOrderQty > 0
        ? Math.min(100, Math.round((totalProducedQty / totalOrderQty) * 100))
        : 0;

    // Total Quotation Value
    const totalQuoteVal = quotations.reduce((sum, q) => {
      const v = parseFloat(String(q.amount_total || "0"));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    return {
      ordersCount: orders.length,
      totalOrderQty: parseFloat(totalOrderQty.toFixed(1)),
      totalProducedQty: parseFloat(totalProducedQty.toFixed(1)),
      dispatchPercent,
      leadsCount: leads.length,
      totalQuoteVal,
    };
  }, [orders, leads, quotations]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#2563EB"]}
            tintColor="#FFFFFF"
          />
        }
      >
        {/* ==========================================
            1. MODERN EXECUTIVE NAVY HEADER
        ========================================== */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandGroup}>
              <View style={styles.brandRow}>
                <Text style={styles.brandTitle}>MODO</Text>
                <Text style={styles.brandAccent}>RMC</Text>
                <View style={styles.livePulseDot} />
              </View>
              <View style={styles.plantBadgeRow}>
                <Ionicons name="business" size={13} color="#94A3B8" />
                <Text style={styles.plantBadgeText} numberOfLines={1}>
                  {plant_name || "Coimbatore Batching Plant"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.headerRefreshBtn}
              onPress={handleRefresh}
              activeOpacity={0.7}
            >
              <Ionicons
                name="reload-outline"
                size={18}
                color="#FFFFFF"
                style={
                  refreshing ? { transform: [{ rotate: "45deg" }] } : undefined
                }
              />
            </TouchableOpacity>
          </View>

          {/* ==========================================
              ATTENDANCE / SHIFT CHECK-IN & CHECK-OUT CARD
          ========================================== */}
          <View style={styles.attendanceCard}>
            <TouchableOpacity
              style={styles.attendanceLeft}
              onPress={() => router.push("/attendancehistory")}
              activeOpacity={0.8}
            >
              <View style={styles.attendanceStatusRow}>
                <View
                  style={[
                    styles.statusIndicatorDot,
                    isCheckedIn ? styles.dotGreen : styles.dotAmber,
                  ]}
                />
                <Text
                  style={[
                    styles.attendanceStatusText,
                    isCheckedIn ? styles.textGreen : styles.textAmber,
                  ]}
                >
                  {isCheckedIn ? "CURRENTLY CHECKED IN" : "NOT CHECKED IN"}
                </Text>
                <View style={styles.attendanceHistoryLink}>
                  <Text style={styles.attendanceHistoryLinkText}>History →</Text>
                </View>
              </View>

              <Text style={styles.attendanceShiftTitle} numberOfLines={1}>
                {shift?.name || "Personnel Shift"} · {shiftHours}h Shift
              </Text>

              <Text style={styles.attendanceDetailText} numberOfLines={1}>
                {isCheckedIn
                  ? `In at ${checkInTime || "Today"}${elapsedFormatted ? ` · ${elapsedFormatted}` : ""}`
                  : `Shift: ${shiftTimingText}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.attendanceButton,
                isCheckedIn ? styles.checkOutBtn : styles.checkInBtn,
              ]}
              onPress={isCheckedIn ? handleCheckOut : handleCheckIn}
              disabled={attendanceLoading}
              activeOpacity={0.82}
            >
              {attendanceLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : isCheckedIn ? (
                <View style={styles.attendanceBtnContent}>
                  <Ionicons name="log-out-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.attendanceBtnText}>Check Out</Text>
                </View>
              ) : (
                <View style={styles.attendanceBtnContent}>
                  <Ionicons name="log-in-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.attendanceBtnText}>Check In</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* KPI METRIC STRIP (2x2 MODERN GRID) */}
          <View style={styles.kpiGrid}>
            {/* KPI 1: Active Orders */}
            <TouchableOpacity
              style={styles.kpiBox}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/orders")}
            >
              <View
                style={[
                  styles.kpiIconWrap,
                  { backgroundColor: "rgba(37, 99, 235, 0.2)" },
                ]}
              >
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={18}
                  color="#60A5FA"
                />
              </View>
              <Text style={styles.kpiVal}>{metrics.ordersCount}</Text>
              <Text style={styles.kpiLabel}>ACTIVE ORDERS</Text>
              <Text style={styles.kpiSub}>
                {metrics.totalOrderQty} m³ Booked
              </Text>
            </TouchableOpacity>

            {/* KPI 2: Production Dispatched */}
            <TouchableOpacity
              style={styles.kpiBox}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/orders")}
            >
              <View
                style={[
                  styles.kpiIconWrap,
                  { backgroundColor: "rgba(5, 150, 105, 0.2)" },
                ]}
              >
                <MaterialCommunityIcons
                  name="truck-delivery-outline"
                  size={18}
                  color="#34D399"
                />
              </View>
              <Text style={[styles.kpiVal, { color: "#34D399" }]}>
                {metrics.totalProducedQty}{" "}
                <Text style={{ fontSize: 13 }}>m³</Text>
              </Text>
              <Text style={styles.kpiLabel}>DISPATCHED</Text>
              <Text style={styles.kpiSub}>
                {metrics.dispatchPercent}% Completed
              </Text>
            </TouchableOpacity>

            {/* KPI 3: Commercial Leads */}
            <TouchableOpacity
              style={styles.kpiBox}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/leads")}
            >
              <View
                style={[
                  styles.kpiIconWrap,
                  { backgroundColor: "rgba(217, 119, 6, 0.2)" },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-group-outline"
                  size={18}
                  color="#FBBF24"
                />
              </View>
              <Text style={[styles.kpiVal, { color: "#FBBF24" }]}>
                {metrics.leadsCount}
              </Text>
              <Text style={styles.kpiLabel}>ACTIVE LEADS</Text>
              <Text style={styles.kpiSub}>Pipeline Enquiries</Text>
            </TouchableOpacity>

            {/* KPI 4: Quotation Value */}
            <TouchableOpacity
              style={styles.kpiBox}
              activeOpacity={0.8}
              onPress={() => router.push("/showlistquotation")}
            >
              <View
                style={[
                  styles.kpiIconWrap,
                  { backgroundColor: "rgba(99, 102, 241, 0.2)" },
                ]}
              >
                <Ionicons name="cash-outline" size={18} color="#A5B4FC" />
              </View>
              <Text style={[styles.kpiVal, { color: "#A5B4FC" }]}>
                {formatCurrency(metrics.totalQuoteVal)}
              </Text>
              <Text style={styles.kpiLabel}>QUOTE PIPELINE</Text>
              <Text style={styles.kpiSub}>
                {quotations.length} Active Quotes
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ==========================================
            2. QUICK ACTION HUB (4 ACTION CARDS)
        ========================================== */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionHeaderTitle}>QUICK ACTIONS</Text>

          <View style={styles.actionsRow}>
            {/* New Lead */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/showcreatelead")}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: "#EFF6FF" },
                ]}
              >
                <Ionicons name="person-add" size={20} color="#2563EB" />
              </View>
              <Text style={styles.actionCardTitle}>New Lead</Text>
              <Text style={styles.actionCardSubtitle}>Add Enquiry</Text>
            </TouchableOpacity>

            {/* New Quote */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/showcreatequotations")}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: "#F0FDF4" },
                ]}
              >
                <Ionicons name="document-text" size={20} color="#059669" />
              </View>
              <Text style={styles.actionCardTitle}>New Quote</Text>
              <Text style={styles.actionCardSubtitle}>Draft Quote</Text>
            </TouchableOpacity>

            {/* Orders Pipeline */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/(tabs)/orders")}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: "#FFFBEB" },
                ]}
              >
                <MaterialCommunityIcons
                  name="clipboard-check"
                  size={20}
                  color="#D97706"
                />
              </View>
              <Text style={styles.actionCardTitle}>Orders</Text>
              <Text style={styles.actionCardSubtitle}>Production</Text>
            </TouchableOpacity>

            {/* Customers */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push("/shocustomerlist")}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: "#F5F3FF" },
                ]}
              >
                <Ionicons name="people" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.actionCardTitle}>Customers</Text>
              <Text style={styles.actionCardSubtitle}>Client Base</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ==========================================
            3. LIVE BATCHING PLANT HEALTH CARD
        ========================================== */}
        <View style={styles.plantCard}>
          <View style={styles.plantHeaderRow}>
            <View style={styles.plantTitleRow}>
              <View style={styles.greenPulseBadge}>
                <View style={styles.greenDot} />
              </View>
              <View>
                <Text style={styles.plantTitleText}>
                  {plant_name ? plant_name : "Ready-Mix Batching Plant #1"}
                </Text>
                <Text style={styles.plantStatusSubtitle}>
                  Operating at optimal throughput · 120 m³/h capacity
                </Text>
              </View>
            </View>
            <View style={styles.activeTrucksTag}>
              <MaterialCommunityIcons
                name="truck-fast"
                size={14}
                color="#059669"
              />
              <Text style={styles.activeTrucksText}>8 Mixers</Text>
            </View>
          </View>

          {/* Plant Material Silos Level Bar */}
          <View style={styles.silosGrid}>
            <View style={styles.siloItem}>
              <View style={styles.siloHeader}>
                <Text style={styles.siloLabel}>OPC 53 Cement</Text>
                <Text style={styles.siloPercent}>78%</Text>
              </View>
              <View style={styles.siloTrack}>
                <View
                  style={[
                    styles.siloFill,
                    { width: "78%", backgroundColor: "#3B82F6" },
                  ]}
                />
              </View>
            </View>

            <View style={styles.siloItem}>
              <View style={styles.siloHeader}>
                <Text style={styles.siloLabel}>20mm Aggregate</Text>
                <Text style={styles.siloPercent}>85%</Text>
              </View>
              <View style={styles.siloTrack}>
                <View
                  style={[
                    styles.siloFill,
                    { width: "85%", backgroundColor: "#10B981" },
                  ]}
                />
              </View>
            </View>

            <View style={styles.siloItem}>
              <View style={styles.siloHeader}>
                <Text style={styles.siloLabel}>M-Sand Stock</Text>
                <Text style={styles.siloPercent}>92%</Text>
              </View>
              <View style={styles.siloTrack}>
                <View
                  style={[
                    styles.siloFill,
                    { width: "92%", backgroundColor: "#F59E0B" },
                  ]}
                />
              </View>
            </View>

            <View style={styles.siloItem}>
              <View style={styles.siloHeader}>
                <Text style={styles.siloLabel}>Admixtures</Text>
                <Text style={styles.siloPercent}>95%</Text>
              </View>
              <View style={styles.siloTrack}>
                <View
                  style={[
                    styles.siloFill,
                    { width: "95%", backgroundColor: "#8B5CF6" },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* ==========================================
            4. RECENT ORDERS & DISPATCHES (CURRENT DATA)
        ========================================== */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleGroup}>
            <MaterialCommunityIcons
              name="clipboard-text-clock"
              size={18}
              color="#0B2A4A"
            />
            <Text style={styles.sectionMainTitle}>
              Recent Orders & Dispatches
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/orders")}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View All ({orders.length}) →</Text>
          </TouchableOpacity>
        </View>

        {loading && orders.length === 0 ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.inlineLoadingText}>
              Loading orders from plant...
            </Text>
          </View>
        ) : (
          orders.slice(0, 3).map((item) => {
            const statusMeta = getOrderStatusMeta(item.status);
            const totalQty = parseFloat(String(item.total_qty || "0"));
            const producedQty = parseFloat(String(item.produced_qty || "0"));
            const pct =
              totalQty > 0
                ? Math.min(100, Math.round((producedQty / totalQty) * 100))
                : 0;
            const refNumber =
              item.full_number || item.order_no || `SO/2627/${item.id}`;
            const customerName =
              item.customer?.legal_name || "Commercial Customer";
            const siteName = item.site?.name || "Delivery Site";
            const mixName =
              item.mix_design?.design_name ||
              item.mix_design?.name ||
              "Concrete Mix";

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.orderCard}
                onPress={() => router.push("/(tabs)/orders")}
                activeOpacity={0.85}
              >
                {/* Header: SO Reference & Status */}
                <View style={styles.orderCardTop}>
                  <View style={styles.orderRefBadge}>
                    <MaterialCommunityIcons
                      name="file-document-outline"
                      size={13}
                      color="#2563EB"
                    />
                    <Text style={styles.orderRefText}>{refNumber}</Text>
                  </View>

                  <View
                    style={[
                      styles.orderStatusBadge,
                      {
                        backgroundColor: statusMeta.bg,
                        borderColor: statusMeta.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderStatusText,
                        { color: statusMeta.text },
                      ]}
                    >
                      {statusMeta.label}
                    </Text>
                  </View>
                </View>

                {/* Customer & Location */}
                <Text style={styles.orderCustomerName} numberOfLines={1}>
                  {customerName}
                </Text>
                <View style={styles.orderSiteRow}>
                  <Ionicons name="location" size={13} color="#DC2626" />
                  <Text style={styles.orderSiteText} numberOfLines={1}>
                    {siteName}
                  </Text>
                </View>

                {/* Concrete Mix & Dispatch Progress */}
                <View style={styles.orderSpecRow}>
                  <View style={styles.orderMixPill}>
                    <MaterialCommunityIcons
                      name="layers-triple-outline"
                      size={13}
                      color="#475569"
                    />
                    <Text style={styles.orderMixText} numberOfLines={1}>
                      {mixName}
                    </Text>
                  </View>

                  {item.concrete_pump ? (
                    <View style={styles.pumpBadge}>
                      <Ionicons
                        name="flash-outline"
                        size={11}
                        color="#D97706"
                      />
                      <Text style={styles.pumpBadgeText}>
                        {item.concrete_pump.toUpperCase()} PUMP
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Progress bar */}
                <View style={styles.orderProgressBox}>
                  <View style={styles.orderProgressLabels}>
                    <Text style={styles.progressQtyLabel}>
                      Dispatched:{" "}
                      <Text style={styles.progressQtyVal}>
                        {producedQty} / {totalQty} m³
                      </Text>
                    </Text>
                    <Text style={styles.progressPctText}>{pct}%</Text>
                  </View>
                  <View style={styles.orderProgressTrack}>
                    <View
                      style={[styles.orderProgressFill, { width: `${pct}%` }]}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* ==========================================
            5. RECENT COMMERCIAL LEADS (CURRENT DATA)
        ========================================== */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleGroup}>
            <MaterialCommunityIcons
              name="account-search-outline"
              size={18}
              color="#0B2A4A"
            />
            <Text style={styles.sectionMainTitle}>
              Commercial Pipeline Leads
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/leads")}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View All ({leads.length}) →</Text>
          </TouchableOpacity>
        </View>

        {loading && leads.length === 0 ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.inlineLoadingText}>
              Loading leads pipeline...
            </Text>
          </View>
        ) : (
          leads.slice(0, 3).map((item) => {
            const clientTitle =
              item.company_name || item.contact_name || "Lead Client";
            const projectTitle =
              item.project_name || item.delivery_location || "Project Location";
            const mixName =
              item.mix_design && typeof item.mix_design === "object"
                ? item.mix_design.design_name ||
                  item.mix_design.name ||
                  item.mix_design.code
                : typeof item.mix_design === "string" && item.mix_design.trim()
                  ? item.mix_design.trim()
                  : item.requirement && isNaN(Number(item.requirement))
                    ? item.requirement
                    : "Standard Mix";
            const grade = mixName || "M20 Grade";
            const qty = item.estimated_quantity
              ? `${parseFloat(String(item.estimated_quantity))} m³`
              : "0 m³";
            const value = formatCurrency(item.expected_value);

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.leadCard}
                onPress={() => router.push("/(tabs)/leads")}
                activeOpacity={0.85}
              >
                <View style={styles.leadCardTop}>
                  <View style={styles.leadNumberBadge}>
                    <Ionicons
                      name="pricetag-outline"
                      size={12}
                      color="#4F46E5"
                    />
                    <Text style={styles.leadNumberText}>
                      {item.lead_number || "Commercial Lead"}
                    </Text>
                  </View>

                  <View style={styles.leadStatusBadge}>
                    <Text style={styles.leadStatusText}>
                      {item.status || "New"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.leadClientText} numberOfLines={1}>
                  {clientTitle}
                </Text>

                <View style={styles.leadProjectRow}>
                  <Ionicons name="business-outline" size={13} color="#64748B" />
                  <Text style={styles.leadProjectText} numberOfLines={1}>
                    {projectTitle}
                  </Text>
                </View>

                <View style={styles.leadFooterRow}>
                  <View style={styles.leadSpecsGroup}>
                    <View style={styles.leadSpecItem}>
                      <MaterialCommunityIcons
                        name="cube-outline"
                        size={13}
                        color="#2563EB"
                      />
                      <Text style={styles.leadSpecText}>
                        {grade} · {qty}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.leadValueText}>{value}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ==========================================
          ANIMATED ATTENDANCE MODAL ALERT
      ========================================== */}
      <Modal
        visible={modalData.visible}
        transparent
        animationType="none"
        onRequestClose={hideAttendanceModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: modalAnim,
                transform: [
                  {
                    scale: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.82, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Modal Top Bar Accent */}
            <View
              style={[
                styles.modalTopBar,
                modalData.type === "checkin"
                  ? { backgroundColor: "#10B981" }
                  : modalData.type === "checkout"
                    ? { backgroundColor: "#2563EB" }
                    : modalData.type === "error"
                      ? { backgroundColor: "#DC2626" }
                      : { backgroundColor: "#D97706" },
              ]}
            />

            <View style={styles.modalBody}>
              {/* Hero Circular Icon with Layered Pulse Ring */}
              <View
                style={[
                  styles.modalIconOuter,
                  modalData.type === "checkin"
                    ? styles.outerGreen
                    : modalData.type === "checkout"
                      ? styles.outerBlue
                      : modalData.type === "error"
                        ? styles.outerRed
                        : styles.outerAmber,
                ]}
              >
                <View
                  style={[
                    styles.modalIconInner,
                    modalData.type === "checkin"
                      ? styles.innerGreen
                      : modalData.type === "checkout"
                        ? styles.innerBlue
                        : modalData.type === "error"
                          ? styles.innerRed
                          : styles.innerAmber,
                  ]}
                >
                  <Ionicons
                    name={
                      modalData.type === "checkin"
                        ? "checkmark-circle"
                        : modalData.type === "checkout"
                          ? "checkmark-done-circle"
                          : modalData.type === "error"
                            ? "alert-circle"
                            : "time"
                    }
                    size={38}
                    color={
                      modalData.type === "checkin"
                        ? "#059669"
                        : modalData.type === "checkout"
                          ? "#2563EB"
                          : modalData.type === "error"
                            ? "#DC2626"
                            : "#D97706"
                    }
                  />
                </View>
              </View>

              {/* Status Chip Badge */}
              {modalData.badge ? (
                <View
                  style={[
                    styles.modalBadge,
                    modalData.type === "checkin"
                      ? styles.badgeGreen
                      : modalData.type === "checkout"
                        ? styles.badgeBlue
                        : modalData.type === "error"
                          ? styles.badgeRed
                          : styles.badgeAmber,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalBadgeText,
                      modalData.type === "checkin"
                        ? styles.badgeTextGreen
                        : modalData.type === "checkout"
                          ? styles.badgeTextBlue
                          : modalData.type === "error"
                            ? styles.badgeTextRed
                            : styles.badgeTextAmber,
                    ]}
                  >
                    {modalData.badge}
                  </Text>
                </View>
              ) : null}

              {/* Title & Subtitle */}
              <Text style={styles.modalTitle}>{modalData.title}</Text>
              <Text style={styles.modalSubtitle}>{modalData.subtitle}</Text>

              {/* Response Details Breakdown Card */}
              {modalData.details ? (
                <View style={styles.modalDetailsCard}>
                  {modalData.details.attendanceId ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Attendance ID</Text>
                      <View style={styles.idChip}>
                        <Text style={styles.idChipText}>
                          #{modalData.details.attendanceId}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {modalData.details.time ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>
                        {modalData.type === "checkin"
                          ? "Check-In Time"
                          : "Check-Out Time"}
                      </Text>
                      <Text style={styles.detailValBold}>
                        {modalData.details.time}
                      </Text>
                    </View>
                  ) : null}

                  {modalData.details.date ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailVal}>
                        {modalData.details.date}
                      </Text>
                    </View>
                  ) : null}

                  {modalData.details.shiftName ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Shift</Text>
                      <Text style={styles.detailVal} numberOfLines={1}>
                        {modalData.details.shiftName}
                        {modalData.details.workingHours
                          ? ` (${modalData.details.workingHours}h)`
                          : ""}
                      </Text>
                    </View>
                  ) : null}

                  {modalData.details.status ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status</Text>
                      <View
                        style={[
                          styles.statusChip,
                          modalData.type === "checkout"
                            ? { backgroundColor: "#EFF6FF" }
                            : { backgroundColor: "#ECFDF5" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            modalData.type === "checkout"
                              ? { color: "#2563EB" }
                              : { color: "#059669" },
                          ]}
                        >
                          {String(modalData.details.status).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {modalData.details.workedHours ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Hours Worked</Text>
                      <Text
                        style={[styles.detailValBold, { color: "#2563EB" }]}
                      >
                        {modalData.details.workedHours} hrs
                      </Text>
                    </View>
                  ) : null}

                  {/* Late Arrival Badge if marked late */}
                  {modalData.details.isLate ? (
                    <View style={styles.lateBanner}>
                      <Ionicons
                        name="warning-outline"
                        size={15}
                        color="#B45309"
                      />
                      <Text style={styles.lateBannerText}>
                        Late Arrival ({modalData.details.lateHours || "0"} hrs)
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.modalActionButton,
                  modalData.type === "checkin"
                    ? styles.actionBtnGreen
                    : modalData.type === "checkout"
                      ? styles.actionBtnBlue
                      : styles.actionBtnNavy,
                ]}
                onPress={hideAttendanceModal}
                activeOpacity={0.85}
              >
                <Text style={styles.modalActionText}>
                  {modalData.type === "checkin"
                    ? "Start Working Day"
                    : modalData.type === "checkout"
                      ? "Got It"
                      : "Dismiss"}
                </Text>
                <Ionicons
                  name={
                    modalData.type === "checkin" ? "arrow-forward" : "checkmark"
                  }
                  size={16}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B2A4A",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // 1. Header Section
  header: {
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#0B2A4A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  brandGroup: {
    flex: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  brandAccent: {
    fontSize: 22,
    fontWeight: "900",
    color: "#60A5FA",
    letterSpacing: 0.5,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginLeft: 6,
  },
  plantBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  plantBadgeText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  headerRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Attendance & Shift Card
  attendanceCard: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attendanceLeft: {
    flex: 1,
    marginRight: 10,
  },
  attendanceStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  statusIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  dotGreen: {
    backgroundColor: "#10B981",
  },
  dotAmber: {
    backgroundColor: "#F59E0B",
  },
  attendanceStatusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  textGreen: {
    color: "#34D399",
  },
  textAmber: {
    color: "#FBBF24",
  },
  attendanceHistoryLink: {
    marginLeft: 6,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  attendanceHistoryLinkText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#93C5FD",
  },
  attendanceShiftTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  attendanceDetailText: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "500",
  },
  attendanceButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 106,
  },
  checkInBtn: {
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  checkOutBtn: {
    backgroundColor: "#DC2626",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  attendanceBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  attendanceBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // KPI 2x2 Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiBox: {
    width: "48.4%",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiVal: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 11,
    color: "#CBD5E1",
    marginTop: 2,
    fontWeight: "500",
  },

  // 2. Quick Actions
  actionsSection: {
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  actionCardSubtitle: {
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
    marginTop: 2,
  },

  // 3. Batching Plant Health
  plantCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  plantHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  plantTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  greenPulseBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },
  plantTitleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  plantStatusSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  activeTrucksTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 4,
  },
  activeTrucksText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#065F46",
  },
  silosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  siloItem: {
    width: "48%",
  },
  siloHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  siloLabel: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
  },
  siloPercent: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },
  siloTrack: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  siloFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionMainTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B2A4A",
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },

  inlineLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  inlineLoadingText: {
    fontSize: 12,
    color: "#64748B",
  },

  // Order Cards
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  orderRefBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    gap: 4,
  },
  orderRefText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E40AF",
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  orderCustomerName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  orderSiteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  orderSiteText: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
  orderSpecRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  orderMixPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4,
  },
  orderMixText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  pumpBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 3,
  },
  pumpBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
  },
  orderProgressBox: {
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  orderProgressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressQtyLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  progressQtyVal: {
    fontWeight: "700",
    color: "#0F172A",
  },
  progressPctText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  orderProgressTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  orderProgressFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 3,
  },

  // Lead Cards
  leadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  leadCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  leadNumberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    gap: 4,
  },
  leadNumberText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4338CA",
  },
  leadStatusBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  leadStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  leadClientText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  leadProjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  leadProjectText: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
  leadFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  leadSpecsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  leadSpecItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  leadSpecText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  leadValueText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#059669",
  },

  // ==========================================
  // ANIMATED ATTENDANCE MODAL STYLES
  // ==========================================
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 42, 74, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#0B2A4A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTopBar: {
    height: 5,
    width: "100%",
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
  },
  modalIconOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  modalIconInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
  },
  outerGreen: { backgroundColor: "#ECFDF5" },
  innerGreen: { backgroundColor: "#D1FAE5" },
  outerBlue: { backgroundColor: "#EFF6FF" },
  innerBlue: { backgroundColor: "#DBEAFE" },
  outerRed: { backgroundColor: "#FEF2F2" },
  innerRed: { backgroundColor: "#FEE2E2" },
  outerAmber: { backgroundColor: "#FFFBEB" },
  innerAmber: { backgroundColor: "#FEF3C7" },

  modalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeGreen: { backgroundColor: "#ECFDF5" },
  badgeBlue: { backgroundColor: "#EFF6FF" },
  badgeRed: { backgroundColor: "#FEF2F2" },
  badgeAmber: { backgroundColor: "#FFFBEB" },
  modalBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  badgeTextGreen: { color: "#059669" },
  badgeTextBlue: { color: "#2563EB" },
  badgeTextRed: { color: "#DC2626" },
  badgeTextAmber: { color: "#D97706" },

  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  modalDetailsCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  detailVal: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "600",
  },
  detailValBold: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
  },
  idChip: {
    backgroundColor: "#EEF2F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  idChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  lateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  lateBannerText: {
    fontSize: 11,
    color: "#92400E",
    fontWeight: "600",
  },
  modalActionButton: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  actionBtnGreen: {
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  actionBtnBlue: {
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  actionBtnNavy: {
    backgroundColor: "#0B2A4A",
  },
  modalActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
