-- 1) Add new columns (nullable first for safety on existing rows)
ALTER TABLE "cash_sessions"
    ADD COLUMN "requestContextId" uuid,
ADD COLUMN "closedRequestContextId" uuid;

-- 2) Add foreign keys
ALTER TABLE "cash_sessions"
    ADD CONSTRAINT "cash_sessions_requestContextId_fkey"
        FOREIGN KEY ("requestContextId") REFERENCES "request_contexts"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_sessions"
    ADD CONSTRAINT "cash_sessions_closedRequestContextId_fkey"
        FOREIGN KEY ("closedRequestContextId") REFERENCES "request_contexts"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Optional: backfill requestContextId for existing cash_sessions if any
-- If you already have rows in cash_sessions, you must set requestContextId for them
-- before making it NOT NULL. This is a safe default backfill approach:
--
-- INSERT INTO request_contexts (id, ipAddress, userAgent)
-- SELECT gen_random_uuid(), '127.0.0.1', 'migration-backfill'
-- WHERE NOT EXISTS (SELECT 1 FROM request_contexts WHERE userAgent = 'migration-backfill');
--
-- ...but since request_contexts links to auth_sessions in your schema, backfill properly
-- requires a valid userId. So we keep it nullable until you decide how to backfill.

-- 4) Make requestContextId required for new writes after you confirm no old rows exist:
-- ALTER TABLE "cash_sessions"
-- ALTER COLUMN "requestContextId" SET NOT NULL;