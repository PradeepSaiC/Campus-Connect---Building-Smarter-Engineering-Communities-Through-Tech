import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};

// Verify email configuration
const emailFrom = process.env.EMAIL_FROM || 'noreply@campusconnect.com';
if (!emailFrom || !emailConfig.auth.user || !emailConfig.auth.pass) {

// Verify connection configuration
transporter.verify(function(error) {
  if (error) {
    console.error('Error verifying email configuration:', error.message);
    console.error('Please check your credentials and ensure "Less secure app access" is enabled in your Google Account settings');
    process.exit(1);
  } else {
    console.log('Email server is ready to send messages');
  }
});

/**
 * Send an email using Nodemailer
 * @param {Object} options - Email options
 * @param {string|Array} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text version of the email
 * @param {string} [options.html] - HTML version of the email (optional)
 * @returns {Promise<Object>} - Send operation result
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // Setup email data
    const mailOptions = {
      from: `"CampusConnect" <${process.env.EMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text,
      html: html || text,
    };

    // Send mail with defined transport object
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', info.messageId);
    return { 
      success: true, 
      data: {
        messageId: info.messageId
      } 
    };
  } catch (error) {
    console.error('Error sending email:', error.message);
    return { 
      success: false, 
      error: error.message
    };
  }
};

// Example usage:
/*
await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to CampusConnect!',
  text: 'Thank you for signing up!',
  html: '<strong>Thank you for signing up to CampusConnect!</strong>',
});
*/
