export function exceptionTone(exceptions = []) {
  if (exceptions.some((exception) => exception.severity === 'critical')) return '#b4502a'
  if (exceptions.length > 0) return '#d69a1c'
  return '#2e8f6d'
}
