export function shouldReloadAuthProfile(event, activeUserId, sessionUserId) {
  if (!sessionUserId) return false
  if (!['INITIAL_SESSION','SIGNED_IN'].includes(event)) return false
  return !activeUserId || activeUserId !== sessionUserId
}
