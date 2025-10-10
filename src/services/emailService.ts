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

export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8000'}/reset-password.html?token=${token}`;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Đặt lại mật khẩu Verveo',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Đặt lại mật khẩu Verveo</h2>
        <p>Xin chào,</p>
        <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Verveo của mình. Nhấp vào nút bên dưới để đặt mật khẩu mới:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Đặt lại mật khẩu
          </a>
        </div>
        
        <p><strong>Lưu ý quan trọng:</strong></p>
        <ul>
          <li>Link này sẽ hết hạn sau <strong>1 giờ</strong></li>
          <li>Link chỉ có thể sử dụng <strong>một lần</strong></li>
          <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này</li>
        </ul>
        
        <p>Nếu nút không hoạt động, bạn có thể copy và paste link này vào trình duyệt:</p>
        <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          Email này được gửi tự động từ hệ thống Verveo. Vui lòng không trả lời email này.
        </p>
      </div>
    `
  });
};
