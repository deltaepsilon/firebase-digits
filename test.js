var env = require('./env.json');
var firebase = require('firebase').initializeApp(env.firebase);
var FirebaseDigits = require('./firebase-digits');
var firebaseDigits = FirebaseDigits(firebase, 'digits');

// Start listening
firebaseDigits.start();

// Optional listeners
firebaseDigits.on('token', function (token) {
  console.log('token created', token.substring(0, 10) + '...');
});

firebaseDigits.on('response', function (res) {
  console.log('response', res);
});

firebaseDigits.on('error', function (err) {
  console.log('error', err);
});

// Serve up the demo page
var express = require('express');
var app = express();
app.use(express.static('demo'));
app.listen(8080, function () {
  console.log(`Demo available on localhost:8080`);
});
