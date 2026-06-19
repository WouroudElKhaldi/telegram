import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';

// DOM Elements
const apiIdInput = document.getElementById('api-id');
const apiHashInput = document.getElementById('api-hash');
const phoneInput = document.getElementById('phone-number');
const codeInput = document.getElementById('login-code');
const passwordInput = document.getElementById('password-2fa');
const connectBtn = document.getElementById('btn-connect');
const logoutBtn = document.getElementById('btn-logout');
const connectionBadge = document.getElementById('connection-badge');
const authOverlay = document.getElementById('auth-overlay');

const checkNumbersInput = document.getElementById('check-numbers');
const checkUsernamesInput = document.getElementById('check-usernames');
const inviteNumbersInput = document.getElementById('invite-numbers');
const inviteUsernamesInput = document.getElementById('invite-usernames');
const channelInput = document.getElementById('channel-peer');
const channelUsernameInput = document.getElementById('channel-peer-username');
const inviteLinkCheck = document.getElementById('chk-use-invite-link');
const inviteLinkCheckUsername = document.getElementById('chk-use-invite-link-username');

const checkBtn = document.getElementById('btn-check');
const checkUsernamesBtn = document.getElementById('btn-check-usernames');
const executeBtn = document.getElementById('btn-execute');
const executeUsernameBtn = document.getElementById('btn-execute-username');
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

// Load saved settings (Phone, API credentials & Session)
function loadSettings() {
  const envApiId = import.meta.env.VITE_TG_API_ID || '';
  const envApiHash = import.meta.env.VITE_TG_API_HASH || '';

  // Hide inputs if credentials exist in .env
  if (envApiId && envApiHash) {
    const apiInputsDiv = document.getElementById('api-credentials-inputs');
    if (apiInputsDiv) apiInputsDiv.classList.add('hidden');
  }

  const savedApiId = localStorage.getItem('tg_api_id') || envApiId;
  const savedApiHash = localStorage.getItem('tg_api_hash') || envApiHash;
  const savedPhone = localStorage.getItem('tg_phone');

  if (savedApiId) apiIdInput.value = savedApiId;
  if (savedApiHash) apiHashInput.value = savedApiHash;
  if (savedPhone) phoneInput.value = savedPhone;

  const savedSession = localStorage.getItem('tg_session');
  if (savedSession) {
    log('Saved session found. Connect to login automatically.', 'info');
  }
}

