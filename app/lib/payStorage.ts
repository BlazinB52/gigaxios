export type PayEntry = {
  id: string;
  date: string;
  platform: string;
  deliveries: string;
  hours: string;
  basePay: string;
  tips: string;
  adjustments: string;
  grossPay: string;
  notes?: string;
};

const PAY_STORAGE_KEY = "gigaxios-pay";

export function loadPayEntries(): PayEntry[] {
    if (typeof window === "undefined") return [];

    const data = localStorage.getItem(PAY_STORAGE_KEY);

    if (!data) return [];

    try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function savePayEntries(entries: PayEntry[]) {
    if (typeof window === "undefined") return;

    localStorage.setItem(PAY_STORAGE_KEY, JSON.stringify(entries));
}