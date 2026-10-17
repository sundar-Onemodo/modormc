import EditQuotationScreen from "@/screens/quotations/editQuotationScreen";
import { useLocalSearchParams } from "expo-router";

export default function ShowEditQuotations() {
  const params = useLocalSearchParams<{ quotation_id?: string; id?: string }>();
  const quotationId = params.quotation_id || params.id;
  return <EditQuotationScreen quotationId={quotationId} />;
}
