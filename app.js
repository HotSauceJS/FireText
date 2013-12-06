var express = require('express');
var app = express();

var twilio = require('twilio');

var twilioSID = process.env.TWILIO_SID || 'twiliosid';
var twilioToken = process.env.TWILIO_TOKEN || 'twiliotoken';
var client = twilio(twilioSID, twilioToken);

var twilioNumber = process.env.TWILIO_NUMBER || 'twilionumber'

var Firebase = require('firebase');
var firebaseURL = process.env.FIREBASE_URL || 'firebase_url';
var myRootRef = new Firebase(firebaseURL);

var FirebaseTokenGenerator = require("firebase-token-generator");
var firebaseSecret = process.env.FIREBASE_SECRET || 'firebase_secret';
var tokenGenerator = new FirebaseTokenGenerator(firebaseSecret);
var token = tokenGenerator.createToken({name:'superadmin'}, {admin:true, debug:true});

var defaultRoom = process.env.DEFAULT_ROOM || 'default_room';

var allowOrigin = process.env.ALLOW_ORIGIN || 'cors_allow_origin';

var getUserByName = function(name, callback) {
    myRootRef.auth(token, function(anErr, aResult) {
        myUserRef = myRootRef.child('users');
        myUserRef.once('value', function(snapshot){
            var users = snapshot.val();
            var user = users.filter(function(entry) {
                if (entry.name == name) return entry;
            })
            callback(user[0]);
        })
    })
}

var getUserByPhone = function(phone, callback) {
    myRootRef.auth(token, function(anErr, aResult) {
        myUserRef = myRootRef.child('users');
        myUserRef.once('value', function(snapshot){
            var users = snapshot.val();
            var user = users.filter(function(entry) {
                if (entry.phone == phone) return entry;
            })
            callback(user[0]);
        })
    })
}

var sendMessage = function(from, message, callback){
    myRootRef.auth(token, function(anErr, aResult) {
        var roomRef = myRootRef.child(defaultRoom);
        getUserByPhone(from, function(user){
            if (!user) return;

            var newMessage = {}
            newMessage.message = message;
            newMessage.name = user.name;
            newMessage.userId = user.id;
            newMessage.type = "default";
            newMessage.timestamp = Firebase.ServerValue.TIMESTAMP;

            var newMessageRef = roomRef.push();
            newMessageRef.setWithPriority(newMessage, Firebase.ServerValue.TIMESTAMP);
        });
    });
}

var sendSMS = function(to, message, callback){
    console.log("sending: ", to, message);
    client.sms.messages.create({
        body: message,
        to: to,
        from: twilioNumber}, 
        function(err, sms) {
            if (callback) callback;
        });
}

app.use(express.bodyParser());

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", allowOrigin);
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
 });

app.post('/message', function(req, res){
    console.log(req.body.From, req.body.Body);
    sendMessage(req.body.From, req.body.Body, function(){
        res.end();
    });
});

app.post('/mention', function(req,res){
    var message = req.body.message;
    var re = /^@\w+/
    if (re.test(message)){
        var name = message.match(re)[0].substr(1);
        getUserByName(name, function(user){
            if (user) {
                sendSMS(user.phone, message);
                res.json('message sent');
            } else {
                res.json('no match');
            }
        });
    }
    res.json('no mention');
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);
});