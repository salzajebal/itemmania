type RemovedRecord = { adminDeletedAt?: Date | string | null };

export function canRemoveAdminOrder(order: RemovedRecord & { status: string }): boolean {
  return !order.adminDeletedAt && ["completed", "cancelled"].includes(order.status);
}

export function canHideAdminOrder(order: RemovedRecord & {
  status: string; adminHiddenAt?: Date | string | null;
}): boolean {
  return !!order.adminDeletedAt && !order.adminHiddenAt &&
    ["completed", "cancelled"].includes(order.status);
}

export function canRemoveAdminChat(room: RemovedRecord & { status: string; orderId: number | null }): boolean {
  // Retain the existing ability to clean up orderless inquiries, but never
  // physically delete their messages. Linked completed trades are now allowed.
  return !room.adminDeletedAt && (room.orderId === null || ["ended", "cancelled", "rejected"].includes(room.status));
}

export function canHideAdminChat(room: RemovedRecord & {
  status: string; orderId: number | null; adminHiddenAt?: Date | string | null;
}): boolean {
  return !!room.adminDeletedAt && !room.adminHiddenAt &&
    (room.orderId === null || ["ended", "cancelled", "rejected"].includes(room.status));
}