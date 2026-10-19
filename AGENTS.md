<!-- BEGIN:database-storage-rules -->
# Database Storage Rule (CRITICAL & MANDATORY)

**Never use JSON files on disk (`data/*.json`, `trade-store.json`, etc.) to store or manage persistent application data, users, orders, credentials, or state.**
- **PostgreSQL is the sole authoritative system of record** for all business and trade data (`trade_accounts`, `trade_users`, `trade_orders`, `trade_products`, `trade_config`, etc.).
- All reads, writes, mutations, and authentications must query PostgreSQL directly via `lib/trade/trade-pg.js`.
- Never introduce dual-storage or file-mirroring patterns. File-based persistence causes permission issues (`EACCES`), race conditions, data loss across processes, and credential synchronization failures on production.
- Any JSON files on disk must strictly be treated as read-only seeds or optional local dev fallbacks, never the primary store of truth.
<!-- END:database-storage-rules -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
