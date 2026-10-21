import { pool } from "@workspace/db";

/** Count rendered detail GETs, not API reads, HEAD probes or redirects.
 * Raw SQL deliberately leaves updated_at (listing/scheduling metadata) alone.
 */
export async function recordProductView(product: Record<string, unknown>, method: string): Promise<void> {
  const id = Number(product.id);
  if (method !== "GET" || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) return;
  const result = await pool.query<{ view_count: number }>(
    "UPDATE products SET view_count = view_count + 1 WHERE id = $1 RETURNING view_count", [id],
  );
  if (!result.rows[0]) throw new Error("Viewed product no longer exists");
  product.viewCount = result.rows[0].view_count;
}
