// Respect an explicit Arabic preference; new/invalid preferences use English.
export const resolveLanguage = saved => saved === 'ar' ? 'ar' : 'en'
