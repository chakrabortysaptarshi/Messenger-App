var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var HashMap = require('hashmap');
var fs = require('fs');
var async = require('async');
var deepcopy = require("deepcopy");
var dl = require('delivery');

var map = new HashMap();

app.get('/', function(req, res) {
	res.sendFile(__dirname +'/index.html');
});

io.on('connection', function (socket) {
	console.log(socket.id);

    getOnlineUsers(socket);

    loadEmoticons();

    var delivery = dl.listen(socket);
    delivery.on('receive.success',function(file){
        var params = file.params;
        fs.writeFile(file.name,file.buffer, function(err){
            if(err){
                console.log('File could not be saved.');
            }else{
                console.log('File saved.');
            };
        });
    });

	socket.broadcast.emit('new user welcome', {hello : 'world'});

	socket.on('chat message', function(msg) {
		if(msg.users === undefined) {
            console.log("No selected username");
            socket.broadcast.emit('chat message', msg.content);
        }
		else {
            //console.log(msg.users);
			if(msg.users.indexOf(',') > -1) {
				//split each user name to broadcast
				var onlineUsers = msg.users.split(',');
				//console.log("Selected users : "+onlineUsers.length);
                onlineUsers.forEach(function(entry) {
                    io.to(getSessionKey(entry)).emit('chat message', msg.content);
                });
			} else {
                io.to(getSessionKey(msg.users)).emit('chat message', msg.content);
			}
		}
    });

	socket.on('nickname', function(msg) {
		socket.broadcast.emit('nickname', msg);
		map.set(socket.id, msg);
		//console.log(map.count());
		io.to(socket.id).emit('name set', msg);

	});

	socket.on('typing now', function () {
		socket.broadcast.emit('typing now', map.get(socket.id));
    });

    socket.on('typing stopped', function () {
        socket.broadcast.emit('typing stopped', map.get(socket.id));
    });

    socket.on('image send', function (val) {
        //console.log(val);
        fs.readFile(__dirname + val.imageName, function (err, buf) {
            if(val.users === undefined) {
                console.log("No selected username");
                socket.broadcast.emit('image receive', buf);
            } else {
                console.log(val.users);
                if(val.users.indexOf(',') > -1) {
                    //split each user name to broadcast
                    var onlineUsers = val.users.split(',');
                    console.log("Selected users : "+onlineUsers.length);
                    onlineUsers.forEach(function(entry) {
                        console.log(entry);
                        io.to(getSessionKey(entry)).emit('image receive', buf);
                    });
                } else {
                    io.to(getSessionKey(val.users)).emit('image receive', buf);
                }
            }
            //socket.broadcast.emit('image receive', buf);
            io.to(socket.id).emit('selfImage receive', buf);
        });
    })

});

io.sockets.on('connection', function (socket) {
    socket.on('disconnect', function () {
        var sockId = deepcopy(socket.id);
        socket.broadcast.emit('user offline', map.get(sockId) );
        map.remove(sockId);
    });
});

http.listen(3000, function() {
	console.log("listening to port 3000");
});

function loadEmoticons() {
    var smileyImages = [];
    for(var i=1;i<117; i++) {
        var j = '/Emoji Smiley/Emoji Smiley-' + i + '.png';
        smileyImages.push(j);
    }

    async.each(smileyImages, function (image, callback) {
        fs.readFile(__dirname + image, function (err, buf) {
            io.emit('image', {buffer: buf, imageId: image});
        });
        callback();
    }, function (err) {
        if (err) { throw err;
        }
    });

    var symbolImages = [];
    for(var i=1;i<117; i++) {
        var j = '/Emoji Symbol/Emoji Symbol-' + i + '.png';
        symbolImages.push(j);
    }

    async.each(symbolImages, function (image, callback) {
        fs.readFile(__dirname + image, function (err, buf) {
            io.emit('image', {buffer: buf, imageId: image});
        });
        callback();
    }, function (err) {
        if (err) { throw err;
        }
    });
}

function getSessionKey(val) {
	var v ;
    map.forEach(function(value, key) {
        //console.log(key + " : " + value);
        if(value == val)
        	v = key;
    });
    return v;
}

function getOnlineUsers(socket) {
    var v = [];
    map.forEach(function(value, key) {
        if(socket.id != key)
            v.push(value);
    });
    if(v.length > 0 ) {
        async.each(v, function (name, callback) {
            io.to(socket.id).emit('nickname', name);
            callback();
        }, function (err) {
            if (err) { throw err;
            }
        });
    }
}