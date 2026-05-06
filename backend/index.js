require('dotenv').config()
const pool = require('./db/pool')
const app = require('./app')

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('DB connection error', err)
  else console.log('DB connected:', res.rows[0])
})

const port = process.env.PORT || 3000

app.listen(port, () => {
  console.log(`Freightline API listening on port ${port}`)
})
