import { useState } from 'react'
import type { EntityConfig } from './config'
import { archiveBlocker, deleteBlocker, getState, removeRecord, setActive } from './store'
import { toast } from './toast'
import type { Rec } from './types'
import { BlockedDialog, ConfirmDialog } from './ui'

type Pending = { kind: 'archive' | 'delete' | 'blocked'; rec: Rec; reason?: string; verb?: string } | null

/** Shared Archive / Restore / Delete flow (with confirmation + guard dialogs) for list and detail screens. */
export function useRecordActions(cfg: EntityConfig, onDeleted?: () => void) {
  const [pending, setPending] = useState<Pending>(null)
  const name = (r: Rec) => cfg.nameOf(r, getState())

  const requestArchive = (rec: Rec) => {
    const reason = archiveBlocker(cfg.key, rec, getState())
    setPending(reason ? { kind: 'blocked', rec, reason, verb: 'archive' } : { kind: 'archive', rec })
  }
  const restore = (rec: Rec) => {
    setActive(cfg.key, rec.id, true)
    toast(`${cfg.singular} "${name(rec)}" restored.`)
  }
  const requestDelete = (rec: Rec) => {
    const reason = deleteBlocker(cfg.key, rec, getState())
    setPending(reason ? { kind: 'blocked', rec, reason, verb: 'delete' } : { kind: 'delete', rec })
  }
  const close = () => setPending(null)

  const dialogs = (
    <>
      <ConfirmDialog
        open={pending?.kind === 'archive'} tone="warning" confirmLabel="Archive"
        title={`Archive ${cfg.singular.toLowerCase()}?`}
        message={<>"{pending ? name(pending.rec) : ''}" will be hidden from selection lists and default views. You can restore it any time from the Archived filter.</>}
        onCancel={close}
        onConfirm={() => { if (!pending) return; setActive(cfg.key, pending.rec.id, false); toast(`${cfg.singular} "${name(pending.rec)}" archived.`); close() }}
      />
      <ConfirmDialog
        open={pending?.kind === 'delete'} tone="danger" confirmLabel="Delete"
        title={`Delete ${cfg.singular.toLowerCase()}?`}
        message={<>"{pending ? name(pending.rec) : ''}" will be permanently deleted. This cannot be undone. Archive it instead if you only want to hide it.</>}
        onCancel={close}
        onConfirm={() => { if (!pending) return; removeRecord(cfg.key, pending.rec.id); toast(`${cfg.singular} "${name(pending.rec)}" deleted.`); close(); onDeleted?.() }}
      />
      <BlockedDialog
        open={pending?.kind === 'blocked'} onClose={close}
        title={`Cannot ${pending?.verb ?? 'complete'} ${cfg.singular.toLowerCase()}`}
        message={pending?.reason}
      />
    </>
  )
  return { requestArchive, restore, requestDelete, dialogs }
}
