const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const Tesseract = require("tesseract.js");
const express = require("express");

require("dotenv").config();

/* =========================
   EXPRESS SERVER (Render)
========================= */

const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

/* =========================
   DISCORD BOT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`✅ ล็อกอินเป็น ${client.user.tag}`);
});

/* =========================
   FUNCTIONS
========================= */

function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[|]/g, "")
    .trim();
}

function extractAmount(text) {
  const match = text.match(/([\d,]+\.\d{2})/);
  return match ? match[1] : "ไม่พบ";
}

function extractBank(text) {
  const lower = text.toLowerCase();

  if (lower.includes("กรุงไทย") || lower.includes("krungthai"))
    return "กรุงไทย";

  if (lower.includes("กสิกร") || lower.includes("k plus"))
    return "กสิกรไทย";

  if (lower.includes("ไทยพาณิชย์") || lower.includes("scb"))
    return "ไทยพาณิชย์";

  if (lower.includes("กรุงเทพ"))
    return "กรุงเทพ";

  if (lower.includes("ttb"))
    return "ttb";

  if (lower.includes("ออมสิน"))
    return "ออมสิน";

  return "ไม่พบ";
}

function extractName(text) {
  const lines = text.split("\n");

  for (let line of lines) {
    line = cleanText(line);

    if (
      line.includes("นาย") ||
      line.includes("นาง") ||
      line.includes("น.ส") ||
      line.includes("นางสาว")
    ) {
      const words = line.split(" ");

      if (words.length >= 2) {
        return `${words[0]} ${words[1]}`;
      }
    }
  }

  return "ไม่พบ";
}

/* =========================
   MESSAGE EVENT
========================= */

client.on("messageCreate", async (message) => {
  try {
    // กันบอทตอบตัวเอง
    if (message.author.bot) return;

    // เช็คว่ามีรูปไหม
    const attachment = message.attachments.first();

    // ถ้าไม่มีรูป = ไม่ทำอะไร
    if (!attachment) return;

    // เช็คว่าเป็นรูปจริงไหม
    if (
      !attachment.contentType ||
      !attachment.contentType.startsWith("image/")
    ) {
      return;
    }

    console.log("📷 มีการส่งรูป");

    // โหลดรูป
    const response = await axios({
      url: attachment.url,
      responseType: "arraybuffer",
    });

    // OCR อ่านข้อความ
    const result = await Tesseract.recognize(
      response.data,
      "tha+eng"
    );

    const text = result.data.text;
    const cleaned = cleanText(text);

    console.log(cleaned);

    // เช็คว่าเป็นสลิปจริงไหม
    if (
      !cleaned.includes("โอนเงินสำเร็จ") &&
      !cleaned.includes("สำเร็จ") &&
      !cleaned.includes("Krungthai") &&
      !cleaned.includes("K PLUS") &&
      !cleaned.includes("SCB")
    ) {
      console.log("❌ ไม่ใช่สลิป");
      return;
    }

    const amount = extractAmount(cleaned);
    const sender = extractName(text);
    const bank = extractBank(cleaned);

    // ตอบกลับ
    await message.reply(`
✅ ตรวจสอบสลิปสำเร็จ

💵 จำนวน: ${amount} บาท
👤 ผู้โอน: ${sender}
🏦 ธนาคาร: ${bank}
    `);

  } catch (error) {
    console.log("ERROR:", error);

    await message.reply("❌ อ่านสลิปไม่สำเร็จ");
  }
});

/* =========================
   LOGIN
========================= */

client.login(process.env.TOKEN);