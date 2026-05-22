const {
  Client,
  GatewayIntentBits,
} = require("discord.js");

const axios = require("axios");
const Tesseract = require("tesseract.js");
const express = require("express");

require("dotenv").config();

//////////////////////////////////////////////////////
// WEB SERVER
//////////////////////////////////////////////////////

const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

//////////////////////////////////////////////////////
// DISCORD BOT
//////////////////////////////////////////////////////

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

//////////////////////////////////////////////////////
// FUNCTIONS
//////////////////////////////////////////////////////

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAmount(text) {
  const lines = text.split("\n");

  for (let line of lines) {
    line = cleanText(line);

    if (
      line.includes("จำนวน") ||
      line.includes("Amount") ||
      line.includes("บาท")
    ) {
      const match = line.match(/([\d,]+\.\d{2})/);

      if (match) {
        return match[1];
      }
    }
  }

  return "ไม่พบ";
}

function extractBank(text) {
  text = text.toLowerCase();

  if (
    text.includes("k plus") ||
    text.includes("kplus") ||
    text.includes("กสิกร")
  ) {
    return "กสิกรไทย";
  }

  if (
    text.includes("krungthai") ||
    text.includes("กรุงไทย")
  ) {
    return "กรุงไทย";
  }

  if (
    text.includes("scb") ||
    text.includes("ไทยพาณิชย์")
  ) {
    return "ไทยพาณิชย์";
  }

  if (
    text.includes("กรุงเทพ") ||
    text.includes("bangkok bank")
  ) {
    return "กรุงเทพ";
  }

  if (text.includes("ttb")) {
    return "ttb";
  }

  if (text.includes("ออมสิน")) {
    return "ออมสิน";
  }

  return "ไม่พบ";
}

function extractName(text) {
  const lines = text.split("\n");

  for (let line of lines) {
    line = cleanText(line);

    if (
      line.startsWith("นาย") ||
      line.startsWith("นาง") ||
      line.startsWith("น.ส.") ||
      line.startsWith("นางสาว")
    ) {
      const words = line.split(" ").filter(Boolean);

      if (words.length >= 2) {
        return `${words[0]} ${words[1]}`;
      }
    }
  }

  return "ไม่พบ";
}

function isSlip(text) {
  text = text.toLowerCase();

  const keywords = [
    "โอนเงินสำเร็จ",
    "สำเร็จ",
    "k plus",
    "kplus",
    "krungthai",
    "scb",
    "ธนาคาร",
    "บาท",
    "promptpay",
    "พร้อมเพย์",
  ];

  let score = 0;

  for (const word of keywords) {
    if (text.includes(word)) {
      score++;
    }
  }

  return score >= 2;
}

//////////////////////////////////////////////////////
// MESSAGE EVENT
//////////////////////////////////////////////////////

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    if (message.attachments.size === 0) return;

    const attachment = message.attachments.first();

    if (!attachment.contentType) return;

    if (
      !attachment.contentType.startsWith("image/")
    ) {
      return;
    }

    console.log("📥 พบรูปภาพ");

    //////////////////////////////////////////////////////
    // DOWNLOAD IMAGE
    //////////////////////////////////////////////////////

    const response = await axios({
      url: attachment.url,
      responseType: "arraybuffer",
    });

    //////////////////////////////////////////////////////
    // OCR
    //////////////////////////////////////////////////////

    const result = await Tesseract.recognize(
      response.data,
      "tha+eng",
      {
        logger: () => {},
      }
    );

    const rawText = result.data.text;

    const text = cleanText(rawText);

    console.log("========== OCR ==========");
    console.log(text);
    console.log("=========================");

    //////////////////////////////////////////////////////
    // CHECK SLIP
    //////////////////////////////////////////////////////

    if (!isSlip(text)) {
      console.log("❌ ไม่ใช่สลิป");

      return;
    }

    //////////////////////////////////////////////////////
    // EXTRACT DATA
    //////////////////////////////////////////////////////

    const amount = extractAmount(rawText);

    const bank = extractBank(text);

    const sender = extractName(rawText);

    //////////////////////////////////////////////////////
    // REPLY
    //////////////////////////////////////////////////////

    await message.reply(`
✅ ตรวจสอบสลิปสำเร็จ

💵 จำนวน: ${amount} บาท
👤 ผู้โอน: ${sender}
🏦 ธนาคาร: ${bank}
    `);

    console.log("✅ อ่านสลิปสำเร็จ");
  } catch (error) {
    console.log("❌ ERROR:", error);

    await message.reply(
      "❌ อ่านสลิปไม่สำเร็จ"
    );
  }
});

//////////////////////////////////////////////////////
// LOGIN
//////////////////////////////////////////////////////

client.login(process.env.TOKEN);