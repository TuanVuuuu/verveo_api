import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
  const verificationUrl = `${process.env.APP_URL || 'http://localhost:8000'}/auth/verify?token=${token}`;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify your Verveo account',
    html: `
      <h2>Welcome to Verveo!</h2>
      <p>Please click the link below to verify your account:</p>
      <a href="${verificationUrl}">Verify Account</a>
    `
  });
};
