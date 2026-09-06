const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  // profileFolder: path where prismarine-auth stores credentials for this user
  profileFolder: { type: String, required: true },
  accessToken: { type: String },
  refreshToken: { type: String },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: () => new Date() }
});

module.exports = mongoose.model('Account', AccountSchema);
