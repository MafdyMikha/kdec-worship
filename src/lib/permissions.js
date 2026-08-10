export function getUserRoles(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles
  return user?.role ? [user.role] : []
}

export function isAdminUser(user) {
  return Boolean(user?.isAdmin || user?.is_admin)
}

export function canManageWorship(user) {
  const roles = getUserRoles(user)
  return isAdminUser(user) || roles.some(role => ['Worship Leader', 'Music Director'].includes(role))
}

