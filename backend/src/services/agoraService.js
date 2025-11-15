import pkg from 'agora-token';
import dotenv from 'dotenv';
dotenv.config();
const { RtcTokenBuilder, RtcRole } = pkg;

class AgoraService {
  constructor() {
    this.appId = process.env.AGORA_APP_ID;
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE;
    
    if (!this.appId || !this.appCertificate) {
      console.warn('⚠️ Agora credentials not found. Please set AGORA_APP_ID and AGORA_APP_CERTIFICATE in your environment variables.');
    }
  }

  // Generate RTC token for video calls
  generateRtcToken(channelName, account, role = RtcRole.PUBLISHER, privilegeExpiredTs = 3600) {
    if (!this.appId || !this.appCertificate) {
      throw new Error('Agora credentials not configured');
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expirationTimestamp = currentTimestamp + privilegeExpiredTs;

    // Use account-based tokens so we can use Mongo ObjectId strings as UIDs consistently with the client
    return RtcTokenBuilder.buildTokenWithUserAccount(
      this.appId,
      this.appCertificate,
      channelName,
      account,
      role,
      expirationTimestamp
    );
  }

  // Generate channel name for video calls
  generateChannelName(callerId, receiverId) {
    const sortedIds = [String(callerId), String(receiverId)].sort();
    const a = sortedIds[0].slice(-6);
    const b = sortedIds[1].slice(-6);
    const ts = Date.now().toString(36); // shorter than decimal
    const name = `c_${a}_${b}_${ts}`;
    return name.length > 64 ? name.slice(0, 64) : name;
  }

  // Generate channel name for live streams
  generateStreamChannelName(streamerId, title) {
    const idPart = String(streamerId).slice(-6);
    const sanitizedTitle = (title || '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .slice(0, 20);
    const ts = Date.now().toString(36);
    let name = `s_${idPart}_${sanitizedTitle}_${ts}`;
    if (name.endsWith('_')) name = name.slice(0, -1);
    return name.length > 64 ? name.slice(0, 64) : name;
  }

  // Validate channel name
  validateChannelName(channelName) {
    return typeof channelName === 'string'
      && channelName.length > 0
      && channelName.length <= 64
      && /^[a-zA-Z0-9_-]+$/.test(channelName);
  }

  // Get app ID
  getAppId() {
    if (!this.appId) {
      throw new Error('Agora App ID not configured');
    }
    return this.appId;
  }
}

export default new AgoraService(); 