var wid = 1000
var hei = 800
var shot = false
var bullets = new Array

var config = {
	type: Phaser.AUTO,
	parent: 'phaser-example',
	width: wid,
	height: hei,
	physics: {
		default: 'arcade',
		arcade: {
			debug: false,
			gravity: { y: 0 }
		}
	},
	scene: {
		preload: preload,
		create: create,
		update: update
	}
}

var game = new Phaser.Game(config)

function preload() {
	for(i = 1; i <= 16; i++) {
		this.load.image('ship' + i, '/assets/Player/ship' + i + '.png')
	}
	this.load.image('powerup', '/assets/Power-ups/bolt_gold.png')
	this.load.image('laser', '/assets/Lasers/laserBlue08.png')
}

function create() {
	this.socket = io()
	var self = this
	this.otherPlayers = this.physics.add.group()
	
	this.socket.on('currentPlayers', function(players) {
		Object.keys(players).forEach( function(id) {
			if(players[id].playerId === self.socket.id) {
				addPlayer(self, players[id])
			}else {
				addOtherPlayer(self, players[id])
			}
		})
	})
	
	this.socket.on('newPlayer', function(playerInfo) {
		addOtherPlayer(self, playerInfo)
	})
	
	this.socket.on('disconnect', function(playerId) {
		self.otherPlayers.getChildren().forEach( function(otherPlayer) {
			if(playerId === otherPlayer.playerId) {
				otherPlayer.destroy()
			}
		})
	})
	
	this.socket.on('playerMoved', function(playerInfo) {
		self.otherPlayers.getChildren().forEach( function(otherPlayer) {
			if(playerInfo.playerId === otherPlayer.playerId) {
				otherPlayer.setRotation(playerInfo.rotation)
				otherPlayer.setPosition(playerInfo.x, playerInfo.y)
			}
		})
	})
	
	this.cursors = this.input.keyboard.createCursorKeys()
	this.shootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z)

	this.fuelCount = this.add.text(16, 16, '', {fontSize: '32px', fill: '#FFFFFF'}).setText('Fuel: 50')
	this.score = this.add.text(16, 50, '', {fontSize: '32px', fill: '#FFFFFF'}).setText('Hits: 0')
	
	this.socket.on('powerupLocation', function(powerupLoc) {
		if(self.powerup) self.powerup.destroy()
		self.powerup = self.physics.add.image(powerupLoc.x, powerupLoc.y, 'powerup')
		self.physics.add.overlap(self.ship, self.powerup, function() {
			self.ship.fuel += 50
			this.fuelCount.setText('Fuel: ' + this.ship.fuel)
			this.socket.emit('powerupCollected')
		}, null, self)
	})
	
	this.socket.on('bullet-update', function(server_bullets) {
		for(i = 0; i < server_bullets.length; i++) {
			if(bullets[i] == undefined) {
				bullets[i] = self.add.sprite(server_bullets[i].x, server_bullets[i].y, 'laser').setOrigin(0.5, 0.5).setDisplaySize(10, 12)
			}else {
				bullets[i].x = server_bullets[i].x
				bullets[i].y = server_bullets[i].y
			}
		}
		
		for(i = server_bullets.length; i < bullets.length; i++) {
			bullets[i].destroy()
			bullets.splice(i, 1)
			i--
		}
	})
	
	this.socket.on('player-hit', function(targetId) {
		self.otherPlayers.getChildren().forEach( function(otherPlayer) {
			if(otherPlayer.playerId == targetId) {
				otherPlayer.setTint(getRandomColor())
				self.socket.emit('hitPlayer')
			}
		})
	})
	
	this.socket.on('updateScore', function(newScore) {
		self.score.setText('Hits: ' + newScore)
	})
}

function addPlayer(self, playerInfo) {
	var imgVal = Math.floor(Math.random() * 12) + 1
	self.ship = self.physics.add.image(playerInfo.x, playerInfo.y, 'ship' + imgVal).setOrigin(0.5, 0.5).setDisplaySize(53, 40)
	self.ship.health = playerInfo.health
	self.ship.fuel = 50
	self.ship.setTint(0x00ff00)
	self.ship.setDrag(100)
	self.ship.setAngularVelocity(100)
	self.ship.setMaxVelocity(150)
}

function addOtherPlayer(self, playerInfo) {
	var imgVal = Math.floor(Math.random() * 12) + 1
	const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'ship' + imgVal).setOrigin(0.5, 0.5).setDisplaySize(53, 40)
	otherPlayer.playerId = playerInfo.playerId
	otherPlayer.health = playerInfo.health
	self.otherPlayers.add(otherPlayer)
}

function update() {
	var self = this
	
	if(this.ship) {
		if(this.cursors.left.isDown) {
			this.ship.setAngularVelocity(-150)
		}else if(this.cursors.right.isDown) {
			this.ship.setAngularVelocity(150)
		}else {
			this.ship.setAngularVelocity(0)
		}
		
		if(this.cursors.up.isDown) {
			this.physics.velocityFromRotation(this.ship.rotation - Math.PI/2, 100, this.ship.body.acceleration)
		}else {
			this.ship.setAcceleration(0)
		}
		
		if(this.cursors.space.isDown && this.ship.fuel > 0) {
			this.ship.setMaxVelocity(Number.MAX_VALUE)
			this.physics.velocityFromRotation(this.ship.rotation - Math.PI/2, 10000, this.ship.body.acceleration)
			this.ship.fuel -= 1
			this.fuelCount.setText('Fuel: ' + this.ship.fuel)
		}else {
			this.ship.setMaxVelocity(150)
		}
		
		if(this.ship.x + 53 < 0 && this.ship.x + 53 > -1000) {
			this.ship.x = wid
		}else if(this.ship.x > wid && this.ship.x < wid + 1000) {
			this.ship.x = 0
		}
		
		if(this.ship.y + 40 < 0 && this.ship.y + 40 > -1000) {
			this.ship.y = hei
		}else if(this.ship.y > hei && this.ship.y < hei + 1000) {
			this.ship.y = 0
		}
		
		var x = this.ship.x
		var y = this.ship.y
		var r = this.ship.rotation
		if(this.ship.oldPosition && (x !== this.ship.oldPosition.x || y !== this.ship.oldPosition.y || r !== this.ship.oldPosition.r)) {
			this.socket.emit('playerMovement', {x: this.ship.x, y: this.ship.y, rotation: this.ship.rotation})
		}
		
		this.ship.oldPosition = {
			x: this.ship.x,
			y: this.ship.y,
			rotation: this.ship.rotation
		}
		
		if(this.shootKey.isDown && !shot) {
			var vx = Math.cos(self.ship.rotation - Math.PI/2) * 15
			var vy = Math.sin(self.ship.rotation - Math.PI/2) * 15
			self.socket.emit('shoot-bullet', {x: self.ship.x, y: self.ship.y, angle: self.ship.rotation, vx: vx, vy: vy, id: 1})
			shot = true
		}
		
		if(!this.shootKey.isDown) {
			shot = false
		}
	}
}

function getRandomColor() {
  var letters = '0123456789ABCDEF'
  var color = '0x'
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}
