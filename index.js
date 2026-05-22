const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const Tesseract = require("tesseract.js");
const express = require("express");
require("dotenv").config();

const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(3000, () => {
  console.log("Web server running on port 3000");
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log(`ล็อกอินเป็น ${client.user.tag}`);
});

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
  if (text.includes("กรุงไทย")) return "กรุงไทย";
  if (text.includes("กสิกร")) return "กสิกรไทย";
  if (text.includes("ไทยพาณิชย์")) return "ไทยพาณิชย์";
  if (text.includes("กรุงเทพ")) return "กรุงเทพ";
  if (text.includes("ttb")) return "ttb";
  if (text.includes("ออมสิน")) return "ออมสิน";
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

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.attachments.size > 0) {
    try {
      const attachment = message.attachments.first();

      if (
        !attachment.contentType ||
        !attachment.contentType.startsWith("image/")
      ) {
        return;
      }

      const imageUrl = attachment.url;

      const response = await axios({
        url: imageUrl,
        responseType: "arraybuffer",
      });

      const result = await Tesseract.recognize(response.data, "tha+eng");

      const text = result.data.text;
      const cleaned = cleanText(text);

      if (
        !cleaned.includes("โอนเงินสำเร็จ") &&
        !cleaned.includes("สำเร็จ") &&
        !cleaned.includes("Krungthai") &&
        !cleaned.includes("K PLUS") &&
        !cleaned.includes("SCB")
      ) {
        return;
      }

      const amount = extractAmount(cleaned);
      const sender = extractName(text);
      const bank = extractBank(cleaned);

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
  }
});

client.login(process.env.TOKEN);

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});