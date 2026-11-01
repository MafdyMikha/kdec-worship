// Transparent vector interpretation of the selected navy / ivory logo direction.
// Shared geometry keeps website, print and phone icon versions consistent.
import { writeFileSync } from 'node:fs'
const towerBars = Array.from({ length: 8 }, (_, i) => {
  const x = 7 + i * 11, y = 250 - i * 12.5
  return `<path d="M${x} 264V${y}l7-7v${271-y}Z"/><path d="M${240-x} 264V${y}l-7-7v${271-y}Z"/>`
}).join('')
const tower = `<g fill="currentColor">
  <path d="M117.5 0h5v14H134v5h-11.5v95h-5V19H106v-5h11.5Z"/>
  <path fill-rule="evenodd" d="M96 264V126l7-7V63l7-9v63q10-9 20 0V54l7 9v56l7 7v138h-9V193h-7v71h-5V193h-6v71h-5V193h-7v71Zm24-143a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-16 36v28h8v-28a4 4 0 0 0-8 0Zm12 0v28h8v-28a4 4 0 0 0-8 0Zm12 0v28h8v-28a4 4 0 0 0-8 0Z"/>
  <path d="M112 47l3-4v65l-3 1Zm16 0-3-4v65l3 1Z"/>
  ${towerBars}
</g>`
const wordmark = `<g fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="square" stroke-linejoin="miter">
  <path d="M4 292v53m46-53L4 320l48 25M91 292v53h16c40 0 40-53 0-53ZM221 292h-42v53h42m-42-27h36M316 298c-18-16-47-8-53 10-11 30 28 51 53 30"/>
</g>
<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="round" transform="translate(6 0)">
  <path d="m34 361 5 18 7-16 7 16 5-18M76 370c0-13 20-13 20 0s-20 13-20 0ZM115 379v-18h8c12 0 12 9 0 9h-8m9 0 9 9M166 363c-16-9-21 8-7 7 14 0 7 17-7 7M192 361v18m0-9h15m0-9v18M232 361v18M261 379v-18h8c13 0 13 11 0 11h-8"/>
</g>`
const lockup = `<g transform="translate(40)">${tower}</g>${wordmark}`
const svg = (body, viewBox) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" color="#294d62">${body}</svg>\n`
writeFileSync('public/brand/kdec-clean-lockup.svg', svg(lockup, '0 0 320 384'))
writeFileSync('public/brand/kdec-clean-tower.svg', svg(tower, '0 0 240 264'))
writeFileSync('public/brand/kdec-clean-symbols.svg', `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="tower" viewBox="0 0 240 264">${tower}</symbol><symbol id="lockup" viewBox="0 0 320 384">${lockup}</symbol></svg>\n`)
