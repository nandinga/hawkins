//// Initialization ///////////////////////////////////////////////////////////

var admin = require("firebase-admin");

// Create/download from Firebase Console > User and admin permissions > Service accounts
var serviceAccount = require("./hawkins-camaloon-0548347e24ee.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://hawkins-camaloon.firebaseio.com"
});

var db = admin.database();

//// Cleaning routine /////////////////////////////////////////////////////////
//
// The following routine has to be completed to not only delete builds but also
// examples and logs!!
//
///////////////////////////////////////////////////////////////////////////////

// var days_to_keep = 15;
// var d = new Date();
// var keep_builds_to = d.setDate(d.getDate() - days_to_keep);
// 
// var to_delete_ref = db.ref("builds").orderByChild("startedAt").endAt(keep_builds_to) //.once("value", function(s) { console.log(Object.keys(s.val()).length) })
// 
// console.log("Querying the DB...")
// to_delete_ref.once("value", function(snapshot) {
//   console.log("Deleting...")
//   snapshot.forEach(function(child_snapshot) {
//     // TODO: Also delete nodes in /examples and /logs
//     child_snapshot.ref.remove()
//     console.log(".") // TODO: show the dot after all resources are deleted
//   });
// }).then(function() { console.log("Done!") });

//// FIX: delete orphan examples and logs /////////////////////////////////////
//
// The following code fixes the case when builds are deleted but dependent logs
// and examples are left in the DB. It iterates over logs, but deletes both the
// log and example when it finds an orphan.
//
// Batch processing:
//
// Batches are needed because logs list is too big to load in memory, and there
// is no way to query them one by one. once("value") explicitsly queries
// everything, and on("child_added") calls its callback once per child added,
// but also once per existing child, and queries them all at once too.
// Firebase doesn't provide any means for pagination so we need to implement it
// here. There's no secuential index so we need to go by key (build hash).
//
///////////////////////////////////////////////////////////////////////////////

var recursiveProcessLogBatch = function(batchSize, fromHash) {
  processLogBatch(batchSize, fromHash)
    .then(recursiveProcessLogBatch.bind(null, batchSize));
};

var processLogBatch = function(batchSize, fromHash) {
  console.log("Querying " + batchSize + " logs from " + fromHash + "...");
  return db.ref("logs").orderByKey().startAt(fromHash).limitToFirst(batchSize).once("value")
    .then(processLogBatchSnapshot)
    .catch(errorHandler);
};

var processLogBatchSnapshot = function(logsSnapshot) {
  console.log("Iterating over the " + logsSnapshot.numChildren() + " logs received...");
  var lastLogKey = null;
  logsSnapshot.forEach(function(logSnapshot) {
    lastLogKey = logSnapshot.key;
    processLogSnapshot(logSnapshot);
  });
  return lastLogKey;
};

var processLogSnapshot = function(logSnapshot) {
  console.log("Processing log " + logSnapshot.key + "...");
  db.ref("builds/" + logSnapshot.key).once("value", function(correspondingBuildSnapshot) {
    if (correspondingBuildSnapshot.exists()) {
      console.log("- Leaving:      " + logSnapshot.key);
    } else {
      console.log("- Deleting: (!) " + logSnapshot.key);
      deleteResourcesFor(logSnapshot.key);
    }
  }, errorHandler);
};

var deleteResourcesFor = function(buildHash) {
  db.ref("logs/" + buildHash).remove().catch(errorHandler);
  db.ref("examples/" + buildHash).remove().catch(errorHandler);
};

var errorHandler = console.log.bind(this, "Errorll!!");



console.log("Go!");
recursiveProcessLogBatch(100, "");

