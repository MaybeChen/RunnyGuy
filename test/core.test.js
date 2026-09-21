const test = require('node:test')
const assert = require('node:assert/strict')
const { circleSegmentCollision, reflect } = require('../src/physics')
const { completeLevel } = require('../src/progression')
const { getLevel, LEVEL_COUNT } = require('../src/config')

test('水平运动的狗撞击竖线后反向', () => {
  const hit = circleSegmentCollision({ x: 9, y: 5, radius: 2 }, { x: 10, y: 0 }, { x: 10, y: 10 })
  assert.ok(hit)
  assert.deepEqual(reflect({ x: 30, y: 0 }, hit), { x: -30, y: 0 })
})

test('远离线段时不产生碰撞', () => {
  assert.equal(circleSegmentCollision({ x: 2, y: 5, radius: 2 }, { x: 10, y: 0 }, { x: 10, y: 10 }), null)
})

test('重复通关保留最高星并解锁下一关', () => {
  const first = completeLevel({ unlocked: 0, stars: [] }, 0, 3, LEVEL_COUNT)
  assert.deepEqual(completeLevel(first, 0, 1, LEVEL_COUNT), { unlocked: 1, stars: [3] })
})

test('生成两个犬种各三档的六个关卡', () => {
  assert.equal(LEVEL_COUNT, 6)
  assert.equal(getLevel(0).breed.name, '吉娃娃')
  assert.equal(getLevel(2).count, 3)
  assert.equal(getLevel(3).breed.name, '柯基')
  assert.equal(getLevel(5).count, 3)
})
