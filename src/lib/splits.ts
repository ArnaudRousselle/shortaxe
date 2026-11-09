import { formatEuro, parseEuroToCents } from './format'

export type SplitRow = { key: number; categoryId: string; value: string }

type SplitResult = { splits: { categoryId: string; cents: number }[]; error: string | null; remaining: number }

/**
 * Calcule la ventilation en centimes (valeurs absolues), à partir de montants saisis en euros.
 * `remaining` = reste à répartir en centimes, toujours calculé pour l'affichage.
 * `error` est renseigné tant que la ventilation est incomplète ou incohérente.
 */
export function computeSplits(totalCents: number, rows: SplitRow[]): SplitResult {
  if (rows.length === 0) return { splits: [], error: null, remaining: 0 }

  const missingCategory = rows.some((r) => !r.categoryId)
  const ids = rows.map((r) => r.categoryId).filter(Boolean)
  const duplicate = new Set(ids).size !== ids.length
  const categoryError = missingCategory
    ? 'Choisis une catégorie pour chaque ligne de ventilation.'
    : duplicate
      ? 'Une même catégorie apparaît deux fois.'
      : null

  if (rows.length === 1) {
    return { splits: [{ categoryId: rows[0].categoryId, cents: totalCents }], error: categoryError, remaining: 0 }
  }

  const values = rows.map((r) => (r.value.trim() === '' ? 0 : parseEuroToCents(r.value)))
  if (values.some((v) => v === null || v < 0)) {
    return { splits: [], error: 'Un montant de ventilation est invalide.', remaining: 0 }
  }
  const cents = values as number[]
  const remaining = totalCents - cents.reduce((s, v) => s + v, 0)

  let error = categoryError
  if (!error && remaining !== 0) {
    error = `La ventilation doit égaler le montant (reste ${formatEuro(remaining / 100)}).`
  }
  if (!error && cents.some((v) => v === 0)) error = 'Chaque catégorie doit recevoir un montant non nul.'
  if (error) return { splits: [], error, remaining }

  return { splits: rows.map((r, i) => ({ categoryId: r.categoryId, cents: cents[i] })), error: null, remaining: 0 }
}
