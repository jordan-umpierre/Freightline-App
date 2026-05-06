require('dotenv').config()
const pool = require('./db/pool')
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('DB connection error', err)
  else console.log('DB connected:', res.rows[0])
})

const express = require('express')
const app = express()
const port = 3000

app.use(express.json())

const authRouter = require('./routes/auth')
app.use('/auth', authRouter)

const { authenticate } = require('./middleware/auth')

app.get('/protected-test', authenticate, (req, res) => {
  res.json({ message: 'You are in', user: req.user })
})

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})