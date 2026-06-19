import { calculateF1PublicationAmount } from "../../shared/f1AmountCalculator.js";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function applyAuthoritativeF1Amount(requestType, formData = {}, publication = null) {
  if (requestType !== "publication") {
    return { formData, calculation: null };
  }

  const calculation = calculateF1PublicationAmount(publication || {});
  const amount = calculation.amount === null ? "" : String(calculation.amount);
  const banking = {
    ...(isObject(formData.banking) ? formData.banking : {}),
    amount: calculation.amount,
  };

  return {
    formData: {
      ...formData,
      amount,
      banking,
    },
    calculation,
  };
}
