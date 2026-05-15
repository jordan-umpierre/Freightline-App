require('dotenv').config()
const http = require('http')
const pool = require('./db/pool')
const { getMongoDb } = require('./db/mongo')
const app = require('./app')
const { attachLiveServer } = require('./services/liveHub')

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('Postgres connection error', err)
  else console.log('Postgres connected:', res.rows[0])
})

getMongoDb()
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error', err))

const port = process.env.PORT || 3000
const server = http.createServer(app)
attachLiveServer(server, { app })

server.listen(port, '0.0.0.0', () => {
  console.log(`Freightline API listening on port ${port}`)
})
