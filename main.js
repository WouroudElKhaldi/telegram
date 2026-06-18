import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';

// DOM Elements
const phoneInput = document.getElementById('phone-number');
const codeInput = document.getElementById('login-code');
const passwordInput = document.getElementById('password-2fa');
const connectBtn = document.getElementById('btn-connect');
const logoutBtn = document.getElementById('btn-logout');
const connectionBadge = document.getElementById('connection-badge');
const authOverlay = document.getElementById('auth-overlay');

const checkNumbersInput = document.getElementById('check-numbers');
const inviteNumbersInput = document.getElementById('invite-numbers');
const channelInput = document.getElementById('channel-peer');
const inviteLinkCheck = document.getElementById('chk-use-invite-link');

const checkBtn = document.getElementById('btn-check');
const executeBtn = document.getElementById('btn-execute');
const consoleLog = document.getElementById('console-log');
const clearConsoleBtn = document.getElementById('btn-clear-console');

// UI Visibility Elements
const loginStepCodeDiv = document.getElementById('login-step-code');
const loginStep2FaDiv = document.getElementById('login-step-2fa');

// Application State
let client = null;
let codeResolver = null;
let passwordResolver = null;
let isConnecting = false;

// Custom Logging Helper
function log(message, type = 'system') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
  
  consoleLog.appendChild(line);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

// Load saved settings (Phone & Session)
function loadSettings() {
  const savedPhone = localStorage.getItem('tg_phone');
  if (savedPhone) phoneInput.value = savedPhone;

  const savedSession = localStorage.getItem('tg_session');
  if (savedSession) {
    log('Saved session found. Connect to login automatically.', 'info');
  }
}

// Save settings to LocalStorage
function saveSettings() {
  localStorage.setItem('tg_phone', phoneInput.value.trim());
}

// Clear UI Inputs for verification code & 2FA
function resetAuthUI() {
  loginStepCodeDiv.classList.add('hidden');
  loginStep2FaDiv.classList.add('hidden');
  codeInput.value = '';
  passwordInput.value = '';
  codeResolver = null;
  passwordResolver = null;
}

// Update Action Buttons States based on connection status
function updateActionButtons(connected) {
  if (connected) {
    checkBtn.removeAttribute('disabled');
    executeBtn.removeAttribute('disabled');
    connectionBadge.textContent = 'Connected';
    connectionBadge.className = 'badge connected';
    logoutBtn.classList.remove('hidden');
    authOverlay.classList.add('hidden');
  } else {
    checkBtn.setAttribute('disabled', 'true');
    executeBtn.setAttribute('disabled', 'true');
    connectionBadge.textContent = 'Disconnected';
    connectionBadge.className = 'badge disconnected';
    logoutBtn.classList.add('hidden');
    authOverlay.classList.remove('hidden');
  }
}

// Parse input numbers (handles comma/line/space separation)
function parseNumbers(inputStr) {
  return inputStr
    .split(/[\n,]+/)
    .map(num => num.trim())
    .filter(num => num.length > 0);
}

// Initial load
loadSettings();

// Clear Console Action
clearConsoleBtn.addEventListener('click', () => {
  consoleLog.innerHTML = '';
  log('Console cleared.', 'system');
});

// Authentication Button Handler
connectBtn.addEventListener('click', async () => {
  // If we're currently waiting for a code input
  if (codeResolver && codeInput.value.trim() !== '') {
    log('Submitting login code...', 'info');
    codeResolver(codeInput.value.trim());
    return;
  }

  // If we're currently waiting for a 2FA password input
  if (passwordResolver && passwordInput.value.trim() !== '') {
    log('Submitting 2FA password...', 'info');
    passwordResolver(passwordInput.value.trim());
    return;
  }

  // Otherwise, start fresh connection
  if (isConnecting) return;
  
  // Load API keys from environment
  const apiId = parseInt(import.meta.env.VITE_TG_API_ID, 10);
  const apiHash = import.meta.env.VITE_TG_API_HASH;
  const phone = phoneInput.value.trim();

  if (isNaN(apiId) || !apiHash || !phone) {
    log('Error: API credentials not defined in .env or phone number is empty.', 'error');
    alert('Please configure your VITE_TG_API_ID and VITE_TG_API_HASH in the .env file!');
    return;
  }

  saveSettings();
  isConnecting = true;
  connectBtn.setAttribute('disabled', 'true');
  connectionBadge.textContent = 'Connecting...';
  connectionBadge.className = 'badge connecting';
  resetAuthUI();

  const sessionString = localStorage.getItem('tg_session') || '';
  const stringSession = new StringSession(sessionString);

  try {
    log('Connecting to Telegram servers...', 'info');
    client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => phone,
      phoneCode: async () => {
        log('Verification code requested. Check your Telegram app.', 'warning');
        loginStepCodeDiv.classList.remove('hidden');
        connectBtn.textContent = 'Submit Code';
        connectBtn.removeAttribute('disabled');
        isConnecting = false;
        return new Promise((resolve) => {
          codeResolver = resolve;
        });
      },
      password: async () => {
        log('2FA Password requested. Enter your password below.', 'warning');
        loginStep2FaDiv.classList.remove('hidden');
        connectBtn.textContent = 'Submit 2FA';
        connectBtn.removeAttribute('disabled');
        isConnecting = false;
        return new Promise((resolve) => {
          passwordResolver = resolve;
        });
      },
      onError: (err) => {
        log(`Auth Error: ${err.message}`, 'error');
      }
    });

    log('Successfully connected to Telegram!', 'success');
    
    // Save session string
    const newSession = client.session.save();
    localStorage.setItem('tg_session', newSession);
    
    resetAuthUI();
    updateActionButtons(true);
  } catch (err) {
    log(`Connection failed: ${err.message}`, 'error');
    updateActionButtons(false);
  } finally {
    isConnecting = false;
    connectBtn.removeAttribute('disabled');
  }
});

