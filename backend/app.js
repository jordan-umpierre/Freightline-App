const cors = require('cors')
const express = require('express')
const authRouter = require('./routes/auth')
const loadsRouter = require('./routes/loads')
const vehiclesRouter = require('./routes/vehicles')

const app = express()

app.use(cors())
app.use(express.json())

app.use('/auth', authRouter)
app.use('/vehicles', vehiclesRouter)
app.use('/loads', loadsRouter)

app.get('/', (req, res) => {
  res.json({
    name: 'Freightline API',
    status: 'ok',
  })
})

module.exports = app
