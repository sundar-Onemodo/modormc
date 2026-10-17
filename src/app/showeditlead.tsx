import { useLocalSearchParams } from "expo-router";
import React from "react";
import EditLeadScreen from "../screens/lead/editLeadScreen";

export default function ShowEditLeadScreen() {
  const params = useLocalSearchParams<{ id?: string; lead_id?: string }>();
  const leadId = params.id || params.lead_id;
  return <EditLeadScreen leadId={leadId} />;
}
