/**
 * Quy tắc hiển thị gói qua API — giữ khớp với query `getActiveSubscriptionByUserId`
 * (`is_active` và `expires_at` so với thời điểm hiện tại, UTC trên DB).
 */
export function isRevenueCatRowActiveForApi(
  isActive: boolean,
  expiresAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!isActive) return false;
  if (expiresAt == null) return true;
  return expiresAt.getTime() > now.getTime();
}

export function isManualPlanActiveForApi(
  manualPlanIsActive: boolean | null | undefined,
  manualPlanExpiresAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!manualPlanIsActive) return false;
  if (manualPlanExpiresAt == null) return true;
  return manualPlanExpiresAt.getTime() > now.getTime();
}
