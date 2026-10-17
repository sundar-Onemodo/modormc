import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { baseURL } from "../../../baseurl/baseURL";
import { RootState } from "../../../store/store";

// ==========================================
// TYPES & INTERFACES (Matching Live API)
// ==========================================

export interface OrderCustomer {
  id: number;
  legal_name: string;
}

export interface OrderSite {
  id: number;
  name: string;
}

export interface OrderMixDesign {
  id: number;
  design_name?: string | null;
  name?: string | null;
  code?: string | null;
}

export interface OrderItem {
  id: number;
  plant_id?: number;
  customer_po_id?: number | null;
  concrete_pump?: string | null;
  sales_executive_id?: number | null;
  pump_type?: string | null;
  customer_id?: number;
  site_id?: number;
  prefix?: string | null;
  order_no?: string | null;
  reference_type?: string | null;
  reference_id?: number | null;
  mix_design_id?: number;
  rate?: number | string | null;
  tax_id?: number | null;
  is_tax_inclusive?: boolean;
  total_qty?: string | number;
  produced_qty?: string | number;
  uom_id?: number | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status: number | string;
  created_at?: string;
  updated_at?: string;
  pump_rate?: number | string | null;
  full_number?: string | null;
  customer?: OrderCustomer | null;
  site?: OrderSite | null;
  mix_design?: OrderMixDesign | null;
}

// Initial realistic fallback data based on live API
const SAMPLE_ORDERS: OrderItem[] = [
  {
    id: 31,
    plant_id: 6,
    customer_po_id: null,
    concrete_pump: "boom",
    sales_executive_id: 1,
    pump_type: null,
    customer_id: 25,
    site_id: 10,
    prefix: "SO/2627/",
    order_no: "0030",
    reference_type: null,
    reference_id: null,
    mix_design_id: 15,
    rate: 1000,
    tax_id: 200,
    is_tax_inclusive: true,
    total_qty: "50.000",
    produced_qty: "0.000",
    uom_id: null,
    scheduled_start: "2026-10-12T09:02:23.000000Z",
    scheduled_end: null,
    status: 1,
    created_at: "2026-10-12T09:04:10.000000Z",
    updated_at: "2026-10-15T12:44:18.000000Z",
    pump_rate: 500,
    full_number: "SO/2627/0030",
    customer: {
      id: 25,
      legal_name: "Kavi",
    },
    site: {
      id: 10,
      name: "KK Nagar",
    },
    mix_design: {
      id: 15,
      design_name: "M01",
      name: "M01",
      code: null,
    },
  },
];

// ==========================================
// UTILITY HELPERS
// ==========================================

export const formatCurrency = (
  val: string | number | null | undefined,
): string => {
  if (val === null || val === undefined || val === "") return "₹0";
  const num =
    typeof val === "number"
      ? val
      : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return "₹0";
  return "₹ " + Math.round(num).toLocaleString("en-IN");
};

export const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return "Not Scheduled";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${formattedHours}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
};

