// Only member-created listings carry a local owner. Imported seller names/IDs
// are identifiers on a different site and cannot establish local account ownership.
export function localProductSellerId(product: { itemmaniaid: string; sellerId: number | null }): number | null {
  return /^user_\d+_[a-z0-9]+$/.test(product.itemmaniaid) &&
    product.sellerId !== null && Number.isSafeInteger(product.sellerId) && product.sellerId > 0
    ? product.sellerId
    : null;
}