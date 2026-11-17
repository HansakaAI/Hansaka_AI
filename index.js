import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import axios from 'axios'
import fs from 'fs'

const GROQ_KEY = process.env.GROQ_API_KEY
const PHONE_NUMBER = process.env.PHONE_NUMBER // 947XXXXXXXX වගේ, 0 නැතුව
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Silent Logger - pino ඕනි නෑ, මේකෙන් Error එක Fix වෙනවා
const silentLogger = {
  level: 'silent',
  child: () => silentLogger,
  trace: () => {}, debug: () => {}, info: () => {},
  warn: () => {}, error: () => {}, fatal: () => {}
}

const SYSTEM_PROMPT = `Hi මම siaa AI ඔයාගෙ study , devoloping වගේ වැඩවලට උදවු කරන්න මට පුළුවන්.`

async function askGroq(userMsg) {
  try {
    const res = await axios.post(GROQ_URL, {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.7,
      max_tokens: 800
    }, { headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' } })
    return res.data.choices[0].message.content
  } catch (e) {
    console.log('Groq Error:', e.message)
    return 'අඩෝ ටිකක් අවුල් වුනා මචං 😅 ආයෙත් Message එකක් දාන්න!'
  }
}

async function startBot() {
  // GitHub Secret එකෙන් Auth එක ගන්නවා
  if (process.env.AUTH_STATE && process.env.AUTH_STATE !== 'empty') {
    try {
      const decoded = Buffer.from(process.env.AUTH_STATE, 'base64').toString('utf-8')
      fs.mkdirSync('auth_info', { recursive: true })
      const files = JSON.parse(decoded)
      for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(`auth_info/${name}`, content)
      }
      console.log('✅ Auth loaded from Secret!')
    } catch (e) { console.log('Auth load failed, new Pair Code needed') }
  }

  const { state, saveCreds } = await useMultiFileAuthState('auth_info')
  const sock = makeWASocket({
    auth: state,
    logger: silentLogger,
    printQRInTerminal: false,
    browser: ['Tech Malli', 'Chrome', '1.0.0']
  })

  sock.ev.on('creds.update', async () => {
    await saveCreds()
    try {
      const files = {}
      for (const f of fs.readdirSync('auth_info')) {
        files[f] = fs.readFileSync(`auth_info/${f}`, 'utf-8')
      }
      console.log('=== NEW_AUTH_START ===')
      console.log(Buffer.from(JSON.stringify(files)).toString('base64'))
      console.log('=== NEW_AUTH_END ===')
    } catch (e) {}
  })

  // 🔥 PAIR CODE එක ගන්න තැන
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        if (!PHONE_NUMBER) {
          console.log('❌ PHONE_NUMBER Secret එක නෑ! Settings -> Secrets වල දාන්න')
          return
        }
        const code = await sock.requestPairingCode(PHONE_NUMBER)
        console.log('========================================')
        console.log(`🔥 PAIR CODE: ${code}`)
        console.log(`Phone: ${PHONE_NUMBER}`)
        console.log('WhatsApp -> Linked Devices -> Link with Phone Number -> Code එක දාන්න')
        console.log('========================================')
      } catch (e) {
        console.log('Pair Code Error:', e.message)
      }
    }, 3000)
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'open') console.log('✅ Tech Malli Connected! 🔥')
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        console.log('Reconnecting...')
        startBot()
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return
    const from = msg.key.remoteJid
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text
    if (!text) return
    console.log(`Msg from ${from}: ${text}`)
    const isGroup = from.endsWith('@g.us')
    if (isGroup && !text.toLowerCase().includes('tech malli')) return
    await sock.sendPresenceUpdate('composing', from)
    const reply = await askGroq(text)
    await sock.sendMessage(from, { text: reply })
    console.log(`Replied: ${reply.substring(0, 50)}...`)
  })
}
startBot()
