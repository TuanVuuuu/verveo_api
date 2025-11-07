import * as brevo from '@getbrevo/brevo';

const getApiInstance = () => {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not set in environment variables');
  }
  
  const apiInstance = new brevo.TransactionalEmailsApi();
  
  // Set API key using setApiKey method
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
  
  return apiInstance;
};

export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
  const verificationUrl = `${process.env.APP_URL || 'http://localhost:8000'}/auth/verify?token=${token}`;
  
  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = 'Verify your Verveo account';
  sendSmtpEmail.htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #667eea;">Welcome to Verveo!</h2>
      <p>Thank you for registering with Verveo. Please click the link below to verify your account:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" 
           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                  color: white; 
                  padding: 12px 30px; 
                  text-decoration: none; 
                  border-radius: 5px; 
                  display: inline-block; 
                  font-weight: bold;">
          Verify Account
        </a>
      </div>
      
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px;">
        This email was sent automatically from Verveo. Please do not reply to this email.
      </p>
    </div>
  `;
  sendSmtpEmail.sender = {
    name: process.env.BREVO_FROM_NAME || 'Verveo',
    email: process.env.BREVO_FROM_EMAIL!,
  };
  sendSmtpEmail.to = [{ email }];

  try {
    const apiInstance = getApiInstance();
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8000'}/reset-password.html?token=${token}`;
  
  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = 'Đặt lại mật khẩu Verveo';
  sendSmtpEmail.htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #667eea;">Đặt lại mật khẩu Verveo</h2>
      <p>Xin chào,</p>
      <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Verveo của mình. Nhấp vào nút bên dưới để đặt mật khẩu mới:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                  color: white; 
                  padding: 12px 30px; 
                  text-decoration: none; 
                  border-radius: 5px; 
                  display: inline-block; 
                  font-weight: bold;">
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
  `;
  sendSmtpEmail.sender = {
    name: process.env.BREVO_FROM_NAME || 'Verveo',
    email: process.env.BREVO_FROM_EMAIL!,
  };
  sendSmtpEmail.to = [{ email }];

  try {
    const apiInstance = getApiInstance();
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};
