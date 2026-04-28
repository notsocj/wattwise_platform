export type AddApplianceModalProps = {
  onClose: () => void;
  onSuccess: (deviceName: string) => void;
};

export type ApplianceType = "refrigerator" | "aircon" | "tv" | "other";

export type AiRecommendation = {
  message: string;
  estimated_monthly_kwh: number;
  estimated_monthly_cost: number;
  suggested_budget: number;
};
