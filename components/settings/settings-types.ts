export type SettingsDevice = {
  id: string;
  device_name: string;
  require_approval_on_expiry: boolean | null;
  user_approved_limit_php: number | string | null;
  budget_status: string | null;
};

export type SettingsToast = { type: "success" | "error"; message: string };

export type ShowSettingsToast = (toast: SettingsToast | null) => void;
