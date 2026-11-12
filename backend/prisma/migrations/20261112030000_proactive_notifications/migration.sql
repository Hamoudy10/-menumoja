-- Phase C: deterministic proactive alerts.
-- New notification types used by the proactive detectors. Enum additions live
-- in their own migration (PostgreSQL ADD VALUE visibility rules).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_WAITING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_BRIEFING';
