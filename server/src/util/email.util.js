const nodemailer = require('nodemailer')
const { DecryptString } = require('./cryptography.util')
require('dotenv').config()

const transporter = nodemailer.createTransport({
  host: `${process.env._EMAIL_HOST}`,
  port: `${process.env._EMAIL_PORT}`,
  secure: false,
  auth: {
    user: `${process.env._EMAIL_USER}`,
    pass: `${DecryptString(process.env._EMAIL_PASSWORD)}`,
  },
})

const SendOTPEmail = async (toEmail, otpCode) => {
  const mailOptions = {
    from: `"GHotel Management Sync" <${process.env._EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4F46E5;">Verify your Email</h2>
        <p>You are setting up a new Organization account.</p>
        <p>Your verification code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px; background: #f3f4f6; padding: 10px; display: inline-block; border-radius: 8px;">${otpCode}</h1>
        <p>This code expires in 5 minutes.</p>
        <p style="font-size: 12px; color: #888;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}

module.exports = { SendOTPEmail }
