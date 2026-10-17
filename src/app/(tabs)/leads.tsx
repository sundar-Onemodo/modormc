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
// TYPES & INTERFACES (Based on API response)
// ==========================================

export interface LeadOwner {
  id: number;
  username: string;
  profile_photo_url?: string | null;
}

export interface LeadItem {
  id: number;
  plant_id?: number;
  lead_number: string;
  enquiry_date: string;
  contact_name: string;
  company_name?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  source?: string | null;
  status: string;
  priority: string;
  assigned_to?: number | null;
  project_name: string;
  requirement: string;
  estimated_quantity: string | number;
  delivery_location: string;
  expected_value: string | number;
  expected_purchase_date?: string | null;
  remarks?: string | null;
  lost_reason?: string | null;
  customer_id?: number | null;
  converted_at?: string | null;
  created_at?: string;
  created_by?: number;
  updated_at?: string;
  updated_by?: number;
  deleted_at?: string | null;
  deleted_by?: number | null;
  next_follow_up?: string | null;
  owner?: LeadOwner | null;
}

// Initial realistic fallback data matching user's exact API schema
const SAMPLE_LEADS: LeadItem[] = [
  {
    id: 1,
    plant_id: 6,
    lead_number: "LD/2026/00001",
    enquiry_date: "2026-10-15",
    contact_name: "Lughuvg",
    company_name: "Uhuhuh Enterprises",
    phone: "4894949844",
    email: "contact@uhuhuh.com",
    address: "Sdcsfcsdfc Industrial Area",
    source: "Referral",
    status: "New",
    priority: "Medium",
    assigned_to: 5,
    project_name: "Kjsabdaskjdb Commercial Center",
    requirement: "M20 MP",
    estimated_quantity: "5.000",
    delivery_location: "Ssdcfdscfsdcf, Site Gate #2",
    expected_value: "50000.00",
    expected_purchase_date: "2026-10-16",
    remarks: "Requires timely morning dispatch with transit mixer.",
    lost_reason: null,
    customer_id: null,
    converted_at: null,
    created_at: "2026-10-15T04:13:47.000000Z",
    created_by: 1,
    updated_at: "2026-10-15T04:13:47.000000Z",
    updated_by: 1,
    deleted_at: null,
    deleted_by: null,
    next_follow_up: null,
    owner: {
      id: 5,
      username: "Testing Account",
      profile_photo_url:
        "https://ui-avatars.com/api/?name=Testing+Account&color=7F9CF5&background=EBF4FF",
    },
  },
  {
    id: 2,
    plant_id: 6,
    lead_number: "LD/2026/00002",
    enquiry_date: "2026-10-14",
    contact_name: "Vikram Mehta",
    company_name: "Skyline Infra Builders",
    phone: "+91 98450 12345",
    email: "vikram@skylineinfra.com",
    address: "Plot 42, Electronic City Phase 1",
    source: "Direct Inbound",
    status: "Contacted",
    priority: "High",
    assigned_to: 5,
    project_name: "Skyline Gateway Tower B",
    requirement: "M35 Pumpable",
    estimated_quantity: "450.000",
    delivery_location: "Hosur Main Road, Bengaluru",
    expected_value: "1850000.00",
    expected_purchase_date: "2026-10-22",
    remarks: "Requires boom pump 36m for 4th floor slab casting.",
    lost_reason: null,
    customer_id: null,
    converted_at: null,
    created_at: "2026-10-14T08:20:00.000000Z",
    created_by: 1,
    updated_at: "2026-10-14T08:20:00.000000Z",
    updated_by: 1,
    deleted_at: null,
    deleted_by: null,
    next_follow_up: null,
    owner: {
      id: 5,
      username: "Testing Account",
      profile_photo_url:
        "https://ui-avatars.com/api/?name=Testing+Account&color=7F9CF5&background=EBF4FF",
    },
  },
];

// ==========================================
// API HELPER
// ==========================================

async function fetchLeadsApi(
  token: string | null,
  plantId: number | null,
  page: number = 1,
  perPage: number = 50,
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

  const params: Record<string, any> = {
    page,
    per_page: perPage,
  };
  if (plantId !== null && plantId !== undefined) {
    params.plant_id = String(plantId);
  }

  return axios.get(`${baseURL}v1/leads`, {
    headers,
    params,
    timeout: 25000,
  });
}

// ==========================================
// FORMATTING HELPERS
// ==========================================

