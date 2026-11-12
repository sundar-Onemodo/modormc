import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useSelector } from "react-redux";
import { baseURL } from "../../../baseurl/baseURL";
import { RootState } from "../../../store/store";

// ==========================================
// INTERFACES (Matching Live Attendance API)
// ==========================================

export interface AttendanceShift {
  id: number | null;
  name: string;
  start_time: string;
  end_time: string;
  grace_time: number;
  working_hours: number;
  is_night_shift: boolean;
  effective_from: string | null;
  effective_to: string | null;
}

export interface AttendanceItem {
  id: number;
  plant_id: number;
  personnel_id: number;
  shift_id: number | null;
  status: string; // "present", "absent", etc.
  source?: string | null;
  notes?: string | null;
  worked_hours?: string | number;
  overtime_hours?: string | number;
  late_hours?: string | number;
  is_late?: boolean;
  is_early_departure?: boolean;
  user_id?: number;
  shift?: AttendanceShift | null;
  scheduled_hours?: string | number;
  grace_seconds?: number;
  attendance_date: string; // "2026-11-11"
  timezone?: string;
  check_in?: string | null; // "2026-11-11 13:07:37"
  check_out?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  is_open?: boolean;
}

interface CalendarCell {
  day: number | null;
  dateKey: string;
  isCurrentMonth: boolean;
  records?: AttendanceItem[];
}

type DatePresetKey =
  | "this_month"
  | "last_7"
  | "last_30"
  | "last_month"
  | "custom";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// ==========================================
// PURE DATE & FORMAT HELPERS (TZ-Safe)
// ==========================================

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthRange(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  return {
    from: toDateKey(firstDay),
    to: toDateKey(lastDay),
  };
}

function formatShortDate(dateKey: string): string {
  if (!dateKey) return "";
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIdx) || isNaN(day)) return dateKey;
  const monthShort = MONTH_NAMES[monthIdx]?.substring(0, 3) || parts[1];
  return `${String(day).padStart(2, "0")} ${monthShort} ${year}`;
}

function formatFullDateDisplay(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          weekday: "long",
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    }
  } catch {
    // ignore
  }
  return dateStr;
}

function formatTimeWithOptionalDate(
  dateTimeStr?: string | null,
  referenceDateKey?: string,
): { time: string; dateTag?: string } {
  if (!dateTimeStr) return { time: "--:--" };
  try {
    const clean = dateTimeStr.trim();
    const [datePart] = clean.split(" ");
    const d = new Date(clean.replace(" ", "T"));
    if (!isNaN(d.getTime())) {
      const time = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      if (referenceDateKey && datePart && datePart !== referenceDateKey) {
        return { time, dateTag: formatShortDate(datePart) };
      }
      return { time };
    }
    const parts = clean.split(" ");
    if (parts.length > 1) return { time: parts[1] };
  } catch {
    // ignore
  }
  return { time: dateTimeStr };
}

