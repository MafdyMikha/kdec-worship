export function mergeAuthenticatedProfile(normalizedProfile, authUser) {
  return {
    ...normalizedProfile,
    id:authUser.id,
    personId:authUser.id,
    email:authUser.email || normalizedProfile.email,
  }
}
