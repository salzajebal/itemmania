export function normalizeTradeCharacterName(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("인게임 닉네임은 문자로 입력해주세요.");
  const name = value.trim();
  if (!name) return null;
  if (name.length > 100 || /[\r\n\u0000-\u001f]/.test(name)) {
    throw new Error("인게임 닉네임은 줄바꿈 없이 100자 이내로 입력해주세요.");
  }
  return name;
}

// Legacy registration embedded metadata in descriptions; keep this fallback
// for historical trades without treating new free-form descriptions as input.
export function listingCharacterName(description: string | null | undefined): string | null {
  const matches = [...(description ?? "").matchAll(/^(?:캐릭터명|인게임 닉네임)\s*:\s*([^\r\n]*)$/gm)];
  try {
    return normalizeTradeCharacterName(matches.at(-1)?.[1]);
  } catch {
    return null;
  }
}

export function tradeCharacterNames(
  room: { buyerCharacterName?: string | null; sellerCharacterName?: string | null; characterName?: string | null },
  product?: CharacterListing | null,
) {
  let buyerCharacterName = room.buyerCharacterName ?? null;
  let sellerCharacterName = room.sellerCharacterName ?? null;
  if (product?.category === "sell") {
    buyerCharacterName ??= room.characterName ?? null;
    sellerCharacterName ??= registeredListingName(product);
  } else if (product?.category === "buy") {
    sellerCharacterName ??= room.characterName ?? null;
    // An ordinary chat must not reveal a buy listing's private registration
    // name. An explicit sale application supplies the seller's character name.
    if (sellerCharacterName) buyerCharacterName ??= registeredListingName(product);
  }
  return { buyerCharacterName, sellerCharacterName };
}

export type CharacterListing = {
  category: string | null;
  description: string | null;
  registeredCharacterName?: string | null;
  characterNameInDescription?: boolean;
};

function registeredListingName(product: CharacterListing): string | null {
  if (product.registeredCharacterName) return product.registeredCharacterName;
  if (product.category === "buy" && product.characterNameInDescription === false) return null;
  return listingCharacterName(product.description);
}

/** Public projection only; the original legacy description stays in storage. */
export function publicListingDescription(product: CharacterListing): string | null {
  if (product.category !== "buy" || !product.characterNameInDescription) return product.description;
  return (product.description ?? "").replace(
    /(?:^|\r?\n)(?:캐릭터명|인게임 닉네임)[ \t]*:[ \t]*[^\r\n]*(?:\r?\n)?$/, "",
  ) || null;
}