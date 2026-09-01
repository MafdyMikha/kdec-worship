import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'))
const headers=Object.fromEntries(config.headers[0].headers.map(header=>[header.key,header.value]))

test('production deployment sends baseline browser security headers',()=>{
  for(const name of ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy']) assert.ok(headers[name],name)
  assert.match(headers['Content-Security-Policy'],/frame-ancestors 'none'/)
  assert.match(headers['Content-Security-Policy'],/script-src 'self'/)
  assert.doesNotMatch(headers['Content-Security-Policy'],/script-src[^;]*'unsafe-inline'/)
})
