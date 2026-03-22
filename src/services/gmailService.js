/**
 * gmailService.js
 * Handles Google OAuth2 and Gmail Draft Creation for OpsTrack
 */

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE'; // User needs to provide this
const SCOPES = 'https://www.googleapis.com/auth/gmail.compose';

let tokenClient;
let accessToken = null;

/**
 * Encodes a string to Base64URL (required by Gmail API)
 */
const base64urlEncode = (str) => {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Creates a raw MIME email message
 */
const createRawMessage = (to, subject, htmlBody) => {
  const message = [
    `To: ${to}`,
    'Subject: ' + subject,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    htmlBody
  ].join('\r\n');
  return base64urlEncode(message);
};

export const initGoogleAuth = () => {
  // To be implemented using Google Identity Services (GIS)
};

export const createGmailDraft = async (to, subject, htmlBody) => {
  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  const raw = createRawMessage(to, subject, htmlBody);
  
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: { raw }
    })
  });

  return await response.json();
};
