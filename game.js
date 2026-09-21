const { RescueGame } = require('./src/game')

const canvas = wx.createCanvas()
const game = new RescueGame(canvas, wx)
game.start()
