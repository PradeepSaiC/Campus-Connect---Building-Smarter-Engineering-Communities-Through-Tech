import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send an email using SendGrid
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text version of the email
 * @param {string} options.html - HTML version of the email (optional)
 * @returns {Promise<Object>} - SendGrid response
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const msg = {
      to,
      from: process.env.EMAIL_FROM || 'noreply@campusconnect.com',
      subject,
      text,
      html: html || text, // Use HTML if provided, otherwise fallback to text
    };

    const response = await sgMail.send(msg);
    console.log('Email sent successfully:', response[0].statusCode);
    return { success: true, data: response[0] };
  } catch (error) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('Error response body:', error.response.body);
    }
    return { success: false, error: error.message };
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
