const { BREEDS, LEVEL_COUNT, getLevel } = require('./config')
const { clamp, circleSegmentCollision, reflect } = require('./physics')
const { STORAGE_KEY, loadProgress, completeLevel } = require('./progression')

const LINE_LIFETIME = 10
const CAPTURE_TIME = 1.2
const MIN_LINE_LENGTH = 18

class RescueGame {
  constructor(canvas, api) {
    this.canvas = canvas
    this.api = api
    const info = api.getSystemInfoSync()
    this.width = info.windowWidth
    this.height = info.windowHeight
    this.dpr = Math.min(info.pixelRatio || 1, 2)
    canvas.width = this.width * this.dpr
    canvas.height = this.height * this.dpr
    this.ctx = canvas.getContext('2d')
    this.ctx.scale(this.dpr, this.dpr)
    this.progress = loadProgress(api)
    this.levelIndex = clamp(this.progress.unlocked, 0, LEVEL_COUNT - 1)
    this.scene = 'menu'
    this.lastTime = 0
    this.bindInput()
  }

  start() {
    const frame = now => {
      const dt = Math.min((now - this.lastTime) / 1000 || 0, 0.034)
      this.lastTime = now
      if (this.scene === 'playing') this.update(dt)
      this.render()
      this.api.requestAnimationFrame(frame)
    }
    this.api.requestAnimationFrame(frame)
  }

  bindInput() {
    this.api.onTouchStart(event => this.pointerDown(event.touches[0]))
    this.api.onTouchMove(event => this.pointerMove(event.touches[0]))
    this.api.onTouchEnd(() => this.pointerUp())
  }

  pointerDown(touch) {
    const point = { x: touch.clientX, y: touch.clientY }
    if (this.scene === 'menu') {
      if (point.y > this.height - 190 && point.y < this.height - 125) this.beginLevel(this.levelIndex)
      else if (point.y > this.height - 115) this.levelIndex = (this.levelIndex + 1) % (this.progress.unlocked + 1)
      return
    }
    if (this.scene === 'result') {
      if (point.y > this.height - 190 && point.y < this.height - 125) {
        this.beginLevel(this.won ? Math.min(this.levelIndex + 1, LEVEL_COUNT - 1) : this.levelIndex)
      } else if (point.y > this.height - 115) this.scene = 'menu'
      return
    }
    if (point.y < 72 || this.energy <= 0) return
    this.touch = { points: [point], length: 0, valid: !this.inSafeZone(point) }
  }

  pointerMove(touch) {
    if (!this.touch || this.scene !== 'playing') return
    const point = { x: touch.clientX, y: touch.clientY }
    const last = this.touch.points[this.touch.points.length - 1]
    const distance = Math.hypot(point.x - last.x, point.y - last.y)
    if (distance < 5) return
    const usable = Math.min(distance, this.energy - this.touch.length)
    if (usable <= 0) return
    const next = {
      x: last.x + (point.x - last.x) * usable / distance,
      y: last.y + (point.y - last.y) * usable / distance
    }
    this.touch.points.push(next)
    this.touch.length += usable
    if (this.inSafeZone(next) || this.dogs.some(dog => !dog.captured && Math.hypot(dog.x - next.x, dog.y - next.y) < dog.radius + 8)) {
      this.touch.valid = false
    }
  }

  pointerUp() {
    if (!this.touch) return
    if (this.touch.valid && this.touch.length >= MIN_LINE_LENGTH) {
      this.lines.push({ points: this.touch.points, age: 0 })
      this.energy -= this.touch.length
    }
    this.touch = null
  }

  inSafeZone(point) {
    return Math.hypot(point.x - this.safe.x, point.y - this.safe.y) < this.safe.radius + 10
  }

  beginLevel(index) {
    this.levelIndex = index
    this.level = getLevel(index)
    this.timeLeft = this.level.time
    this.energy = this.level.energy
    this.lines = []
    this.safe = { x: this.width / 2, y: this.height * 0.48, radius: 54 }
    this.dogs = Array.from({ length: this.level.count }, (_, i) => this.createDog(i))
    this.won = false
    this.scene = 'playing'
  }

  createDog(index) {
    const angle = index / this.level.count * Math.PI * 2 - Math.PI / 2 + 0.45
    const distance = Math.min(this.width, this.height) * 0.3
    const speed = this.level.breed.speed * (this.level.count === 1 ? 1 : 0.9)
    const direction = angle + 0.7
    return {
      x: this.safe.x + Math.cos(angle) * distance,
      y: this.safe.y + Math.sin(angle) * distance,
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      radius: this.level.breed.radius,
      capture: 0,
      captured: false,
      collisionCooldown: 0,
      turnIn: 2.4 + index * 0.7,
      warning: 0
    }
  }

