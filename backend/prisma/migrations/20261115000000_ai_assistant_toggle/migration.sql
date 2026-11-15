-- Per-restaurant opt-out for the AI assistant.
ALTER TABLE "restaurant_settings"
  ADD COLUMN "ai_assistant_enabled" BOOLEAN NOT NULL DEFAULT true;
