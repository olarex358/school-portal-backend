require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

const sendSMS = async (to, body) => {
    try {
        if (!to || !body) {
            throw new Error('Recipient and message body are required.');
        }
        const message = await client.messages.create({
            to: to,
            from: process.env.TWILIO_PHONE_NUMBER,
            body: body,
        });
        console.log(`SMS sent successfully: ${message.sid}`);
        return message;
    } catch (error) {
        console.error('Error sending SMS:', error);
        throw error;
    }
};

module.exports = { sendSMS };