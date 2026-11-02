import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface LineItemCalculationParams {
  quantity: number;
  rate: number;
  pump_rate: number;
  taxRate: number;
  isTaxInclusive: boolean;
  discount?: number;
  discountType?: string;
}

export interface LineItemCalculationResult {
  discountAmount: number;
  materialUntaxed: number;
  materialTax: number;
  materialTotal: number;
  pumpCharge: number;
  grossAmount: number;
  untaxedAmount: number;
  taxAmount: number;
  amountTotal: number;
}

export function calculateLineItemTotals(
  params: LineItemCalculationParams,
): LineItemCalculationResult {
  const qty = Number(params.quantity || 0);
  const rate = Number(params.rate || 0);
  const pumpRate = Number(params.pump_rate || 0);
  const taxRate = Number(params.taxRate || 0);
  const isTaxInclusive = Boolean(params.isTaxInclusive);

  const pumpCharge = pumpRate;
  const grossLine = qty * rate + pumpCharge;
  const discountValue = Math.max(0, Number(params.discount || 0));
  const discountAmount = Math.min(
    grossLine,
    Number(
      (params.discountType === "%"
        ? (grossLine * discountValue) / 100
        : discountValue
      ).toFixed(2),
    ),
  );

  let materialUntaxed = 0;
  let materialTax = 0;
  let materialTotal = 0;
  let untaxedAmount = 0;
  let taxAmount = 0;
  let amountTotal = 0;
  let grossAmount = 0;

  if (isTaxInclusive) {
    // TAX INCLUSIVE:
    // gross_amount = (qty * rate) + pump_charge
    // taxable_amount (untaxed) = gross_amount * 100 / (100 + tax_rate)
    // tax_amount = gross_amount - taxable_amount
    // amount_total = gross_amount
    grossAmount = qty * rate + pumpCharge - discountAmount;
    untaxedAmount =
      taxRate > 0 ? (grossAmount * 100) / (100 + taxRate) : grossAmount;
    taxAmount = grossAmount - untaxedAmount;
    amountTotal = grossAmount;

    materialTotal = qty * rate;
    materialUntaxed =
      taxRate > 0 ? (materialTotal * 100) / (100 + taxRate) : materialTotal;
    materialTax = materialTotal - materialUntaxed;
  } else {
    // TAX EXCLUSIVE:
    // material_amount = qty * rate
    // untaxed_amount = material_amount + pump_charge
    // tax_amount = untaxed_amount * (tax_rate / 100)
    // amount_total = untaxed_amount + tax_amount
    materialUntaxed = qty * rate;
    materialTax = (materialUntaxed * taxRate) / 100;
    materialTotal = materialUntaxed + materialTax;

    untaxedAmount = materialUntaxed + pumpCharge - discountAmount;
    taxAmount = (untaxedAmount * taxRate) / 100;
    grossAmount = untaxedAmount;
    amountTotal = untaxedAmount + taxAmount;
  }

  return {
    discountAmount,
    materialUntaxed: Number(materialUntaxed.toFixed(2)),
    materialTax: Number(materialTax.toFixed(2)),
    materialTotal: Number(materialTotal.toFixed(2)),
    pumpCharge: Number(pumpCharge.toFixed(2)),
    untaxedAmount: Number(untaxedAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    amountTotal: Number(amountTotal.toFixed(2)),
    grossAmount: Number(grossAmount.toFixed(2)),
  };
}

export interface QuotationTotalsResult {
  untaxedAmount: number;
  taxAmount: number;
  amountTotal: number;
  adjustmentAmount: number;
  grandTotal: number;
}

export function calculateQuotationTotals(
  items: { calculation: LineItemCalculationResult }[],
  adjustment: number | string = 0,
): QuotationTotalsResult {
  const totals = items.reduce(
    (acc, item) => ({
      untaxedAmount: acc.untaxedAmount + (item.calculation?.untaxedAmount || 0),
      taxAmount: acc.taxAmount + (item.calculation?.taxAmount || 0),
      amountTotal: acc.amountTotal + (item.calculation?.amountTotal || 0),
    }),
    { untaxedAmount: 0, taxAmount: 0, amountTotal: 0 },
  );

  const adj = parseFloat(String(adjustment || 0)) || 0;
  const grandTotal = totals.untaxedAmount + totals.taxAmount + adj;

  return {
    untaxedAmount: Number(totals.untaxedAmount.toFixed(2)),
    taxAmount: Number(totals.taxAmount.toFixed(2)),
    amountTotal: Number(totals.amountTotal.toFixed(2)),
    adjustmentAmount: adj,
    grandTotal: Number(grandTotal.toFixed(2)),
  };
}

export interface CustomerDropdownItem {
  id: number;
  legal_name: string;
  plant_id?: number;
}

export interface SiteDropdownItem {
  id: number;
  name: string;
  patron_id?: number[] | null;
  site_address_1?: string | null;
  code?: string | null;
}

export interface MixDesignDropdownItem {
  id: number;
  design_name: string;
  name?: string;
  design_code?: string | null;
  code?: string | null;
  rate_per_qty?: string;
  concrete_grade_id?: number;
}

export interface TaxDropdownItem {
  id: number;
  tax_name: string;
  name?: string;
  tax_rate?: string | number;
  rate?: number;
  parent_id?: number | null;
}

export interface QuotationState {
  customers: CustomerDropdownItem[];
  sites: SiteDropdownItem[];
  mixDesigns: MixDesignDropdownItem[];
  taxes: TaxDropdownItem[];
  selectedCustomer: CustomerDropdownItem | null;
  selectedSite: SiteDropdownItem | null;
  isLoadingDropdowns: boolean;
  dropdownError: string | null;
}

const initialState: QuotationState = {
  customers: [],
  sites: [],
  mixDesigns: [],
  taxes: [],
  selectedCustomer: null,
  selectedSite: null,
  isLoadingDropdowns: false,
  dropdownError: null,
};

const quotationSlice = createSlice({
  name: "quotation",
  initialState,
  reducers: {
    setCustomers: (state, action: PayloadAction<CustomerDropdownItem[]>) => {
      state.customers = action.payload;
    },
    setSites: (state, action: PayloadAction<SiteDropdownItem[]>) => {
      state.sites = action.payload;
    },
    setMixDesigns: (state, action: PayloadAction<MixDesignDropdownItem[]>) => {
      state.mixDesigns = action.payload;
    },
    setTaxes: (state, action: PayloadAction<TaxDropdownItem[]>) => {
      state.taxes = action.payload;
    },
    setSelectedCustomer: (
      state,
      action: PayloadAction<CustomerDropdownItem | null>,
    ) => {
      state.selectedCustomer = action.payload;
    },
    setSelectedSite: (
      state,
      action: PayloadAction<SiteDropdownItem | null>,
    ) => {
      state.selectedSite = action.payload;
    },
    setDropdownLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingDropdowns = action.payload;
    },
    setDropdownError: (state, action: PayloadAction<string | null>) => {
      state.dropdownError = action.payload;
    },
    clearQuotationSelection: (state) => {
      state.selectedCustomer = null;
      state.selectedSite = null;
    },
  },
});

export const {
  setCustomers,
  setSites,
  setMixDesigns,
  setTaxes,
  setSelectedCustomer,
  setSelectedSite,
  setDropdownLoading,
  setDropdownError,
  clearQuotationSelection,
} = quotationSlice.actions;

export default quotationSlice.reducer;
