export const DEMO_ACCOUNTS = Object.freeze({
  admin: Object.freeze({ email:'mafdy@kdec.org', accessLevel:'super_admin' }),
  leader: Object.freeze({ email:'sarah@kdec.org', accessLevel:'leader' }),
  member: Object.freeze({ email:'david@kdec.org', accessLevel:'member' }),
})

export function getDemoAccount(kind) {
  return DEMO_ACCOUNTS[kind] || null
}
