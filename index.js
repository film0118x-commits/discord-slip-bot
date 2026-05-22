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
// CLEAN TEXT
//////////////////////////////////////////////////////

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

//////////////////////////////////////////////////////
// EXTRACT AMOUNT
//////////////////////////////////////////////////////

function extractAmount(text) {
  // หาเฉพาะบรรทัดที่มีคำว่า จำนวน
  const amountLine = text.match(
    /จำนวน[\s:]*([\d,]+\.\d{2})/i
  );

  if (amountLine) {
    return amountLine[1];
  }

  // fallback หาเลขบาทตัวสุดท้าย
  const allNumbers = text.match(
    /([\d,]+\.\d{2})/g
  );

  if (allNumbers && allNumbers.length > 0) {
    return allNumbers[allNumbers.length - 1];
  }

  return "ไม่พบ";
}

//////////////////////////////////////////////////////
// EXTRACT BANK
//////////////////////////////////////////////////////

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
    text.includes("bangkok") ||
    text.includes("กรุงเทพ")
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

//////////////////////////////////////////////////////
// EXTRACT NAME
//////////////////////////////////////////////////////

function extractName(text) {
  const regex =
    /(นาย|นางสาว|นาง|น\.ส\.?)\s*[ก-๙a-zA-Z]+/;

  const match = text.match(regex);

  if (match) {
    return cleanText(match[0]);
  }

  return "ไม่พบ";
}

//////////////////////////////////////////////////////
// CHECK SLIP
//////////////////////////////////////////////////////

function isSlip(text) {
  text = text.toLowerCase();

  const keywords = [
    "โอนเงินสำเร็จ",
    "สำเร็จ",
    "k plus",
    "kplus",
    "krungthai",
    "scb",
    "promptpay",
    "พร้อมเพย์",
    "จำนวน",
    "บาท",
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

client.on(
  "messageCreate",
  async (message) => {
    try {
      if (message.author.bot) return;

      if (
        message.attachments.size === 0
      )
        return;

      const attachment =
        message.attachments.first();

      if (!attachment.contentType)
        return;

      if (
        !attachment.contentType.startsWith(
          "image/"
        )
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

      const result =
        await Tesseract.recognize(
          response.data,
          "tha+eng",
          {
            logger: () => {},
          }
        );

      const rawText =
        result.data.text;

      const text =
        cleanText(rawText);

      console.log(
        "========== OCR =========="
      );

      console.log(text);

      console.log(
        "========================="
      );

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

      const amount =
        extractAmount(text);

      const sender =
        extractName(text);

      const bank =
        extractBank(text);

      //////////////////////////////////////////////////////
      // REPLY
      //////////////////////////////////////////////////////

      await message.reply(`
✅ ตรวจสอบสลิปสำเร็จ

💵 จำนวน: ${amount} บาท
👤 ผู้โอน: ${sender}
🏦 ธนาคาร: ${bank}
      `);

      console.log(
        "✅ อ่านสลิปสำเร็จ"
      );
    } catch (error) {
      console.log(
        "❌ ERROR:",
        error
      );

      await message.reply(
        "❌ อ่านสลิปไม่สำเร็จ"
      );
    }
  }
);

//////////////////////////////////////////////////////
// LOGIN
//////////////////////////////////////////////////////

client.login(process.env.TOKEN);