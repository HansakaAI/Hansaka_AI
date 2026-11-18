import TelegramBot from 'node-telegram-bot-api'
import axios from 'axios'
import fs from 'fs'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const GROQ_KEY = process.env.GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const bot = new TelegramBot(TOKEN, { polling: true })
console.log('✅ HANSAKA MD Bot Started! 🔥')

const SYSTEM_PROMPT = `ඔයා HANSAKA MD. A/L IT කරන කොල්ලෙක්ට උදව් කරන යාළුවෙක් වගේ කතා කරන AI එකක්.
සිංහල + English මිශ්‍ර කරලා, යාලුවෙක් වගේ, fun විදියට උත්තර දෙන්න. Emoticon දාන්න.
A/L IT, Python, Database, Networking, HTML ගැන දන්නවා. කෙටියෙන්, පැහැදිලිව උත්තර දෙන්න.`

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

// 🔥 /start , /alive , .alive 3ටම මේකම එනවා
async function sendAlive(chatId, userName) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }))
  const time = now.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true })
  const date = now.toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })

  const hour = now.getHours()
  let greeting = 'සුභ දවසක්'
  if (hour < 12) greeting = 'සුභ උදෑසනක්'
  else if (hour < 16) greeting = 'සුභ දවල්ක්'
  else if (hour < 19) greeting = 'සුභ සන්ධ්‍යාවක්'
  else greeting = 'සුභ රාත්‍රියක්'

  const caption = `⭐ Hey , ${userName}
👋 welcome to HANSAKA MD 🦊
┌ 「 STATUS PANEL 」
│ 🌐 ${greeting} / සුභ දවසක් / සුභ රාත්‍රියක්
│ 🕒 Time : ${time}
│ 📅 Date : ${date}
│ 🤖 Bot Name: HANSAKA MD
│ 👑 Owner : HANSAKA
│ 📱 Platform: ANDROID
└
🫶 කොහොමද ඔයාලට HANSAKA MD BOT වෙත සාදරයෙන් පිළිගන්නවා... 🧡

DEPLOYED BY HANSAKA`

  try {
    if (fs.existsSync('alive.jpg')) {
      await bot.sendPhoto(chatId, 'alive.jpg', { caption: caption })
    } else {
      await bot.sendMessage(chatId, caption)
    }
  } catch (e) {
    console.log('Alive Error:', e.message)
    await bot.sendMessage(chatId, caption)
  }
}

bot.onText(/\/start/, (msg) => {
  sendAlive(msg.chat.id, msg.from.first_name || 'User')
})

bot.onText(/^\.alive/, (msg) => {
  sendAlive(msg.chat.id, msg.from.first_name || 'User')
})

bot.onText(/\/alive/, (msg) => {
  sendAlive(msg.chat.id, msg.from.first_name || 'User')
})

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/') || msg.text.startsWith('.')) return
  console.log(`Msg from ${msg.from.username}: ${msg.text}`)
  bot.sendChatAction(msg.chat.id, 'typing')
  const reply = await askGroq(msg.text)
  bot.sendMessage(msg.chat.id, reply)
})

bot.on('polling_error', (e) => console.log('Polling Error:', e.message))
