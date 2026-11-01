try {
  const saved = localStorage.getItem('kdec_theme')
  const dark = saved === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
} catch {
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = 'light'
}

try { document.documentElement.dataset.reduceTransparency=String(localStorage.getItem('kdec_reduce_transparency')==='true') } catch { /* Solid fallbacks remain available via system settings. */ }
