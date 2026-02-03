// This module previously initialized the SQLite database.
// It now simply exports the shared Firestore instance configured in firebase.js.

const db = require('./firebase');

module.exports = db;