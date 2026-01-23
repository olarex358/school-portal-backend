require('dotenv').config();
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, html) => {
    const msg = {
        to: to,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: subject,
        html: html,
    };

    try {
        if (!to || !subject || !html) {
            throw new Error('Recipient, subject, and HTML body are required.');
        }
        await sgMail.send(msg);
        console.log('Email sent successfully!');
    } catch (error) {
        console.error('Error sending email:', error);
        if (error.response) {
            console.error(error.response.body);
        }
        throw error;
    }
};

module.exports = { sendEmail };