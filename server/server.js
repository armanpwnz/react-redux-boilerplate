import express from 'express'
import path from 'path'
import axios from 'axios'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const Root = () => ''

const { readFile, writeFile, unlink } = require('fs').promises

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const setHeader = (req, res, next) => {
  res.set('x-skillcrucial-user', 'd47f32f5-a80b-4798-8674-54ed17711f2c')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()
}

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser(),
  setHeader
]

middleware.forEach((it) => server.use(it))

const toExistFile = () => {
  return readFile(`${__dirname}/users.json`)
    .then((file) => {
      return JSON.parse(file)
    })
    .catch(async () => {
      const response = await axios('https://jsonplaceholder.typicode.com/users')
      writeFile(`${__dirname}/users.json`, JSON.stringify(response.data), { encoding: 'utf8' })
      return response.data
    })
}

function toWriteFile(fileData) {
  writeFile(`${__dirname}/users.json`, JSON.stringify(fileData), 'utf8')
}

server.get('/api/v1/users', async (req, res) => {
  const data = await toExistFile()
  res.json(data)
})

server.post('/api/v1/users', async (req, res) => {
  const newUser = req.body
  const data = await toExistFile()
  newUser.id = data.length === 0 ? 1 : data[data.length - 1].id + 1
  toWriteFile([...data, newUser])
  res.json({ status: 'success', id: newUser.id })
})

server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const newUser = req.body
  const arr = await toExistFile()
  const objId = arr.find((obj) => obj.id === +userId)
  const objId2 = { ...objId, ...newUser }
  const arr2 = arr.map((rec) => {
    return rec.id === objId2.id ? objId2 : rec
  }, [])
  toWriteFile(arr2)
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const arr = await toExistFile()
  const objId = arr.find((obj) => obj.id === +userId)
  const arr2 = arr.filter((item) => item.id !== objId.id)
  toWriteFile(arr2)
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users', (req, res) => {
  unlink(`${__dirname}/users.json`)
    .then(() => res.json({ status: 'success' }))
    .catch(() => {
      res.send('file doesnt exist')
    })
  
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
