// index.js
import 'dotenv/config';
import { Bot } from 'grammy';
import fetch from 'node-fetch';

// Проверка переменных окружения
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TG_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');
if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

// Клиент Telegram
const bot = new Bot(TG_TOKEN);

// Функция разбиения текста
function chunkText(text, max = 4000) {
  const chunks = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut === -1) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

// Системный промпт
const systemPrompt = [
  'You are a professional paraphraser.',
  'Task: rewrite the user text in the SAME language (Russian or English).',
  'Keep the meaning and facts unchanged.',
  'Improve grammar and clarity; keep roughly similar length.',
  'Preserve names, numbers, links, hashtags, emojis.',
  'Maintain lists and line breaks.',
  'DO NOT add new info or commentary.',
  'Return ONLY the rewritten text, no explanations.'
].join(' ');

// Команда start
bot.command('start', async (ctx) => {
  await ctx.reply(
    'Привет! Я перефразирую текст на русском и английском без изменения смысла.\n' +
    'Просто пришли мне текст или ответь на сообщение с текстом.'
  );
});

// Логика перефразирования
bot.on('message:text', async (ctx) => {
  const text = ctx.message?.reply_to_message?.text ?? ctx.message.text;
  ctx.api.sendChatAction(ctx.chat.id, 'typing').catch(() => {});

  try {
    const combinedPrompt = systemPrompt + "\n\n" + text;

    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: combinedPrompt }]
            }
          ]
        })
      }
    );

    const data = await res.json();

    // Извлекаем текст ответа
    const answer = data?.candidates?.[0]?.content?.[0]?.text?.trim();
    if (!answer) {
      await ctx.reply('Не удалось получить ответ от модели. Попробуй ещё раз.');
      return;
    }

    // Отправляем частями, если длинный текст
    for (const part of chunkText(answer)) {
      await ctx.reply(part);
    }

  } catch (err) {
    console.error('Error in paraphrasing:', err);
    await ctx.reply('Произошла ошибка при перефразировании. Проверь ключи и попробуй снова.');
  }
});

// Запуск бота
bot.start();
console.log('Paraphrase bot is running…');