  update(dt) {
    this.timeLeft -= dt
    this.lines.forEach(line => { line.age += dt })
    this.lines = this.lines.filter(line => line.age < LINE_LIFETIME)
    this.dogs.forEach(dog => this.updateDog(dog, dt))

    if (this.dogs.every(dog => dog.captured)) return this.finish(true)
    const escaped = this.dogs.some(dog => !dog.captured && (
      dog.x + dog.radius < 0 || dog.x - dog.radius > this.width ||
      dog.y + dog.radius < 70 || dog.y - dog.radius > this.height
    ))
    if (escaped || this.timeLeft <= 0) this.finish(false)
  }

  updateDog(dog, dt) {
    if (dog.captured) return
    dog.collisionCooldown = Math.max(0, dog.collisionCooldown - dt)
    dog.turnIn -= dt
    if (dog.turnIn < 0.55 && dog.warning === 0) dog.warning = 0.55
    if (dog.turnIn <= 0) {
      const angle = Math.atan2(dog.vy, dog.vx) + (Math.random() - 0.5) * 1.2
      const speed = Math.hypot(dog.vx, dog.vy)
      dog.vx = Math.cos(angle) * speed
      dog.vy = Math.sin(angle) * speed
      dog.turnIn = 2.6 + Math.random() * 2.5
      dog.warning = 0
    }
    dog.warning = Math.max(0, dog.warning - dt)
    dog.x += dog.vx * dt
    dog.y += dog.vy * dt
    if (!dog.collisionCooldown) this.collideLines(dog)

    const inside = Math.hypot(dog.x - this.safe.x, dog.y - this.safe.y) + dog.radius <= this.safe.radius
    dog.capture = inside ? dog.capture + dt : 0
    if (dog.capture >= CAPTURE_TIME) dog.captured = true
  }

  collideLines(dog) {
    for (const line of this.lines) {
      for (let i = 1; i < line.points.length; i += 1) {
        const hit = circleSegmentCollision(dog, line.points[i - 1], line.points[i])
        if (!hit) continue
        const velocity = reflect({ x: dog.vx, y: dog.vy }, hit)
        dog.vx = velocity.x
        dog.vy = velocity.y
        dog.x += hit.nx * (hit.overlap + 2)
        dog.y += hit.ny * (hit.overlap + 2)
        dog.collisionCooldown = 0.08
        return
      }
    }
  }

  finish(won) {
    if (this.scene !== 'playing') return
    this.won = won
    this.scene = 'result'
    if (!won) return
    const elapsed = this.level.time - Math.max(0, this.timeLeft)
    this.stars = 1
    if (elapsed <= this.level.targetTime) this.stars += 1
    if (elapsed <= this.level.targetTime && this.energy >= this.level.energy * 0.2) this.stars += 1
    this.progress = completeLevel(this.progress, this.levelIndex, this.stars, LEVEL_COUNT)
    try {
      this.api.setStorageSync(STORAGE_KEY, this.progress)
    } catch (_) {
      // Finishing a level must still work when storage is full or unavailable.
    }
  }