function formatCurrency(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "₹ 0";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return `₹ ${value}`;
  return `₹ ${num.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

function formatQuantity(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "0 m³";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return `${value} m³`;
  return `${num} m³`;
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
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
      if (month >= 1 && month <= 12) {
        return `${day} ${months[month - 1]} ${year}`;
      }
    }
    return dateStr.split("T")[0];
  } catch {
    return dateStr;
  }
}

function getPriorityBadge(priority: string) {
  const p = (priority || "").toLowerCase();
  switch (p) {
    case "urgent":
      return {
        bg: "#FEF2F2",
        text: "#DC2626",
        border: "#FCA5A5",
        dot: "#EF4444",
      };
    case "high":
      return {
        bg: "#FFF7ED",
        text: "#C2410C",
        border: "#FDBA74",
        dot: "#EA580C",
      };
    case "medium":
      return {
        bg: "#FEFCE8",
        text: "#A16207",
        border: "#FDE047",
        dot: "#CA8A04",
      };
    case "low":
    default:
      return {
        bg: "#F0FDF4",
        text: "#15803D",
        border: "#86EFAC",
        dot: "#16A34A",
      };
  }
}

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "new":
      return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
    case "in negotiation":
    case "negotiation":
    case "in progress":
      return { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" };
    case "qualified":
    case "won":
    case "converted":
      return { bg: "#DCFCE7", text: "#15803D", border: "#86EFAC" };
    case "lost":
    case "unqualified":
    case "cancelled":
      return { bg: "#FFE4E6", text: "#BE123C", border: "#FECDD3" };
    case "contacted":
      return { bg: "#F3E8FF", text: "#7E22CE", border: "#D8B4FE" };
    default:
      return { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
  }
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function LeadsScreen() {
  const { token, plant_id, plant_name } = useSelector(
    (state: RootState) => state.auth,
  );
  const cachedMixDesigns = useSelector(
    (state: RootState) => state.quotation?.mixDesigns,
  );

  const [leads, setLeads] = useState<LeadItem[]>(SAMPLE_LEADS);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState("All");

  // Initial single API load on mount or auth change
  useEffect(() => {
    let isCancelled = false;

    fetchLeadsApi(token, plant_id, 1, 50)
      .then((response) => {
        if (isCancelled) return;
        const resData = response.data;
        let fetchedList: LeadItem[] = [];
        if (Array.isArray(resData?.data?.data)) {
          fetchedList = resData.data.data;
        } else if (Array.isArray(resData?.data)) {
          fetchedList = resData.data;
        }

        if (fetchedList.length > 0) {
          setLeads(fetchedList);
        } else {
          setLeads([]);
        }
      })
      .catch((err: any) => {
        if (isCancelled) return;
        console.warn("API leads load note:", err?.message || err);
        const errMsg =
          err?.response?.data?.message ||
          err?.message ||
          "Could not connect to leads server.";
        setErrorMessage(errMsg);
        setLeads((prev) => (prev.length > 0 ? prev : SAMPLE_LEADS));
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

      fetchLeadsApi(token, plant_id, 1, 50)
        .then((response) => {
          const resData = response.data;
          let fetchedList: LeadItem[] = [];
          if (Array.isArray(resData?.data?.data)) {
            fetchedList = resData.data.data;
          } else if (Array.isArray(resData?.data)) {
            fetchedList = resData.data;
          }

          if (fetchedList.length > 0) {
            setLeads(fetchedList);
          } else {
            setLeads([]);
          }
        })
        .catch((err: any) => {
          console.warn("API leads load note:", err?.message || err);
          const errMsg =
            err?.response?.data?.message ||
            err?.message ||
            "Could not connect to leads server.";
          setErrorMessage(errMsg);
          setLeads((prev) => (prev.length > 0 ? prev : SAMPLE_LEADS));
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [token, plant_id],
  );

  // Automatically refresh when screen regains focus (e.g. after adding a lead)
  useFocusEffect(
    useCallback(() => {
      fetchLeadsApi(token, plant_id, 1, 50)
        .then((response) => {
          const resData = response.data;
          let fetchedList: LeadItem[] = [];
          if (Array.isArray(resData?.data?.data)) {
            fetchedList = resData.data.data;
          } else if (Array.isArray(resData?.data)) {
            fetchedList = resData.data;
          }
          if (fetchedList.length > 0) {
            setLeads(fetchedList);
          }
        })
        .catch(() => {});
    }, [token, plant_id]),
  );

  // Phone Call Action
  const handleCall = (phone: string) => {
    if (!phone) {
      Alert.alert("No Phone Number", "This lead does not have a phone number.");
      return;
    }
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert("Unable to Call", `Could not initiate call to ${phone}`);
    });
  };

  // Email Action
  const handleEmail = (email?: string | null) => {
    if (!email) {
      Alert.alert("No Email", "This lead does not have an email address.");
      return;
    }
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert("Unable to Email", `Could not open mail app for ${email}`);
    });
  };

  // Quick Status Picker State
  const [selectedLeadForStatus, setSelectedLeadForStatus] =
    useState<LeadItem | null>(null);
  const [statusPickerVisible, setStatusPickerVisible] =
    useState<boolean>(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const handleOpenStatusPicker = (lead: LeadItem) => {
    setSelectedLeadForStatus(lead);
    setStatusPickerVisible(true);
  };

  const handleSelectStatus = async (newStatus: string) => {
    if (!selectedLeadForStatus) return;
    const targetLead = selectedLeadForStatus;
    setStatusPickerVisible(false);

    if (targetLead.status?.toLowerCase() === newStatus.toLowerCase()) return;

    setUpdatingStatusId(targetLead.id);

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

    if (plant_id !== null && plant_id !== undefined) {
      headers["X-Plant-Id"] = String(plant_id);
    }

    // Resolve requirement mix design id as a string
    let reqToSend = "6";
    const rawReq = targetLead.requirement;
    if (typeof rawReq === "number") {
      reqToSend = String(rawReq);
    } else if (rawReq && !isNaN(parseInt(String(rawReq), 10))) {
      reqToSend = String(parseInt(String(rawReq), 10));
    } else if (rawReq) {
      const rawStr = String(rawReq).toLowerCase().trim();
      const listToSearch =
        cachedMixDesigns && cachedMixDesigns.length > 0 ? cachedMixDesigns : [];
      const found = listToSearch.find(
        (m: any) =>
          String(m.id) === rawStr ||
          (m.design_name || "").toLowerCase().trim() === rawStr ||
          (m.name || "").toLowerCase().trim() === rawStr,
      );
      if (found) {
        reqToSend = String(found.id);
      } else {
        reqToSend = String(rawReq);
      }
    }

    const resolvedAddress =
      targetLead.address || targetLead.delivery_location || "";
    const rawSource = (targetLead.source || "Referral").toLowerCase();
    const sourceToSend =
      rawSource === "referal" || rawSource === "referral"
        ? "Referral"
        : rawSource === "orther" || rawSource === "other"
          ? "Other"
          : targetLead.source || "Referral";

    const payload = {
      contact_name: targetLead.contact_name,
      company_name: targetLead.company_name || null,
      phone: targetLead.phone,
      email: targetLead.email || null,
      enquiry_date: targetLead.enquiry_date,
      source: sourceToSend,
      status: newStatus,
      priority: targetLead.priority || "Medium",
      requirement: reqToSend,
      estimated_quantity: parseFloat(String(targetLead.estimated_quantity || 0)),
      expected_value: parseFloat(String(targetLead.expected_value || 0)),
      expected_purchase_date: targetLead.expected_purchase_date || null,
      remarks: targetLead.remarks || null,
      delivery_location: targetLead.delivery_location,
      address: resolvedAddress,
      addrress: resolvedAddress,
      project_name: targetLead.project_name,
    };

    try {
      await axios.put(`${baseURL}v1/leads/${targetLead.id}`, payload, {
        headers,
        params: { lead: targetLead.id },
        timeout: 20000,
      });

      // Update particular card in leads state
      setLeads((prev) =>
        prev.map((l) =>
          l.id === targetLead.id ? { ...l, status: newStatus } : l,
        ),
      );
    } catch (err: any) {
      console.warn("Status update note:", err?.message || err);
      Alert.alert(
        "Update Notice",
        err?.response?.data?.message || "Could not update status on server.",
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Full Edit Lead Action (navigates to showeditlead)
  const handleNavigateToEditLead = (id: number) => {
    router.push({
      pathname: "/showeditlead" as any,
      params: { id: String(id) },
    });
  };

  // Navigate to Create Lead Screen
  const handleNavigateToAddLead = () => {
    router.push("/showcreatelead" as any);
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Status filter
      if (
        activeStatusFilter !== "All" &&
        lead.status?.toLowerCase() !== activeStatusFilter.toLowerCase()
      ) {
        return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesProject = (lead.project_name || "")
          .toLowerCase()
          .includes(query);
        const matchesContact = (lead.contact_name || "")
          .toLowerCase()
          .includes(query);
        const matchesCompany = (lead.company_name || "")
          .toLowerCase()
          .includes(query);
        const matchesNumber = (lead.lead_number || "")
          .toLowerCase()
          .includes(query);
        const matchesPhone = (lead.phone || "").toLowerCase().includes(query);
        const matchesRequirement = (lead.requirement || "")
          .toLowerCase()
          .includes(query);
        const matchesLocation = (lead.delivery_location || "")
          .toLowerCase()
          .includes(query);

        return (
          matchesProject ||
          matchesContact ||
          matchesCompany ||
          matchesNumber ||
          matchesPhone ||
          matchesRequirement ||
          matchesLocation
        );
      }
      return true;
    });
  }, [leads, activeStatusFilter, searchQuery]);

  // Aggregate KPI stats
  const totalPipelineValue = useMemo(() => {
    return leads.reduce((sum, item) => {
      const val = parseFloat(String(item.expected_value || 0));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [leads]);

  const highPriorityCount = useMemo(() => {
    return leads.filter(
      (l) =>
        l.priority?.toLowerCase() === "high" ||
        l.priority?.toLowerCase() === "urgent",
    ).length;
  }, [leads]);

  // Available options
  const statusOptions = [
    "All",
    "New",
    "Contacted",
    "Qualified",
    "Unqualified",
  ];

  // Render individual Lead Card
  const renderLeadCard = ({ item }: { item: LeadItem }) => {
    const priorityStyle = getPriorityBadge(item.priority);
    const statusStyle = getStatusBadge(item.status);

    return (
      <View style={styles.leadCard}>
        {/* Card Header: Lead ID, Priority & Status */}
        <View style={styles.cardHeader}>
          <View style={styles.leadNumberBadge}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={14}
              color="#2563EB"
            />
            <Text style={styles.leadNumberText}>{item.lead_number}</Text>
          </View>

          <View style={styles.badgesRightRow}>
            {/* Priority Badge */}
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor: priorityStyle.bg,
                  borderColor: priorityStyle.border,
                },
              ]}
            >
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: priorityStyle.dot },
                ]}
              />
              <Text
                style={[styles.priorityText, { color: priorityStyle.text }]}
              >
                {item.priority || "Medium"}
              </Text>
            </View>

            {/* Status Dropdown Badge */}
            <TouchableOpacity
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusStyle.bg,
                  borderColor: statusStyle.border,
                },
              ]}
              onPress={() => handleOpenStatusPicker(item)}
              activeOpacity={0.7}
              disabled={updatingStatusId === item.id}
            >
              {updatingStatusId === item.id ? (
                <ActivityIndicator size="small" color={statusStyle.text} />
              ) : (
                <>
                  <Text
                    style={[styles.statusText, { color: statusStyle.text }]}
                    numberOfLines={1}
                  >
                    {item.status || "New"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={11}
                    color={statusStyle.text}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Project Title & Source */}
        <View style={styles.projectSection}>
          <View style={styles.projectTitleRow}>
            <Text style={styles.projectNameText} numberOfLines={2}>
              {item.project_name || "Untitled Project"}
            </Text>
            {item.source ? (
              <View style={styles.sourceBadge}>
                <Ionicons name="pricetag-outline" size={11} color="#64748B" />
                <Text style={styles.sourceBadgeText}>{item.source}</Text>
              </View>
            ) : null}
          </View>

          {/* Contact Person & Company */}
          <View style={styles.contactRow}>
            <Ionicons name="person-circle-outline" size={15} color="#475569" />
            <Text style={styles.contactPersonText}>
              {item.contact_name}
              {item.company_name ? ` · ${item.company_name}` : ""}
            </Text>
          </View>
        </View>

        {/* Core Specs Grid: Requirement, Estimated Qty, Expected Value */}
        <View style={styles.specBox}>
          {/* Requirement */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="layers-triple-outline"
                size={13}
                color="#64748B"
              />
              <Text style={styles.specLabel}>REQUIREMENT</Text>
            </View>
            <Text style={styles.specValue} numberOfLines={1}>
              {item.requirement || "Standard Mix"}
            </Text>
          </View>

          <View style={styles.specDivider} />

          {/* Est Quantity */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <MaterialCommunityIcons
                name="cube-outline"
                size={13}
                color="#2563EB"
              />
              <Text style={styles.specLabel}>EST. QUANTITY</Text>
            </View>
            <Text style={[styles.specValue, { color: "#2563EB" }]}>
              {formatQuantity(item.estimated_quantity)}
            </Text>
          </View>

          <View style={styles.specDivider} />

          {/* Expected Value */}
          <View style={styles.specCol}>
            <View style={styles.specHeaderRow}>
              <Ionicons name="cash-outline" size={13} color="#059669" />
              <Text style={styles.specLabel}>EXP. VALUE</Text>
            </View>
            <Text
              style={[
                styles.specValue,
                { color: "#059669", fontWeight: "800" },
              ]}
              numberOfLines={1}
            >
              {formatCurrency(item.expected_value)}
            </Text>
          </View>
        </View>

        {/* Location & Address Section */}
        <View style={styles.locationContainer}>
          <View style={styles.locationItem}>
            <Ionicons
              name="location"
              size={14}
              color="#DC2626"
              style={styles.locationIcon}
            />
            <Text style={styles.locationText} numberOfLines={1}>
              <Text style={styles.locationPrefix}>Delivery: </Text>
              {item.delivery_location || "Not specified"}
            </Text>
          </View>

          {item.address ? (
            <View style={styles.locationItem}>
              <Ionicons
                name="business-outline"
                size={14}
                color="#64748B"
                style={styles.locationIcon}
              />
              <Text style={styles.locationText} numberOfLines={1}>
                <Text style={styles.locationPrefix}>Address: </Text>
                {item.address}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Dates Bar: Enquiry Date & Expected Purchase Date */}
        <View style={styles.datesBar}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={13} color="#64748B" />
            <Text style={styles.dateLabel}>
              Enquiry:{" "}
              <Text style={styles.dateVal}>
                {formatDateDisplay(item.enquiry_date)}
              </Text>
            </Text>
          </View>

          <View style={styles.dateItem}>
            <Ionicons name="time-outline" size={13} color="#D97706" />
            <Text style={styles.dateLabel}>
              Expected:{" "}
              <Text style={[styles.dateVal, { color: "#D97706" }]}>
                {formatDateDisplay(item.expected_purchase_date)}
              </Text>
            </Text>
          </View>
        </View>

        {/* Owner / Assignee & Remarks if available */}
        {item.owner?.username || item.remarks ? (
          <View style={styles.ownerRemarksRow}>
            {item.owner?.username ? (
              <View style={styles.ownerPill}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={12}
                  color="#2563EB"
                />
                <Text style={styles.ownerText}>
                  Assigned: {item.owner.username}
                </Text>
              </View>
            ) : (
              <View />
            )}

            {item.remarks ? (
              <Text style={styles.remarksSnippet} numberOfLines={1}>
                {`“${item.remarks}”`}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Quick Action Footer: Phone / Call & Email */}
        <View style={styles.cardFooter}>
          <View style={styles.phoneDisplay}>
            <Ionicons name="call-outline" size={13} color="#475569" />
            <Text style={styles.phoneDisplayText}>
              {item.phone || "No phone"}
            </Text>
          </View>

          <View style={styles.actionButtonsGroup}>
            <TouchableOpacity
              style={styles.actionEditBtn}
              onPress={() => handleNavigateToEditLead(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={14} color="#0B2A4A" />
              <Text style={styles.actionEditText}>Edit</Text>
            </TouchableOpacity>

            {item.email ? (
              <TouchableOpacity
                style={styles.actionEmailBtn}
                onPress={() => handleEmail(item.email)}
                activeOpacity={0.7}
              >
                <Ionicons name="mail" size={14} color="#2563EB" />
                <Text style={styles.actionEmailText}>Email</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.actionCallBtn}
              onPress={() => handleCall(item.phone)}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={14} color="#FFFFFF" />
              <Text style={styles.actionCallText}>Call</Text>
            </TouchableOpacity>
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

      {/* TOP INDUSTRIAL HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerTitleBadgeRow}>
              <Text style={styles.headerTitle}>Leads</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{leads.length}</Text>
              </View>
            </View>
            <View style={styles.plantBadgeRow}>
              <Ionicons name="business" size={12} color="#94A3B8" />
              <Text style={styles.plantBadgeText}>
                {plant_name ? plant_name : "Ready-Mix Sales Pipeline"}
              </Text>
            </View>
          </View>
        </View>

        {/* QUICK KPI METRIC STRIP */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL LEADS</Text>
            <Text style={styles.kpiValue}>{leads.length}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>HIGH PRIORITY</Text>
            <Text style={[styles.kpiValue, { color: "#FBBF24" }]}>
              {highPriorityCount}
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

        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search project, lead #, client, grade..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTER TABS */}
      <View style={styles.filterSection}>
        {/* Status Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {statusOptions.map((status) => {
            const isActive = activeStatusFilter === status;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveStatusFilter(status)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ERROR NOTICE IF ANY */}
      {errorMessage && (
        <View style={styles.errorNotice}>
          <Ionicons name="warning-outline" size={16} color="#DC2626" />
          <Text style={styles.errorNoticeText}>
            Showing cached data. ({errorMessage})
          </Text>
          <TouchableOpacity onPress={() => handleManualRefresh(false)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LEADS LIST / FLATLIST */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Fetching leads from plant...</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: "#F8FAFC" }}
          data={filteredLeads}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLeadCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
              <Text style={styles.emptyTitle}>No Leads Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || activeStatusFilter !== "All"
                  ? "No matching leads found for current search/filter."
                  : "No sales leads currently available for this plant."}
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={handleNavigateToAddLead}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Add First Lead</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FLOATING ACTION BUTTON: ADD LEAD */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={handleNavigateToAddLead}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.fabText}>Add Lead</Text>
      </TouchableOpacity>

      {/* QUICK STATUS PICKER MODAL */}
      <Modal
        visible={statusPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setStatusPickerVisible(false)}
      >
        <View style={styles.statusModalOverlay}>
          <View style={styles.statusModalContent}>
            <View style={styles.statusModalHeader}>
              <View>
                <Text style={styles.statusModalTitle}>Update Lead Status</Text>
                <Text style={styles.statusModalSubtitle}>
                  {selectedLeadForStatus?.lead_number} ·{" "}
                  {selectedLeadForStatus?.project_name}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.statusModalCloseBtn}
                onPress={() => setStatusPickerVisible(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.statusOptionsList}>
              {[
                { label: "New", value: "New", color: "#2563EB" },
                { label: "Contacted", value: "Contacted", color: "#7C3AED" },
                { label: "Qualified", value: "Qualified", color: "#059669" },
                {
                  label: "Unqualified",
                  value: "Unqualified",
                  color: "#DC2626",
                },
              ].map((opt) => {
                const isSelected =
                  selectedLeadForStatus?.status?.toLowerCase() ===
                  opt.value.toLowerCase();
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusOptionItem,
                      isSelected && styles.statusOptionItemSelected,
                    ]}
                    onPress={() => handleSelectStatus(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.statusOptionLeft}>
                      <View
                        style={[
                          styles.statusOptionDot,
                          { backgroundColor: opt.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusOptionLabel,
                          isSelected && {
                            color: opt.color,
                            fontWeight: "800",
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={opt.color}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
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
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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

  // TOUCHABLEOPACITY: + ADD LEAD BUTTON
  addLeadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addLeadButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
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
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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

  // Leads List
  listContent: {
    padding: 14,
    paddingBottom: 95,
    gap: 12,
  },

  // LEAD CARD
  leadCard: {
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
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  leadNumberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    flexShrink: 1,
  },
  leadNumberText: {
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
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
    includeFontPadding: false,
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
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  sourceBadgeText: {
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

  // Location details
  locationContainer: {
    backgroundColor: "#FFFFFF",
    gap: 4,
    marginBottom: 8,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationIcon: {
    marginRight: 6,
    width: 14,
  },
  locationPrefix: {
    fontWeight: "700",
    color: "#475569",
  },
  locationText: {
    fontSize: 12,
    color: "#334155",
    flex: 1,
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

  // Owner & Remarks
  ownerRemarksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    marginBottom: 8,
    gap: 8,
  },
  ownerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  ownerText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#1D4ED8",
  },
  remarksSnippet: {
    flex: 1,
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
    textAlign: "right",
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
  phoneDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  phoneDisplayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  actionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionEmailBtn: {
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
  actionEmailText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  actionEditBtn: {
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
  actionEditText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },
  actionCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  actionCallText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Status Modal Styles
  statusModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  statusModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  statusModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
  },
  statusModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusModalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  statusModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  statusOptionsList: {
    gap: 8,
  },
  statusOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusOptionItemSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  statusOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 24,
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
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Loading State
  centerContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },

  // FAB Button
  fabButton: {
    position: "absolute",
    bottom: 20,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
