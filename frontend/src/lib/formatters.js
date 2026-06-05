export function formatMoney(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(cents || 0) / 100)
}

export function formatWeight(weight) {
  return `${Number(weight || 0).toLocaleString()} lb`
}
