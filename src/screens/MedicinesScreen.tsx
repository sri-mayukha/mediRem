import { useEffect, useState } from 'react'
import { ConfirmationDialog, useToast } from '../components/Dialogs'
import { MedicationCard } from '../components/MedicationCard'
import { MedicationDetails } from '../components/MedicationDetails'
import { EmptyState } from '../components/EmptyState'
import { MedicationForm, emptyFormValue, formValueFrom, type MedFormValue } from '../components/MedicationForm'
import {
  createMedicationWithSchedule,
  getSchedules,
  listMedications,
  removeMedication,
  setMedicationStatus,
  updateMedicationWithSchedule,
} from '../db/medications'
import type { Medication, MedicationStatus } from '../types'

const FILTERS: { id: MedicationStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
]

export function MedicinesScreen({
  tick,
  onChanged,
  externalOpenId,
  onClearExternal,
  addSignal = 0,
}: {
  tick: number
  onChanged: () => void
  externalOpenId: string | null
  onClearExternal: () => void
  addSignal?: number
}) {
  const [filter, setFilter] = useState<MedicationStatus | 'all'>('active')
  const [query, setQuery] = useState('')
  const [meds, setMeds] = useState<Medication[]>([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Medication | null>(null)
  const [selected, setSelected] = useState<Medication | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const toast = useToast()

  const load = async () => {
    const all = await listMedications()
    setMeds(all)
    if (selected) {
      const fresh = all.find((m) => m.id === selected.id) ?? null
      setSelected(fresh)
    }
    if (editing) {
      const fresh = all.find((m) => m.id === editing.id) ?? null
      setEditing(fresh)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  useEffect(() => {
    if (addSignal > 0) {
      setSelected(null)
      setEditing(null)
      setFormError(null)
      setFormKey((k) => k + 1)
      setAdding(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal])

  useEffect(() => {
    if (externalOpenId) {
      listMedications().then((all) => {
        const hit = all.find((m) => m.id === externalOpenId) ?? null
        if (hit) setSelected(hit)
        onClearExternal()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenId])

  const visible = meds.filter((m) => {
    if (filter !== 'all' && m.status !== filter) return false
    if (query) {
      const q = query.toLowerCase()
      if (![m.name, m.genericName ?? '', m.brandName ?? ''].some((f) => f.toLowerCase().includes(q))) return false
    }
    return true
  })

  const saveAdd = async (v: MedFormValue) => {
    setPending(true)
    setFormError(null)
    try {
      await createMedicationWithSchedule(v.med, v.sched)
      setAdding(false)
      toast.show('✓ Medication added')
      onChanged()
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'We couldn\'t save this entry. Your existing data is safe. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const saveEdit = async (v: MedFormValue) => {
    if (!editing) return
    setPending(true)
    setFormError(null)
    try {
      await updateMedicationWithSchedule(editing.id, v.med, v.sched)
      const fresh = (await listMedications()).find((m) => m.id === editing.id) ?? null
      setEditing(null)
      setSelected(fresh)
      toast.show('Medication updated.')
      onChanged()
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'We couldn\'t save this entry. Your existing data is safe. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (adding) {
    return (
      <div className="space-y-4">
        <h1 className="mr-h1">Add medication</h1>
        <MedicationForm key={formKey} initial={emptyFormValue()} pending={pending} error={formError} onSave={saveAdd} onCancel={() => setAdding(false)} />
        {toast.node}
      </div>
    )
  }

  if (editing) {
    return (
      <EditLoader
        med={editing}
        pending={pending}
        error={formError}
        onSave={saveEdit}
        onCancel={() => setEditing(null)}
      />
    )
  }

  if (selected) {
    return (
      <MedicationDetails
        med={selected}
        onClose={() => setSelected(null)}
        onEdit={() => setEditing(selected)}
        onStatus={(s) => void (async () => {
          await setMedicationStatus(selected.id, s)
          toast.show(s === 'paused' ? 'Medication paused.' : s === 'active' ? 'Medication resumed.' : s === 'completed' ? 'Course completed.' : 'Medication archived.')
          onChanged()
          await load()
        })()}
        onRemove={() => void (async () => {
          await removeMedication(selected.id)
          setSelected(null)
          toast.show('Medication removed. History preserved.')
          onChanged()
          await load()
        })()}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="mr-h1">Medicines</h1>
        <button type="button" onClick={() => { setFormError(null); setFormKey((k) => k + 1); setAdding(true) }} className="mr-btn-primary px-5 py-2.5">
          + Add
        </button>
      </div>
      <label className="block">
        <span className="sr-only">Search medications</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search medications…" className="w-full rounded-xl border px-4 py-2.5" style={{ borderColor: 'var(--mr-border)', background: 'var(--mr-surface)' }} />
      </label>
      <div role="group" aria-label="Filter medications" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
            className="rounded-full border px-3.5 py-1.5 text-sm font-semibold"
            style={filter === f.id ? { background: 'var(--mr-primary-deep)', color: '#fff', borderColor: 'transparent' } : { borderColor: 'var(--mr-border)', color: 'var(--mr-muted)' }}>
            {f.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title={meds.length === 0 ? 'No medications yet' : 'Nothing here'}
          body={meds.length === 0 ? 'Add your first medication to start building your schedule.' : 'No medications match this filter.'}
          action={<button type="button" onClick={() => { setFormKey((k) => k + 1); setAdding(true) }} className="mr-btn-primary px-5 py-3">+ Add medication</button>}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((m) => (
            <li key={m.id}>
              <MedicationCard med={m} onOpen={() => setSelected(m)} />
            </li>
          ))}
        </ul>
      )}
      {toast.node}
    </div>
  )
}

function EditLoader({ med, pending, error, onSave, onCancel }: { med: Medication; pending: boolean; error: string | null; onSave: (v: MedFormValue) => void; onCancel: () => void }) {
  const [initial, setInitial] = useState<MedFormValue | null>(null)
  useEffect(() => {
    let alive = true
    getSchedules(med.id).then((rows) => {
      if (alive) setInitial(formValueFrom(med, rows[0]))
    })
    return () => {
      alive = false
    }
  }, [med])
  if (!initial) return <p className="mr-muted">Loading…</p>
  return (
    <div className="space-y-4">
      <h1 className="mr-h1">Edit {med.name}</h1>
      <MedicationForm initial={initial} pending={pending} error={error} onSave={onSave} onCancel={onCancel} />
    </div>
  )
}

export function AddMedicationGate({ children }: { children: (open: () => void) => React.ReactNode }) {
  return <>{children(() => {})}</>
}

export { ConfirmationDialog }
