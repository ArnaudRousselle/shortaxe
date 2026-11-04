import { formatEuro, parseEuroToCents, parsePercent } from './format'

export type SplitMode = 'pct' | 'eur'
export type SplitRow = { key: number; categoryId: string; value: string }

export function formatPct(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

type SplitResult = { splits: { categoryId: string; cents: number }[]; error: string | null; remaining: number }

/**
 * Calcule la ventilation en centimes (valeurs absolues).
 * `remaining` = reste à répartir (en % ou en centimes selon le mode), toujours calculé pour l'affichage.
 * `error` est renseigné tant que la ventilation est incomplète ou incohérente.
 */
export function computeSplits(totalCents: number, rows: SplitRow[], mode: SplitMode): SplitResult {
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

  const empty = (v: string) => v.trim() === ''
  const values =
    mode === 'pct'
      ? rows.map((r) => (empty(r.value) ? 0 : parsePercent(r.value)))
      : rows.map((r) => (empty(r.value) ? 0 : parseEuroToCents(r.value)))
  if (values.some((v) => v === null || v < 0)) {
    return { splits: [], error: mode === 'pct' ? 'Un pourcentage est invalide.' : 'Un montant de ventilation est invalide.', remaining: 0 }
  }
  const nums = values as number[]
  const sum = nums.reduce((s, v) => s + v, 0)
  const remaining = mode === 'pct' ? Math.round((100 - sum) * 100) / 100 : totalCents - sum

  let error = categoryError
  if (!error && Math.abs(remaining) > 0.001) {
    error =
      mode === 'pct'
        ? `La somme des pourcentages doit faire 100 % (reste ${formatPct(remaining)} %).`
        : `La ventilation doit égaler le montant (reste ${formatEuro(remaining / 100)}).`
  }
  if (!error && nums.some((v) => v === 0)) error = 'Chaque catégorie doit recevoir une part non nulle.'
  if (error) return { splits: [], error, remaining }

  if (mode === 'eur') {
    return { splits: rows.map((r, i) => ({ categoryId: r.categoryId, cents: nums[i] })), error: null, remaining: 0 }
  }
  // Pourcentages → centimes ; la dernière ligne absorbe l'arrondi
  let allocated = 0
  const splits = rows.map((r, i) => {
    const cents = i === rows.length - 1 ? totalCents - allocated : Math.round((totalCents * nums[i]) / 100)
    allocated += cents
    return { categoryId: r.categoryId, cents }
  })
  return { splits, error: null, remaining: 0 }
}