  render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height)
    gradient.addColorStop(0, '#d9f5e8')
    gradient.addColorStop(1, '#fff5d6')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, this.width, this.height)
    if (this.scene === 'menu') return this.drawMenu()
    this.drawField()
    if (this.scene === 'result') this.drawResult()
  }

  drawMenu() {
    const ctx = this.ctx
    this.centerText('抓捕狗狗', 62, 30, '#24564a')
    this.centerText('画出能量带，把狗狗安全带回家', 100, 15, '#52736a')
    ctx.fillStyle = '#ffffffcc'
    this.roundRect(32, 138, this.width - 64, 270, 24)
    ctx.fill()
    this.drawHero(this.width / 2, 235)
    const level = getLevel(this.levelIndex)
    this.centerText(`狗狗侠 · ${level.breed.suit}`, 330, 19, '#24564a')
    this.centerText(`第 ${this.levelIndex + 1} 关  ${level.breed.name} × ${level.count}`, 374, 18, '#80552f')
    this.button(this.height - 190, '开始巡逻', '#ff8c42')
    this.button(this.height - 115, `选择关卡  ${this.levelIndex + 1}/${this.progress.unlocked + 1}`, '#3a8d78')
  }

  drawHero(x, y) {
    const ctx = this.ctx
    ctx.fillStyle = '#ff8c42'
    ctx.beginPath(); ctx.arc(x, y - 24, 30, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#367fbe'
    this.roundRect(x - 40, y + 4, 80, 64, 20); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(x - 11, y - 27, 5, 0, Math.PI * 2); ctx.arc(x + 11, y - 27, 5, 0, Math.PI * 2); ctx.fill()
    this.centerText('★', y + 47, 25, '#ffd35a', x)
  }

  drawField() {
    const ctx = this.ctx
    ctx.fillStyle = '#24564a'; ctx.fillRect(0, 0, this.width, 70)
    ctx.textAlign = 'left'; ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#fff'
    ctx.fillText(`时间 ${Math.ceil(Math.max(0, this.timeLeft))}`, 18, 30)
    ctx.fillText(`待救 ${this.dogs.filter(dog => !dog.captured).length}`, 18, 55)
    ctx.textAlign = 'right'; ctx.fillText(`能量 ${Math.ceil(Math.max(0, this.energy))}`, this.width - 18, 30)
    ctx.fillStyle = '#ffffff55'; ctx.fillRect(this.width - 125, 43, 107, 9)
    ctx.fillStyle = '#ffd35a'; ctx.fillRect(this.width - 125, 43, 107 * Math.max(0, this.energy / this.level.energy), 9)
    ctx.strokeStyle = '#eb7356'; ctx.lineWidth = 5; ctx.strokeRect(2, 72, this.width - 4, this.height - 74)

    ctx.beginPath(); ctx.arc(this.safe.x, this.safe.y, this.safe.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#70d6b588'; ctx.fill(); ctx.strokeStyle = '#319b7c'; ctx.setLineDash([8, 7]); ctx.stroke(); ctx.setLineDash([])
    this.centerText('安心圈', this.safe.y + 5, 14, '#246c5a')
    this.lines.forEach(line => this.drawLine(line.points, '#5a8cff', Math.max(0.2, 1 - line.age / LINE_LIFETIME)))
    if (this.touch) this.drawLine(this.touch.points, this.touch.valid ? '#5a8cff' : '#e55252', 0.75)
    this.dogs.forEach(dog => this.drawDog(dog))
  }

  drawDog(dog) {
    if (dog.captured) return
    const ctx = this.ctx
    ctx.save()
    ctx.translate(dog.x, dog.y)
    ctx.rotate(Math.atan2(dog.vy, dog.vx) + Math.PI / 2)
    ctx.fillStyle = this.level.breed.color
    ctx.beginPath(); ctx.arc(0, 0, dog.radius, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-dog.radius, -5); ctx.lineTo(-dog.radius * 1.25, -dog.radius * 1.25); ctx.lineTo(-3, -dog.radius); ctx.fill()
    ctx.beginPath(); ctx.moveTo(dog.radius, -5); ctx.lineTo(dog.radius * 1.25, -dog.radius * 1.25); ctx.lineTo(3, -dog.radius); ctx.fill()
    ctx.fillStyle = '#3d2b22'
    ctx.beginPath(); ctx.arc(-dog.radius * 0.38, -2, 2, 0, Math.PI * 2); ctx.arc(dog.radius * 0.38, -2, 2, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    if (dog.warning > 0) this.centerText('!', dog.y - dog.radius - 12, 20, '#e6503e', dog.x)
    if (dog.capture > 0) {
      ctx.fillStyle = '#fff'; ctx.fillRect(dog.x - 20, dog.y + dog.radius + 7, 40, 5)
      ctx.fillStyle = '#ff9f43'; ctx.fillRect(dog.x - 20, dog.y + dog.radius + 7, 40 * clamp(dog.capture / CAPTURE_TIME, 0, 1), 5)
    }
  }

  drawLine(points, color, alpha) {
    if (points.length < 2) return
    const ctx = this.ctx
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y)
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y))
    ctx.stroke(); ctx.restore()
  }

  drawResult() {
    const ctx = this.ctx
    ctx.fillStyle = '#183c35cc'; ctx.fillRect(0, 70, this.width, this.height - 70)
    ctx.fillStyle = '#fff'; this.roundRect(28, 140, this.width - 56, 260, 24); ctx.fill()
    this.centerText(this.won ? '安全带回！' : '狗狗跑远了', 195, 28, this.won ? '#319b7c' : '#dc5d4b')
    this.centerText(this.won ? '★'.repeat(this.stars) + '☆'.repeat(3 - this.stars) : '再试一次，你一定可以', 250, 34, '#ffb629')
    this.centerText(this.won ? `剩余能量 ${Math.ceil(this.energy)} · 全部获救` : '调整障碍角度，别忘了守住边缘', 302, 16, '#596b67')
    this.button(this.height - 190, this.won ? '下一关' : '立即重试', '#ff8c42')
    this.button(this.height - 115, '返回主页', '#3a8d78')
  }

  roundRect(x, y, width, height, radius) {
    const ctx = this.ctx
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius)
    ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius)
    ctx.arcTo(x, y, x + width, y, radius); ctx.closePath()
  }

  button(y, label, color) {
    const ctx = this.ctx
    ctx.fillStyle = color; this.roundRect(44, y, this.width - 88, 58, 18); ctx.fill()
    this.centerText(label, y + 36, 20, '#fff')
  }

  centerText(text, y, size, color, x = this.width / 2) {
    const ctx = this.ctx
    ctx.textAlign = 'center'; ctx.font = `bold ${size}px sans-serif`; ctx.fillStyle = color; ctx.fillText(text, x, y)
  }
}

module.exports = { RescueGame }
