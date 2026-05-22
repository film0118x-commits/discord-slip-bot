const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const Tesseract = require("tesseract.js");
const express = require("express");
require("dotenv").config();

// =========================
// EXPRESS
// =========================
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =========================
// DISCORD CLIENT
// =========================
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

// =========================
// CLEAN TEXT
// =========================
function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[|]/g, "")
    .trim();
}

// =========================
// EXTRACT AMOUNT
// =========================
function extractAmount(text) {
  const clean = text.replace(/,/g, "");

  // หาเฉพาะหลังคำว่า "จำนวน"
  const amountSection = clean.match(
    /จำนวน[^0-9]{0,10}([0-9]+\.[0-9]{2})/
  );

  if (amountSection) {
    return amountSection[1];
  }

  // fallback หาเลขเงินทั้งหมด
  const matches = [...clean.matchAll(/([0-9]+\.[0-9]{2})/g)];

  if (!matches.length) return "ไม่พบ";

  // ตัด 0.00 ออก
  const filtered = matches
    .map((m) => parseFloat(m[1]))
    .filter((n) => n > 0);

  if (!filtered.length) return "ไม่พบ";

  // เอาค่าสูงสุด
  return Math.max(...filtered).toFixed(2);
}

// =========================
// EXTRACT BANK
// =========================
function extractBank(text) {
  const t = text.toLowerCase();

  if (t.includes("กสิกร") || t.includes("k plus"))
    return "กสิกรไทย";

  if (t.includes("กรุงไทย") || t.includes("krungthai"))
    return "กรุงไทย";

  if (t.includes("ไทยพาณิชย์") || t.includes("scb"))
    return "ไทยพาณิชย์";

  if (t.includes("กรุงเทพ") || t.includes("bangkok bank"))
    return "กรุงเทพ";

  if (t.includes("ttb"))
    return "ttb";

  if (t.includes("ออมสิน"))
    return "ออมสิน";

  return "ไม่พบ";
}

// =========================
// EXTRACT NAME
// =========================
function extractName(text) {
  const lines = text.split("\n");

  for (let line of lines) {
    line = cleanText(line);

    const match = line.match(
      /(นาย|นางสาว|นาง|น\.ส\.?)\s*([ก-๙a-zA-Z]+)/
    );

    if (match) {
      return `${match[1]} ${match[2]}`;
    }
  }

  return "ไม่พบ";
}

// =========================
// CHECK SLIP
// =========================
function isSlip(text) {
  const keywords = [
    "โอนเงินสำเร็จ",
    "จำนวน",
    "ธนาคาร",
    "k plus",
    "krungthai",
    "scb",
    "promptpay",
    "พร้อมเพย์",
    "pay",
  ];

  const lower = text.toLowerCase();

  return keywords.some((k) => lower.includes(k));
}

// =========================
// MESSAGE EVENT
// =========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.attachments.size <= 0) return;

  try {
    const attachment = message.attachments.first();

    if (
      !attachment.contentType ||
      !attachment.contentType.startsWith("image/")
    ) {
      return;
    }

    // =========================
    // DOWNLOAD IMAGE
    // =========================
    const response = await axios({
      url: attachment.url,
      responseType: "arraybuffer",
    });

    // =========================
    // OCR
    // =========================
    const result = await Tesseract.recognize(
      response.data,
      "tha+eng",
      {
        logger: () => {},
      }
    );

    const rawText = result.data.text;
    const cleaned = cleanText(rawText);

    console.log("========== OCR ==========");
    console.log(cleaned);
    console.log("=========================");

    // =========================
    // CHECK VALID SLIP
    // =========================
    if (!isSlip(cleaned)) {
      console.log("❌ ไม่ใช่สลิป");
      return;
    }

    // =========================
    // EXTRACT DATA
    // =========================
    const amount = extractAmount(cleaned);
    const sender = extractName(rawText);
    const bank = extractBank(cleaned);

    // =========================
    // SEND RESULT
    // =========================
    await message.reply(`
✅ ตรวจสอบสลิปสำเร็จ

💵 จำนวน: ${amount} บาท
👤 ผู้โอน: ${sender}
🏦 ธนาคาร: ${bank}
`);

    console.log("✅ อ่านสลิปสำเร็จ");

  } catch (error) {
    console.log("❌ ERROR:", error);

    await message.reply("❌ อ่านสลิปไม่สำเร็จ");
  }
});

// =========================
// LOGIN
// =========================
client.login(process.env.TOKEN);