// Logout Button Action
logoutBtn.addEventListener('click', async () => {
  if (client) {
    try {
      log('Disconnecting Telegram client...', 'info');
      await client.disconnect();
    } catch (e) {}
  }
  localStorage.removeItem('tg_session');
  log('Logged out. Session cache cleared.', 'system');
  resetAuthUI();
  updateActionButtons(false);
});

// Auto login if session already exists
(async () => {
  const sessionString = localStorage.getItem('tg_session');
  const apiId = parseInt(import.meta.env.VITE_TG_API_ID, 10);
  const apiHash = import.meta.env.VITE_TG_API_HASH;
  
  if (sessionString && !isNaN(apiId) && apiHash) {
    try {
      log('Auto-connecting with saved session...', 'info');
      client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
        connectionRetries: 3
      });
      await client.connect();
      if (await client.checkAuthorization()) {
        log('Auto-connected successfully!', 'success');
        updateActionButtons(true);
      } else {
        log('Saved session expired or invalid. Please login again.', 'warning');
        updateActionButtons(false);
      }
    } catch (e) {
      log(`Auto-connection failed: ${e.message}`, 'error');
      updateActionButtons(false);
    }
  }
})();

// 1. Check Numbers Action
checkBtn.addEventListener('click', async () => {
  const numbers = parseNumbers(checkNumbersInput.value);
  if (numbers.length === 0) {
    log('Please enter at least one phone number to check.', 'warning');
    return;
  }

  if (!client || !client.connected) {
    log('Error: Client is not connected.', 'error');
    return;
  }

  checkBtn.setAttribute('disabled', 'true');
  log(`Starting validation for ${numbers.length} phone number(s)...`, 'info');

  for (const targetNumber of numbers) {
    try {
      log(`Checking: ${targetNumber}...`, 'info');
      const randomClientId = BigInt(Math.floor(Math.random() * 10000000));
      
      const result = await client.invoke(
        new Api.contacts.ImportContacts({
          contacts: [
            new Api.InputPhoneContact({
              clientId: randomClientId,
              phone: targetNumber,
              firstName: "Check",
              lastName: "Number",
            }),
          ],
        })
      );
      
      if (result.users && result.users.length > 0) {
        const user = result.users[0];
        log(`✅ REGISTERED: ${targetNumber} is on Telegram! (${user.firstName} ${user.lastName || ''}, @${user.username || 'NoUsername'})`, 'success');
        
        // Clean up contact list so it doesn't get cluttered
        try {
          await client.invoke(new Api.contacts.DeleteContacts({
            id: [user.id]
          }));
        } catch (delErr) {
          // Silent catch for deletion error
        }
      } else {
        log(`❌ NOT REGISTERED: ${targetNumber} is not on Telegram.`, 'error');
      }
    } catch (err) {
      log(`Error checking ${targetNumber}: ${err.message}`, 'error');
    }
  }

  log('Validation complete.', 'system');
  checkBtn.removeAttribute('disabled');
});

