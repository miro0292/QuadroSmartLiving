export function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function monthToDateString(month) {
  if (!month) {
    return null
  }

  return `${month}-01`
}

export function dateToMonth(dateString) {
  if (!dateString) {
    return ''
  }

  return dateString.slice(0, 7)
}
