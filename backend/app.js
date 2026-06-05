const cors = require('cors')
const express = require('express')
const authRouter = require('./routes/auth')
const documentsRouter = require('./routes/documents')
const loadsRouter = require('./routes/loads')
const vehiclesRouter = require('./routes/vehicles')

const app = express()

const DEFAULT_CORS_ORIGINS = [
  'https://freightline-app.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

function parseCorsOrigins(value) {
  return (value || DEFAULT_CORS_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const allowedCorsOrigins = new Set(parseCorsOrigins(process.env.CORS_ORIGINS))

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (allowedCorsOrigins.has(origin)) return callback(null, origin)
    return callback(null, false)
  },
}))
app.use(express.json())

app.use('/auth', authRouter)
app.use('/vehicles', vehiclesRouter)
app.use('/loads', loadsRouter)
app.use('/loads/:id/documents', documentsRouter)

app.get('/', (req, res) => {
  res.json({
    name: 'Freightline API',
    status: 'ok',
  })
})

module.exports = app