function buildCalendarWeeks(
  year: number,
  monthIndex: number,
  recordsMap?: Record<string, AttendanceItem[]>,
): CalendarCell[][] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayIndex = new Date(year, monthIndex, 1).getDay();

  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({
      day: null,
      dateKey: `empty-start-${i}`,
      isCurrentMonth: false,
    });
  }

  const monthStr = String(monthIndex + 1).padStart(2, "0");
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, "0");
    const dateKey = `${year}-${monthStr}-${dayStr}`;
    cells.push({
      day: d,
      dateKey,
      isCurrentMonth: true,
      records: recordsMap ? recordsMap[dateKey] : undefined,
    });
  }

  // Always pad trailing cells so every week row has exact 7 slots
  while (cells.length % 7 !== 0) {
    cells.push({
      day: null,
      dateKey: `empty-end-${cells.length}`,
      isCurrentMonth: false,
    });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function daysBetweenCount(fromKey: string, toKey: string): number {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  if ([y1, m1, d1, y2, m2, d2].some(isNaN)) return 0;
  const start = new Date(y1, m1 - 1, d1).getTime();
  const end = new Date(y2, m2 - 1, d2).getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

// ==========================================
// MAIN SCREEN COMPONENT
// ==========================================

export default function AttendanceHistoryScreen() {
  const { user, token, plant_id, plant_name, shift } = useSelector(
    (state: RootState) => state.auth,
  );

  const [todayKey] = useState<string>(() => toDateKey(new Date()));
  const [viewYear, setViewYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState<number>(() =>
    new Date().getMonth(),
  );

  // Active filter date range
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    return getMonthRange(now.getFullYear(), now.getMonth()).from;
  });
  const [toDate, setToDate] = useState<string>(() => {
    const now = new Date();
    return getMonthRange(now.getFullYear(), now.getMonth()).to;
  });
  const [activePreset, setActivePreset] = useState<DatePresetKey>("this_month");

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    toDateKey(new Date()),
  );

  // Data state
  const [attendances, setAttendances] = useState<AttendanceItem[]>([]);
  const [apiUsername, setApiUsername] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [lastPage, setLastPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Date Range Picker Modal state
  const [rangeModalVisible, setRangeModalVisible] = useState<boolean>(false);
  const [pickerYear, setPickerYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [pickerMonth, setPickerMonth] = useState<number>(() =>
    new Date().getMonth(),
  );
  const [draftFromDate, setDraftFromDate] = useState<string | null>(null);
  const [draftToDate, setDraftToDate] = useState<string | null>(null);

  // Status Bar Sync
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0B2A4A");
      }
    }, []),
  );

  // API Fetch Helper with from_date, to_date, per_page, page
  const fetchAttendanceHistory = useCallback(
    async (from: string, to: string, pageNum: number = 1) => {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (plant_id !== null && plant_id !== undefined) {
        headers["X-Plant-Id"] = String(plant_id);
      }

      const params = {
        from_date: from,
        to_date: to,
        per_page: 50,
        page: pageNum,
      };

      const urlV1 = `${baseURL}v1/attendances`;
      const urlDirect = `${baseURL}attendances`;

      try {
        const res = await axios.get(urlV1, {
          headers,
          params,
          timeout: 15000,
        });
        return res.data;
      } catch (err: any) {
        if (err?.response?.status === 404) {
          const resFallback = await axios.get(urlDirect, {
            headers,
            params,
            timeout: 15000,
          });
          return resFallback.data;
        }
        throw err;
      }
    },
    [token, plant_id],
  );

  // Initial & reactive fetch whenever date range changes
  useEffect(() => {
    let isCancelled = false;

    fetchAttendanceHistory(fromDate, toDate, 1)
      .then((resData) => {
        if (!isCancelled && resData?.success) {
          const payload = resData.data;
          const rawList: AttendanceItem[] = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];

          setAttendances(rawList);
          setCurrentPage(payload?.current_page || 1);
          setLastPage(payload?.last_page || 1);
          setTotalCount(payload?.total ?? rawList.length);
          if (resData?.user?.username) {
            setApiUsername(resData.user.username);
          }

          if (rawList.length > 0) {
            setSelectedDate((prev) => {
              const hasPrevInResult = rawList.some(
                (r) => r.attendance_date?.trim() === prev,
              );
              return hasPrevInResult
                ? prev
                : rawList[0].attendance_date.trim();
            });
          }
        }
      })
      .catch((err) => {
        console.log(
          "Error loading attendance history:",
          err?.response?.data || err?.message || err,
        );
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [fetchAttendanceHistory, fromDate, toDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const resData = await fetchAttendanceHistory(fromDate, toDate, 1);
      if (resData?.success) {
        const payload = resData.data;
        const rawList: AttendanceItem[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];
        setAttendances(rawList);
        setCurrentPage(payload?.current_page || 1);
        setLastPage(payload?.last_page || 1);
        setTotalCount(payload?.total ?? rawList.length);
      }
    } catch (err: any) {
      console.log(
        "Error refreshing attendance:",
        err?.response?.data || err?.message || err,
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || currentPage >= lastPage) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const resData = await fetchAttendanceHistory(fromDate, toDate, nextPage);
      if (resData?.success) {
        const payload = resData.data;
        const rawList: AttendanceItem[] = Array.isArray(payload?.data)
          ? payload.data
          : [];
        setAttendances((prev) => [...prev, ...rawList]);
        setCurrentPage(payload?.current_page || nextPage);
        setLastPage(payload?.last_page || lastPage);
      }
    } catch (err: any) {
      console.log("Error loading more attendances:", err?.message || err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Apply Preset Filters
  const applyPreset = (preset: Exclude<DatePresetKey, "custom">) => {
    const now = new Date();
    let newFrom = fromDate;
    let newTo = toDate;
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth();

    if (preset === "this_month") {
      const range = getMonthRange(now.getFullYear(), now.getMonth());
      newFrom = range.from;
      newTo = range.to;
    } else if (preset === "last_7") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      newFrom = toDateKey(start);
      newTo = toDateKey(now);
    } else if (preset === "last_30") {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      newFrom = toDateKey(start);
      newTo = toDateKey(now);
    } else if (preset === "last_month") {
      targetMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      targetYear =
        now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const range = getMonthRange(targetYear, targetMonth);
      newFrom = range.from;
      newTo = range.to;
    }

    setLoading(true);
    setActivePreset(preset);
    setFromDate(newFrom);
    setToDate(newTo);
    setViewYear(targetYear);
    setViewMonth(targetMonth);
    setSelectedDate(newTo);
  };

  // Navigate Calendar Months (also updates query range so user sees any month's data)
  const navigateCalendarMonth = (delta: -1 | 1) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }

    const range = getMonthRange(nextYear, nextMonth);
    const now = new Date();
    const isCurrentMonth =
      nextYear === now.getFullYear() && nextMonth === now.getMonth();

    setLoading(true);
    setViewYear(nextYear);
    setViewMonth(nextMonth);
    setFromDate(range.from);
    setToDate(range.to);
    setActivePreset(isCurrentMonth ? "this_month" : "custom");
    setSelectedDate(isCurrentMonth ? toDateKey(now) : range.from);
  };

  const goToToday = () => {
    applyPreset("this_month");
    setSelectedDate(todayKey);
  };

  // Open Range Picker Modal
  const openRangePicker = () => {
    const [yStr, mStr] = toDate.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    setPickerYear(!isNaN(y) ? y : viewYear);
    setPickerMonth(!isNaN(m) ? m : viewMonth);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setRangeModalVisible(true);
  };

  const handlePickerDayPress = (dateKey: string) => {
    if (!draftFromDate || (draftFromDate && draftToDate)) {
      setDraftFromDate(dateKey);
      setDraftToDate(null);
    } else if (dateKey < draftFromDate) {
      setDraftToDate(draftFromDate);
      setDraftFromDate(dateKey);
    } else {
      setDraftToDate(dateKey);
    }
  };

  const applyCustomRange = () => {
    if (!draftFromDate) {
      setRangeModalVisible(false);
      return;
    }
    const finalFrom = draftFromDate;
    const finalTo = draftToDate || draftFromDate;

    const [yStr, mStr] = finalTo.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;

    setLoading(true);
    setFromDate(finalFrom);
    setToDate(finalTo);
    setActivePreset("custom");
    if (!isNaN(y) && !isNaN(m)) {
      setViewYear(y);
      setViewMonth(m);
    }
    setSelectedDate(finalTo);
    setRangeModalVisible(false);
  };

  // Group attendances by dateKey ("YYYY-MM-DD")
  const attendanceMapByDate = useMemo(() => {
    const map: Record<string, AttendanceItem[]> = {};
    for (const item of attendances) {
      if (item.attendance_date) {
        const cleanKey = item.attendance_date.trim();
        if (!map[cleanKey]) map[cleanKey] = [];
        map[cleanKey].push(item);
      }
    }
    return map;
  }, [attendances]);

  // Fixed 7-Column Weeks for Main Calendar
  const calendarWeeks = useMemo(
    () => buildCalendarWeeks(viewYear, viewMonth, attendanceMapByDate),
    [viewYear, viewMonth, attendanceMapByDate],
  );

  // Fixed 7-Column Weeks for Modal Range Picker
  const pickerWeeks = useMemo(
    () => buildCalendarWeeks(pickerYear, pickerMonth),
    [pickerYear, pickerMonth],
  );

  // KPI Metrics across fetched date range
  const rangeMetrics = useMemo(() => {
    const presentDaysSet = new Set<string>();
    let lateCount = 0;
    let totalWorkedHours = 0;
    let totalOvertimeHours = 0;

    for (const item of attendances) {
      if (
        String(item.status).toLowerCase() === "present" &&
        item.attendance_date
      ) {
        presentDaysSet.add(item.attendance_date.trim());
      }
      if (item.is_late) lateCount += 1;

      const worked = parseFloat(String(item.worked_hours || "0"));
      if (!isNaN(worked)) totalWorkedHours += worked;

      const ot = parseFloat(String(item.overtime_hours || "0"));
      if (!isNaN(ot)) totalOvertimeHours += ot;
    }

    return {
      presentCount: presentDaysSet.size,
      lateCount,
      totalWorkedHours: totalWorkedHours.toFixed(1),
      totalOvertimeHours: totalOvertimeHours.toFixed(1),
    };
  }, [attendances]);

  // Selected Date Records
  const selectedRecords = useMemo(
    () => attendanceMapByDate[selectedDate] || [],
    [attendanceMapByDate, selectedDate],
  );

  const displayName = user?.name || apiUsername || "Kiran";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const handleLogCardPress = (dateStr: string) => {
    setSelectedDate(dateStr);
    const [yStr, mStr] = dateStr.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    if (!isNaN(y) && !isNaN(m)) {
      setViewYear(y);
      setViewMonth(m);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      {/* ==========================================
          1. EXECUTIVE NAVY HEADER & PROFILE
      ========================================== */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>My Attendance</Text>
            <Text style={styles.headerSubtitle}>
              Calendar, Date Range & Shift Logs
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
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

        {/* User Profile Mini Banner */}
        <View style={styles.profileMiniCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initials || "KI"}</Text>
          </View>

          <View style={styles.profileMiniInfo}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileNameText} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.profileRoleBadge}>
                <Text style={styles.profileRoleText}>PERSONNEL</Text>
              </View>
            </View>

            <View style={styles.profileMetaRow}>
              <Ionicons name="business" size={12} color="#94A3B8" />
              <Text style={styles.profilePlantText} numberOfLines={1}>
                {plant_name || "Ready-Mix Batching Plant"}
              </Text>
              <Text style={styles.metaDivider}>•</Text>
              <Text style={styles.profileShiftText} numberOfLines={1}>
                {shift?.name || "Personnel shift"} ({shift?.working_hours || 10}
                h)
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2563EB"]}
            tintColor="#0B2A4A"
          />
        }
      >
        {/* ==========================================
            2. DATE RANGE FILTER BAR & PRESETS
        ========================================== */}
        <View style={styles.rangeFilterCard}>
          <TouchableOpacity
            style={styles.rangeDisplayBtn}
            onPress={openRangePicker}
            activeOpacity={0.8}
          >
            <View style={styles.rangeIconWrap}>
              <Ionicons name="calendar-outline" size={18} color="#2563EB" />
            </View>
            <View style={styles.rangeTextGroup}>
              <Text style={styles.rangeLabel}>SELECTED DATE RANGE</Text>
              <Text style={styles.rangeValue}>
                {formatShortDate(fromDate)} → {formatShortDate(toDate)}
              </Text>
            </View>
            <View style={styles.rangeEditPill}>
              <Ionicons name="options-outline" size={13} color="#2563EB" />
              <Text style={styles.rangeEditText}>Change</Text>
            </View>
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetScroll}
          >
            {[
              { key: "this_month", label: "This Month" },
              { key: "last_7", label: "Last 7 Days" },
              { key: "last_30", label: "Last 30 Days" },
              { key: "last_month", label: "Last Month" },
            ].map((item) => {
              const isActive = activePreset === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.presetChip, isActive && styles.presetChipActive]}
                  onPress={() =>
                    applyPreset(
                      item.key as Exclude<DatePresetKey, "custom">,
                    )
                  }
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      isActive && styles.presetChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.presetChip,
                activePreset === "custom" && styles.presetChipActive,
              ]}
              onPress={openRangePicker}
              activeOpacity={0.75}
            >
              <Ionicons
                name="calendar"
                size={11}
                color={activePreset === "custom" ? "#FFFFFF" : "#64748B"}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.presetChipText,
                  activePreset === "custom" && styles.presetChipTextActive,
                ]}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ==========================================
            3. RANGE SUMMARY KPIs (2x2 GRID)
        ========================================== */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiRowTop}>
              <View
                style={[
                  styles.kpiIconBox,
                  { backgroundColor: "rgba(5, 150, 105, 0.12)" },
                ]}
              >
                <Ionicons name="checkmark-done" size={16} color="#059669" />
              </View>
              <Text style={styles.kpiLabel}>DAYS PRESENT</Text>
            </View>
            <Text style={styles.kpiValue}>{rangeMetrics.presentCount}</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiRowTop}>
              <View
                style={[
                  styles.kpiIconBox,
                  { backgroundColor: "rgba(37, 99, 235, 0.12)" },
                ]}
              >
                <Ionicons name="time-outline" size={16} color="#2563EB" />
              </View>
              <Text style={styles.kpiLabel}>WORKED HOURS</Text>
            </View>
            <Text style={[styles.kpiValue, { color: "#2563EB" }]}>
              {rangeMetrics.totalWorkedHours}h
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiRowTop}>
              <View
                style={[
                  styles.kpiIconBox,
                  { backgroundColor: "rgba(124, 58, 237, 0.12)" },
                ]}
              >
                <Ionicons name="flash-outline" size={16} color="#7C3AED" />
              </View>
              <Text style={styles.kpiLabel}>OVERTIME</Text>
            </View>
            <Text style={[styles.kpiValue, { color: "#7C3AED" }]}>
              {rangeMetrics.totalOvertimeHours}h
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiRowTop}>
              <View
                style={[
                  styles.kpiIconBox,
                  { backgroundColor: "rgba(217, 119, 6, 0.12)" },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color="#D97706"
                />
              </View>
              <Text style={styles.kpiLabel}>LATE ENTRIES</Text>
            </View>
            <Text style={[styles.kpiValue, { color: "#D97706" }]}>
              {rangeMetrics.lateCount}
            </Text>
          </View>
        </View>

        {/* ==========================================
            4. FIXED 7-COLUMN ATTENDANCE CALENDAR
        ========================================== */}
        <View style={styles.calendarCard}>
          {/* Calendar Month Navigation Header */}
          <View style={styles.calendarNavRow}>
            <TouchableOpacity
              style={styles.navArrowBtn}
              onPress={() => navigateCalendarMonth(-1)}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color="#0B2A4A" />
            </TouchableOpacity>

            <View style={styles.monthTitleBlock}>
              <Text style={styles.monthTitleText}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
            </View>

            <View style={styles.calendarRightActions}>
              <TouchableOpacity
                style={styles.todayPill}
                onPress={goToToday}
                activeOpacity={0.7}
              >
                <Text style={styles.todayPillText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => navigateCalendarMonth(1)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={18} color="#0B2A4A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Fixed 7-Column Days of Week Row */}
          <View style={styles.dayOfWeekRow}>
            {DAYS_OF_WEEK.map((day, idx) => (
              <View key={day} style={styles.daySlotWrapper}>
                <Text
                  style={[
                    styles.dayOfWeekText,
                    idx === 0 && { color: "#DC2626" },
                  ]}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Week Rows (Exact 7 Cells Per Row for 28/29/30/31-day perfection) */}
          <View style={styles.weeksContainer}>
            {calendarWeeks.map((week, wIdx) => (
              <View key={`week-${wIdx}`} style={styles.weekRow}>
                {week.map((cell) => {
                  if (cell.day === null) {
                    return (
                      <View key={cell.dateKey} style={styles.daySlotWrapper}>
                        <View style={styles.dayCellEmpty} />
                      </View>
                    );
                  }

                  const records = cell.records || [];
                  const isPresent = records.some(
                    (r) => String(r.status).toLowerCase() === "present",
                  );
                  const isLate = records.some((r) => Boolean(r.is_late));
                  const isSelected = selectedDate === cell.dateKey;
                  const isToday = todayKey === cell.dateKey;
                  const isInActiveRange =
                    cell.dateKey >= fromDate && cell.dateKey <= toDate;

                  return (
                    <View key={cell.dateKey} style={styles.daySlotWrapper}>
                      <TouchableOpacity
                        style={[
                          styles.dayCell,
                          isInActiveRange &&
                            !isPresent &&
                            styles.dayCellInRange,
                          isPresent && styles.dayCellPresent, // Solid Green when status is present!
                          isSelected && styles.dayCellSelected,
                          isToday && !isPresent && styles.dayCellToday,
                        ]}
                        onPress={() => setSelectedDate(cell.dateKey)}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.dayCellText,
                            isPresent && styles.dayCellTextPresent,
                            isSelected &&
                              !isPresent &&
                              styles.dayCellTextSelected,
                            isToday && !isPresent && styles.dayCellTextToday,
                          ]}
                        >
                          {cell.day}
                        </Text>

                        {/* Status Dot */}
                        {isPresent ? (
                          <View style={styles.presentDotWhite} />
                        ) : isToday ? (
                          <View style={styles.todayDotBlue} />
                        ) : null}

                        {/* Late Warning Mini Tag */}
                        {isLate && isPresent ? (
                          <View style={styles.cellLateMarker} />
                        ) : null}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Calendar Status Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
              <Text style={styles.legendText}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor: "#FFFFFF",
                    borderColor: "#0B2A4A",
                    borderWidth: 2,
                  },
                ]}
              />
              <Text style={styles.legendText}>Selected</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", borderWidth: 1 }]} />
              <Text style={styles.legendText}>In Range</Text>
            </View>
          </View>
        </View>

        {/* ==========================================
            5. SELECTED DATE DETAILS BREAKDOWN CARD
        ========================================== */}
        <View style={styles.detailsSectionHeader}>
          <Ionicons name="calendar" size={17} color="#0B2A4A" />
          <Text style={styles.detailsSectionTitle}>
            {formatFullDateDisplay(selectedDate)}
          </Text>
        </View>

        {loading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.inlineLoadingText}>
              Loading attendance details...
            </Text>
          </View>
        ) : selectedRecords.length > 0 ? (
          selectedRecords.map((record) => {
            const checkInFormatted = formatTimeWithOptionalDate(
              record.check_in,
              record.attendance_date,
            );
            const checkOutFormatted = formatTimeWithOptionalDate(
              record.check_out,
              record.attendance_date,
            );
            const otNum = parseFloat(String(record.overtime_hours || "0"));

            return (
              <View key={record.id} style={styles.detailCard}>
                {/* Status Header */}
                <View style={styles.detailCardHeader}>
                  <View style={styles.detailBadgesLeft}>
                    <View style={styles.statusPillPresent}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#059669"
                      />
                      <Text style={styles.statusPillPresentText}>
                        {String(record.status).toUpperCase()}
                      </Text>
                    </View>

                    {record.is_open ? (
                      <View style={styles.openShiftBadge}>
                        <View style={styles.openPulseDot} />
                        <Text style={styles.openShiftText}>ACTIVE</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.recordIdTag}>
                    <Text style={styles.recordIdText}>ID #{record.id}</Text>
                  </View>
                </View>

                {/* In / Out Timings Grid */}
                <View style={styles.timingsRow}>
                  <View style={styles.timingBox}>
                    <View style={styles.timingIconWrap}>
                      <Ionicons
                        name="log-in-outline"
                        size={16}
                        color="#059669"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timingLabel}>CHECK IN</Text>
                      <Text style={styles.timingVal}>
                        {checkInFormatted.time}
                      </Text>
                      {checkInFormatted.dateTag ? (
                        <Text style={styles.crossDateTag}>
                          {checkInFormatted.dateTag}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.timingBox}>
                    <View
                      style={[
                        styles.timingIconWrap,
                        { backgroundColor: "#EFF6FF" },
                      ]}
                    >
                      <Ionicons
                        name="log-out-outline"
                        size={16}
                        color="#2563EB"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timingLabel}>CHECK OUT</Text>
                      <Text style={styles.timingVal}>
                        {record.check_out
                          ? checkOutFormatted.time
                          : record.is_open
                            ? "Open / Active"
                            : "--:--"}
                      </Text>
                      {record.check_out && checkOutFormatted.dateTag ? (
                        <Text style={styles.crossDateTag}>
                          on {checkOutFormatted.dateTag}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Worked / Scheduled / Overtime Metric Strip */}
                <View style={styles.hoursPillRow}>
                  <View style={styles.hourMiniBox}>
                    <Text style={styles.hourMiniLabel}>WORKED</Text>
                    <Text style={styles.hourMiniVal}>
                      {record.worked_hours || "0.00"}h
                    </Text>
                  </View>
                  <View style={styles.hourDivider} />
                  <View style={styles.hourMiniBox}>
                    <Text style={styles.hourMiniLabel}>SCHEDULED</Text>
                    <Text style={styles.hourMiniVal}>
                      {record.scheduled_hours ||
                        record.shift?.working_hours ||
                        "10.00"}
                      h
                    </Text>
                  </View>
                  <View style={styles.hourDivider} />
                  <View style={styles.hourMiniBox}>
                    <Text style={styles.hourMiniLabel}>OVERTIME</Text>
                    <Text
                      style={[
                        styles.hourMiniVal,
                        otNum > 0 && { color: "#7C3AED" },
                      ]}
                    >
                      {otNum > 0 ? `+${record.overtime_hours}h` : "0.00h"}
                    </Text>
                  </View>
                </View>

                {/* Shift & Meta Specs */}
                <View style={styles.specList}>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Assigned Shift</Text>
                    <Text style={styles.specValue}>
                      {record.shift?.name || shift?.name || "Personnel shift"} (
                      {record.shift?.start_time?.slice(0, 5) || "08:00"} -{" "}
                      {record.shift?.end_time?.slice(0, 5) || "18:00"})
                    </Text>
                  </View>

                  {record.notes ? (
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>Notes</Text>
                      <Text style={styles.specValue}>{record.notes}</Text>
                    </View>
                  ) : null}

                  {/* Flags Row (Late / Early Departure) */}
                  {(record.is_late || record.is_early_departure) && (
                    <View style={styles.flagsContainer}>
                      {record.is_late ? (
                        <View style={styles.lateBanner}>
                          <Ionicons name="warning" size={14} color="#B45309" />
                          <Text style={styles.lateBannerText}>
                            Late by {record.late_hours || "0.00"} hrs
                          </Text>
                        </View>
                      ) : null}

                      {record.is_early_departure ? (
                        <View style={styles.earlyBanner}>
                          <Ionicons
                            name="exit-outline"
                            size={14}
                            color="#BE123C"
                          />
                          <Text style={styles.earlyBannerText}>
                            Early Departure
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyDetailCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={26} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Attendance Recorded</Text>
            <Text style={styles.emptySubtitle}>
              No punch record found for {formatShortDate(selectedDate)}. Tap any
              green date on the calendar or pick another date range above.
            </Text>
          </View>
        )}

        {/* ==========================================
            6. RANGE ATTENDANCE LOGS LIST
        ========================================== */}
        <View style={styles.listSectionHeader}>
          <View>
            <Text style={styles.listSectionTitle}>Attendance Records</Text>
            <Text style={styles.listRangeSubtitle}>
              {formatShortDate(fromDate)} – {formatShortDate(toDate)}
            </Text>
          </View>
          <View style={styles.countPillBadge}>
            <Text style={styles.listCountBadge}>
              {totalCount || attendances.length} Found
            </Text>
          </View>
        </View>

        {attendances.length === 0 && !loading ? (
          <View style={styles.emptyListCard}>
            <Ionicons
              name="document-text-outline"
              size={24}
              color="#94A3B8"
              style={{ marginBottom: 6 }}
            />
            <Text style={styles.emptyListText}>
              No attendance logs found in this date range.
            </Text>
          </View>
        ) : (
          attendances.map((record) => {
            const isPresent =
              String(record.status).toLowerCase() === "present";
            const dateStr = record.attendance_date || todayKey;
            const dayParts = dateStr.split("-");
            const dayNumber = dayParts[2] || "01";
            const monthIdx = parseInt(dayParts[1] || "1", 10) - 1;
            const monthShort =
              MONTH_NAMES[monthIdx]?.substring(0, 3).toUpperCase() || "NOV";
            const inFmt = formatTimeWithOptionalDate(record.check_in, dateStr);
            const outFmt = formatTimeWithOptionalDate(
              record.check_out,
              dateStr,
            );
            const otNum = parseFloat(String(record.overtime_hours || "0"));

            return (
              <TouchableOpacity
                key={record.id}
                style={[
                  styles.logCard,
                  selectedDate === dateStr && styles.logCardActive,
                ]}
                onPress={() => handleLogCardPress(dateStr)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.logDateBlock,
                    selectedDate === dateStr && { backgroundColor: "#2563EB" },
                  ]}
                >
                  <Text style={styles.logDateNum}>{dayNumber}</Text>
                  <Text style={styles.logDateMonth}>{monthShort}</Text>
                </View>

                <View style={styles.logDetails}>
                  <View style={styles.logShiftRow}>
                    <Text style={styles.logShiftName} numberOfLines={1}>
                      {record.shift?.name || "Personnel shift"}
                    </Text>

                    <View style={styles.logTagsRow}>
                      {record.is_open ? (
                        <View style={styles.tagOpen}>
                          <Text style={styles.tagOpenText}>OPEN</Text>
                        </View>
                      ) : null}
                      <View
                        style={[
                          styles.logStatusTag,
                          isPresent ? styles.tagGreen : styles.tagAmber,
                        ]}
                      >
                        <Text
                          style={[
                            styles.logStatusTagText,
                            isPresent ? styles.tagTextGreen : styles.tagTextAmber,
                          ]}
                        >
                          {String(record.status).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.logPunchTimes}>
                    <Text style={styles.logPunchLabel}>
                      In: <Text style={styles.logPunchVal}>{inFmt.time}</Text>
                    </Text>
                    <Text style={styles.logPunchDivider}>•</Text>
                    <Text style={styles.logPunchLabel}>
                      Out:{" "}
                      <Text style={styles.logPunchVal}>
                        {record.check_out
                          ? `${outFmt.time}${outFmt.dateTag ? ` (${outFmt.dateTag.slice(0, 6)})` : ""}`
                          : record.is_open
                            ? "Active"
                            : "--:--"}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.logFooterMetrics}>
                    <Text style={styles.logMetricItem}>
                      Worked:{" "}
                      <Text style={styles.logMetricBold}>
                        {record.worked_hours || "0.00"}h
                      </Text>
                    </Text>
                    {otNum > 0 ? (
                      <Text style={styles.logOtBadge}>
                        +{record.overtime_hours}h OT
                      </Text>
                    ) : null}
                    {record.is_late ? (
                      <Text style={styles.logLateChip}>
                        Late {record.late_hours || "0"}h
                      </Text>
                    ) : null}
                    {record.is_early_departure ? (
                      <Text style={styles.logEarlyChip}>Early Out</Text>
                    ) : null}
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={selectedDate === dateStr ? "#2563EB" : "#CBD5E1"}
                />
              </TouchableOpacity>
            );
          })
        )}

        {/* Load More Pagination Button */}
        {currentPage < lastPage && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={handleLoadMore}
            disabled={loadingMore}
            activeOpacity={0.8}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Text style={styles.loadMoreText}>
                Load More ({attendances.length} of {totalCount})
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ==========================================
          7. CUSTOM DATE RANGE PICKER MODAL
      ========================================== */}
      <Modal
        visible={rangeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRangeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Date Range</Text>
                <Text style={styles.modalSubtitle}>
                  Tap start date and end date on calendar
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setRangeModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Draft Range Summary Boxes */}
            <View style={styles.draftRangeRow}>
              <View
                style={[
                  styles.draftBox,
                  (!draftFromDate || Boolean(draftFromDate && draftToDate)) &&
                    styles.draftBoxActive,
                ]}
              >
                <Text style={styles.draftBoxLabel}>FROM DATE</Text>
                <Text style={styles.draftBoxVal}>
                  {draftFromDate ? formatShortDate(draftFromDate) : "Select"}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
              <View
                style={[
                  styles.draftBox,
                  Boolean(draftFromDate && !draftToDate) &&
                    styles.draftBoxActive,
                ]}
              >
                <Text style={styles.draftBoxLabel}>TO DATE</Text>
                <Text style={styles.draftBoxVal}>
                  {draftToDate
                    ? formatShortDate(draftToDate)
                    : draftFromDate
                      ? formatShortDate(draftFromDate)
                      : "Select"}
                </Text>
              </View>
            </View>

            {/* Modal Calendar Navigation */}
            <View style={styles.calendarNavRow}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => {
                  if (pickerMonth === 0) {
                    setPickerMonth(11);
                    setPickerYear((y) => y - 1);
                  } else {
                    setPickerMonth((m) => m - 1);
                  }
                }}
              >
                <Ionicons name="chevron-back" size={18} color="#0B2A4A" />
              </TouchableOpacity>

              <Text style={styles.monthTitleText}>
                {MONTH_NAMES[pickerMonth]} {pickerYear}
              </Text>

              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => {
                  if (pickerMonth === 11) {
                    setPickerMonth(0);
                    setPickerYear((y) => y + 1);
                  } else {
                    setPickerMonth((m) => m + 1);
                  }
                }}
              >
                <Ionicons name="chevron-forward" size={18} color="#0B2A4A" />
              </TouchableOpacity>
            </View>

            {/* 7-Column Header */}
            <View style={styles.dayOfWeekRow}>
              {DAYS_OF_WEEK.map((day, idx) => (
                <View key={day} style={styles.daySlotWrapper}>
                  <Text
                    style={[
                      styles.dayOfWeekText,
                      idx === 0 && { color: "#DC2626" },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* 7-Column Weeks */}
            <View style={styles.weeksContainer}>
              {pickerWeeks.map((week, wIdx) => (
                <View key={`pweek-${wIdx}`} style={styles.weekRow}>
                  {week.map((cell) => {
                    if (cell.day === null) {
                      return (
                        <View key={cell.dateKey} style={styles.daySlotWrapper}>
                          <View style={styles.dayCellEmpty} />
                        </View>
                      );
                    }

                    const isStart = draftFromDate === cell.dateKey;
                    const isEnd = draftToDate === cell.dateKey;
                    const isInSpan = Boolean(
                      draftFromDate &&
                        draftToDate &&
                        cell.dateKey > draftFromDate &&
                        cell.dateKey < draftToDate,
                    );

                    return (
                      <View key={cell.dateKey} style={styles.daySlotWrapper}>
                        <TouchableOpacity
                          style={[
                            styles.pickerDayCell,
                            isInSpan && styles.pickerDayInSpan,
                            (isStart || isEnd) && styles.pickerDayEndpoint,
                          ]}
                          onPress={() => handlePickerDayPress(cell.dateKey)}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              isInSpan && {
                                color: "#1E40AF",
                                fontWeight: "700",
                              },
                              (isStart || isEnd) && {
                                color: "#FFFFFF",
                                fontWeight: "800",
                              },
                            ]}
                          >
                            {cell.day}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Modal Action Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRangeModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={applyCustomRange}
                activeOpacity={0.85}
              >
                <Text style={styles.modalApplyText}>
                  Apply (
                  {draftFromDate
                    ? `${daysBetweenCount(draftFromDate, draftToDate || draftFromDate)}d`
                    : "Filter"}
                  )
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    padding: 16,
    paddingBottom: 30,
  },

  // 1. Header & Profile
  header: {
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#0B2A4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleGroup: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileMiniCard: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  profileMiniInfo: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  profileNameText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profileRoleBadge: {
    backgroundColor: "rgba(37, 99, 235, 0.3)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  profileRoleText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#60A5FA",
    letterSpacing: 0.5,
  },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  profilePlantText: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: "500",
    maxWidth: 120,
  },
  metaDivider: {
    color: "#64748B",
    fontSize: 10,
  },
  profileShiftText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
    flex: 1,
  },

  // 2. Date Range Filter Card
  rangeFilterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  rangeDisplayBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 10,
  },
  rangeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  rangeTextGroup: {
    flex: 1,
  },
  rangeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  rangeValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  rangeEditPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  rangeEditText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  presetScroll: {
    flexDirection: "row",
    gap: 8,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  presetChipActive: {
    backgroundColor: "#0B2A4A",
    borderColor: "#0B2A4A",
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  presetChipTextActive: {
    color: "#FFFFFF",
  },

  // 3. KPI 2x2 Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    width: "48.3%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.4,
    flex: 1,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#059669",
  },

  // 4. Fixed 7-Column Calendar Card
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  calendarNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  monthTitleBlock: {
    flex: 1,
    alignItems: "center",
  },
  monthTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.3,
  },
  calendarRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  todayPill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  dayOfWeekRow: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 4,
  },
  weeksContainer: {
    gap: 2,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  daySlotWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayOfWeekText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.4,
  },
  dayCellEmpty: {
    width: 38,
    height: 40,
  },
  dayCell: {
    width: 38,
    height: 40,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    position: "relative",
  },
  dayCellInRange: {
    backgroundColor: "#EFF6FF",
  },
  dayCellPresent: {
    backgroundColor: "#10B981", // Solid Green when Present!
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  dayCellSelected: {
    borderWidth: 2,
    borderColor: "#0B2A4A",
  },
  dayCellToday: {
    borderColor: "#2563EB",
    borderWidth: 1.5,
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  dayCellTextPresent: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  dayCellTextSelected: {
    color: "#0B2A4A",
    fontWeight: "800",
  },
  dayCellTextToday: {
    color: "#2563EB",
    fontWeight: "800",
  },
  presentDotWhite: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
    marginTop: 1,
  },
  todayDotBlue: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2563EB",
    marginTop: 1,
  },
  cellLateMarker: {
    position: "absolute",
    top: 3,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FBBF24",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },

  // 5. Details Breakdown
  detailsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    marginLeft: 2,
  },
  detailsSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  inlineLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  inlineLoadingText: {
    fontSize: 12,
    color: "#64748B",
  },
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  detailCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  detailBadgesLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPillPresent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  statusPillPresentText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.5,
  },
  openShiftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  openPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563EB",
  },
  openShiftText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563EB",
  },
  recordIdTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recordIdText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  timingsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  timingBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  timingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  timingLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  timingVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  crossDateTag: {
    fontSize: 10,
    color: "#2563EB",
    fontWeight: "600",
    marginTop: 1,
  },
  hoursPillRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    marginBottom: 12,
  },
  hourMiniBox: {
    flex: 1,
    alignItems: "center",
  },
  hourMiniLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.4,
  },
  hourMiniVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  hourDivider: {
    width: 1,
    height: 26,
    backgroundColor: "#E2E8F0",
  },
  specList: {
    gap: 8,
  },
  specItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  specLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  specValue: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
  },
  flagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  lateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lateBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
  },
  earlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFE4E6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  earlyBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#BE123C",
  },
  emptyDetailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
  },

  // 6. Filtered Attendance Logs List
  listSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginLeft: 2,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listRangeSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  countPillBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  listCountBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  emptyListCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyListText: {
    fontSize: 12,
    color: "#64748B",
  },
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  logCardActive: {
    borderColor: "#2563EB",
    backgroundColor: "#F0F7FF",
  },
  logDateBlock: {
    width: 44,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#0B2A4A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  logDateNum: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 18,
  },
  logDateMonth: {
    fontSize: 9,
    fontWeight: "700",
    color: "#CBD5E1",
    letterSpacing: 0.5,
  },
  logDetails: {
    flex: 1,
  },
  logShiftRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  logShiftName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  logTagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  tagOpen: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagOpenText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
  },
  logStatusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagGreen: { backgroundColor: "#ECFDF5" },
  tagAmber: { backgroundColor: "#FFFBEB" },
  logStatusTagText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  tagTextGreen: { color: "#059669" },
  tagTextAmber: { color: "#D97706" },
  logPunchTimes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  logPunchLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  logPunchVal: {
    fontWeight: "700",
    color: "#334155",
  },
  logPunchDivider: {
    color: "#CBD5E1",
    fontSize: 10,
  },
  logFooterMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  logMetricItem: {
    fontSize: 11,
    color: "#64748B",
  },
  logMetricBold: {
    fontWeight: "700",
    color: "#0F172A",
  },
  logOtBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7C3AED",
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  logLateChip: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  logEarlyChip: {
    fontSize: 10,
    fontWeight: "700",
    color: "#BE123C",
    backgroundColor: "#FFE4E6",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  loadMoreBtn: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginTop: 6,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  // 7. Date Range Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 42, 74, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  draftRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 14,
  },
  draftBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  draftBoxActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  draftBoxLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  draftBoxVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  pickerDayCell: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerDayInSpan: {
    backgroundColor: "#DBEAFE",
    borderRadius: 6,
  },
  pickerDayEndpoint: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  modalApplyBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#0B2A4A",
    justifyContent: "center",
    alignItems: "center",
  },
  modalApplyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
