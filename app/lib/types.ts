export type ShiftStatus = "open" | "closed";


// ======================================================
// SavedShift
// Master record for one completed or open work shift
// One saved shift = mileage + work totals + pay totals
// ======================================================

export type SavedShift = {
  id: string;
  platform: string;
  date: string;

  beginningMileage: string;
  endingMileage: string;

  deliveries: string;
  hoursWorked: string;

  basePay: string;
  tips: string;
  otherPay: string;
  grossPay: string;

  status: "open" | "closed";
};