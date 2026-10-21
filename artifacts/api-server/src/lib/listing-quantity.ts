/** Registration writes explicit quantity metadata; freeform descriptions are not inventory.
 * Legacy imports store the captured quantity in description; preserve that quantity text.
 * Keep this function self-contained: the existing snapshot pages embed it as JavaScript.
 */
export function listingQuantityLabel(product: {
  itemmaniaid?: unknown;
  tid?: unknown;
  sellerId?: unknown;
  description?: unknown;
  quantityLabel?: unknown;
}): string {
  const explicit = typeof product.quantityLabel === "string" ? product.quantityLabel.trim() : "";
  if (explicit && explicit.length <= 80 && !/[<>&"']/.test(explicit)) return explicit;
  const description = typeof product.description === "string" ? product.description.trim() : "";
  const metadata = description.match(/^수량\s*:\s*([^\r\n]+)/);
  if (metadata && metadata[1].length <= 80
    && /^\d[\d,.가-힣A-Za-z\s~～\-–]*$/.test(metadata[1])) return metadata[1].trim();
  const local = /^user_/.test(String(product.itemmaniaid || product.tid || ""))
    || Number(product.sellerId) > 0;
  const captured = description;
  // A numeric upstream listing ID identifies the legacy captured quantity field.
  // Games can use custom currency units: don't replace their valid captured labels.
  const upstream = /^\d+$/.test(String(product.itemmaniaid || product.tid || ""));
  if (upstream && /^\d/.test(captured) && captured.length <= 120 && !/[<>]/.test(captured)) return captured;
  if (local) return "-";
  if (captured === "무제한" || captured === "협의") return captured;
  if (/^\d/.test(captured)
    && /(?:개|억|만|천|백|조|메소|골드|냥|금전|실버|마리|장|대|명|세트|EA|G|K|M)/i.test(captured)
    && /^(?:[\d,\s.~～\-–()/]|개|억|만|천|백|조|메소|골드|냥|금전|실버|마리|장|대|명|세트|당|EA|G|K|M)+$/i.test(captured)) {
    return captured;
  }
  return "-";
}
