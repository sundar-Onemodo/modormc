import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { resetRmcAuth } from "../../../store/authSice";
import { AppDispatch, RootState } from "../../../store/store";

interface GridMenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  badgeColor?: string;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
}

export default function MoreScreen() {
  const { user, plant_name } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0B2A4A");
      }
    }, []),
  );

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out from ONEMODO RMC?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            dispatch(resetRmcAuth());
            router.replace("/login");
          },
        },
      ],
    );
  };

  const handleModuleClick = (moduleName: string) => {
    Alert.alert(
      moduleName,
      `Opening ${moduleName} module for ${plant_name || "active plant"}.`,
      [{ text: "OK" }],
    );
  };

  const gridItems: GridMenuItem[] = [
    {
      id: "attendance",
      title: "My Attendance",
      subtitle: "Calendar & Shift Logs",
      icon: "calendar-outline",
      badge: "Calendar",
      badgeColor: "#059669",
      iconColor: "#059669",
      iconBg: "#ECFDF5",
      onPress: () => router.push("/attendancehistory"),
    },
    {
      id: "quotations",
      title: "Quotations",
      subtitle: "Create New Estimate",
      icon: "document-attach-outline",
      badge: "Create",
      badgeColor: "#2563EB",
      iconColor: "#2563EB",
      iconBg: "#EFF6FF",
      onPress: () => router.push("/showlistquotation"),
    },
    {
      id: "customer",
      title: "Customer",
      subtitle: "Clients & Contractors",
      icon: "people-outline",
      badge: "Clients",
      badgeColor: "#0284C7",
      iconColor: "#0284C7",
      iconBg: "#F0F9FF",
      onPress: () => router.push("/shocustomerlist"),
    },
    {
      id: "batch",
      title: "Batch Schedules",
      subtitle: "Daily Plant Queue",
      icon: "time-outline",
      badge: "8 Today",
      badgeColor: "#7C3AED",
      iconColor: "#7C3AED",
      iconBg: "#F5F3FF",
      onPress: () => handleModuleClick("Batch Schedules"),
    },
    {
      id: "marketing",
      title: "Marketing & Visits",
      subtitle: "Site Visits & Leads",
      icon: "navigate-circle-outline",
      badge: "5 Visits",
      badgeColor: "#D97706",
      iconColor: "#D97706",
      iconBg: "#FEF3C7",
      onPress: () => handleModuleClick("Marketing & Visits"),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>More</Text>
            <Text style={styles.headerSubtitle}>
              Operations, plant modules & admin
            </Text>
          </View>
          <View style={styles.headerBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.headerBadgeText}>ONLINE</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: "#F8FAFC" }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.name
                ? user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase()
                : "RM"}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>
                {user?.name || "Operations Lead"}
              </Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>OPERATIONS</Text>
              </View>
            </View>

            <Text style={styles.userEmail}>
              {user?.email || "rmc@onemodo.com"}
            </Text>

            <View style={styles.plantTag}>
              <Ionicons name="location-sharp" size={13} color="#2563EB" />
              <Text style={styles.plantText} numberOfLines={1}>
                {plant_name || "Bengaluru Central Plant #1"}
              </Text>
            </View>
          </View>
        </View>

        {/* My Attendance Interactive Card */}
        <TouchableOpacity
          style={styles.attendanceActionCard}
          onPress={() => router.push("/attendancehistory")}
          activeOpacity={0.85}
        >
          <View style={styles.attendanceActionLeft}>
            <View style={styles.attendanceActionIconWrap}>
              <Ionicons name="calendar" size={22} color="#059669" />
            </View>
            <View style={styles.attendanceActionTextGroup}>
              <View style={styles.attendanceActionTitleRow}>
                <Text style={styles.attendanceActionTitle}>My Attendance</Text>
                <View style={styles.attendanceActionBadge}>
                  <View style={styles.actionGreenDot} />
                  <Text style={styles.attendanceActionBadgeText}>CALENDAR</Text>
                </View>
              </View>
              <Text style={styles.attendanceActionSubtitle} numberOfLines={1}>
                View daily attendance calendar, green marks & logs
              </Text>
            </View>
          </View>

          <View style={styles.attendanceActionArrow}>
            <Ionicons name="chevron-forward" size={18} color="#059669" />
          </View>
        </TouchableOpacity>

        {/* Quick Operational Grid Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Operations & Management</Text>
          <Text style={styles.sectionSubtitle}>
            Quick access to plant modules
          </Text>
        </View>

        <View style={styles.gridContainer}>
          {gridItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.gridCard}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.cardTopRow}>
                <View
                  style={[styles.iconBox, { backgroundColor: item.iconBg }]}
                >
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={item.iconColor}
                  />
                </View>
                {item.badge && (
                  <View
                    style={[styles.cardBadge, { backgroundColor: item.iconBg }]}
                  >
                    <Text
                      style={[
                        styles.cardBadgeText,
                        { color: item.badgeColor || item.iconColor },
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Sign Out from App</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.versionFooter}>
          ONEMODO Concrete ERP · Built for Android & iOS
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B2A4A",
  },
  header: {
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 20,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  profileInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  rolePill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2563EB",
    letterSpacing: 0.5,
  },
  userEmail: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 6,
  },
  plantTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  plantText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
    flex: 1,
  },
  // My Attendance Action Card
  attendanceActionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  attendanceActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  attendanceActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  attendanceActionTextGroup: {
    flex: 1,
  },
  attendanceActionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  attendanceActionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  attendanceActionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionGreenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10B981",
  },
  attendanceActionBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.5,
  },
  attendanceActionSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  attendanceActionArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sectionHeader: {
    marginBottom: 10,
    marginLeft: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  gridCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748B",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    height: 48,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
  },
  versionFooter: {
    textAlign: "center",
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 10,
  },
});
