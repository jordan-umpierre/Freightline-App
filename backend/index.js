require('dotenv').config()
const http = require('http')
const pool = require('./db/pool')
const app = require('./app')
const { attachLiveServer } = require('./services/liveHub')

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('DB connection error', err)
  else console.log('DB connected:', res.rows[0])
})

const port = process.env.PORT || 3000
const server = http.createServer(app)
attachLiveServer(server, { app })

server.listen(port, '0.0.0.0', () => {
  console.log(`Freightline API listening on port ${port}`)
})
