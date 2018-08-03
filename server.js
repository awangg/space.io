var express = require('express')
var app = express()
var server = require('http').Server(app)
var io = require('socket.io').listen(server)
var port = 8081;

var players = {}
var shield = {
	x: Math.floor(Math.random() * 900) + 50,
	y: Math.floor(Math.random() * 700) + 50
}
var server_bullets = new Array
var isAlive = true

app.use(express.static(__dirname + '/public'))

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html')
})

io.on('connection', function(socket) {
	players[socket.id] = {
		rotation: 0,
		x: Math.floor(Math.random() * 900) + 50,
		y: Math.floor(Math.random() * 700) + 50,
		playerId: socket.id,
		score: 0
	}
	socket.emit('currentPlayers', players)
	socket.broadcast.emit('newPlayer', players[socket.id])

	socket.emit('powerupLocation', shield)

	socket.on('disconnect', function() {
		delete players[socket.id]
		io.emit('disconnect', socket.id)
	})

	socket.on('playerMovement', function(movementData) {
		if(players[socket.id] != undefined) {
			players[socket.id].x = movementData.x
			players[socket.id].y = movementData.y
			players[socket.id].rotation = movementData.rotation
			socket.broadcast.emit('playerMoved', players[socket.id])
		}
	})

	socket.on('powerupCollected', function() {
		shield.x = Math.floor(Math.random() * 900) + 50
		shield.y = Math.floor(Math.random() * 700) + 50
		io.emit('powerupLocation', shield)
	})

	socket.on('shoot-bullet', function(bullet_data) {
		if(players[socket.id] != undefined) {
			var newBullet = bullet_data
			newBullet.id = socket.id
			server_bullets.push(newBullet)
		}
	})

	socket.on('hitPlayer', function() {
		players[socket.id].score++
		socket.emit('updateScore', players[socket.id].score)
	})
})

server.listen(port, function() {
	console.log('Listening on ' + server.address().port)
})

function updateBullets() {
	for(i = 0; i < server_bullets.length; i++) {
		var bull = server_bullets[i]
		if(bull != undefined) {
			bull.x += bull.vx
			bull.y += bull.vy

			Object.keys(players).forEach( function(index) {
				var play = players[index]
				if(bull.id != play.playerId) {
					var distX = bull.x - play.x
					var distY = bull.y - play.y
					if(Math.sqrt(distX * distX + distY * distY) <= 30) {
						io.emit('player-hit', play.playerId)
						server_bullets.splice(i, 1)
						i--
					}
				}
			})

			if(bull.x >= 1000 || bull.x <= 0 || bull.y >= 800 || bull.y <= 0) {
				server_bullets.splice(i, 1)
				i--
			}
		}
	}
	io.emit('bullet-update', server_bullets)
}

setInterval(updateBullets, 16)
