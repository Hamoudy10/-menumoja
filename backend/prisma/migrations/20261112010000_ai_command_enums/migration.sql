-- AI command layer: new enum values.
-- Kept in its own migration so the new values are committed before any
-- migration/seed uses them (PostgreSQL enum ADD VALUE visibility rules).
ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'MANAGER_COMMAND';
ALTER TYPE "AiActionStatus" ADD VALUE IF NOT EXISTS 'UNDONE';
