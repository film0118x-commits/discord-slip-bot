const { Client, GatewayIntentBits } = require('discord.js');
const Tesseract = require('tesseract.js');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// =========================
// Discord Client
// =========================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =========================
// Bot Online
// =========================

client.once('ready', () => {
    console.log(`✅ Bot Online: ${client.user.tag}`);
});

// =========================
// อ่านข้อความ
// =========================

client.on('messageCreate', async (message) => {

    // กันบอทตอบตัวเอง
    if (message.author.bot) return;

    // ต้องมีไฟล์
    if (message.attachments.size === 0) return;

    const attachment = message.attachments.first();

    // ต้องเป็นรูป
    if (!attachment.contentType?.startsWith('image')) return;

    try {

        // =========================
        // โหลดรูป
        // =========================

        const response = await axios({
            url: attachment.url,
            responseType: 'arraybuffer'
        });

        fs.writeFileSync('slip.png', response.data);

        // =========================
        // OCR อ่านข้อความ
        // =========================

        const result = await Tesseract.recognize(
            'slip.png',
            'tha+eng'
        );

        const text = result.data.text;

        console.log("========== OCR ==========");
        console.log(text);
        console.log("=========================");

        // =========================
        // ตรวจว่าเป็นสลิปไหม
        // =========================

        const slipKeywords = [
            'โอนเงินสำเร็จ',
            'จำนวนเงิน',
            'บาท',
            'พร้อมเพย์',
            'krungthai',
            'k plus',
            'scb',
            'bangkok bank',
            'กรุงไทย',
            'กสิกร',
            'ไทยพาณิชย์'
        ];

        const isSlip = slipKeywords.some(word =>
            text.toLowerCase().includes(word.toLowerCase())
        );

        // ไม่ใช่สลิป = ไม่ตอบ
        if (!isSlip) return;

        // =========================
        // หา จำนวนเงิน
        // =========================

        let amount = 'ไม่พบ';

        const moneyRegex =
            /([0-9,]+\.[0-9]{2})/g;

        const moneyMatches = text.match(moneyRegex);

        if (moneyMatches && moneyMatches.length > 0) {

            let biggest = 0;

            for (const m of moneyMatches) {

                const value =
                    parseFloat(
                        m.replace(/,/g, '')
                    );

                if (value > biggest) {
                    biggest = value;
                }
            }

            amount = biggest.toFixed(2);
        }

        // =========================
        // หา ธนาคาร
        // =========================

        let bank = 'ไม่พบ';

        if (
            text.includes('กรุงไทย') ||
            text.toLowerCase().includes('krungthai')
        ) {
            bank = 'กรุงไทย';
        }
        else if (
            text.includes('กสิกร') ||
            text.toLowerCase().includes('k plus')
        ) {
            bank = 'กสิกรไทย';
        }
        else if (
            text.includes('ไทยพาณิชย์') ||
            text.toLowerCase().includes('scb')
        ) {
            bank = 'SCB';
        }
        else if (
            text.toLowerCase().includes('bangkok bank')
        ) {
            bank = 'Bangkok Bank';
        }

        // =========================
        // หา ชื่อผู้โอน
        // =========================

        let sender = 'ไม่พบ';

        const cleanText = text
            .replace(/\|/g, ' ')
            .replace(/:/g, ' ')
            .replace(/,/g, ' ')
            .replace(/\s+/g, ' ');

        // หา นาย / นาง / น.ส + ชื่อ
        const thaiNameRegex =
            /(นาย|นาง|น\.ส\.?)\s*([ก-๙]{2,20})/;

        const match =
            cleanText.match(thaiNameRegex);

        if (match) {

            // เอาแค่ คำนำหน้า + ชื่อจริง
            sender =
                `${match[1]} ${match[2]}`;
        }

        // =========================
        // ส่งข้อความ
        // =========================

        await message.reply(
`✅ ตรวจสอบสลิปสำเร็จ

💵 จำนวน: ${amount} บาท
👤 ผู้โอน: ${sender}
🏦 ธนาคาร: ${bank}`
        );

    } catch (error) {

        console.log("ERROR:", error);

        await message.reply(
            '❌ อ่านสลิปไม่สำเร็จ'
        );
    }
});

// =========================
// Login
// =========================

client.login(process.env.TOKEN);