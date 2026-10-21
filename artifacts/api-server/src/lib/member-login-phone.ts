export function memberPhoneVariants(identifier: string): string[] | null {
  if (!/^[+\d\s()-]+$/.test(identifier)) return null;
  let digits = identifier.replace(/\D/g, "");
  if (digits.startsWith("82")) digits = "0" + digits.slice(2);
  if (!/^0\d{8,10}$/.test(digits)) return null;
  return [digits, "82" + digits.slice(1)];
}
