### Server-side installation

Install with ```npm install --save firebase-digits```

FirebaseDigits is a Node.js module, not a client-side module. Don't try to use it on the client side!!! 

The next block of code is the only Node.js code in this README. Everything else is client-side. If you don't understand the difference between server- and client-side JavaScript, you have some serious studying to do. So go do it and then come back when you've read up.

Now that we're on the same page... FirebaseDigits takes a configured Firebase app and a path to listen on. Then you call start. That's it. Keep whatever Node.js script that you're using to run this alive, and FirebaseDigits will listen to the path that you gave it until the end of time. It's a very tiny process by design. Your server doesn't need any ports open to run... it can be totally firewalled. All it needs to do is to connect to Firebase and keep running. You could run this process on a Raspberry Pi stuck to the wall in your bathroom and it would be fine.

```javascript
var firebase = require('firebase').initializeApp({
    "databaseURL": "https://replace-with-your-app-name.firebaseio.com",
    "serviceAccount": "./service-account.json"
  });
var FirebaseDigits = require('./firebase-digits');
var firebaseDigits = FirebaseDigits(firebase, '/digits'); // Will listen on the /digits node

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
```

You can stop listening if needed with ```firebaseDigits.stop()```.

You can also manually verify a record with ```firebaseDigits.verify(serviceProvider, credentials, loginRef)```, which returns a promise.

### Client-side installation

FirebaseDigits works by using Firebase as a message bus. Your client app will push a new record to a collection of your choosing, and your Node.js server will use FirebaseDigits to listen to new records, validate them and respond with tokens or errors. 

A common payload would look something like this:

```json
{
  "digits": {
    "logins" : {
      "someUID" : {
        "X-Auth-Service-Provider" : "https://api.digits.com/1.1/sdk/account.json",
        "X-Verify-Credentials-Authorization" : "OAuth oauth_consumer_key=\"asdfadsfadf\", oauth_nonce=\"767769010737995777-adfasfadsf\", oauth_signature=\"dfadfadsfs\", oauth_signature_method=\"HMAC-SHA1\", oauth_timestamp=\"1472684522\", oauth_token=\"767769010737995777-adfadsfdaf\", oauth_version=\"1.0\""
      }
    },
    "unhandledErrors" : {
      "somePushKey" : {
        "uid": "someOtherUID",
        "error" : true
      }
    },
    "unhandledTokens" : {
      "anotherPushKey" : {
        "uid": "someOtherUID",
        "token" : true
      }
    }
  } 
}
```

First off, for security purposes, we're going to authenticate anonmyously with Firebase at a minimum. This will enable us to secure our Firebase with security rules that utilize the anonmyous auth's uid to prevent any jerk from listening in on our Firebase transactions.

Your client app will call ```Digits.login()``` and then, in this example, create a new record (```loginRef```) at ```/digits/logins/<uid>``` and immediately begin listening to the ```child_added``` event on ```loginRef```. We then set ```loginRef``` to ```res.oauth_echo_headers``` from the Digits response. 

FirebaseDigits will listen for the new ```loginRef``` record and immediately try to verify it with Twitter. If verification is successful, FirebaseDigits will create a custom auth token for Firebase and add it to the ```loginRef``` record at ```/digits/logins/<uid>/token```. If there's an error, FirebaseDigits will copy the error message to ```/digits/logins/<uid>/error```.

***Note***: FirebaseDigits will IMMEDIATELY delete the record after setting the ```token``` or ```error``` attribute. Your client app needs to be listening to the ```child_added``` or ```value``` event on ```loginRef``` before the record is removed.

If you start up FirebaseDigits and there are stray records sitting around in the queue that have not been deleted, FirebaseDigits will copy them to ```/digits/unhandledErrors``` or ```/digits/unhandledTokens``` for your debugging pleasure. Feel free to delete them yourself or try to figure out what part of your process is broken and causing them to get orphaned.  

```javascript
firebase.auth().onAuthStateChanged(function(user) {
  if (!user) {
    firebase.auth().signInAnonymously();
  }
});
Digits.logIn()
  .done(function(res) {
    var uid = firebase.auth().currentUser.uid;
    var loginRef = firebase.database().ref('digits/logins').child(uid);
    loginRef.on('child_added', function(snap) {
      var value = snap.val();
      if (snap.key == 'error') {
        // handle error
      } else if (snap.key == 'token') {
        // handle success
        return firebase.auth().signInWithCustomToken(value).then(resolve, reject);
      } 
    });
    loginRef.set(res.oauth_echo_headers);
  });

```

See ```demo/index.html``` or look at the code block below for a full implementation for the client side. If this seems confusing, you don't understand enough about Firebase yet. I have [a bunch of YouTube videos](https://www.youtube.com/playlist?list=PLdssc-pDiZ7OD78kJVp4habTynj-Etwhm) on these subjects, and the [Firebase docs](https://firebase.google.com/docs/database/web/start) are fantastic. Keep learning more about Firebase and reread this client-side code until it becomes clear. I promise it's not that complicated... once you understand basic Firebase operations.

