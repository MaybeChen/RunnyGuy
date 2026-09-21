const STORAGE_KEY = 'dog-rescue-progress-v1'

function loadProgress(api) {
  try {
    const saved = api.getStorageSync(STORAGE_KEY)
    if (saved && Array.isArray(saved.stars)) return saved
  } catch (_) {
    // Storage may be unavailable in development; a fresh local state is safe.
  }
  return { unlocked: 0, stars: [] }
}

function completeLevel(progress, levelIndex, stars, levelCount) {
  const next = { unlocked: progress.unlocked, stars: progress.stars.slice() }
  next.stars[levelIndex] = Math.max(next.stars[levelIndex] || 0, stars)
  next.unlocked = Math.max(next.unlocked, Math.min(levelIndex + 1, levelCount - 1))
  return next
}

module.exports = { STORAGE_KEY, loadProgress, completeLevel }
