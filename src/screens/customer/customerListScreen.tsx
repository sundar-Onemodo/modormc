import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
// TYPES & INTERFACES (Matching Live API)
// ==========================================

export interface CustomerContact {
  id: number;
  plant_id: number;
  patron_id: number;
  contact_type_id?: number | null;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  alt_mobile?: string | null;
  landline?: string | null;
  is_primary?: boolean;
  status?: boolean;
  displayed?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  deleted_by?: number | null;
}

export interface CustomerItem {
  id: number;
  legal_name: string;
  plant_id: number;
  contacts: CustomerContact[];
}

export interface CustomerListScreenProps {
  onBack?: () => void;
}

// Initial realistic fallback data based on user API
const SAMPLE_CUSTOMERS: CustomerItem[] = [
  {
    id: 13,
    legal_name: "Default Customer",
    plant_id: 6,
    contacts: [],
  },
  {
    id: 24,
    legal_name: "Duracastt RMC",
    plant_id: 6,
    contacts: [
      {
        id: 5,
        plant_id: 6,
        patron_id: 24,
        contact_type_id: 1,
        name: null,
        email: null,
        mobile: "6383503603",
        alt_mobile: null,
        landline: null,
        is_primary: true,
        status: true,
        displayed: true,
        created_at: "2026-08-28T07:26:03.000000Z",
        updated_at: "2026-08-28T07:26:03.000000Z",
        deleted_at: null,
        created_by: null,
        updated_by: null,
        deleted_by: null,
      },
    ],
  },
  {
    id: 25,
    legal_name: "Kavi",
    plant_id: 6,
    contacts: [
      {
        id: 6,
        plant_id: 6,
        patron_id: 25,
        contact_type_id: 1,
        name: "Praba",
        email: null,
        mobile: "9150055434",
        alt_mobile: null,
        landline: null,
        is_primary: true,
        status: true,
        displayed: true,
        created_at: "2026-09-19T05:21:43.000000Z",
        updated_at: "2026-09-19T05:21:43.000000Z",
        deleted_at: null,
        created_by: 5,
        updated_by: 5,
        deleted_by: null,
      },
    ],
  },
  {
    id: 20,
    legal_name: "Prabakaran",
    plant_id: 6,
    contacts: [
      {
        id: 8,
        plant_id: 6,
        patron_id: 20,
        contact_type_id: 1,
        name: "Ragul Sakkaravel",
        email: null,
        mobile: "6379664637",
        alt_mobile: null,
        landline: null,
        is_primary: true,
        status: true,
        displayed: true,
        created_at: "2026-10-06T06:37:18.000000Z",
        updated_at: "2026-10-06T06:37:18.000000Z",
        deleted_at: null,
        created_by: 1,
        updated_by: 1,
        deleted_by: null,
      },
    ],
  },
  {
    id: 16,
    legal_name: "Ramco Cements",
    plant_id: 6,
    contacts: [
      {
        id: 1,
        plant_id: 6,
        patron_id: 16,
        contact_type_id: 1,
        name: null,
        email: "toloke5081@candaba.com",
        mobile: null,
        alt_mobile: null,
        landline: null,
        is_primary: true,
        status: true,
        displayed: true,
        created_at: "2026-07-25T04:59:16.000000Z",
        updated_at: "2026-07-25T04:59:16.000000Z",
        deleted_at: null,
        created_by: null,
        updated_by: null,
        deleted_by: null,
      },
    ],
  },
  {
    id: 26,
    legal_name: "Senthil",
    plant_id: 6,
    contacts: [],
  },
  {
    id: 22,
    legal_name: "Srinivasan Associates",
    plant_id: 6,
    contacts: [],
  },
];

// Color palette for customer avatars
const AVATAR_PALETTE = [
  "#2563EB", // Royal Blue
  "#059669", // Emerald Green
  "#7C3AED", // Violet
  "#D97706", // Amber
  "#0284C7", // Sky Blue
  "#DC2626", // Crimson
  "#0D9488", // Teal
  "#4F46E5", // Indigo
];

const getInitials = (name: string): string => {
  if (!name) return "CU";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
};

const getAvatarColor = (id: number): string => {
  return AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length];
};

// ==========================================
// API CALL HELPER
// ==========================================

