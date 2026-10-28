import type { Db } from './db.js'

// Registro de operaciones administrativas relevantes. Nunca guarda datos
// personales del cliente ni secretos; solo qué cambió y quién lo hizo.
export async function audit(
  db: Db,
  entry: { actorId: string; action: string; entity: string; entityId?: string; data?: unknown },
) {
  await db.query('insert into public.audit_log (actor_id, action, entity, entity_id, data) values ($1, $2, $3, $4, $5)', [
    entry.actorId,
    entry.action,
    entry.entity,
    entry.entityId ?? null,
    entry.data === undefined ? null : JSON.stringify(entry.data),
  ])
}
