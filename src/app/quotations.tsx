import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CreateQuotationScreen from "../screens/quotations/listQuotationScreen";

interface QuotationItem {
  id: string;
  client: string;
  site: string;
  grade: string;
  volume: string;
  rate: string;
  total: string;
  status: "Approved" | "Pending" | "Sent" | "Draft";
  date: string;
  validity: string;
  pouring: string;
}

export default function QuotationsScreen() {
  const [activeTab, setActiveTab] = useState<
    "All" | "Approved" | "Pending" | "Sent" | "Draft"
  >("All");
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0B2A4A");
      }
    }, []),
  );

  const [quotations, setQuotations] = useState<QuotationItem[]>([
    {
      id: "QT-2026-089",
      client: "Prestige Projects Ltd",
      site: "Falcon City Phase 2, Pier 18",
      grade: "M30 Grade",
      volume: "350 m³",
      rate: "₹ 4,450 / m³",
      total: "₹ 18.38 L",
      status: "Approved",
      date: "12 Oct 2026",
      validity: "Valid till 27 Oct",
      pouring: "Boom Pump 36m",
    },
    {
      id: "QT-2026-088",
      client: "L&T Infrastructure",
      site: "Metro Viaduct Pier #44",
      grade: "M40 Self-Compacting",
      volume: "520 m³",
      rate: "₹ 5,100 / m³",
      total: "₹ 31.29 L",
      status: "Pending",
      date: "11 Oct 2026",
      validity: "Valid till 26 Oct",
      pouring: "Line Pump",
    },
    {
      id: "QT-2026-087",
      client: "Brigade Enterprises",
      site: "Tech Gardens Block B Raft",
      grade: "M35 Grade",
      volume: "240 m³",
      rate: "₹ 4,750 / m³",
      total: "₹ 13.45 L",
      status: "Sent",
      date: "09 Oct 2026",
      validity: "Valid till 24 Oct",
      pouring: "Boom Pump 36m",
    },
    {
      id: "QT-2026-086",
      client: "Sobha Developers",
      site: "Dream Acres Tower 7 Foundation",
      grade: "M25 Grade",
      volume: "180 m³",
      rate: "₹ 4,200 / m³",
      total: "₹ 8.92 L",
      status: "Approved",
      date: "08 Oct 2026",
      validity: "Valid till 23 Oct",
      pouring: "Direct Chute",
    },
    {
      id: "QT-2026-085",
      client: "Godrej Properties",
      site: "Athena Luxury Villas Block 3",
      grade: "M30 Grade",
      volume: "95 m³",
      rate: "₹ 4,400 / m³",
      total: "₹ 4.93 L",
      status: "Draft",
      date: "06 Oct 2026",
      validity: "Draft Estimate",
      pouring: "Line Pump",
    },
  ]);

  // If currently in creation mode, render CreateQuotationScreen
  if (isCreating) {
    return (
      <CreateQuotationScreen
        onBack={() => setIsCreating(false)}
        onSuccess={(newQuote) => {
          setQuotations([
            {
              ...newQuote,
              validity: "Valid 15 Days",
            },
            ...quotations,
          ]);
          setIsCreating(false);
        }}
      />
    );
  }

  const filtered = quotations.filter((q) => {
    const matchesTab = activeTab === "All" || q.status === activeTab;
    const matchesSearch =
      q.client.toLowerCase().includes(search.toLowerCase()) ||
      q.site.toLowerCase().includes(search.toLowerCase()) ||
      q.id.toLowerCase().includes(search.toLowerCase()) ||
      q.grade.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getStatusColor = (status: QuotationItem["status"]) => {
    switch (status) {
      case "Approved":
        return { bg: "#DCFCE7", text: "#166534", border: "#86EFAC" };
      case "Pending":
        return { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" };
      case "Sent":
        return { bg: "#EFF6FF", text: "#1E40AF", border: "#93C5FD" };
      case "Draft":
        return { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
    }
  };

  const handleShareQuote = (quote: QuotationItem) => {
    Alert.alert(
      "Share Quotation",
      `Quotation ${quote.id} (${quote.grade}, ${quote.volume}) for ${quote.client} ready for dispatch via WhatsApp or Email PDF.`,
      [{ text: "OK" }],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0B2A4A"
        translucent={false}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerMainTitle}>Quotations</Text>
            <Text style={styles.headerSub}>
              Manage rates, proposals & estimates
            </Text>
          </View>
          <TouchableOpacity
            style={styles.newQuoteBtn}
            onPress={() => setIsCreating(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.newQuoteBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Quick KPI Strip */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Quotes</Text>
            <Text style={styles.kpiValue}>18</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pipeline Value</Text>
            <Text style={styles.kpiValue}>₹ 84.5 L</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Volume</Text>
            <Text style={styles.kpiValue}>2,150 m³</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* Search Input */}
        <View style={styles.searchWrapper}>
          <Ionicons
            name="search"
            size={18}
            color="#64748B"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by client, site or quote ID..."
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

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {(["All", "Approved", "Pending", "Sent", "Draft"] as const).map(
            (tab) => {
              const isSelected = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.filterPill,
                    isSelected && styles.filterPillActive,
                  ]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected && styles.filterPillTextActive,
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            },
          )}
        </View>

        {/* Quotations List */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color="#CBD5E1"
              />
              <Text style={styles.emptyTitle}>No Quotations Found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your search query or create a new quotation.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => setIsCreating(true)}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.emptyActionText}>Create New Quotation</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map((item) => {
              const statusStyle = getStatusColor(item.status);
              return (
                <View key={item.id} style={styles.quoteCard}>
                  {/* Card Header */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.idBadge}>
                      <Ionicons
                        name="document-text"
                        size={13}
                        color="#2563EB"
                      />
                      <Text style={styles.idText}>{item.id}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusStyle.bg,
                          borderColor: statusStyle.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: statusStyle.text }]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  {/* Client & Site */}
                  <Text style={styles.clientTitle}>{item.client}</Text>
                  <View style={styles.siteRow}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color="#64748B"
                    />
                    <Text style={styles.siteText}>{item.site}</Text>
                  </View>

                  {/* Concrete & Volume Grid */}
                  <View style={styles.specBox}>
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>GRADE</Text>
                      <Text style={styles.specValue}>{item.grade}</Text>
                    </View>
                    <View style={styles.specDivider} />
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>VOLUME</Text>
                      <Text style={styles.specValue}>{item.volume}</Text>
                    </View>
                    <View style={styles.specDivider} />
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>TOTAL VALUE</Text>
                      <Text style={[styles.specValue, { color: "#2563EB" }]}>
                        {item.total}
                      </Text>
                    </View>
                  </View>

                  {/* Footer Details & Action */}
                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.rateDetail}>
                        {item.rate} • {item.pouring}
                      </Text>
                      <Text style={styles.dateDetail}>
                        {item.date} • {item.validity}
                      </Text>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.shareBtn}
                        onPress={() => handleShareQuote(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="share-social-outline"
                          size={18}
                          color="#2563EB"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 14 : 10,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitles: {
    flex: 1,
  },
  headerMainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSub: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  newQuoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  newQuoteBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  kpiLabel: {
    fontSize: 10,
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },
  body: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: "#0F172A",
    paddingVertical: 0,
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 24,
  },
  quoteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  idBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  idText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  clientTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
    marginBottom: 10,
  },
  siteText: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
  specBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 10,
  },
  specItem: {
    flex: 1,
  },
  specLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  specValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 2,
  },
  specDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 8,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
  },
  rateDetail: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  dateDetail: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
