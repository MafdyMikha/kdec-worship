// iOS keyboards shrink the visual viewport without resizing the layout viewport.
export function observePhoneViewport(browser) {
  const viewport = browser.visualViewport
  if (!viewport) return () => {}
  const root = browser.document.documentElement
  let frame
  const update = () => {
    // Pinch zoom must keep its normal browser behavior.
    if (viewport.scale !== 1) return
    root.style.setProperty('--app-height', `${viewport.height}px`)
    root.style.setProperty('--viewport-top', `${viewport.offsetTop}px`)
    const editing = browser.document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')
    root.toggleAttribute('data-keyboard', Boolean(editing && browser.innerHeight - viewport.height > 150))
  }
  const schedule = () => { browser.cancelAnimationFrame(frame); frame = browser.requestAnimationFrame(update) }
  viewport.addEventListener('resize', schedule)
  viewport.addEventListener('scroll', schedule)
  browser.document.addEventListener('focusin', schedule)
  browser.document.addEventListener('focusout', schedule)
  update()
  return () => {
    browser.cancelAnimationFrame(frame)
    viewport.removeEventListener('resize', schedule)
    viewport.removeEventListener('scroll', schedule)
    browser.document.removeEventListener('focusin', schedule)
    browser.document.removeEventListener('focusout', schedule)
  }
}
