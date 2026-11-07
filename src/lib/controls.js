export function normalizeControls(raw) {
  const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.controls) ? raw.controls : []
  return list
    .map((control, index) => ({
      id: String(control.id || `${control.label || 'control'}-${index}`),
      label: String(control.label || 'Control'),
      url: String(control.url || ''),
      icon: control.icon ? String(control.icon) : '',
    }))
    .filter((control) => control.url)
}
