/** Quantity is display metadata, not escrow inventory or a price multiplier. */
export function normalizeQuantityLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim();
  if (!label || label.length > 80) return null;
  const match = label.match(/^(\d[\d,]*(?:\.\d+)?)(\s*[가-힣A-Za-z ]*)(?:\s*[~～\-–]\s*(\d[\d,]*(?:\.\d+)?)(\s*[가-힣A-Za-z ]*))?$/);
  if (!match) return null;
  const first = Number(match[1].replace(/,/g, ""));
  const last = match[3] ? Number(match[3].replace(/,/g, "")) : first;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0
    || first > Number.MAX_SAFE_INTEGER || last > Number.MAX_SAFE_INTEGER) return null;
  if (match[3] && match[2].trim() === match[4].trim() && last < first) return null;
  return label;
}

/** This function is embedded into the existing native registration pages. */
export function readRegistrationQuantity(form: { querySelector(selector: string): { value: string } | null }): string | null {
  const value = (form.querySelector('[name=im_registration_quantity]')?.value || "").trim();
  const unit = (form.querySelector('[name=im_registration_unit]')?.value || "").trim();
  if (!value || !unit || !/^[가-힣A-Za-z ]{1,20}$/.test(unit)) return null;
  // Already-unit-bearing ranges are preserved; numeric ranges use the entered unit on both bounds.
  const label = /[가-힣A-Za-z]/.test(value)
    ? value : value.replace(/\d[\d,]*(?:\.\d+)?/g, number => number + unit);
  return normalizeQuantityLabel(label);
}

export function registrationQuantityScript(): string {
  return `<script>(function(){var normalizeQuantityLabel=${normalizeQuantityLabel.toString()};window._im_registration_quantity=${readRegistrationQuantity.toString()};})();</script>`;
}

/** Keep the existing captured registration table, rather than adding a replacement UI. */
export function installRegistrationQuantityInputs(html: string, category: "sell" | "buy"): string {
  const label = category === "buy" ? "구매수량" : "판매수량";
  const row = `<tr class="im-registration-quantity"><th><label for="im_registration_quantity">${label}</label></th><td><input class="g_text" id="im_registration_quantity" name="im_registration_quantity" type="text" value="1" maxlength="60" required aria-label="${label}" style="width:180px" placeholder="예: 5 또는 10 ~ 500"> <input class="g_text" id="im_registration_unit" name="im_registration_unit" type="text" value="개" maxlength="20" required aria-label="수량 단위" style="width:80px" placeholder="단위"><span style="margin-left:8px;color:#777;font-size:12px">수량 / 단위 (개, 만, 억 메소 등)</span></td></tr>`;
  const oldRow = /<tr\b[^>]*>\s*<th\b[^>]*>\s*(?:판매수량|구매수량)\s*<\/th>[\s\S]*?<\/tr>/;
  if (oldRow.test(html)) return html.replace(oldRow, row);
  const priceRow = /<tr\b[^>]*>\s*<th\b[^>]*>\s*(?:판매금액|구매금액)\s*<\/th>/;
  if (!priceRow.test(html)) throw new Error("Registration quantity anchor is missing");
  return html.replace(priceRow, match => row + match);
}
