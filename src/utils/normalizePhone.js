export function normalizePhone(phone) {
  if (!phone) return null;
  // Z-API costuma aceitar dígitos sem "+" em E.164
  const digits = String(phone).replace(/\D/g, "");
  return digits.length ? digits : null;
}