// Save settings to LocalStorage
function saveSettings() {
  localStorage.setItem('tg_api_id', apiIdInput.value.trim());
  localStorage.setItem('tg_api_hash', apiHashInput.value.trim());
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
    checkUsernamesBtn.removeAttribute('disabled');
    executeBtn.removeAttribute('disabled');
    executeUsernameBtn.removeAttribute('disabled');
    connectionBadge.textContent = 'Connected';
    connectionBadge.className = 'badge connected';
    logoutBtn.classList.remove('hidden');
    authOverlay.classList.add('hidden');
  } else {
    checkBtn.setAttribute('disabled', 'true');
    checkUsernamesBtn.setAttribute('disabled', 'true');
    executeBtn.setAttribute('disabled', 'true');
    executeUsernameBtn.setAttribute('disabled', 'true');
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
  
  // Load API keys from input
  const apiId = parseInt(apiIdInput.value.trim(), 10);
  const apiHash = apiHashInput.value.trim();
  const phone = phoneInput.value.trim();

  if (isNaN(apiId) || !apiHash || !phone) {
    log('Error: API credentials (API ID & API Hash) and Phone Number are required.', 'error');
    alert('Please enter your API ID, API Hash, and Phone Number to connect!');
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

// CSV download helper
function downloadCSV(filename, headers, rows) {
  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += headers.join(",") + "\n";
  
  rows.forEach(row => {
    const formatted = row.map(val => `"${String(val).replace(/"/g, '""')}"`);
    csvContent += formatted.join(",") + "\n";
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Robust helper to resolve a user by phone number
async function resolveUserByPhone(client, targetNumber) {
  const normalizedTarget = targetNumber.replace(/\D/g, '');
  if (!normalizedTarget) return null;

  const randomClientId = BigInt(Math.floor(Math.random() * 10000000));

  // 1. Try importing the contact
  try {
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

    // If successfully returned in users
    if (importResult.users && importResult.users.length > 0) {
      const found = importResult.users.find(u => u.phone && u.phone.replace(/\D/g, '') === normalizedTarget);
      if (found) return found;

      // Match via imported clientId mapping to userId
      if (importResult.imported && importResult.imported.length > 0) {
        const importedMatch = importResult.imported.find(i => i.clientId === randomClientId);
        if (importedMatch) {
          const userMatch = importResult.users.find(u => String(u.id) === String(importedMatch.userId));
          if (userMatch) return userMatch;
        }
      }
    }

    // If user ID was returned in imported list but not in users list
    if (importResult.imported && importResult.imported.length > 0) {
      const importedMatch = importResult.imported.find(i => i.clientId === randomClientId);
      if (importedMatch) {
        try {
          const user = await client.getEntity(importedMatch.userId);
          if (user) return user;
        } catch (e) {
          // Fall through
        }
      }
    }
  } catch (err) {
    log(`Import check warning for ${targetNumber}: ${err.message}`, 'warning');
  }

  // 2. If not found (might already be in contact list), fetch contacts list
  try {
    const contactsResult = await client.invoke(
      new Api.contacts.GetContacts({
        hash: BigInt(0),
      })
    );
    if (contactsResult && contactsResult.users) {
      const found = contactsResult.users.find(u => u.phone && u.phone.replace(/\D/g, '') === normalizedTarget);
      if (found) return found;
    }
  } catch (e) {
    // Fall through
  }

  // 3. Fallback to ResolvePhone
  try {
    const resolved = await client.invoke(
      new Api.contacts.ResolvePhone({
        phone: targetNumber,
      })
    );
    if (resolved && resolved.users && resolved.users.length > 0) {
      return resolved.users[0];
    }
  } catch (e) {
    // Fall through
  }

  return null;
}

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

  const results = [];

  for (const targetNumber of numbers) {
    try {
      log(`Checking: ${targetNumber}...`, 'info');
      const user = await resolveUserByPhone(client, targetNumber);
      
      if (user) {
        const usernameStr = user.username ? `@${user.username}` : 'None';
        log(`✅ REGISTERED: ${targetNumber} is on Telegram! (${user.firstName || ''} ${user.lastName || ''}, ${usernameStr})`, 'success');
        results.push([targetNumber, usernameStr, 'Yes']);
      } else {
        log(`❌ NOT REGISTERED: ${targetNumber} is not on Telegram.`, 'error');
        results.push([targetNumber, 'None', 'Has no']);
      }
    } catch (err) {
      log(`Error checking ${targetNumber}: ${err.message}`, 'error');
      results.push([targetNumber, 'Error', `Error: ${err.message}`]);
    }
  }

  // Sort: 'Has no' on top, then 'Yes', then others
  results.sort((a, b) => {
    if (a[2] === 'Has no' && b[2] !== 'Has no') return -1;
    if (a[2] !== 'Has no' && b[2] === 'Has no') return 1;
    return 0;
  });

  log('Validation complete. Exporting Excel (CSV)...', 'system');
  downloadCSV(`telegram_check_results_${new Date().toISOString().slice(0,10)}.csv`, ['Phone Number', 'Username', 'Registered on Telegram'], results);
  checkBtn.removeAttribute('disabled');
});

// 1.5 Check Usernames Action
checkUsernamesBtn.addEventListener('click', async () => {
  const usernames = parseNumbers(checkUsernamesInput.value);
  if (usernames.length === 0) {
    log('Please enter at least one username to check.', 'warning');
    return;
  }

  if (!client || !client.connected) {
    log('Error: Client is not connected.', 'error');
    return;
  }

  checkUsernamesBtn.setAttribute('disabled', 'true');
  log(`Starting validation for ${usernames.length} username(s)...`, 'info');

  const results = [];

  for (let username of usernames) {
    try {
      username = username.trim();
      if (!username.startsWith('@')) {
        username = `@${username}`;
      }
      log(`Checking username: ${username}...`, 'info');
      
      const entity = await client.getEntity(username);
      if (entity && (entity.className === 'User' || entity.className === 'Chat' || entity.className === 'Channel')) {
        const typeStr = entity.className;
        let nameStr = entity.firstName || entity.title || 'None';
        if (entity.lastName) nameStr += ` ${entity.lastName}`;
        
        const phoneStr = entity.phone ? `+${entity.phone}` : 'Hidden';
        
        log(`✅ FOUND: ${username} exists! (Type: ${typeStr}, Name: ${nameStr}, Phone: ${phoneStr})`, 'success');
        results.push([username, typeStr, nameStr, phoneStr, 'Yes']);
      } else {
        log(`❌ NOT FOUND: ${username} does not exist.`, 'error');
        results.push([username, 'Unknown', 'None', 'None', 'No']);
      }
    } catch (err) {
      if (err.message.includes("Could not find") || err.message.includes("Cannot find") || err.message.includes("ValueError")) {
        log(`❌ NOT FOUND: ${username} does not exist.`, 'error');
        results.push([username, 'None', 'None', 'None', 'No']);
      } else {
        log(`Error checking username ${username}: ${err.message}`, 'error');
        results.push([username, 'Error', `Error: ${err.message}`, 'None', 'Error']);
      }
    }
  }

  log('Validation complete. Exporting Excel (CSV)...', 'system');
  downloadCSV(`telegram_username_results_${new Date().toISOString().slice(0,10)}.csv`, ['Username', 'Type', 'Name', 'Phone Number', 'Exists'], results);
  checkUsernamesBtn.removeAttribute('disabled');
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
  const actionResults = [];

  try {
    if (inviteOnly) {
      // Direct raw link constructed from user input to bypass ExportChatInvite expiration issues
      const inviteLink = channelVal.startsWith('http') ? channelVal : `https://t.me/${channelVal.replace('@', '')}`;
      log(`Using invite link: ${inviteLink}`, 'info');
      log(`Starting invite link messaging flow for ${numbers.length} number(s)...`, 'info');

      for (const targetNumber of numbers) {
        try {
          log(`Resolving user for messaging: ${targetNumber}...`, 'info');
          const targetUser = await resolveUserByPhone(client, targetNumber);

          if (!targetUser) {
            log(`❌ Fail: ${targetNumber} is not registered on Telegram.`, 'error');
            actionResults.push([targetNumber, 'Failed: Not registered on Telegram']);
            continue;
          }

          log(`User resolved: ${targetUser.firstName || ''} (ID: ${targetUser.id}). Sending message...`, 'info');

          // Send message with the invite link
          await client.sendMessage(targetUser.id, {
            message: `Hi! Here is the invite link to join our channel: ${inviteLink}`
          });

          log(`✉️ Message sent successfully to ${targetNumber}!`, 'success');
          actionResults.push([targetNumber, 'Success']);

          // Clean up contact from contact list
          try {
            await client.invoke(new Api.contacts.DeleteContacts({
              id: [targetUser.id]
            }));
          } catch (delErr) {}

        } catch (err) {
          log(`❌ Fail to send link to ${targetNumber}: ${err.message}`, 'error');
          actionResults.push([targetNumber, `Failed: ${err.message}`]);
        }
      }
    } else {
      log(`Resolving channel target: "${channelVal}"...`, 'info');
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
      log(`Starting invite flow for ${numbers.length} number(s)...`, 'info');

      for (const targetNumber of numbers) {
        try {
          log(`Resolving user for: ${targetNumber}...`, 'info');
          const targetUser = await resolveUserByPhone(client, targetNumber);

          if (!targetUser) {
            log(`❌ Fail: ${targetNumber} is not registered on Telegram.`, 'error');
            actionResults.push([targetNumber, 'Failed: Not registered on Telegram']);
            continue;
          }

          log(`User resolved: ${targetUser.firstName || ''} (ID: ${targetUser.id}). Inviting...`, 'info');

          await client.invoke(
            new Api.channels.InviteToChannel({
              channel: channelEntity,
              users: [targetUser],
            })
          );

          log(`🎉 Success! ${targetNumber} has been added to the channel.`, 'success');
          actionResults.push([targetNumber, 'Success']);

          // Clean up contact from contact list
          try {
            await client.invoke(new Api.contacts.DeleteContacts({
              id: [targetUser.id]
            }));
          } catch (delErr) {}

        } catch (err) {
          let errorMsg = err.message;
          if (err.message.includes("USER_PRIVACY_RESTRICTED")) {
            errorMsg = "Privacy settings prevent direct invites";
            log(`❌ Fail: ${targetNumber}'s privacy settings prevent direct invitations.`, 'error');
          } else if (err.message.includes("CHANNELS_ADMIN_PUBLIC_LEFT")) {
            errorMsg = "No admin permissions to invite users";
            log(`❌ Fail: You do not have administrator permissions to invite users.`, 'error');
          } else if (err.message.includes("USERS_TOO_MUCH")) {
            errorMsg = "Maximum invite limit (200) exceeded";
            log(`❌ Fail: Maximum direct invitation limit (200) exceeded.`, 'error');
          } else {
            log(`❌ Fail for ${targetNumber}: ${err.message}`, 'error');
          }
          actionResults.push([targetNumber, `Failed: ${errorMsg}`]);
        }
      }
    }
  } catch (err) {
    log(`Channel Action failed: ${err.message}`, 'error');
  }

  log('Action execution complete. Exporting Excel (CSV)...', 'system');
  downloadCSV(`telegram_invite_results_${new Date().toISOString().slice(0,10)}.csv`, ['Phone Number', 'Status'], actionResults);
  executeBtn.removeAttribute('disabled');
});

// 3. Add / Get Invite Action (by Username)
executeUsernameBtn.addEventListener('click', async () => {
  const usernames = parseNumbers(inviteUsernamesInput.value);
  const channelVal = channelUsernameInput.value.trim();
  const inviteOnly = inviteLinkCheckUsername.checked;

  if (usernames.length === 0) {
    log('Please enter at least one username to invite.', 'warning');
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

  executeUsernameBtn.setAttribute('disabled', 'true');
  const actionResults = [];

  try {
    let channelEntity = null;
    let inviteHash = null;

    if (!inviteOnly) {
      log(`Resolving channel target: "${channelVal}"...`, 'info');
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
    }

    const inviteLink = channelVal.startsWith('http') ? channelVal : `https://t.me/${channelVal.replace('@', '')}`;

    if (inviteOnly) {
      log(`Using invite link: ${inviteLink}`, 'info');
      log(`Starting invite link messaging flow for ${usernames.length} username(s)...`, 'info');
    } else {
      log(`Starting direct invite flow for ${usernames.length} username(s)...`, 'info');
    }

    for (let username of usernames) {
      try {
        username = username.trim();
        if (!username.startsWith('@')) {
          username = `@${username}`;
        }
        log(`Resolving user: ${username}...`, 'info');

        const targetUser = await client.getEntity(username);

        if (!targetUser) {
          log(`❌ Fail: ${username} does not exist on Telegram.`, 'error');
          actionResults.push([username, 'Failed: Not registered on Telegram']);
          continue;
        }

        if (inviteOnly) {
          log(`User resolved: ${targetUser.firstName || ''} (ID: ${targetUser.id}). Sending message...`, 'info');
          await client.sendMessage(targetUser.id, {
            message: `Hi! Here is the invite link to join our channel: ${inviteLink}`
          });
          log(`✉️ Message sent successfully to ${username}!`, 'success');
          actionResults.push([username, 'Success']);
        } else {
          log(`User resolved: ${targetUser.firstName || ''} (ID: ${targetUser.id}). Inviting...`, 'info');
          await client.invoke(
            new Api.channels.InviteToChannel({
              channel: channelEntity,
              users: [targetUser],
            })
          );
          log(`🎉 Success! ${username} has been added to the channel.`, 'success');
          actionResults.push([username, 'Success']);
        }

      } catch (err) {
        let errorMsg = err.message;
        if (err.message.includes("USER_PRIVACY_RESTRICTED")) {
          errorMsg = "Privacy settings prevent direct invites";
          log(`❌ Fail: ${username}'s privacy settings prevent direct invitations.`, 'error');
        } else if (err.message.includes("CHANNELS_ADMIN_PUBLIC_LEFT")) {
          errorMsg = "No admin permissions to invite users";
          log(`❌ Fail: You do not have administrator permissions to invite users.`, 'error');
        } else if (err.message.includes("USERS_TOO_MUCH")) {
          errorMsg = "Maximum invite limit (200) exceeded";
          log(`❌ Fail: Maximum direct invitation limit (200) exceeded.`, 'error');
        } else if (err.message.includes("Could not find") || err.message.includes("ValueError") || err.message.includes("Cannot find")) {
          errorMsg = "Username does not exist";
          log(`❌ Fail: Username ${username} does not exist.`, 'error');
        } else {
          log(`❌ Fail for ${username}: ${err.message}`, 'error');
        }
        actionResults.push([username, `Failed: ${errorMsg}`]);
      }
    }
  } catch (err) {
    log(`Channel Action failed: ${err.message}`, 'error');
  }

  log('Action execution complete. Exporting Excel (CSV)...', 'system');
  downloadCSV(`telegram_invite_username_results_${new Date().toISOString().slice(0,10)}.csv`, ['Username', 'Status'], actionResults);
  executeUsernameBtn.removeAttribute('disabled');
});
