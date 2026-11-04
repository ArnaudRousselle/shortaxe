import { useState } from 'react'
import { useData } from '../data/DataProvider'
import { deleteCategory, saveCategory } from '../lib/api'
import { errorMessage } from '../lib/supabase'
import type { Category } from '../lib/types'
import { CategoryDot, EmptyState, ErrorBanner, Loading, Modal, PageHeader } from '../components/ui'
import { IconPlus } from '../components/Icons'

const PALETTE = ['#16a34a', '#ea580c', '#7c3aed', '#0284c7', '#ca8a04', '#dc2626', '#db2777', '#0d9488', '#9333ea', '#64748b', '#059669', '#4f46e5']

type Draft = { id?: string; name: string; color: string; is_archived: boolean }

export function CategoriesPage() {
  const { categories, loading, error, reload } = useData()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openNew() {
    setFormError(null)
    setDraft({ name: '', color: PALETTE[categories.length % PALETTE.length], is_archived: false })
  }
  function openEdit(c: Category) {
    setFormError(null)
    setDraft({ id: c.id, name: c.name, color: c.color, is_archived: c.is_archived })
  }

  async function onSave() {
    if (!draft) return
    if (!draft.name.trim()) return setFormError('Le nom est obligatoire.')
    setBusy(true)
    try {
      await saveCategory({ ...draft, name: draft.name.trim() })
      setDraft(null)
      await reload()
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!draft?.id) return
    if (!confirm(`Supprimer la catégorie « ${draft.name} » ?`)) return
    setBusy(true)
    try {
      await deleteCategory(draft.id)
      setDraft(null)
      await reload()
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const active = categories.filter((c) => !c.is_archived)
  const archived = categories.filter((c) => c.is_archived)

  const chip = (c: Category) => (
    <button
      key={c.id}
      onClick={() => openEdit(c)}
      className="card flex items-center gap-3 px-4 py-3 text-left hover:border-slate-300"
    >
      <CategoryDot color={c.color} className="h-4 w-4" />
      <span className="truncate font-medium">{c.name}</span>
    </button>
  )

  return (
    <>
      <PageHeader
        title="Catégories"
        actions={
          <button className="btn-primary" onClick={openNew}>
            <IconPlus /> Nouvelle catégorie
          </button>
        }
      />
      <ErrorBanner message={error} />
      {loading ? (
        <Loading />
      ) : categories.length === 0 ? (
        <EmptyState>Aucune catégorie.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{active.map(chip)}</div>
          {archived.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-slate-500">Catégories archivées</h2>
              <div className="grid grid-cols-1 gap-2 opacity-70 sm:grid-cols-2 lg:grid-cols-3">{archived.map(chip)}</div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={draft !== null}
        title={draft?.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft?.id && (
              <button className="btn-danger mr-auto" onClick={onDelete} disabled={busy}>Supprimer</button>
            )}
            <button className="btn-secondary" onClick={() => setDraft(null)}>Annuler</button>
            <button className="btn-primary" onClick={onSave} disabled={busy}>Enregistrer</button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="cat-name">Nom</label>
              <input id="cat-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <span className="label">Couleur</span>
              <div className="flex flex-wrap items-center gap-2">
                {PALETTE.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-label={`Couleur ${p}`}
                    onClick={() => setDraft({ ...draft, color: p })}
                    className={`h-8 w-8 rounded-full ring-offset-2 ${draft.color === p ? 'ring-2 ring-slate-900' : ''}`}
                    style={{ backgroundColor: p }}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Couleur personnalisée"
                  className="h-8 w-10 cursor-pointer rounded border border-slate-300"
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={draft.is_archived} onChange={(e) => setDraft({ ...draft, is_archived: e.target.checked })} />
              Catégorie archivée (n’apparaît plus dans la saisie)
            </label>
            <ErrorBanner message={formError} />
          </div>
        )}
      </Modal>
    </>
  )
}
