const EPSILON = 0.0001

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function closestPoint(point, start, end) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared < EPSILON
    ? 0
    : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
  return { x: start.x + dx * t, y: start.y + dy * t }
}

function circleSegmentCollision(circle, start, end) {
  const point = closestPoint(circle, start, end)
  const dx = circle.x - point.x
  const dy = circle.y - point.y
  const distance = Math.hypot(dx, dy)
  if (distance >= circle.radius) return null

  let nx = dx / (distance || 1)
  let ny = dy / (distance || 1)
  if (distance < EPSILON) {
    const length = Math.hypot(end.x - start.x, end.y - start.y) || 1
    nx = -(end.y - start.y) / length
    ny = (end.x - start.x) / length
  }
  return { nx, ny, overlap: circle.radius - distance }
}

function reflect(velocity, normal) {
  let { nx, ny } = normal
  if (velocity.x * nx + velocity.y * ny > 0) {
    nx = -nx
    ny = -ny
  }
  const dot = velocity.x * nx + velocity.y * ny
  return { x: velocity.x - 2 * dot * nx, y: velocity.y - 2 * dot * ny }
}

module.exports = { clamp, closestPoint, circleSegmentCollision, reflect }