// 2. Add / Get Invite Action
executeBtn.addEventListener('click', async () => {
  const numbers = parseNumbers(inviteNumbersInput.value);
  const channelVal = channelInput.value.trim();
  const inviteOnly = inviteLinkCheck.checked;

  if (numbers.length === 0) {
    log('Please enter at least one phone number to invite.', 'warning');
    return;
  }

  if (!channelVal) {
    log('Please specify a target Channel Username, Link, or ID.', 'warning');
    return;
  }

  if (!client || !client.connected) {
    log('Error: Client is not connected.', 'error');
    return;
  }

  executeBtn.setAttribute('disabled', 'true');
  log(`Resolving channel target: "${channelVal}"...`, 'info');

  try {
    let channelEntity = null;
    let inviteHash = null;

    if (channelVal.includes('t.me/+')) {
      inviteHash = channelVal.split('t.me/+')[1].split('?')[0].trim();
    } else if (channelVal.includes('t.me/joinchat/')) {
      inviteHash = channelVal.split('t.me/joinchat/')[1].split('?')[0].trim();
    }

    if (inviteHash) {
      log(`Checking invite link hash: "${inviteHash}"...`, 'info');
      try {
        const inviteInfo = await client.invoke(
          new Api.messages.CheckChatInvite({
            hash: inviteHash
          })
        );
        if (inviteInfo.chat) {
          channelEntity = inviteInfo.chat;
        } else {
          log(`Joining channel via invite link...`, 'info');
          const updates = await client.invoke(
            new Api.messages.ImportChatInvite({
              hash: inviteHash
            })
          );
          if (updates.chats && updates.chats.length > 0) {
            channelEntity = updates.chats[0];
          } else if (updates.chat) {
            channelEntity = updates.chat;
          }
        }
      } catch (checkErr) {
        if (checkErr.message.includes("INVITE_HASH_EXPIRED")) {
          throw new Error("The invite link has expired or is invalid.");
        } else {
          log(`Direct check failed: ${checkErr.message}. Trying to join directly...`, 'warning');
          const updates = await client.invoke(
            new Api.messages.ImportChatInvite({
              hash: inviteHash
            })
          );
          if (updates.chats && updates.chats.length > 0) {
            channelEntity = updates.chats[0];
          } else if (updates.chat) {
            channelEntity = updates.chat;
          }
        }
      }
    } else {
      channelEntity = await client.getEntity(channelVal);
    }

    if (!channelEntity) {
      throw new Error("Could not resolve target channel entity.");
    }

    log(`Channel resolved successfully: ID ${channelEntity.id || channelEntity.chatId || 'unknown'}`, 'success');

    if (inviteOnly) {
      log('Requesting chat invite link...', 'info');
      const inviteLinkResult = await client.invoke(
        new Api.messages.ExportChatInvite({
          peer: channelEntity
        })
      );
      log(`🎉 Success! Invite link generated: <a href="${inviteLinkResult.link}" target="_blank" style="color: #34d399; text-decoration: underline;">${inviteLinkResult.link}</a>`, 'success');
    } else {
      log(`Starting invite flow for ${numbers.length} number(s)...`, 'info');
      
      for (const targetNumber of numbers) {
        try {
          log(`Resolving user for: ${targetNumber}...`, 'info');
          const randomClientId = BigInt(Math.floor(Math.random() * 10000000));
          
          const importResult = await client.invoke(
            new Api.contacts.ImportContacts({
              contacts: [
                new Api.InputPhoneContact({
                  clientId: randomClientId,
                  phone: targetNumber,
                  firstName: "Channel",
                  lastName: "Member",
                }),
              ],
            })
          );

          if (!importResult.users || importResult.users.length === 0) {
            log(`❌ Fail: ${targetNumber} is not registered on Telegram.`, 'error');
            continue;
          }

          const targetUser = importResult.users[0];
          log(`User resolved: ${targetUser.firstName} (ID: ${targetUser.id}). Inviting...`, 'info');

          await client.invoke(
            new Api.channels.InviteToChannel({
              channel: channelEntity,
              users: [targetUser],
            })
          );

          log(`🎉 Success! ${targetNumber} has been added to the channel.`, 'success');

          // Clean up contact from contact list
          try {
            await client.invoke(new Api.contacts.DeleteContacts({
              id: [targetUser.id]
            }));
          } catch (delErr) {}

        } catch (err) {
          if (err.message.includes("USER_PRIVACY_RESTRICTED")) {
            log(`❌ Fail: ${targetNumber}'s privacy settings prevent direct invitations.`, 'error');
          } else if (err.message.includes("CHANNELS_ADMIN_PUBLIC_LEFT")) {
            log(`❌ Fail: You do not have administrator permissions to invite users.`, 'error');
          } else if (err.message.includes("USERS_TOO_MUCH")) {
            log(`❌ Fail: Maximum direct invitation limit (200) exceeded.`, 'error');
          } else {
            log(`❌ Fail for ${targetNumber}: ${err.message}`, 'error');
          }
        }
      }
    }
  } catch (err) {
    log(`Channel Action failed: ${err.message}`, 'error');
  }

  log('Action execution complete.', 'system');
  executeBtn.removeAttribute('disabled');
});
