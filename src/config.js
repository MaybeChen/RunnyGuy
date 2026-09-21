const BREEDS = [
  { name: '吉娃娃', color: '#f6c76b', speed: 82, radius: 13, suit: '大耳通讯器' },
  { name: '柯基', color: '#e99145', speed: 106, radius: 17, suit: '橙白短斗篷' }
]

const DIFFICULTIES = [
  { count: 1, time: 45, energy: 100, targetTime: 30 },
  { count: 2, time: 60, energy: 140, targetTime: 45 },
  { count: 3, time: 75, energy: 180, targetTime: 60 }
]

const LEVEL_COUNT = BREEDS.length * DIFFICULTIES.length

function getLevel(index) {
  const breedIndex = Math.floor(index / DIFFICULTIES.length)
  const difficulty = index % DIFFICULTIES.length
  if (!BREEDS[breedIndex]) return null
  return { index, breedIndex, difficulty, breed: BREEDS[breedIndex], ...DIFFICULTIES[difficulty] }
}

module.exports = { BREEDS, DIFFICULTIES, LEVEL_COUNT, getLevel }
