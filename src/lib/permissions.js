import { MINISTRY_ROLES, canEvaluate, ministryRoleNames } from './ministry.js'

export const ACCESS_LEVELS = ['super_admin','admin','leader','member']

export const ACCESS_LEVEL_LABELS = {
  super_admin:{ en:'Super Admin', ar:'مسؤول أعلى' },
  admin:{ en:'Admin', ar:'مسؤول' },
  leader:{ en:'Leader', ar:'قائد' },
  member:{ en:'Member', ar:'عضو' },
}

export const SYSTEM_PERMISSIONS = [
  'users.view','users.create','users.edit','users.delete','roles.manage',
  'permissions.manage','services.view','services.create','services.edit','services.delete',
  'songs.manage','schedules.manage','events.manage','announcements.manage',
  'invitations.manage','reports.view','settings.manage',
  'ratings.view','ratings.musician','ratings.vocal','ratings.leader','ratings.configure','reports.own',
]

export const ADMIN_CONTROL_PERMISSIONS = [
  'users.edit','roles.manage','permissions.manage',
  'invitations.manage','settings.manage',
]

const DEFAULT_ACCESS_PERMISSIONS = {
  super_admin:['*'],
  admin:SYSTEM_PERMISSIONS.filter(permission=>!['permissions.manage','ratings.configure','reports.own'].includes(permission)),
  leader:['users.view','services.view','services.create','services.edit','songs.manage','schedules.manage','events.manage','announcements.manage'],
  member:['services.view'],
}

export function getUserRoles(user) {
  if (Array.isArray(user?.roleAssignments) && user.roleAssignments.length > 0) {
    return user.roleAssignments
      .map(assignment=>assignment.worshipRole?.name || assignment.role?.name || assignment.name)
      .filter(Boolean)
  }
  if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles
  return user?.role ? [user.role] : []
}

export function getAccessLevel(user) {
  if (ACCESS_LEVELS.includes(user?.accessLevel)) return user.accessLevel
  if (ACCESS_LEVELS.includes(user?.access_level)) return user.access_level
  if (user?.isAdmin || user?.is_admin) return 'admin'
  return String(user?.position||'').toLowerCase()==='leader' ? 'leader' : 'member'
}

export function getAccessLevelLabel(user, language = 'en') {
  const level=getAccessLevel(user)
  return ACCESS_LEVEL_LABELS[level]?.[language==='ar'?'ar':'en'] || level
}

export function isSuperAdminUser(user) {
  return getAccessLevel(user)==='super_admin'
}

export function isAdminUser(user) {
  return ['super_admin','admin'].includes(getAccessLevel(user))
}

export function hasPermission(user, permission) {
  if (!user || user.status!=='active') return false
  if(permission==='evaluations.manage')return canEvaluate(user)
  if(ministryRoleNames(user).some(role=>MINISTRY_ROLES[role]?.permissions.includes(permission)))return true
  const assigned=Array.isArray(user.permissions) ? user.permissions : DEFAULT_ACCESS_PERMISSIONS[getAccessLevel(user)] || []
  return assigned.includes('*') || assigned.includes(permission)
}

export function hasAnyPermission(user, permissions) {
  return Array.isArray(permissions) && permissions.some(permission=>hasPermission(user,permission))
}

export function canAccessAdminControl(user) {
  return hasAnyPermission(user, ADMIN_CONTROL_PERMISSIONS)
}

export function canManageWorship(user) {
  return hasPermission(user,'services.edit')
}

export function canManageRoles(user) {
  return hasPermission(user,'roles.manage')
}

export function normalizeRoleName(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en')
}