export const formatDateOnly = (dateStr?: string | null): string => {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

export const getOrderStatusMeta = (
  status: number | string | null | undefined,
) => {
  const s = String(status).toLowerCase();
  if (s === "1" || s === "confirmed" || s === "active" || s === "scheduled") {
    return {
      label: "Confirmed",
      bg: "#ECFDF5",
      text: "#047857",
      border: "#A7F3D0",
      dot: "#10B981",
    };
  }
  if (s === "2" || s === "completed" || s === "delivered") {
    return {
      label: "Completed",
      bg: "#EFF6FF",
      text: "#1D4ED8",
      border: "#BFDBFE",
      dot: "#3B82F6",
    };
  }
  if (s === "3" || s === "cancelled") {
    return {
      label: "Cancelled",
      bg: "#FEF2F2",
      text: "#B91C1C",
      border: "#FECACA",
      dot: "#EF4444",
    };
  }
  return {
    label: "Pending",
    bg: "#FFFBEB",
    text: "#B45309",
    border: "#FDE68A",
    dot: "#F59E0B",
  };
};

export const getPumpBadgeMeta = (pump: string | null | undefined) => {
  if (!pump) return null;
  const p = pump.toLowerCase();
  if (p.includes("boom")) {
    return {
      label: "Boom Pump",
      bg: "#FEF3C7",
      text: "#D97706",
      icon: "flash" as const,
    };
  }
  if (p.includes("line")) {
    return {
      label: "Line Pump",
      bg: "#EFF6FF",
      text: "#2563EB",
      icon: "git-commit" as const,
    };
  }
  return {
    label: pump.toUpperCase(),
    bg: "#F1F5F9",
    text: "#475569",
    icon: "construct" as const,
  };
};

// ==========================================
// API CALL HELPER
// ==========================================

export async function fetchOrdersApi(
  token: string | null,
  plantId: number | null | undefined,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (plantId !== null && plantId !== undefined) {
    headers["X-Plant-Id"] = String(plantId);
  }

  const params: Record<string, any> = {
    per_page: 50,
  };

  return axios.get(`${baseURL}v1/orders`, {
    params,
    headers,
    timeout: 25000,
  });
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function OrdersScreen() {
  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );

  const [orders, setOrders] = useState<OrderItem[]>(SAMPLE_ORDERS);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "All" | "Confirmed" | "BoomPump" | "Completed"
  >("All");

  // Selected Order for Details Modal
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  // Status Bar Synchronization
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0B2A4A");
      }
    }, []),
  );

  // Initial API Load
  useEffect(() => {
    let isCancelled = false;

    fetchOrdersApi(token, plant_id)
      .then((res) => {
        if (isCancelled) return;
        const resData = res.data;
        let list: OrderItem[] = [];
        if (Array.isArray(resData?.data?.data)) {
          list = resData.data.data;
        } else if (Array.isArray(resData?.data)) {
          list = resData.data;
        } else if (Array.isArray(resData)) {
          list = resData;
        }

        if (list.length > 0) {
          setOrders(list);
        }
      })
      .catch((err: any) => {
        if (isCancelled) return;
        console.log("Error loading live orders:", err?.message || err);
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Could not connect to plant orders server.";
        setErrorMessage(msg);
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token, plant_id]);

  // Pull-to-refresh & Retry
  const handleManualRefresh = useCallback(
    (isPull = false) => {
      if (isPull) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      fetchOrdersApi(token, plant_id)
        .then((res) => {
          const resData = res.data;
          let list: OrderItem[] = [];
          if (Array.isArray(resData?.data?.data)) {
            list = resData.data.data;
          } else if (Array.isArray(resData?.data)) {
            list = resData.data;
          } else if (Array.isArray(resData)) {
            list = resData;
          }

          if (list.length > 0) {
            setOrders(list);
          }
        })
        .catch((err: any) => {
          console.log("Error refreshing orders:", err?.message || err);
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Could not refresh orders.";
          setErrorMessage(msg);
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [token, plant_id],
  );

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Tab filter
      if (
        activeTab === "Confirmed" &&
        order.status !== 1 &&
        String(order.status).toLowerCase() !== "confirmed"
      ) {
        return false;
      }
      if (
        activeTab === "Completed" &&
        order.status !== 2 &&
        String(order.status).toLowerCase() !== "completed"
      ) {
        return false;
      }
      if (
        activeTab === "BoomPump" &&
        !order.concrete_pump?.toLowerCase().includes("boom")
      ) {
        return false;
      }

      // 2. Search query filter (No numeric ID matching)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesNumber = (
          order.full_number ||
          order.order_no ||
          ""
        )
          .toLowerCase()
          .includes(q);
        const matchesCustomer = (order.customer?.legal_name || "")
          .toLowerCase()
          .includes(q);
        const matchesSite = (order.site?.name || "")
          .toLowerCase()
          .includes(q);
        const matchesMix = (
          order.mix_design?.design_name ||
          order.mix_design?.name ||
          ""
        )
          .toLowerCase()
          .includes(q);
        return matchesNumber || matchesCustomer || matchesSite || matchesMix;
      }

      return true;
    });
  }, [orders, activeTab, search]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: orders.length,
      confirmed: orders.filter(
        (o) => o.status === 1 || String(o.status).toLowerCase() === "confirmed",
      ).length,
      boom: orders.filter((o) =>
        Boolean(o.concrete_pump?.toLowerCase().includes("boom")),
      ).length,
      completed: orders.filter(
        (o) => o.status === 2 || String(o.status).toLowerCase() === "completed",
      ).length,
    };
  }, [orders]);

  // Overall Metrics
  const totalVolume = useMemo(() => {
    return orders.reduce((sum, o) => {
      const q = parseFloat(String(o.total_qty || "0"));
      return sum + (isNaN(q) ? 0 : q);
    }, 0);
  }, [orders]);

  // Render individual Order Card
  const renderOrderCard = ({ item }: { item: OrderItem }) => {
    const statusMeta = getOrderStatusMeta(item.status);
    const pumpMeta = getPumpBadgeMeta(item.concrete_pump);
    const totalQty = parseFloat(String(item.total_qty || "0")) || 0;
    const producedQty = parseFloat(String(item.produced_qty || "0")) || 0;
    const rate =
      typeof item.rate === "number"
        ? item.rate
        : parseFloat(String(item.rate || "0")) || 0;
    const totalVal = totalQty * rate;
    const progressPercent =
      totalQty > 0
        ? Math.min(100, Math.round((producedQty / totalQty) * 100))
        : 0;

    const customerName = item.customer?.legal_name || "Customer Not Specified";
    const siteName = item.site?.name || "Main Pour Site";
    const mixName =
      item.mix_design?.design_name || item.mix_design?.name || "Concrete Mix";
    const orderTitle =
      item.full_number ||
      (item.prefix ? `${item.prefix}${item.order_no}` : `Order ${item.order_no || ""}`);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.85}
        onPress={() => setSelectedOrder(item)}
      >
        {/* Card Header: Order Number Badge & Status / Equipment Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.orderNumberBadge}>
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={14}
              color="#2563EB"
            />
            <Text style={styles.orderNumberText}>{orderTitle}</Text>
          </View>

          <View style={styles.badgesRightRow}>
            {pumpMeta && (
              <View style={[styles.pumpBadge, { backgroundColor: pumpMeta.bg }]}>
                <Ionicons name={pumpMeta.icon} size={11} color={pumpMeta.text} />
                <Text style={[styles.pumpBadgeText, { color: pumpMeta.text }]}>
                  {pumpMeta.label}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusMeta.bg,
                  borderColor: statusMeta.border,
                },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusMeta.dot }]}
              />
              <Text style={[styles.statusText, { color: statusMeta.text }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer & Delivery Site Info */}
        <View style={styles.clientSection}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customerName}
          </Text>
          <View style={styles.siteRow}>
            <Ionicons name="location" size={13} color="#DC2626" />
            <Text style={styles.siteText} numberOfLines={1}>
              {siteName}
            </Text>
          </View>
        </View>

        {/* Technical Specification Box (Mix, Volume, Total Value) */}
        <View style={styles.specBox}>
          <View style={styles.specCol}>
            <Text style={styles.specLabel}>PRODUCT / MIX</Text>
            <Text style={styles.specValue} numberOfLines={1}>
              {mixName}
            </Text>
          </View>

          <View style={styles.specDivider} />

          <View style={styles.specCol}>
            <Text style={styles.specLabel}>ORDER QTY</Text>
            <Text style={[styles.specValue, { color: "#2563EB" }]}>
              {totalQty} m³
            </Text>
          </View>

          <View style={styles.specDivider} />

          <View style={styles.specCol}>
            <Text style={styles.specLabel}>TOTAL VALUE</Text>
            <Text
              style={[styles.specValue, { color: "#059669", fontWeight: "800" }]}
              numberOfLines={1}
            >
              {formatCurrency(totalVal)}
            </Text>
          </View>
        </View>

        {/* Batching & Dispatch Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressLabel}>
              Batched: <Text style={styles.progressQtyBold}>{producedQty} / {totalQty} m³</Text>
            </Text>
            <Text style={styles.progressPercentText}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: progressPercent >= 100 ? "#059669" : "#2563EB",
                },
              ]}
            />
          </View>
        </View>

        {/* Scheduled Start & Created Date Bar */}
        <View style={styles.datesBar}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={13} color="#64748B" />
            <Text style={styles.dateLabel} numberOfLines={1}>
              Schedule:{" "}
              <Text style={styles.dateVal}>
                {formatDateTime(item.scheduled_start)}
              </Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.viewDetailsBtn}
            onPress={() => setSelectedOrder(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewDetailsBtnText}>Details</Text>
            <Ionicons name="chevron-forward" size={13} color="#2563EB" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      {/* HEADER SECTION (NAVY BLUE MATCHING REST OF APP) */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Orders</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{orders.length}</Text>
              </View>
            </View>
            <View style={styles.plantBadgeRow}>
              <Ionicons name="business" size={12} color="#94A3B8" />
              <Text style={styles.plantBadgeText}>
                {plant_name ? plant_name : "Ready-Mix Batching & Transit Orders"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => handleManualRefresh(false)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="reload-outline"
              size={18}
              color="#FFFFFF"
              style={refreshing ? { transform: [{ rotate: "45deg" }] } : undefined}
            />
          </TouchableOpacity>
        </View>

        {/* QUICK METRICS DASHBOARD STRIP */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL ORDERS</Text>
            <Text style={styles.kpiValue}>{orders.length}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL VOLUME</Text>
            <Text style={[styles.kpiValue, { color: "#60A5FA" }]}>
              {Math.round(totalVolume)} m³
            </Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>CONFIRMED</Text>
            <Text style={[styles.kpiValue, { color: "#10B981" }]}>
              {tabCounts.confirmed}
            </Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search order number, client, site or mix..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTER TABS */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {[
            { key: "All" as const, label: "All Orders", count: tabCounts.all },
            {
              key: "Confirmed" as const,
              label: "Confirmed",
              count: tabCounts.confirmed,
            },
            {
              key: "BoomPump" as const,
              label: "Boom Pump",
              count: tabCounts.boom,
            },
            {
              key: "Completed" as const,
              label: "Completed",
              count: tabCounts.completed,
            },
          ].map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive,
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.filterCountBadge,
                    isSelected && styles.filterCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      isSelected && styles.filterCountTextActive,
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ERROR NOTICE BANNER IF ANY */}
      {errorMessage && (
        <View style={styles.errorNotice}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.errorNoticeText}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => handleManualRefresh(false)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ORDERS LIST */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Fetching plant orders...</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: "#F8FAFC" }}
          data={filteredOrders}
          keyExtractor={(item) =>
            item.full_number || String(item.order_no || item.id)
          }
          renderItem={renderOrderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => handleManualRefresh(true)}
              colors={["#2563EB"]}
              tintColor="#2563EB"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="clipboard-text-search-outline"
                size={54}
                color="#CBD5E1"
              />
              <Text style={styles.emptyTitle}>No Orders Found</Text>
              <Text style={styles.emptySubtitle}>
                {search.trim()
                  ? `No orders matching "${search}".`
                  : activeTab !== "All"
                    ? "No orders found for this filter tab."
                    : "No ready-mix batching orders logged yet."}
              </Text>
              {(search.trim() || activeTab !== "All") && (
                <TouchableOpacity
                  style={styles.emptyResetBtn}
                  onPress={() => {
                    setSearch("");
                    setActiveTab("All");
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emptyResetBtnText}>Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ORDER DETAILS MODAL (ZERO IDS DISPLAYED) */}
      <Modal
        visible={Boolean(selectedOrder)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBox}>
                  <MaterialCommunityIcons
                    name="file-document-check"
                    size={22}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.modalTitleGroup}>
                  <Text style={styles.modalOrderTitle} numberOfLines={1}>
                    {selectedOrder?.full_number ||
                      (selectedOrder?.prefix
                        ? `${selectedOrder.prefix}${selectedOrder.order_no}`
                        : `Order ${selectedOrder?.order_no || ""}`)}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {plant_name ? plant_name : "Ready-Mix Sales Order"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedOrder(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Scroll Content */}
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Customer & Location */}
              <View style={styles.modalCardSection}>
                <Text style={styles.modalSectionHeading}>CLIENT & DELIVERY SITE</Text>
                <View style={styles.modalDetailRow}>
                  <Ionicons name="business" size={15} color="#2563EB" />
                  <View style={styles.modalDetailTextGroup}>
                    <Text style={styles.modalDetailLabel}>Customer</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedOrder?.customer?.legal_name || "Not Specified"}
                    </Text>
                  </View>
                </View>

                <View style={[styles.modalDetailRow, { marginTop: 10 }]}>
                  <Ionicons name="location" size={15} color="#DC2626" />
                  <View style={styles.modalDetailTextGroup}>
                    <Text style={styles.modalDetailLabel}>Delivery Site</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedOrder?.site?.name || "Main Site"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Product Specifications & Pricing */}
              <View style={styles.modalCardSection}>
                <Text style={styles.modalSectionHeading}>ORDER SPECIFICATIONS</Text>
                <View style={styles.modalSpecGrid}>
                  <View style={styles.modalSpecItem}>
                    <Text style={styles.modalSpecLabel}>Mix Design</Text>
                    <Text style={styles.modalSpecValue}>
                      {selectedOrder?.mix_design?.design_name ||
                        selectedOrder?.mix_design?.name ||
                        "Standard Mix"}
                    </Text>
                  </View>
                  <View style={styles.modalSpecItem}>
                    <Text style={styles.modalSpecLabel}>Total Volume</Text>
                    <Text style={[styles.modalSpecValue, { color: "#2563EB" }]}>
                      {selectedOrder?.total_qty || "0"} m³
                    </Text>
                  </View>
                </View>

                <View style={[styles.modalSpecGrid, { marginTop: 10 }]}>
                  <View style={styles.modalSpecItem}>
                    <Text style={styles.modalSpecLabel}>Concrete Rate</Text>
                    <Text style={styles.modalSpecValue}>
                      {formatCurrency(selectedOrder?.rate)} / m³
                    </Text>
                  </View>
                  <View style={styles.modalSpecItem}>
                    <Text style={styles.modalSpecLabel}>Pump Equipment</Text>
                    <Text style={styles.modalSpecValue}>
                      {selectedOrder?.concrete_pump
                        ? selectedOrder.concrete_pump.toUpperCase()
                        : "Direct Chute"}
                    </Text>
                  </View>
                </View>

                {selectedOrder?.pump_rate ? (
                  <View style={[styles.modalSpecGrid, { marginTop: 10 }]}>
                    <View style={styles.modalSpecItem}>
                      <Text style={styles.modalSpecLabel}>Pumping Rate</Text>
                      <Text style={styles.modalSpecValue}>
                        {formatCurrency(selectedOrder.pump_rate)}
                      </Text>
                    </View>
                    <View style={styles.modalSpecItem}>
                      <Text style={styles.modalSpecLabel}>Tax Setting</Text>
                      <Text style={styles.modalSpecValue}>
                        {selectedOrder.is_tax_inclusive
                          ? "Inclusive of Taxes"
                          : "Exclusive"}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Schedule & Timing */}
              <View style={styles.modalCardSection}>
                <Text style={styles.modalSectionHeading}>SCHEDULE & DISPATCH</Text>
                <View style={styles.modalDetailRow}>
                  <Ionicons name="calendar" size={15} color="#D97706" />
                  <View style={styles.modalDetailTextGroup}>
                    <Text style={styles.modalDetailLabel}>Scheduled Pouring</Text>
                    <Text style={styles.modalDetailValue}>
                      {formatDateTime(selectedOrder?.scheduled_start)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.modalDetailRow, { marginTop: 10 }]}>
                  <Ionicons name="time" size={15} color="#64748B" />
                  <View style={styles.modalDetailTextGroup}>
                    <Text style={styles.modalDetailLabel}>Order Placed</Text>
                    <Text style={styles.modalDetailValue}>
                      {formatDateOnly(selectedOrder?.created_at)}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedOrder(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseButtonText}>Close Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// STYLES (INDUSTRIAL RMC DESIGN SYSTEM)
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B2A4A",
  },
  header: {
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  countBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
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
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },

  // KPI Strip
  kpiContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  kpiCard: {
    flex: 1,
    alignItems: "center",
  },
  kpiDivider: {
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginVertical: 2,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 2,
  },

  // Search Bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    marginLeft: 8,
    paddingVertical: 0,
  },

  // Filter Chips Section
  filterSection: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingTop: 8,
    paddingBottom: 6,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  filterCountBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  filterCountTextActive: {
    color: "#FFFFFF",
  },

  // Error Notice
  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5",
    gap: 8,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#991B1B",
  },
  retryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
    textDecorationLine: "underline",
  },

  // List Content
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },

  // Order Card
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  orderNumberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  orderNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.3,
  },
  badgesRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pumpBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  pumpBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },

  // Client Section
  clientSection: {
    marginBottom: 10,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  siteText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    flex: 1,
  },

  // Technical Specs Box
  specBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  specCol: {
    flex: 1,
    alignItems: "center",
  },
  specDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 2,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },

  // Progress Bar
  progressContainer: {
    marginBottom: 10,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  progressQtyBold: {
    fontWeight: "700",
    color: "#0F172A",
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Dates Bar
  datesBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  dateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  dateVal: {
    color: "#0F172A",
    fontWeight: "600",
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  viewDetailsBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyResetBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyResetBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#0B2A4A",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalTitleGroup: {
    flex: 1,
  },
  modalOrderTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  modalScroll: {
    padding: 16,
  },
  modalCardSection: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  modalSectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modalDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  modalDetailTextGroup: {
    flex: 1,
  },
  modalDetailLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 1,
  },
  modalSpecGrid: {
    flexDirection: "row",
    gap: 12,
  },
  modalSpecItem: {
    flex: 1,
  },
  modalSpecLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  modalSpecValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  modalCloseButton: {
    backgroundColor: "#0B2A4A",
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
