import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
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
// TYPES & INTERFACES
// ==========================================

export interface QuotationPatron {
  id: number;
  legal_name: string;
}

export interface QuotationSite {
  id: number;
  name: string;
}

export interface QuotationMixDesign {
  id: number;
  plant_id?: number;
  design_name?: string | null;
  design_code?: string | null;
  design_type?: string | null;
  name?: string | null;
  code?: string | null;
}

export interface QuotationLineItem {
  id: number;
  quotation_id: number;
  mix_design_id?: number | null;
  concrete_pump?: string | null;
  pump_rate?: string | null;
  quantity?: string | number | null;
  uom_id?: number | null;
  rate?: string | number | null;
  tax_id?: number | null;
  tax_amount?: string | null;
  untaxed_amount?: string | null;
  amount_total?: string | null;
  mix_design?: QuotationMixDesign | null;
}

export interface QuotationItem {
  id: number | string;
  plant_id?: number;
  sales_executive_id?: number | null;
  pump_type?: string | null;
  pump_rate?: string;
  is_tax_inclusive?: boolean;
  prefix?: string | null;
  reference: string;
  patron_id?: number;
  site_id?: number;
  quote_date?: string;
  validity_date?: string;
  amount_untaxed?: string;
  tax_id?: number | null;
  tax_amount?: string;
  adjustment?: string;
  amount_tax?: string;
  amount_total: string;
  status: number; // 0: Draft, 1: Sent, 2: Approved, 3: Rejected
  is_customer_po?: number;
  created_at?: string;
  created_by?: number | null;
  updated_at?: string;
  updated_by?: number | null;
  deleted_at?: string | null;
  deleted_by?: number | null;
  notes?: string | null;
  patron?: QuotationPatron;
  site?: QuotationSite;
  client?: string;
  mix_design?: string;
  volume?: string | number;
  quantity?: string | number;
  rate?: string;
  items?: QuotationLineItem[];
}

export interface ListQuotationScreenProps {
  onBack?: () => void;
  onSuccess?: (quotation: any) => void;
}


// ==========================================
// UTILITY HELPERS
// ==========================================

export const formatCurrency = (
  val: string | number | null | undefined,
): string => {
  if (val === null || val === undefined || val === "") return "₹0";
  const str = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(str);
  if (isNaN(num)) return "₹0";
  return "₹" + Math.round(num).toLocaleString("en-IN");
};

export const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return "-";
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

export const getStatusMeta = (status: number | string | null | undefined) => {
  const s = Number(status);
  switch (s) {
    case 0:
      return {
        key: "draft",
        code: 0,
        label: "Draft",
        color: "#475569",
        bg: "#F1F5F9",
        border: "#CBD5E1",
        dot: "#94A3B8",
        icon: "pencil-outline" as const,
      };
    case 1:
      return {
        key: "sent",
        code: 1,
        label: "Sent",
        color: "#1D4ED8",
        bg: "#EFF6FF",
        border: "#BFDBFE",
        dot: "#2563EB",
        icon: "paper-plane-outline" as const,
      };
    case 2:
      return {
        key: "approved",
        code: 2,
        label: "Approved",
        color: "#15803D",
        bg: "#DCFCE7",
        border: "#86EFAC",
        dot: "#16A34A",
        icon: "checkmark-circle-outline" as const,
      };
    case 3:
      return {
        key: "rejected",
        code: 3,
        label: "Rejected",
        color: "#BE123C",
        bg: "#FFE4E6",
        border: "#FECDD3",
        dot: "#DC2626",
        icon: "close-circle-outline" as const,
      };
    default:
      return {
        key: "unknown",
        code: -1,
        label: `Status ${status}`,
        color: "#64748B",
        bg: "#F8FAFC",
        border: "#CBD5E1",
        dot: "#64748B",
        icon: "help-circle-outline" as const,
      };
  }
};

// ==========================================
// UNIFIED API REQUEST HELPER
// ==========================================

async function fetchQuotationsApi(
  token: string | null,
  plantId: number | null,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (token) {
    const cleanToken = token.trim();
    headers["Authorization"] = cleanToken.startsWith("Bearer ")
      ? cleanToken
      : `Bearer ${cleanToken}`;
  }

  // Header values MUST be strings in React Native / Android OkHttp to avoid Network Error
  if (plantId !== null && plantId !== undefined) {
    headers["X-Plant-Id"] = String(plantId);
  }

  const params: Record<string, any> = { page: 1 };
  if (plantId !== null && plantId !== undefined) {
    params.plant_id = String(plantId);
  }

  return axios.get(`${baseURL}v1/quotations`, {
    params,
    headers,
    timeout: 25000,
  });
}

