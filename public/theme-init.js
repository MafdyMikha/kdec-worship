try {
  const saved = localStorage.getItem('kdec_theme')
  const dark = saved === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
} catch {
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = 'light'
}
