const { MongoClient } = require('mongodb')

let client
let db

async function getMongoDb() {
  if (db) return db

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
  const dbName = process.env.MONGODB_DB || 'freightline'

  client = new MongoClient(uri)
  await client.connect()
  db = client.db(dbName)
  return db
}

async function getPingCollection() {
  const mongoDb = await getMongoDb()
  return mongoDb.collection('gps_pings')
}

async function closeMongo() {
  if (client) {
    await client.close()
  }

  client = null
  db = null
}

module.exports = {
  closeMongo,
  getMongoDb,
  getPingCollection,
}