```html
<html>

<head>
  <script id="digits-sdk" src="https://cdn.digits.com/1/sdk.js"></script>
  <script src="https://www.gstatic.com/firebasejs/3.3.0/firebase.js"></script>
  <script>
    // Initialize Firebase
    var config = {
      apiKey: "AIzaSyBP5EaFCQ0yAbcvYozyKCwKJ2Wf-yioCs4",
      authDomain: "quiver-two.firebaseapp.com",
      databaseURL: "https://quiver-two.firebaseio.com",
      storageBucket: "quiver-two.appspot.com",
    };
    firebase.initializeApp(config);
  </script>
</head>

<body>
  <button id="loginButton" onclick="logIn()">Log In</button>
  <button id="logoutButton" onclick="logOut()">Log Out</button>
  <script>
    /* Initialize Digits for Web using your application's consumer key that Fabric generated */
    Digits.init({ consumerKey: 'P9yPbzXusrtrWYUVFDmepZYOq' });

    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) {
        firebase.auth().signInAnonymously();
      }
      console.log('auth state changed:', user);
      loginButton.style.display = user && !user.isAnonymous ? 'none' : '';
      logoutButton.style.display = user && !user.isAnonymous ? '' : 'none';
    });

    function logOut() {
      firebase.auth().signOut();
    };
    
    function logIn() {
      if (!Digits.isInitialized()) {
        return console.log('Digits not initialized.');
      } else {
        var ref = firebase.database().ref('digits');
        Digits.logIn()
          .done(function(res) {
            var uid = firebase.auth().currentUser.uid;
            var loginRef = ref.child('logins').child(uid);

            loginRef.remove()
              .then(function() {
                return loginRef.set(res.oauth_echo_headers);    
              })
              .then(function () {
                return new Promise(function(resolve, reject) {
                  var handler = loginRef.on('child_added', function(snap) {
                    var value = snap.val();
                    if (snap.key == 'error') {
                      loginRef.off('child_added', handler);
                      return reject(value);
                    } else if (snap.key == 'token') {
                      loginRef.off('child_added', handler);
                      return firebase.auth().signInWithCustomToken(value).then(resolve, reject);
                    } 
                  });  
                });
              })
              .catch(function (err) {
                throw new Error(err);
              });
          })
          .fail(function(err) {
            console.log('Digits login fail', err);
          });
      }
    };
  </script>
</body>

</html>
```

### Security

The above client-side implementations are not ***necessarily*** secure. You'll need to sort out your own security rules to secure your ```digits/logins``` endpoint, otherwise, any old hacker will be able to listen to your endpoint and steal all of the tokens.

My suggestion is—-as shown above—-to use [Firebase anonymous auth](https://firebase.google.com/docs/auth/web/anonymous-auth) to create a secure uid with Firebase. So the moment the page is loaded, you'll do something like this:

```javascript
firebase.auth().onAuthStateChanged(function(user) {
  if (!user) { // Sign in anonymously if no auth present
    firebase.auth().signInAnonymously();
  }
});
Digits.logIn()
  .done(function(res) {
    var uid = firebase.auth().currentUser.uid; // Get auth uid from current user... likely an anonymous auth
    var loginRef = ref.child('logins').child(uid);
    // The rest of the Digits auth code
  });
```

Then you'll need a security rule like the following:

```json
{
  "rules":
    {
      "digits": {
        "logins": {
          "$uid": {
            ".write": "auth.uid == $uid",
            ".read": "auth.uid == $uid"
          }
        }
      }
    }
}

```

### Test

I spent about 10 hours trying to get headless browser testing to work, but Twitter Digits appears to be hardened against headless browsers. The API ***REFUSED*** to work with ZombieJS, no matter how hard I tried... so I've retreated to manual testing.

- Copy ```env.json.dist``` to ```env.json``` and fill with your Firebase details. You'll need a [service account file](https://firebase.google.com/docs/server/setup) to test/demo locally.
- Run ```npm install && npm test``` within this folder.
- Visit ```localhost:8080``` in your browser to interact with the test page.
- Log in and log out a few times. View your browser console and terminal to watch it work.

### Sign up for fabric

FirebaseDigits is meant to work with a Fabric app. If you don't have one, this is pointless.

- You'll need a Fabric account, so [sign up or sign in](https://fabric.io/sign_up).
- Fabric has an intricate on-boarding process. It's great if you want get Fabric running on an existing iOS or Android app, but if you just want to use web... well, you may need to build an iOS or Android project anyway just to get "on-boarded" by Fabric and gain access to Digits. 
 