export async function fetchCustomersApi(
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

  return axios.get(`${baseURL}v1/customers`, {
    params,
    headers,
    timeout: 25000,
  });
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function CustomerListScreen({
  onBack,
}: CustomerListScreenProps) {
  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );

  const [customers, setCustomers] = useState<CustomerItem[]>(SAMPLE_CUSTOMERS);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "All" | "WithPhone" | "WithEmail" | "NoContact"
  >("All");

  // Selected customer for modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(
    null,
  );

  // Status bar locking
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("#0B2A4A");
      }
    }, []),
  );

  // Initial API fetch
  useEffect(() => {
    let isCancelled = false;

    fetchCustomersApi(token, plant_id)
      .then((response) => {
        if (isCancelled) return;
        const resData = response.data;

        let list: CustomerItem[] = [];
        if (Array.isArray(resData?.data?.data)) {
          list = resData.data.data;
        } else if (Array.isArray(resData?.data)) {
          list = resData.data;
        } else if (Array.isArray(resData)) {
          list = resData;
        }

        if (list.length > 0) {
          setCustomers(list);
        }
      })
      .catch((err: any) => {
        if (isCancelled) return;
        console.log("Error loading customers:", err?.message || err);
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Could not load live customers from plant server.";
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

  // Manual pull-to-refresh or retry
  const handleManualRefresh = useCallback(
    (isPull = false) => {
      if (isPull) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      fetchCustomersApi(token, plant_id)
        .then((response) => {
          const resData = response.data;
          let list: CustomerItem[] = [];
          if (Array.isArray(resData?.data?.data)) {
            list = resData.data.data;
          } else if (Array.isArray(resData?.data)) {
            list = resData.data;
          } else if (Array.isArray(resData)) {
            list = resData;
          }

          if (list.length > 0) {
            setCustomers(list);
          }
        })
        .catch((err: any) => {
          console.log("Error refreshing customers:", err?.message || err);
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Could not refresh customers.";
          setErrorMessage(msg);
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [token, plant_id],
  );

  // Back handler
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Dial Phone
  const handleCall = (phoneNumber: string) => {
    if (!phoneNumber) return;
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanNumber}`).catch(() => {
      Alert.alert("Dialer Error", `Could not place call to ${phoneNumber}`);
    });
  };

  // WhatsApp
  const handleWhatsApp = (phoneNumber: string, clientName: string) => {
    if (!phoneNumber) return;
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
    const fullNumber = cleanNumber.startsWith("91")
      ? cleanNumber
      : `91${cleanNumber}`;
    const message = encodeURIComponent(
      `Hello ${clientName}, regarding your Ready-Mix Concrete requirement from ${plant_name || "our plant"}.`,
    );
    const url = `whatsapp://send?phone=${fullNumber}&text=${message}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(
        "WhatsApp Not Found",
        `Could not open WhatsApp. Would you like to call ${phoneNumber} instead?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Call", onPress: () => handleCall(phoneNumber) },
        ],
      );
    });
  };

  // Email
  const handleEmail = (emailAddress: string, clientName: string) => {
    if (!emailAddress) return;
    const subject = encodeURIComponent(
      `Ready-Mix Concrete - Commercial Update for ${clientName}`,
    );
    Linking.openURL(`mailto:${emailAddress}?subject=${subject}`).catch(() => {
      Alert.alert("Email Error", `Could not launch email app for ${emailAddress}`);
    });
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((item) => {
      // 1. Tab filter
      const hasPhone = item.contacts.some((c) => Boolean(c.mobile || c.landline));
      const hasEmail = item.contacts.some((c) => Boolean(c.email));
      const hasNoContact = item.contacts.length === 0;

      if (activeTab === "WithPhone" && !hasPhone) return false;
      if (activeTab === "WithEmail" && !hasEmail) return false;
      if (activeTab === "NoContact" && !hasNoContact) return false;

      // 2. Search query filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesLegalName = item.legal_name.toLowerCase().includes(q);
        const matchesContact = item.contacts.some(
          (c) =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.mobile && c.mobile.includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q)),
        );
        return matchesLegalName || matchesContact;
      }

      return true;
    });
  }, [customers, activeTab, search]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: customers.length,
      withPhone: customers.filter((c) =>
        c.contacts.some((ct) => Boolean(ct.mobile || ct.landline)),
      ).length,
      withEmail: customers.filter((c) =>
        c.contacts.some((ct) => Boolean(ct.email)),
      ).length,
      noContact: customers.filter((c) => c.contacts.length === 0).length,
    };
  }, [customers]);

  // Render individual Customer Card
  const renderCustomerCard = ({ item }: { item: CustomerItem }) => {
    const primaryContact =
      item.contacts.find((c) => c.is_primary) || item.contacts[0] || null;
    const avatarColor = getAvatarColor(item.id);
    const initials = getInitials(item.legal_name);
    const additionalContactsCount = item.contacts.length > 1 ? item.contacts.length - 1 : 0;

    return (
      <TouchableOpacity
        style={styles.customerCard}
        activeOpacity={0.85}
        onPress={() => setSelectedCustomer(item)}
      >
        {/* Card Header: Client Badge & Contacts Count */}
        <View style={styles.cardHeader}>
          <View style={styles.customerIdBadge}>
            <MaterialCommunityIcons
              name="office-building"
              size={13}
              color="#2563EB"
            />
            <Text style={styles.customerIdText}>Client</Text>
          </View>

          <View style={styles.badgesRightRow}>
            {item.contacts.length > 0 ? (
              <View style={styles.contactsCountBadge}>
                <Ionicons name="people-outline" size={11} color="#059669" />
                <Text style={styles.contactsCountText}>
                  {item.contacts.length}{" "}
                  {item.contacts.length === 1 ? "Contact" : "Contacts"}
                </Text>
              </View>
            ) : (
              <View style={styles.noContactBadge}>
                <Ionicons name="alert-circle-outline" size={11} color="#D97706" />
                <Text style={styles.noContactBadgeText}>No Contact</Text>
              </View>
            )}
          </View>
        </View>

        {/* Customer Title Row: Avatar + Legal Name */}
        <View style={styles.customerIdentityRow}>
          <View style={[styles.avatarBox, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.customerTitleGroup}>
            <Text style={styles.legalName} numberOfLines={1}>
              {item.legal_name}
            </Text>
            <View style={styles.plantRefRow}>
              <Ionicons name="business" size={12} color="#64748B" />
              <Text style={styles.plantRefText}>
                {plant_name ? plant_name : "Commercial Client"}
              </Text>
            </View>
          </View>
        </View>

        {/* Primary Contact Information Strip */}
        {primaryContact ? (
          <View style={styles.contactDetailsBox}>
            <View style={styles.contactPersonRow}>
              <View style={styles.personIconBox}>
                <Ionicons name="person" size={13} color="#2563EB" />
              </View>
              <Text style={styles.contactPersonName} numberOfLines={1}>
                {primaryContact.name || "Primary Representative"}
              </Text>
              {primaryContact.is_primary && (
                <View style={styles.primaryPill}>
                  <Text style={styles.primaryPillText}>PRIMARY</Text>
                </View>
              )}
            </View>

            {primaryContact.mobile ? (
              <View style={styles.contactChannelRow}>
                <Ionicons name="call-outline" size={12} color="#059669" />
                <Text style={styles.contactChannelText}>
                  {primaryContact.mobile}
                </Text>
              </View>
            ) : null}

            {primaryContact.email ? (
              <View style={styles.contactChannelRow}>
                <Ionicons name="mail-outline" size={12} color="#2563EB" />
                <Text style={styles.contactChannelText} numberOfLines={1}>
                  {primaryContact.email}
                </Text>
              </View>
            ) : null}

            {additionalContactsCount > 0 && (
              <Text style={styles.moreContactsLink}>
                +{additionalContactsCount} additional contact person registered
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.emptyContactNotice}>
            <Ionicons name="person-outline" size={14} color="#94A3B8" />
            <Text style={styles.emptyContactNoticeText}>
              No representative contacts added yet for this customer.
            </Text>
          </View>
        )}

        {/* Action Buttons Row */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => setSelectedCustomer(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={15} color="#0B2A4A" />
            <Text style={styles.detailsBtnText}>Details</Text>
          </TouchableOpacity>

          <View style={styles.actionsRightGroup}>
            {primaryContact?.email ? (
              <TouchableOpacity
                style={styles.actionEmailBtn}
                onPress={() =>
                  handleEmail(primaryContact.email!, item.legal_name)
                }
                activeOpacity={0.7}
              >
                <Ionicons name="mail" size={14} color="#2563EB" />
              </TouchableOpacity>
            ) : null}

            {primaryContact?.mobile ? (
              <TouchableOpacity
                style={styles.actionWhatsAppBtn}
                onPress={() =>
                  handleWhatsApp(primaryContact.mobile!, item.legal_name)
                }
                activeOpacity={0.7}
              >
                <Ionicons name="logo-whatsapp" size={15} color="#166534" />
              </TouchableOpacity>
            ) : null}

            {primaryContact?.mobile ? (
              <TouchableOpacity
                style={styles.actionCallBtn}
                onPress={() => handleCall(primaryContact.mobile!)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={14} color="#FFFFFF" />
                <Text style={styles.actionCallBtnText}>Call</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionNewQuoteBtn}
                onPress={() => router.push("/showcreatequotations")}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={14} color="#2563EB" />
                <Text style={styles.actionNewQuoteBtnText}>New Quote</Text>
              </TouchableOpacity>
            )}
          </View>
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
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Customers</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{customers.length}</Text>
              </View>
            </View>
            <View style={styles.plantBadgeRow}>
              <Ionicons name="business" size={12} color="#94A3B8" />
              <Text style={styles.plantBadgeText}>
                {plant_name ? plant_name : "Central Commercial Directory"}
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
            <Text style={styles.kpiLabel}>TOTAL CLIENTS</Text>
            <Text style={styles.kpiValue}>{customers.length}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>DIRECT CALLS</Text>
            <Text style={[styles.kpiValue, { color: "#10B981" }]}>
              {tabCounts.withPhone}
            </Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>WITH EMAIL</Text>
            <Text style={[styles.kpiValue, { color: "#60A5FA" }]}>
              {tabCounts.withEmail}
            </Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by legal name, contact, or mobile..."
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
            { key: "All" as const, label: "All", count: tabCounts.all },
            {
              key: "WithPhone" as const,
              label: "With Mobile",
              count: tabCounts.withPhone,
            },
            {
              key: "WithEmail" as const,
              label: "With Email",
              count: tabCounts.withEmail,
            },
            {
              key: "NoContact" as const,
              label: "No Contact",
              count: tabCounts.noContact,
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

      {/* CUSTOMERS LIST */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Fetching clients from plant database...</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: "#F8FAFC" }}
          data={filteredCustomers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCustomerCard}
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
                name="account-search-outline"
                size={54}
                color="#CBD5E1"
              />
              <Text style={styles.emptyTitle}>No Customers Found</Text>
              <Text style={styles.emptySubtitle}>
                {search.trim()
                  ? `No clients matching "${search}".`
                  : activeTab !== "All"
                    ? "No customers found for this filter."
                    : "No commercial customers registered yet."}
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

      {/* CUSTOMER DETAILS MODAL */}
      <Modal
        visible={Boolean(selectedCustomer)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedCustomer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalAvatar,
                    {
                      backgroundColor: selectedCustomer
                        ? getAvatarColor(selectedCustomer.id)
                        : "#2563EB",
                    },
                  ]}
                >
                  <Text style={styles.modalAvatarText}>
                    {selectedCustomer ? getInitials(selectedCustomer.legal_name) : "CU"}
                  </Text>
                </View>
                <View style={styles.modalTitleGroup}>
                  <Text style={styles.modalCustomerName} numberOfLines={1}>
                    {selectedCustomer?.legal_name}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {plant_name ? plant_name : "Commercial Client"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedCustomer(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalSectionTitle}>
                REGISTERED CONTACT PERSONS ({selectedCustomer?.contacts.length || 0})
              </Text>

              {selectedCustomer?.contacts && selectedCustomer.contacts.length > 0 ? (
                selectedCustomer.contacts.map((contact, idx) => (
                  <View key={contact.id || idx} style={styles.modalContactCard}>
                    <View style={styles.modalContactTop}>
                      <View style={styles.modalContactNameRow}>
                        <Ionicons name="person-circle" size={20} color="#2563EB" />
                        <Text style={styles.modalContactName}>
                          {contact.name || "Contact Representative"}
                        </Text>
                      </View>
                      {contact.is_primary && (
                        <View style={styles.primaryPill}>
                          <Text style={styles.primaryPillText}>PRIMARY</Text>
                        </View>
                      )}
                    </View>

                    {contact.mobile && (
                      <View style={styles.modalContactActionRow}>
                        <View style={styles.modalContactValueRow}>
                          <Ionicons name="call" size={14} color="#059669" />
                          <Text style={styles.modalContactValue}>
                            {contact.mobile}
                          </Text>
                        </View>
                        <View style={styles.modalActionButtonsGroup}>
                          <TouchableOpacity
                            style={styles.miniCallBtn}
                            onPress={() => handleCall(contact.mobile!)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="call" size={13} color="#FFFFFF" />
                            <Text style={styles.miniBtnText}>Call</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.miniWhatsAppBtn}
                            onPress={() =>
                              handleWhatsApp(
                                contact.mobile!,
                                selectedCustomer.legal_name,
                              )
                            }
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="logo-whatsapp"
                              size={14}
                              color="#166534"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {contact.email && (
                      <View style={styles.modalContactActionRow}>
                        <View style={styles.modalContactValueRow}>
                          <Ionicons name="mail" size={14} color="#2563EB" />
                          <Text style={styles.modalContactValue} numberOfLines={1}>
                            {contact.email}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.miniEmailBtn}
                          onPress={() =>
                            handleEmail(contact.email!, selectedCustomer.legal_name)
                          }
                          activeOpacity={0.7}
                        >
                          <Ionicons name="mail" size={13} color="#2563EB" />
                          <Text style={styles.miniEmailBtnText}>Email</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.modalEmptyBox}>
                  <Ionicons name="person-add-outline" size={32} color="#94A3B8" />
                  <Text style={styles.modalEmptyText}>
                    No phone or email contacts registered for this customer.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalActionCreateQuote}
                onPress={() => {
                  setSelectedCustomer(null);
                  router.push("/showcreatequotations");
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
                <Text style={styles.modalActionCreateQuoteText}>
                  Create Quotation for Client
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Export secondary name for backwards compatibility
export { CustomerListScreen as CustomerListtScreen };

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
    marginLeft: 44,
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

  // Error Banner
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

  // Customer Card
  customerCard: {
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
  customerIdBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  customerIdText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.5,
  },
  badgesRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactsCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  contactsCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  noContactBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  noContactBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
  },

  // Identity Row (Avatar + Legal Name)
  customerIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  customerTitleGroup: {
    flex: 1,
  },
  legalName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  plantRefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  plantRefText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },

  // Contact Details Box
  contactDetailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
    gap: 5,
  },
  contactPersonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  personIconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  contactPersonName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    flex: 1,
  },
  primaryPill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  primaryPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.4,
  },
  contactChannelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 2,
  },
  contactChannelText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  moreContactsLink: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563EB",
    marginTop: 2,
  },
  emptyContactNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyContactNoticeText: {
    fontSize: 12,
    color: "#94A3B8",
    flex: 1,
  },

  // Card Actions
  cardActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0B2A4A",
  },
  actionsRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionEmailBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    justifyContent: "center",
    alignItems: "center",
  },
  actionWhatsAppBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    justifyContent: "center",
    alignItems: "center",
  },
  actionCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  actionCallBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  actionNewQuoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  actionNewQuoteBtnText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
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
  modalAvatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  modalTitleGroup: {
    flex: 1,
  },
  modalCustomerName: {
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
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  modalContactCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    gap: 8,
  },
  modalContactTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalContactNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  modalContactName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalContactActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#EDF2F7",
  },
  modalContactValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  modalContactValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  modalActionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  miniBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  miniWhatsAppBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  miniEmailBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  miniEmailBtnText: {
    color: "#2563EB",
    fontSize: 11,
    fontWeight: "700",
  },
  modalEmptyBox: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 8,
  },
  modalEmptyText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  modalActionCreateQuote: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563EB",
    height: 44,
    borderRadius: 10,
    gap: 8,
  },
  modalActionCreateQuoteText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