async function fetchQuotationDetailApi(
  quotationId: string | number,
  token: string | null,
  plantId: number | null,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (token) {
    const cleanToken = token.trim();
    headers["Authorization"] = cleanToken.startsWith("Bearer ")
      ? cleanToken
      : `Bearer ${cleanToken}`;
  }

  if (plantId !== null && plantId !== undefined) {
    headers["X-Plant-Id"] = String(plantId);
  }

  // GET v1/quotations/{quotation} with params { quotation: id }
  return axios.get(`${baseURL}v1/quotations/${quotationId}`, {
    params: { quotation: quotationId },
    headers,
    timeout: 25000,
  });
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function ListQuotationScreen({
  onBack,
}: ListQuotationScreenProps) {
  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );

  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"All" | 0 | 1 | 2 | 3>("All");

  // View Quotation Modal State
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0B2A4A");
      }
    }, []),
  );

  // Initial single API load on mount or auth change
  useEffect(() => {
    let isCancelled = false;

    fetchQuotationsApi(token, plant_id)
      .then((res) => {
        if (isCancelled) return;
        if (res.data?.success && res.data?.data) {
          const apiData = res.data.data;
          const items: QuotationItem[] = Array.isArray(apiData.data)
            ? apiData.data
            : Array.isArray(apiData)
              ? apiData
              : [];
          setQuotations(items);
        } else if (Array.isArray(res.data)) {
          setQuotations(res.data);
        } else {
          setQuotations([]);
        }
      })
      .catch((err: any) => {
        if (isCancelled) return;
        console.log("Error loading real-time quotations:", err?.message || err);
        const serverError =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Network Error";

        setErrorMessage(
          serverError === "Network Error"
            ? "Network Error: Could not connect to quotations server. Tap retry."
            : `Server note: ${serverError}`,
        );
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

  // Pull to refresh handler (re-uses the single API endpoint)
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetchQuotationsApi(token, plant_id);
      if (res.data?.success && res.data?.data) {
        const apiData = res.data.data;
        const items: QuotationItem[] = Array.isArray(apiData.data)
          ? apiData.data
          : Array.isArray(apiData)
            ? apiData
            : [];
        setQuotations(items);
      } else if (Array.isArray(res.data)) {
        setQuotations(res.data);
      } else {
        setQuotations([]);
      }
    } catch (err: any) {
      console.log("Error refreshing quotations:", err?.message || err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  };

  // Filtered quotations by tab and search
  const filteredQuotations = useMemo(() => {
    return quotations.filter((item) => {
      if (activeTab !== "All" && Number(item.status) !== activeTab) {
        return false;
      }
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const refMatch = item.reference?.toLowerCase().includes(query);
        const patronMatch = (item.patron?.legal_name || item.client || "")
          .toLowerCase()
          .includes(query);
        const siteMatch = item.site?.name?.toLowerCase().includes(query);
        const designMatch =
          item.mix_design?.toLowerCase().includes(query) ||
          item.items?.some((it) =>
            (it.mix_design?.design_name || it.mix_design?.name || "")
              .toLowerCase()
              .includes(query),
          );
        const totalMatch = item.amount_total?.includes(query);
        return Boolean(
          refMatch || patronMatch || siteMatch || designMatch || totalMatch,
        );
      }
      return true;
    });
  }, [quotations, activeTab, search]);

  // Counts per tab
  const tabCounts = useMemo(() => {
    return {
      all: quotations.length,
      draft: quotations.filter((q) => Number(q.status) === 0).length,
      sent: quotations.filter((q) => Number(q.status) === 1).length,
      pending: quotations.filter((q) => Number(q.status) === 1).length,
      approved: quotations.filter((q) => Number(q.status) === 2).length,
      rejected: quotations.filter((q) => Number(q.status) === 3).length,
    };
  }, [quotations]);

  const totalPipelineValue = useMemo(() => {
    return quotations.reduce((sum, item) => {
      const val = parseFloat(String(item.amount_total || 0));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [quotations]);

  // Action Handlers
  const handleOpenView = async (item: QuotationItem) => {
    setSelectedQuotation(item);
    setViewModalVisible(true);
    setIsDetailLoading(true);
    setDetailErrorMessage(null);

    try {
      const res = await fetchQuotationDetailApi(item.id, token, plant_id);
      const detail = res.data?.data || res.data;
      if (detail) {
        setSelectedQuotation(detail);
      }
    } catch (err: any) {
      console.log("Error loading quotation detail:", err?.message || err);
      const errorText =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Could not load latest quotation details.";
      setDetailErrorMessage(errorText);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRetryDetail = async () => {
    if (!selectedQuotation?.id) return;
    setIsDetailLoading(true);
    setDetailErrorMessage(null);
    try {
      const res = await fetchQuotationDetailApi(
        selectedQuotation.id,
        token,
        plant_id,
      );
      const detail = res.data?.data || res.data;
      if (detail) {
        setSelectedQuotation(detail);
      }
    } catch (err: any) {
      console.log("Error retrying quotation detail:", err?.message || err);
      const errorText =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Could not load latest quotation details.";
      setDetailErrorMessage(errorText);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleOpenEdit = (item: QuotationItem | any) => {
    setViewModalVisible(false);
    router.push({
      pathname: "/showeditquotations",
      params: { quotation_id: String(item.id) },
    });
  };

  // ==========================================
  // BEST-IN-CLASS QUOTATION LIST CARD (LEAD CARD DESIGN)
  // ==========================================
  const renderQuotationCard = ({ item }: { item: QuotationItem }) => {
    const statusMeta = getStatusMeta(item.status);
    const customer =
      item.patron?.legal_name || item.client || "Customer Not Specified";
    const site = item.site?.name || "Main Project Site";

    // Extract mix design & volume from API response items array
    let mix = "Standard Mix";
    let volume = "0";

    if (Array.isArray(item.items) && item.items.length > 0) {
      const mixNames = item.items
        .map(
          (it) =>
            it.mix_design?.design_name ||
            it.mix_design?.name ||
            it.mix_design?.design_type ||
            it.mix_design?.design_code,
        )
        .filter(Boolean);
      if (mixNames.length === 1) {
        mix = mixNames[0]!;
      } else if (mixNames.length > 1) {
        mix = mixNames.join(", ");
      } else if (item.mix_design) {
        mix = item.mix_design;
      }

      const totalQty = item.items.reduce((sum, it) => {
        const q = parseFloat(String(it.quantity || "0"));
        return sum + (isNaN(q) ? 0 : q);
      }, 0);
      volume =
        totalQty > 0
          ? String(parseFloat(totalQty.toFixed(2)))
          : String(item.volume || item.quantity || "0");
    } else {
      mix = item.mix_design || "Standard Mix";
      const q = parseFloat(String(item.volume || item.quantity || "0"));
      volume = isNaN(q) ? "0" : String(parseFloat(q.toFixed(2)));
    }

    return (
      <View style={styles.quoteCard}>
        {/* Card Header: Quote Ref, PO Badge & Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.quoteNumberBadge}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={14}
              color="#2563EB"
            />
            <Text style={styles.quoteNumberText}>{item.reference}</Text>
          </View>

          <View style={styles.badgesRightRow}>
            {item.is_customer_po === 1 && (
              <View style={styles.poBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#047857" />
                <Text style={styles.poBadgeText}>PO Linked</Text>
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
              <Text
                style={[styles.statusText, { color: statusMeta.color }]}
                numberOfLines={1}
              >
                {statusMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer / Project Title & Pumping */}
        <View style={styles.projectSection}>
          <View style={styles.projectTitleRow}>
            <Text style={styles.projectNameText} numberOfLines={2}>
              {customer}
            </Text>
            {item.pump_type ? (
              <View style={styles.pumpBadge}>
                <Ionicons name="flash-outline" size={11} color="#64748B" />
                <Text style={styles.pumpBadgeText}>{item.pump_type}</Text>
              </View>
            ) : null}
          </View>

          {/* Site / Delivery Location */}
          <View style={styles.contactRow}>
            <Ionicons name="location" size={14} color="#DC2626" />
            <Text style={styles.contactPersonText} numberOfLines={1}>
              {site}
            </Text>
          </View>
        </View>

        {/* Core Specs Grid: Mix Design, Volume, Total Value */}
        <View style={styles.specBox}>
          {/* Mix Design */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="layers-triple-outline"
                size={13}
                color="#64748B"
              />
              <Text style={styles.specLabel}>MIX DESIGN</Text>
            </View>
            <Text style={styles.specValue} numberOfLines={1}>
              {mix}
            </Text>
          </View>

          <View style={styles.specDivider} />

          {/* Volume */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="cube-outline"
                size={13}
                color="#2563EB"
              />
              <Text style={styles.specLabel}>VOLUME</Text>
            </View>
            <Text style={[styles.specValue, { color: "#2563EB" }]}>
              {String(volume).includes("m³") ? volume : `${volume} m³`}
            </Text>
          </View>

          <View style={styles.specDivider} />

          {/* Total Value */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <Ionicons name="cash-outline" size={13} color="#059669" />
              <Text style={styles.specLabel}>TOTAL VALUE</Text>
            </View>
            <Text
              style={[
                styles.specValue,
                { color: "#059669", fontWeight: "800" },
              ]}
              numberOfLines={1}
            >
              {formatCurrency(item.amount_total)}
            </Text>
          </View>
        </View>

        {/* If multiple mix items exist, show breakdown preview */}
        {Array.isArray(item.items) && item.items.length > 1 && (
          <View style={styles.multiItemsPreviewRow}>
            {item.items.map((lineItem, idx) => (
              <View key={lineItem.id || idx} style={styles.multiItemChip}>
                <Ionicons name="cube-outline" size={11} color="#2563EB" />
                <Text style={styles.multiItemChipText} numberOfLines={1}>
                  {lineItem.mix_design?.design_name ||
                    lineItem.mix_design?.name ||
                    "Mix"}
                  : {parseFloat(String(lineItem.quantity || "0"))} m³
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Dates Bar: Quote Date & Validity Date */}
        <View style={styles.datesBar}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={13} color="#64748B" />
            <Text style={styles.dateLabel}>
              Quote:{" "}
              <Text style={styles.dateVal}>{formatDate(item.quote_date)}</Text>
            </Text>
          </View>

          <View style={styles.dateItem}>
            <Ionicons name="time-outline" size={13} color="#64748B" />
            <Text style={styles.dateLabel}>
              Valid Till:{" "}
              <Text style={styles.dateVal}>
                {formatDate(item.validity_date)}
              </Text>
            </Text>
          </View>
        </View>

        {/* Card Footer Actions (View & Edit) */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {item.notes ? (
              <Text style={styles.notesSnippet} numberOfLines={1}>
                {item.notes}
              </Text>
            ) : (
              <Text style={styles.taxInclusiveText}>Inclusive of taxes</Text>
            )}
          </View>

          <View style={styles.actionButtonsGroup}>
            <TouchableOpacity
              style={styles.actionViewBtn}
              onPress={() => handleOpenView(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-outline" size={13} color="#0F172A" />
              <Text style={styles.actionViewText}>View</Text>
            </TouchableOpacity>

            {Number(item.status) !== 1 && (
              <TouchableOpacity
                style={styles.actionEditBtn}
                onPress={() => handleOpenEdit(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={13} color="#2563EB" />
                <Text style={styles.actionEditText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      {/* HEADER SECTION (NAVY BLUE MATCHING LEADS SCREEN) */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerTitleRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Quotations</Text>
            </View>
            <View style={styles.plantBadgeRow}>
              <Ionicons name="business" size={12} color="#94A3B8" />
              <Text style={styles.plantBadgeText}>
                {plant_name ? plant_name : "Ready-Mix Commercial Pipeline"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
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

        {/* QUICK KPI METRIC STRIP (MATCHING LEADS SCREEN) */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL QUOTES</Text>
            <Text style={styles.kpiValue}>{quotations.length}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>APPROVED</Text>
            <Text style={[styles.kpiValue, { color: "#34D399" }]}>
              {tabCounts.approved}
            </Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PIPELINE VALUE</Text>
            <Text
              style={[styles.kpiValue, { color: "#60A5FA" }]}
              numberOfLines={1}
            >
              {formatCurrency(totalPipelineValue)}
            </Text>
          </View>
        </View>

        {/* SEARCH BAR (MATCHING LEADS SCREEN) */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by quote #, customer, site, mix..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTER TABS (MATCHING LEADS SCREEN) */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {[
            { key: "All" as const, label: "All", count: tabCounts.all },
            { key: 0 as const, label: "Draft", count: tabCounts.draft },
            {
              key: 1 as const,
              label: "Sent",
              count: tabCounts.sent,
            },
            {
              key: 2 as const,
              label: "Approved",
              count: tabCounts.approved,
            },
            {
              key: 3 as const,
              label: "Rejected",
              count: tabCounts.rejected,
            },
          ].map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={String(tab.key)}
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

      {/* ERROR BANNER IF ANY */}
      {errorMessage && (
        <View style={styles.errorNotice}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.errorNoticeText}>{errorMessage}</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* QUOTATIONS LIST */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Fetching quotations from plant...</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: "#F8FAFC" }}
          data={filteredQuotations}
          keyExtractor={(item) => String(item.id || item.reference)}
          renderItem={renderQuotationCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
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
              <Text style={styles.emptyTitle}>No Quotations Found</Text>
              <Text style={styles.emptySubtitle}>
                {search.trim()
                  ? `No quotations matching "${search}".`
                  : activeTab !== "All"
                    ? "No quotations found for this status."
                    : "No commercial quotations available yet."}
              </Text>
              {(search.length > 0 || activeTab !== "All") && (
                <TouchableOpacity
                  style={styles.emptyResetBtn}
                  onPress={() => {
                    setSearch("");
                    setActiveTab("All");
                  }}
                >
                  <Text style={styles.emptyResetBtnText}>Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* FLOATING ACTION BUTTON: ADD QUOTATION */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => router.push("/showcreatequotations")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* QUOTATION DETAILS VIEW MODAL */}
      <Modal
        visible={viewModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBox}>
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={22}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.modalTitleGroup}>
                  <View style={styles.modalRefRow}>
                    <Text style={styles.modalRefText} numberOfLines={1}>
                      {selectedQuotation?.reference ||
                        (selectedQuotation?.prefix
                          ? `${selectedQuotation.prefix}${selectedQuotation.id}`
                          : `Quotation #${selectedQuotation?.id || ""}`)}
                    </Text>
                  </View>
                  <Text style={styles.modalSubtitle}>
                    {plant_name ? plant_name : "Ready-Mix Concrete Quotation"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setViewModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Status & Net Amount Strip */}
            {selectedQuotation && (() => {
              const statusMeta = getStatusMeta(selectedQuotation.status);
              return (
                <View style={styles.modalStatusStrip}>
                  <View
                    style={[
                      styles.modalStatusPill,
                      {
                        backgroundColor: statusMeta.bg,
                        borderColor: statusMeta.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={statusMeta.icon}
                      size={13}
                      color={statusMeta.color}
                    />
                    <Text
                      style={[
                        styles.modalStatusPillText,
                        { color: statusMeta.color },
                      ]}
                    >
                      {statusMeta.label}
                    </Text>
                  </View>

                  <View style={styles.modalTotalHeaderBadge}>
                    <Text style={styles.modalTotalHeaderLabel}>Net Amount</Text>
                    <Text style={styles.modalTotalHeaderVal}>
                      {formatCurrency(selectedQuotation.amount_total)}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Loading Indicator banner */}
            {isDetailLoading && (
              <View style={styles.modalLoadingBanner}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.modalLoadingText}>
                  Fetching quotation details from server...
                </Text>
              </View>
            )}

            {/* Error Banner with retry */}
            {detailErrorMessage && (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.modalErrorText} numberOfLines={2}>
                  {detailErrorMessage}
                </Text>
                <TouchableOpacity
                  onPress={handleRetryDetail}
                  style={styles.modalRetryBtn}
                >
                  <Text style={styles.modalRetryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Modal Scroll Content */}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedQuotation && (
                <>
                  {/* Customer & Delivery Site Section */}
                  <View style={styles.modalCardSection}>
                    <Text style={styles.modalSectionHeading}>
                      CUSTOMER & DELIVERY SITE
                    </Text>

                    <View style={styles.modalDetailRow}>
                      <View
                        style={[
                          styles.modalFieldIconBox,
                          { backgroundColor: "#EFF6FF" },
                        ]}
                      >
                        <Ionicons name="business" size={15} color="#2563EB" />
                      </View>
                      <View style={styles.modalDetailTextGroup}>
                        <Text style={styles.modalDetailLabel}>Customer</Text>
                        <Text style={styles.modalDetailValue}>
                          {selectedQuotation.patron?.legal_name ||
                            selectedQuotation.client ||
                            "Customer Not Specified"}
                        </Text>
                        {selectedQuotation.patron?.phone ? (
                          <TouchableOpacity
                            onPress={() =>
                              Linking.openURL(
                                `tel:${selectedQuotation.patron.phone}`,
                              )
                            }
                            style={styles.modalPhoneRow}
                          >
                            <Ionicons name="call" size={12} color="#16A34A" />
                            <Text style={styles.modalPhoneText}>
                              {selectedQuotation.patron.phone}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>

                    <View style={[styles.modalDetailRow, { marginTop: 12 }]}>
                      <View
                        style={[
                          styles.modalFieldIconBox,
                          { backgroundColor: "#FEF2F2" },
                        ]}
                      >
                        <Ionicons name="location" size={15} color="#DC2626" />
                      </View>
                      <View style={styles.modalDetailTextGroup}>
                        <Text style={styles.modalDetailLabel}>Delivery Site</Text>
                        <Text style={styles.modalDetailValue}>
                          {selectedQuotation.site?.name || "Main Site"}
                        </Text>
                        {selectedQuotation.site?.site_address_1 ? (
                          <Text style={styles.modalDetailSubtext}>
                            {selectedQuotation.site.site_address_1}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Schedule & Terms Section */}
                  <View style={styles.modalCardSection}>
                    <Text style={styles.modalSectionHeading}>
                      SCHEDULE & TERMS
                    </Text>

                    <View style={styles.modalTwoColGrid}>
                      <View style={styles.modalColBox}>
                        <Text style={styles.modalGridLabel}>Quote Date</Text>
                        <View style={styles.modalGridValRow}>
                          <Ionicons
                            name="calendar-outline"
                            size={13}
                            color="#2563EB"
                          />
                          <Text style={styles.modalGridValue}>
                            {formatDate(selectedQuotation.quote_date)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.modalColBox}>
                        <Text style={styles.modalGridLabel}>Validity Date</Text>
                        <View style={styles.modalGridValRow}>
                          <Ionicons
                            name="time-outline"
                            size={13}
                            color="#D97706"
                          />
                          <Text style={styles.modalGridValue}>
                            {formatDate(selectedQuotation.validity_date)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.modalTwoColGrid, { marginTop: 10 }]}>
                      <View style={styles.modalColBox}>
                        <Text style={styles.modalGridLabel}>Tax Mode</Text>
                        <Text
                          style={[
                            styles.modalGridValue,
                            {
                              color: selectedQuotation.is_tax_inclusive
                                ? "#15803D"
                                : "#475569",
                            },
                          ]}
                        >
                          {selectedQuotation.is_tax_inclusive
                            ? "Inclusive of Taxes"
                            : "Exclusive of Taxes"}
                        </Text>
                      </View>

                      {selectedQuotation.concrete_pump ||
                      selectedQuotation.pump_type ? (
                        <View style={styles.modalColBox}>
                          <Text style={styles.modalGridLabel}>
                            Pump Equipment
                          </Text>
                          <Text style={styles.modalGridValue}>
                            {String(
                              selectedQuotation.concrete_pump ||
                                selectedQuotation.pump_type,
                            ).toUpperCase()}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.modalColBox}>
                          <Text style={styles.modalGridLabel}>
                            Quotation Status
                          </Text>
                          <Text style={styles.modalGridValue}>
                            {getStatusMeta(selectedQuotation.status).label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Concrete Line Items Section */}
                  <View style={styles.modalCardSection}>
                    <View style={styles.modalSectionHeaderRow}>
                      <Text style={styles.modalSectionHeading}>
                        PRODUCTS & MIX SPECIFICATIONS
                      </Text>
                      {Array.isArray(selectedQuotation.items) &&
                        selectedQuotation.items.length > 0 && (
                          <View style={styles.modalItemCountBadge}>
                            <Text style={styles.modalItemCountText}>
                              {selectedQuotation.items.length}{" "}
                              {selectedQuotation.items.length === 1
                                ? "Item"
                                : "Items"}
                            </Text>
                          </View>
                        )}
                    </View>

                    {Array.isArray(selectedQuotation.items) &&
                    selectedQuotation.items.length > 0 ? (
                      selectedQuotation.items.map((item: any, idx: number) => {
                        const mixName =
                          item.mix_design?.design_name ||
                          item.mix_design?.name ||
                          item.mix_design?.design_type ||
                          item.mix_design?.design_code ||
                          item.mix_design_name ||
                          `Concrete Item #${idx + 1}`;
                        const qtyNum = parseFloat(item.quantity) || 0;
                        const rateNum = parseFloat(item.rate) || 0;
                        const itemAmount =
                          item.amount_total ||
                          item.amount ||
                          item.untaxed_amount ||
                          (qtyNum * rateNum).toFixed(2);

                        const taxInfo =
                          item.tax?.tax_name ||
                          item.tax?.name ||
                          (item.tax?.tax_rate
                            ? `GST ${item.tax.tax_rate}%`
                            : null) ||
                          (item.tax_amount
                            ? `Tax: ${formatCurrency(item.tax_amount)}`
                            : null);

                        return (
                          <View
                            key={item.id || idx}
                            style={styles.modalLineItemCard}
                          >
                            <View style={styles.modalLineItemTop}>
                              <View style={styles.modalLineItemNumber}>
                                <Text style={styles.modalLineItemNumberText}>
                                  #{idx + 1}
                                </Text>
                              </View>
                              <Text
                                style={styles.modalLineItemName}
                                numberOfLines={2}
                              >
                                {mixName}
                              </Text>
                              <Text style={styles.modalLineItemTotal}>
                                {formatCurrency(itemAmount)}
                              </Text>
                            </View>

                            <View style={styles.modalLineItemDetailsGrid}>
                              <View style={styles.modalLineItemCol}>
                                <Text style={styles.modalSubLabel}>Quantity</Text>
                                <Text style={styles.modalSubValueBold}>
                                  {qtyNum.toFixed(2)} m³
                                </Text>
                              </View>
                              <View style={styles.modalLineItemCol}>
                                <Text style={styles.modalSubLabel}>Rate / m³</Text>
                                <Text style={styles.modalSubValue}>
                                  {formatCurrency(rateNum)}
                                </Text>
                              </View>
                              {taxInfo ? (
                                <View style={styles.modalLineItemCol}>
                                  <Text style={styles.modalSubLabel}>Tax</Text>
                                  <Text
                                    style={styles.modalSubValue}
                                    numberOfLines={1}
                                  >
                                    {taxInfo}
                                  </Text>
                                </View>
                              ) : null}
                              {item.concrete_pump ? (
                                <View style={styles.modalLineItemCol}>
                                  <Text style={styles.modalSubLabel}>Pump</Text>
                                  <Text
                                    style={styles.modalSubValue}
                                    numberOfLines={1}
                                  >
                                    {String(item.concrete_pump)
                                      .replace(/_/g, " ")
                                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                                  </Text>
                                </View>
                              ) : null}
                              {item.pump_rate !== undefined &&
                              item.pump_rate !== null &&
                              Number(item.pump_rate) > 0 ? (
                                <View style={styles.modalLineItemCol}>
                                  <Text style={styles.modalSubLabel}>
                                    Pump Rate
                                  </Text>
                                  <Text style={styles.modalSubValue}>
                                    {formatCurrency(item.pump_rate)}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.modalLineItemCard}>
                        <View style={styles.modalLineItemTop}>
                          <Text style={styles.modalLineItemName}>
                            {selectedQuotation.mix_design ||
                              "Standard Mix Design"}
                          </Text>
                          <Text style={styles.modalLineItemTotal}>
                            {formatCurrency(selectedQuotation.amount_total)}
                          </Text>
                        </View>
                        <View style={styles.modalLineItemDetailsGrid}>
                          <View style={styles.modalLineItemCol}>
                            <Text style={styles.modalSubLabel}>Volume</Text>
                            <Text style={styles.modalSubValueBold}>
                              {selectedQuotation.volume ||
                                selectedQuotation.quantity ||
                                0}{" "}
                              m³
                            </Text>
                          </View>
                          <View style={styles.modalLineItemCol}>
                            <Text style={styles.modalSubLabel}>Rate</Text>
                            <Text style={styles.modalSubValue}>
                              {formatCurrency(selectedQuotation.rate)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Price & Tax Breakdown Section */}
                  <View style={styles.modalCardSection}>
                    <Text style={styles.modalSectionHeading}>
                      PRICE & TAX BREAKDOWN
                    </Text>

                    <View style={styles.modalBreakdownRow}>
                      <Text style={styles.modalBreakdownLabel}>
                        Subtotal (Untaxed)
                      </Text>
                      <Text style={styles.modalBreakdownValue}>
                        {formatCurrency(
                          selectedQuotation.amount_untaxed ||
                            selectedQuotation.subtotal ||
                            selectedQuotation.untaxed_amount ||
                            parseFloat(selectedQuotation.amount_total || "0") -
                              parseFloat(
                                selectedQuotation.amount_tax ||
                                  selectedQuotation.tax_amount ||
                                  "0",
                              ),
                        )}
                      </Text>
                    </View>

                    <View style={styles.modalBreakdownRow}>
                      <Text style={styles.modalBreakdownLabel}>Total Tax (GST)</Text>
                      <Text style={styles.modalBreakdownValue}>
                        {formatCurrency(
                          selectedQuotation.amount_tax ||
                            selectedQuotation.tax_amount ||
                            0,
                        )}
                      </Text>
                    </View>

                    {selectedQuotation.adjustment ? (
                      <View style={styles.modalBreakdownRow}>
                        <Text style={styles.modalBreakdownLabel}>
                          Adjustment / Discount
                        </Text>
                        <Text style={styles.modalBreakdownValue}>
                          {formatCurrency(selectedQuotation.adjustment)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.modalDivider} />

                    <View style={styles.modalTotalPayableRow}>
                      <View>
                        <Text style={styles.modalTotalPayableLabel}>
                          Net Quotation Amount
                        </Text>
                        <Text style={styles.modalTotalPayableSub}>
                          {selectedQuotation.is_tax_inclusive
                            ? "(All Taxes Included)"
                            : "(Taxes Excluded)"}
                        </Text>
                      </View>
                      <Text style={styles.modalTotalPayableValue}>
                        {formatCurrency(selectedQuotation.amount_total)}
                      </Text>
                    </View>
                  </View>

                  {/* Notes & Special Instructions */}
                  {selectedQuotation.notes ? (
                    <View style={styles.modalCardSection}>
                      <Text style={styles.modalSectionHeading}>
                        NOTES & SPECIAL INSTRUCTIONS
                      </Text>
                      <View style={styles.modalNotesBox}>
                        <Ionicons
                          name="chatbox-ellipses-outline"
                          size={15}
                          color="#64748B"
                        />
                        <Text style={styles.modalNotesText}>
                          {selectedQuotation.notes}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>

            {/* Modal Footer Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalFooterCloseBtn,
                  Number(selectedQuotation?.status) === 1 && { flex: 1 },
                ]}
                onPress={() => setViewModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalFooterCloseText}>Close</Text>
              </TouchableOpacity>

              {selectedQuotation && Number(selectedQuotation.status) !== 1 && (
                <TouchableOpacity
                  style={styles.modalFooterEditBtn}
                  onPress={() => handleOpenEdit(selectedQuotation)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.modalFooterEditText}>Edit Quotation</Text>
                </TouchableOpacity>
              )}
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
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
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

  // Quick KPI Strip
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
    fontSize: 13,
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
    paddingBottom: 80,
  },

  // Card Design (Exact Lead Card Design)
  quoteCard: {
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
    marginBottom: 8,
    gap: 8,
  },
  quoteNumberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    flexShrink: 1,
  },
  quoteNumberText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.5,
  },
  badgesRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  poBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  poBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    includeFontPadding: false,
  },

  // Project & Contact
  projectSection: {
    marginBottom: 10,
  },
  projectTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  projectNameText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 20,
  },
  pumpBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  pumpBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  contactPersonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },

  // Core Concrete Specs Grid
  specBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  specCol: {
    flex: 1,
  },
  specHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  specValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  specDivider: {
    width: 1,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 8,
  },

  // Dates Bar
  datesBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  dateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  dateVal: {
    fontWeight: "700",
    color: "#1E293B",
  },

  // Card Footer Actions
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
    marginTop: 2,
  },
  footerLeft: {
    flex: 1,
    marginRight: 8,
  },
  taxInclusiveText: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
  },
  notesSnippet: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
  },
  actionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionViewBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    gap: 4,
  },
  actionViewText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },
  actionEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 4,
  },
  actionEditText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  // Multi-item chips
  multiItemsPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  multiItemChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  multiItemChipText: {
    fontSize: 11,
    color: "#1E40AF",
    fontWeight: "600",
  },

  // Floating Action Button
  fabButton: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
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

  // ==========================================
  // VIEW QUOTATION MODAL STYLES
  // ==========================================
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 42, 74, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0B2A4A",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  modalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitleGroup: {
    flex: 1,
  },
  modalRefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalRefText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "500",
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
  modalStatusStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalStatusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalTotalHeaderBadge: {
    alignItems: "flex-end",
  },
  modalTotalHeaderLabel: {
    fontSize: 10,
    color: "#64748B",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  modalTotalHeaderVal: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B2A4A",
  },
  modalLoadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#DBEAFE",
  },
  modalLoadingText: {
    fontSize: 12,
    color: "#1E40AF",
    fontWeight: "600",
  },
  modalErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#FEE2E2",
  },
  modalErrorText: {
    fontSize: 11,
    color: "#B91C1C",
    flex: 1,
  },
  modalRetryBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalRetryText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalScroll: {
    backgroundColor: "#F1F5F9",
  },
  modalScrollContent: {
    padding: 14,
    gap: 12,
  },
  modalCardSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalSectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  modalSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalItemCountBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modalItemCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  modalDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  modalFieldIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  modalDetailTextGroup: {
    flex: 1,
  },
  modalDetailLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2,
  },
  modalDetailSubtext: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  modalPhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  modalPhoneText: {
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "700",
  },
  modalTwoColGrid: {
    flexDirection: "row",
    gap: 10,
  },
  modalColBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalGridLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
  },
  modalGridValRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  modalGridValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 4,
  },
  modalLineItemCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalLineItemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalLineItemNumber: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalLineItemNumberText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  modalLineItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalLineItemTotal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0B2A4A",
  },
  modalLineItemDetailsGrid: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 12,
  },
  modalLineItemCol: {
    flex: 1,
  },
  modalSubLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  modalSubValue: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
    marginTop: 1,
  },
  modalSubValueBold: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "700",
    marginTop: 1,
  },
  modalBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalBreakdownLabel: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  modalBreakdownValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 8,
  },
  modalTotalPayableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  modalTotalPayableLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalTotalPayableSub: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
  },
  modalTotalPayableValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2563EB",
  },
  modalNotesBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalNotesText: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 12,
  },
  modalFooterCloseBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  modalFooterCloseText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  modalFooterEditBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalFooterEditText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

});
