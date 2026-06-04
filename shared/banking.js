export const KOSOVO_BANKS = [
  { name: "Banka Kombetare Tregtare Kosove", swift: "NCBAXKPR", ibanCodes: ["1701", "17"], logoSrc: "/bank-logos/bkt.svg" },
  { name: "ProCredit Bank Kosovo", swift: "MBKOXKPR", ibanCodes: ["1101", "11"], logoSrc: "/bank-logos/procredit.png" },
  { name: "Raiffeisen Bank Kosovo", swift: "RBKOXKPR", ibanCodes: ["1503", "1212", "1201", "12"], logoSrc: "/bank-logos/raiffeisen.svg" },
  { name: "TEB Bank Kosovo", swift: "TEBKXKPR", ibanCodes: ["1501", "15"], logoSrc: "/bank-logos/teb.svg" },
  { name: "NLB Banka", swift: "NLPRXKPR", ibanCodes: ["1301", "13"], logoSrc: "/bank-logos/nlb.png" },
  { name: "Banka per Biznes", swift: "BPBXXKPR", ibanCodes: ["1601", "16"], logoSrc: "/bank-logos/bpb.svg" },
  { name: "Ziraat Bank Kosovo", swift: "TCZBXKPR", ibanCodes: ["1801", "18"], logoSrc: "/bank-logos/ziraat.svg" },
  { name: "Isbank Kosovo", swift: "ISBKXKPR", ibanCodes: ["1901", "19"], logoSrc: "/bank-logos/isbank.svg" },
  { name: "PriBank", swift: "PHHAXKPR", ibanCodes: ["2101", "21"], logoSrc: "/bank-logos/pribank.svg" },
  { name: "Economic Bank", swift: "EKOMXKPR", ibanCodes: ["1401", "14"], logoSrc: "/bank-logos/economic.jpg" },
];

export function normalizeBankAccountIdentifier(value) {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function ibanMod97(iban) {
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;

  for (const char of rearranged) {
    const code = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;

    if (!/^\d+$/.test(code)) {
      return null;
    }

    for (const digit of code) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder;
}

export function isValidIban(value) {
  const iban = normalizeBankAccountIdentifier(value);

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return false;
  }

  if (iban.length < 15 || iban.length > 34) {
    return false;
  }

  if (iban.startsWith("XK") && iban.length !== 20) {
    return false;
  }

  return ibanMod97(iban) === 1;
}

function isValidKosovoIban(value) {
  const iban = normalizeBankAccountIdentifier(value);
  return iban.startsWith("XK") && isValidIban(iban);
}

function getBankIdentifiersFromAccount(value) {
  const account = normalizeBankAccountIdentifier(value);

  if (isValidKosovoIban(account)) {
    return [account.slice(4, 8), account.slice(4, 6)].filter(Boolean);
  }

  if (!/^\d{4,24}$/.test(account)) {
    return [];
  }

  return [account.slice(0, 4), account.slice(0, 2)].filter(Boolean);
}

export function detectKosovoBankFromAccount(value) {
  const identifiers = getBankIdentifiersFromAccount(value);

  if (!identifiers.length) {
    return null;
  }

  return KOSOVO_BANKS.find((bank) => identifiers.some((code) => bank.ibanCodes.includes(code))) || null;
}

export function isValidSwift(value) {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(value ?? "").trim().toUpperCase());
}

export function maskBankAccount(value) {
  const normalized = normalizeBankAccountIdentifier(value);

  return normalized ? `**** ${normalized.slice(-4)}` : "";
}
