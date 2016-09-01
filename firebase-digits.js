var EventEmitter = require('events').EventEmitter;
var axios = require('axios');

module.exports = function FirebaseDigits(firebase, path) {
  if (!path) throw new Error('FirebaseDigits path must be a valid path string');
  var ref = firebase.database().ref(path);
  var firebaseDigits = Object.create(new EventEmitter());

  function childAddedHandler(snap) {
    var loginRef = snap.ref;
    var login = snap.val();
    var serviceProvider = login['X-Auth-Service-Provider'];
    var credentials = login['X-Verify-Credentials-Authorization'];

    // Move stray tokens for debugging/cleanup
    if (typeof login.token != 'undefined') return ref.child('unhandledTokens')
      .push((login.uid = snap.key, login))
      .then(function () {
        return loginRef.remove();
      });

    // Move unhandled errors for debugging/cleanup
    if (typeof login.error != 'undefined') return ref.child('unhandledErrors')
      .push((login.uid = snap.key, login))
      .then(function () {
        return loginRef.remove();
      });

    // Auth with Twitter
    if (serviceProvider && credentials) return verify(serviceProvider, credentials, loginRef);

    // Handle incomplete record
    return Promise.reject('Record incomplete');
  };

  function verify(serviceProvider, credentials, loginRef) {
    return axios.get(serviceProvider, {
      headers: {
        Authorization: credentials
      }
    })
      .then(function (res) {
        var token = firebase.auth().createCustomToken(res.data.id_str, res.data);
        firebaseDigits.emit('response', res.data);
        firebaseDigits.emit('token', token);
        return loginRef.child('token').set(token);
      })
      .then(function () {
        return loginRef.remove();
      })
      .catch(function (err) {
        firebaseDigits.emit('error', err);
        return loginRef.child('error').set(err.toString());
      });
  };

  // Add functionality to firebaseDigits
  firebaseDigits.start = function start() {
    return ref.child('logins').on('child_added', childAddedHandler);
  };
  firebaseDigits.stop = function stop() {
    return ref.child('logins').off('child_added', childAddedHandler);
  };
  firebaseDigits.verify = verify;

  return firebaseDigits;
};
