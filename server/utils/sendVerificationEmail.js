const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
});
const sendVerificationEmail = (email, token) => {
  const verifyURL = `http://localhost:5000/api/auth/verify-email?token=${token}`;
  return transporter.sendMail({
    from: `"CallConnect" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email Address',
    html: `
      <h2>Welcome to CallConnect!</h2>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verifyURL}">Verify Email</a>
    `,
  });
};

module.exports = sendVerificationEmail;
