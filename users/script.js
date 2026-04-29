// Firebase init
const firebaseConfig = {
  apiKey: 'AIzaSyDo9xLGYs3rzhgJKV_qVEyNxCUaRratbXc',
  authDomain: 'https://chat-linos-default-rtdb.firebaseio.com/',
  projectId: 'chat-linos',
  storageBucket: 'gs://chat-linos.appspot.com',
  messagingSenderId: '335597863138',
  appId: '1:335597863138:web:bb28765ae4a27bae99debb'
};

firebase.initializeApp(firebaseConfig);

const database = firebase.database();
const storage = firebase.storage();
const messagesRef = database.ref('dms');
const imagesRef = storage.ref('images');

const GIPHY_KEY = 'WSMJA7UnJFzduk6w1U0NB1OGlMPvntFi';

// DOM refs
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const usernameInput = document.getElementById('username-input');
const recipientInput = document.getElementById('recipient-input');
const sendBtn = document.getElementById('send-btn');
const emojiBtn = document.getElementById('emoji-btn');
const gifBtn = document.getElementById('gif-btn');
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageInput = document.getElementById('image-input');
const emojiPicker = document.getElementById('emoji-picker');
const gifPicker = document.getElementById('gif-picker');
const emojiSearch = document.getElementById('emoji-search');
const gifSearch = document.getElementById('gif-search');
const emojiGrid = document.getElementById('emoji-grid');
const gifGrid = document.getElementById('gif-grid');
const previewPopup = document.getElementById('preview-popup');
const popupImage = document.getElementById('popup-image');
const closePreviewBtn = document.getElementById('close-preview-btn');
const uploadOverlay = document.getElementById('upload-overlay');
const uploadProgressBar = document.getElementById('upload-progress-bar');
const uploadProgressText = document.getElementById('upload-progress-text');
const imagePreviewBar = document.getElementById('image-preview-bar');
const ephemeralCheckbox = document.getElementById('ephemeral-checkbox');
const typingIndicator = document.getElementById('typing-indicator');
const chatRecipientName = document.getElementById('chat-recipient-name');

let pendingImageFile = null;
let pendingImageURL = null;
let gifSearchTimeout = null;
let activePicker = null;

// --- Ephemeral mode ---
if (localStorage.getItem('ephemeral') === 'true') {
  ephemeralCheckbox.checked = true;
}
ephemeralCheckbox.addEventListener('change', () => {
  localStorage.setItem('ephemeral', ephemeralCheckbox.checked);
});

// --- URL params ---
function getURLParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return { withUser: urlParams.get('with'), user: urlParams.get('user') };
}

function populateInputs() {
  const { withUser, user } = getURLParams();
  if (withUser && user) {
    recipientInput.value = withUser;
    usernameInput.value = user;
    usernameInput.classList.add('hidden');
    recipientInput.classList.add('hidden');
    chatRecipientName.textContent = withUser;
    listenForTypingStatus(user, withUser);
  }
}
populateInputs();

// --- Typing indicator ---
function listenForTypingStatus(sender, recipient) {
  const typingRef = database.ref('typing');
  const sharedKey = [sender, recipient].sort().join('-');

  typingRef.child(sharedKey).on('value', (snapshot) => {
    let isTyping = false;
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data.sender === recipient && data.typing === 'yes') {
        isTyping = true;
      }
    });
    typingIndicator.classList.toggle('active', isTyping);
  });
}

function sendTypingStatus(sender, recipient, isTyping) {
  const typingRef = database.ref('typing');
  const sharedKey = [sender, recipient].sort().join('-');

  typingRef.child(sharedKey).once('value', (snapshot) => {
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const data = child.val();
        if (data.sender === sender) {
          typingRef.child(sharedKey).child(child.key).update({ typing: isTyping ? 'yes' : 'no' });
        }
      });
    } else {
      const sKey = typingRef.child(sharedKey).push().key;
      const rKey = typingRef.child(sharedKey).push().key;
      typingRef.child(sharedKey).child(sKey).set({ sender, recipient, typing: 'no' });
      typingRef.child(sharedKey).child(rKey).set({ sender: recipient, recipient: sender, typing: 'no' });
    }
  });
}

let typingTimeout = null;
messageInput.addEventListener('input', () => {
  const sender = usernameInput.value.trim();
  const recipient = recipientInput.value.trim();
  if (!sender || !recipient) return;
  sendTypingStatus(sender, recipient, true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    sendTypingStatus(sender, recipient, false);
  }, 2000);
});

// --- Shared key ---
function sharedKey(sender, recipient) {
  return `${sender}-${recipient}-shared-key`;
}

// --- Markdown ---
function convertMarkdownToHTML(text) {
  // Protect code blocks from URL conversion
  const codeBlocks = [];
  text = text.replace(/`(.*?)`/g, (_, code) => {
    codeBlocks.push(code);
    return `\x00CODE${codeBlocks.length - 1}\x00`;
  });

  // Convert URLs to clickable links
  text = text.replace(/(https?:\/\/[^\s<\x00]+)/g, (url) => {
    const href = url.replace(/[.,;:!?)\]]+$/, '');
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">${href}</a>`;
  });

  // Markdown formatting
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Restore code blocks
  text = text.replace(/\x00CODE(\d+)\x00/g, (_, i) => `<code>${codeBlocks[i]}</code>`);

  return text;
}

// --- Append message ---
function appendMessage(username, text, isSent, imageUrl, isGif) {
  const el = document.createElement('div');
  el.className = `message-bubble ${isSent ? 'sent-message' : 'received-message'}`;

  if (!isSent && username !== 'You') {
    const nameEl = document.createElement('div');
    nameEl.className = 'sender-name';
    nameEl.textContent = username;
    el.appendChild(nameEl);
  }

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = isGif ? 'gif-image' : 'chat-image';
    img.loading = 'lazy';
    img.addEventListener('click', () => {
      popupImage.src = imageUrl;
      previewPopup.classList.add('visible');
    });
    el.appendChild(img);
  }

  if (text) {
    const textEl = document.createElement('div');
    textEl.innerHTML = convertMarkdownToHTML(text);
    el.appendChild(textEl);
  }

  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendDecryptedMessage(sender, recipient, encryptedText, imageUrl, isGif) {
  const decrypted = CryptoJS.AES.decrypt(encryptedText, sharedKey(sender, recipient)).toString(CryptoJS.enc.Utf8);
  const curSender = usernameInput.value.trim();
  const curRecipient = recipientInput.value.trim();

  if ((sender === curSender && recipient === curRecipient) || (sender === curRecipient && recipient === curSender)) {
    const username = sender === curSender ? 'You' : sender;
    const isSent = sender === curSender;
    appendMessage(username, decrypted, isSent, imageUrl, isGif);
  }
}

// --- Send message ---
function sendMessage() {
  const text = messageInput.value.trim();
  const sender = usernameInput.value.trim();
  const recipient = recipientInput.value.trim();

  if ((!text && !pendingImageFile && !pendingImageURL) || !sender || !recipient) return;

  const key = sharedKey(sender, recipient);
  const encryptedText = CryptoJS.AES.encrypt(text, key).toString();

  // If there's a pending GIF URL, send it directly
  if (pendingImageURL && !pendingImageFile) {
    messagesRef.push({
      sender, recipient,
      text: encryptedText,
      image: pendingImageURL,
      isGif: true,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    messageInput.value = '';
    clearPendingImage();
    sendTypingStatus(sender, recipient, false);
    clearTimeout(typingTimeout);
    return;
  }

  // If there's a pending image file, upload with progress
  if (pendingImageFile) {
    const file = pendingImageFile;
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}_${file.name}`;
    const uploadTask = imagesRef.child(uniqueName).put(file);

    showUploadOverlay();

    uploadTask.on('state_changed',
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        updateUploadProgress(pct);
      },
      (error) => {
        console.error('Error uploading image:', error);
        hideUploadOverlay();
      },
      () => {
        uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
          messagesRef.push({
            sender, recipient,
            text: encryptedText,
            image: downloadURL,
            isGif: false,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          });
          messageInput.value = '';
          clearPendingImage();
          hideUploadOverlay();
          sendTypingStatus(sender, recipient, false);
          clearTimeout(typingTimeout);
        });
      }
    );
  } else {
    messagesRef.push({
      sender, recipient,
      text: encryptedText,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    messageInput.value = '';
    sendTypingStatus(sender, recipient, false);
    clearTimeout(typingTimeout);
  }
}

// --- Upload progress overlay ---
function showUploadOverlay() {
  uploadOverlay.classList.remove('hidden');
  updateUploadProgress(0);
}

function updateUploadProgress(pct) {
  uploadProgressBar.style.setProperty('--progress', pct + '%');
  uploadProgressText.textContent = `Uploading... ${Math.round(pct)}%`;
}

function hideUploadOverlay() {
  uploadOverlay.classList.add('hidden');
}

// --- Image preview bar ---
function showImagePreviewBar(src, name) {
  imagePreviewBar.innerHTML = `
    <img src="${src}" alt="preview">
    <div class="preview-info">${name || 'Image attached'}</div>
    <button class="remove-image" onclick="clearPendingImage()">&times;</button>
  `;
  imagePreviewBar.classList.add('active');
}

function clearPendingImage() {
  pendingImageFile = null;
  pendingImageURL = null;
  imageInput.value = '';
  imagePreviewBar.classList.remove('active');
  imagePreviewBar.innerHTML = '';
}

// --- Image file input ---
imageInput.addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  pendingImageFile = file;
  pendingImageURL = null;
  const reader = new FileReader();
  reader.onload = (e) => showImagePreviewBar(e.target.result, file.name);
  reader.readAsDataURL(file);
});

// --- Send button & Enter key ---
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// --- Firebase listener ---
messagesRef.on('child_added', (snapshot) => {
  const msg = snapshot.val();
  appendDecryptedMessage(msg.sender, msg.recipient, msg.text, msg.image, msg.isGif);
});

// --- Image preview popup ---
closePreviewBtn.addEventListener('click', () => previewPopup.classList.remove('visible'));
previewPopup.addEventListener('click', (e) => {
  if (e.target === previewPopup) previewPopup.classList.remove('visible');
});

// --- Emoji Picker ---
const EMOJI_LIST = [
  // Smileys & Emotion
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
  '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
  '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢',
  '🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥',
  '😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴',
  '😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯',
  '🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁',
  '😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰',
  '😥','😢','😭','😱','😖','😣','😞','😓','😩','😫',
  '🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩',
  '🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹',
  '😻','😼','😽','🙀','😿','😾',
  // People & Body
  '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌',
  '🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
  '👆','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜',
  '👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳',
  '💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀',
  '🫁','🦷','🦴','👀','👁️','👅','👄','🫦','💋','🩸',
  // People
  '👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓',
  '👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🤦',
  '🤷','🙎‍♂️','🙍‍♂️','🙅‍♂️','🙆‍♂️','🤷‍♂️','🤦‍♂️','🙎‍♀️','🙍‍♀️','🙅‍♀️',
  '🙆‍♀️','🤷‍♀️','🤦‍♀️','💇','💆','🧖','🧏‍♂️','🧏‍♀️','🛀','🛌',
  '🧑‍🤝‍🧑','👭','👫','👬',
  // Hand gestures
  '🤱','👩‍🍼','👨‍🍼','🧑‍🍼','👼','🎅','🤶','🧑‍🎄','🦸','🦹',
  '🧙','🧚','🧛','🧜','🧝','🧞','🧟','🧌','💆‍♂️','💆‍♀️',
  '💇‍♂️','💇‍♀️','🚶','🚶‍♂️','🚶‍♀️','🧍','🧍‍♂️','🧍‍♀️','🧎','🧎‍♂️',
  '🧎‍♀️','🏃','🏃‍♂️','🏃‍♀️','💃','🕺','🕴️','👯','👯‍♂️','👯‍♀️',
  '🧖‍♂️','🧖‍♀️','🧑‍🦯','🧑‍🦼','🧑‍🦽',
  // Component
  '🧔‍♂️','🧔‍♀️','👩‍🦰','👩‍🦱','👩‍🦳','👩‍🦲','👨‍🦰','👨‍🦱','👨‍🦳','👨‍🦲',
  '👱‍♀️','👱‍♂️','🧑‍🦰','🧑‍🦱','🧑‍🦳','🧑‍🦲',
  // Animals & Nature
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨',
  '🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊',
  '🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉',
  '🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌',
  '🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🕸️','🦂',
  '🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀',
  '🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆',
  '🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘',
  '🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐',
  '🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃',
  '🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡',
  '🦫','🦦','🦥','🐁','🐀','🐿️','🦔',
  // Nature
  '🌸','💐','🌷','🌹','🥀','🌺','🌻','🌼','🌱','🪴',
  '🌲','🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍂',
  '🍃','🍄','🌰','🪹','🪺',
  // Food & Drink
  '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏',
  '🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑',
  '🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄',
  '🧅','🥜','🫘','🌰','🥖','🍞','🫓','🥐','🥯','🥞',
  '🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭',
  '🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🍲',
  '🫕','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙',
  '🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮',
  '🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦',
  '🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬',
  '🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🍶','🍾',
  '🍷','🍸','🍹','🍺','🍻','🥂','🥃','🫗','🥤','🧋',
  '🧃','🧉','🧊',
  // Travel & Places
  '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐',
  '🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼',
  '🚏','🛣️','🛤️','🛞','⛽','🚨','🚥','🚦','🛑','🚧',
  '⚓','🛟','⛵','🛶','🚤','🛳️','⛴️','🛥️','🚢','✈️',
  '🛩️','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰️',
  '🚀','🛸','🛎️','🧳','⌛','⏳','⌚','⏰','⏱️','⏲️',
  '🕰️','🌡️','⛱️','🛏️','🛋️','🪑','🚽','🚿','🛁','🪒',
  '🧴','🧷','🧹','🧺','🧻','🪣','🧼','🪥','🧽','🧯',
  '🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪',
  '🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌',
  '🛕','🕍','⛩️','🕋','⛲','⛺','🏕️','🪨','🪵','🛖',
  '🗻','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️',
  // Country flags
  '🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️',
  '🇺🇸','🇬🇧','🇨🇦','🇦🇺','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇯🇵','🇰🇷',
  '🇨🇳','🇮🇳','🇧🇷','🇷🇺','🇲🇽','🇳🇱','🇧🇪','🇨🇭','🇦🇹','🇸🇪',
  '🇳🇴','🇩🇰','🇫🇮','🇵🇱','🇵🇹','🇬🇷','🇹🇷','🇮🇱','🇪🇬','🇿🇦',
  '🇳🇿','🇮🇪','🇮🇸','🇦🇷','🇨🇱','🇨🇴','🇵🇪','🇻🇪','🇨🇺','🇵🇭',
  '🇹🇭','🇻🇳','🇲🇾','🇸🇬','🇮🇩','🇵🇰','🇧🇩','🇳🇬','🇰🇪','🇪🇹',
  // Activities
  '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
  '🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳',
  '🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷',
  '⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','🤺',
  '🤾','🏌️','🧗','🚴','🚵','🏇','🧘','🏄','🏊','🤽',
  '🚣','🧗‍♂️','🧗‍♀️','🚴‍♂️','🚴‍♀️','🚵‍♂️','🚵‍♀️','🏇','🧘‍♂️','🧘‍♀️',
  '🎪','🤹','🤹‍♂️','🤹‍♀️','🎭','🩰','🎨','🎬','🎤','🎧',
  '🎼','🎹','🥁','🪘','🎷','🪗','🎸','🪕','🎺','🪈',
  '🎻','🪇','🎲','♟️','🎯','🎳','🎮','🕹️','🧩','🪆',
  '🎰','🪄','🧸','🪅','🪩','🪪',
  // Objects
  '👓','🕶️','🥽','🥼','🦺','👔','👕','👖','🧣','🧤',
  '🧥','🧦','👗','👘','🥻','🩱','🩲','🩳','👙','👚',
  '👛','👜','👝','🛍️','🎒','🩴','👞','👟','🥾','🥿',
  '👠','👡','🩰','👢','👑','👒','🎩','🧢','🪖','⛑️',
  '💍','💎','🔇','🔈','🔉','🔊','📢','📣','📯','🔔',
  '🔕','🎼','🎵','🎶','🎙️','🎚️','🎛️','🎤','🎧','📻',
  '🎷','🪗','🎸','🪕','🎺','🪈','🎻','🪇','🥁','🪘',
  '📱','📲','☎️','📞','📟','📠','🔋','🪫','🔌','💻',
  '🖥️','🖨️','⌨️','🖱️','🖲️','💽','💾','💿','📀','🧮',
  '🎥','🎞️','📽️','🎬','📺','📷','📸','📹','📼','🔍',
  '🔎','🕯️','💡','🔦','🏮','🪔','📔','📕','📖','📗',
  '📘','📙','📚','📓','📒','📃','📜','📄','📰','🗞️',
  '📑','🔖','🏷️','💰','🪙','💴','💵','💶','💷','💸',
  '💳','🧾','💱','💲','✉️','📧','📨','📩','📤','📥',
  '📦','📫','📪','📬','📭','📮','🗳️','✏️','✒️','🖋️',
  '🖊️','🖌️','🖍️','📝','💼','📁','📂','🗂️','📅','📆',
  '🗒️','🗓️','📇','📈','📉','📊','📋','📌','📍','📎',
  '🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔏',
  '🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️',
  '💣','🪃','🏹','🛡️','🪚','🔧','🪛','🔩','⚙️','🗜️',
  '⚖️','🦯','🔗','⛓️','🪝','🧰','🧲','🪜','⚗️','🧪',
  '🧫','🧬','🔬','🔭','📡','💉','🩸','💊','🩹','🩺',
  '🩻','🚪','🛗','🪞','🪟','🛏️','🛋️','🪑','🚽','🪠',
  '🚿','🛁','🪤','🪒','🧴','🧷','🧹','🧺','🧻','🪣',
  '🧼','🪥','🧽','🧯','🛎️','🧳','⏳','⌛','⏰','⌚',
  '⏱️','⏲️','🕰️','🌡️','🧭','🧱','🪨','🪵','🛖','🏘️',
  '🏚️','🏗️','🧱','🪨','🪵','🛖',
  // Symbols
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
  '❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
  '💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️',
  '☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎',
  '♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️',
  '📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮',
  '🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎',
  '🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯',
  '💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗',
  '❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸',
  '🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎',
  '🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗',
  '🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','⚧️',
  '🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠',
  '🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣',
  '4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣',
  '⏏️','▶️','⏸️','⏯️','⏹️','⏺️','⏭️','⏮️','⏩','⏪',
  '⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','↗️',
  '↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀',
  '🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️',
  '♾️','💲','💱','™️','©️','®️','👁️‍🗨️','🔚','🔙','🔛',
  '🔝','🔜','〰️','➰','➿','✔️','☑️','🔘','🔴','🟠',
  '🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸',
  '🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️',
  '◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫',
  '🔈','🔉','🔊','🔇','📣','📢','🔔','🔕','🎵','🎶',
  '✨','🌟','💫','⭐','🔥','💥','💢','💦','💨','🕳️',
  '💬','💭','🗯️','🗨️',
  // Flags
  '🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️',
  '🇺🇳','🇪🇺','🇦🇫','🇦🇽','🇦🇱','🇩🇿','🇦🇸','🇦🇩','🇦🇴','🇦🇮',
  '🇦🇶','🇦🇬','🇦🇷','🇦🇲','🇦🇼','🇦🇺','🇦🇹','🇦🇿','🇧🇸','🇧🇭',
  '🇧🇩','🇧🇧','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇲','🇧🇹','🇧🇴','🇧🇶',
  '🇧🇦','🇧🇼','🇧🇷','🇮🇴','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭',
  '🇨🇲','🇨🇦','🇮🇨','🇨🇻','🇧🇶','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇳',
  '🇨🇽','🇨🇨','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇰','🇨🇷','🇨🇮','🇭🇷',
  '🇨🇺','🇨🇼','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇲','🇩🇴','🇪🇨','🇪🇬',
  '🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇪🇹','🇪🇺','🇫🇰','🇫🇴','🇫🇯','🇫🇮',
  '🇫🇷','🇬🇫','🇵🇫','🇹🇫','🇬🇦','🇬🇲','🇬🇪','🇩🇪','🇬🇭','🇬🇮',
  '🇬🇷','🇬🇱','🇬🇩','🇬🇵','🇬🇺','🇬🇹','🇬🇬','🇬🇳','🇬🇼','🇬🇾',
  '🇭🇹','🇭🇳','🇭🇰','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪',
  '🇮🇲','🇮🇱','🇮🇹','🇯🇲','🇯🇵','🇯🇪','🇯🇴','🇰🇿','🇰🇪','🇰🇮',
  '🇽🇰','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇮',
  '🇱🇹','🇱🇺','🇲🇴','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇭',
  '🇲🇶','🇲🇷','🇲🇺','🇾🇹','🇲🇽','🇫🇲','🇲🇩','🇲🇨','🇲🇳','🇲🇪',
  '🇲🇸','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇷','🇳🇵','🇳🇱','🇳🇨','🇳🇿',
  '🇳🇮','🇳🇪','🇳🇬','🇳🇺','🇳🇫','🇰🇵','🇲🇰','🇲🇵','🇳🇴','🇴🇲',
  '🇵🇰','🇵🇼','🇵🇸','🇵🇦','🇵🇬','🇵🇾','🇵🇪','🇵🇭','🇵🇳','🇵🇱',
  '🇵🇹','🇵🇷','🇶🇦','🇷🇪','🇷🇴','🇷🇺','🇷🇼','🇧🇱','🇸🇭','🇰🇳',
  '🇱🇨','🇵🇲','🇻🇨','🇼🇸','🇸🇲','🇸🇹','🇸🇦','🇸🇳','🇷🇸','🇸🇨',
  '🇸🇱','🇸🇬','🇸🇽','🇸🇰','🇸🇮','🇬🇸','🇸🇧','🇸🇴','🇿🇦','🇰🇷',
  '🇸🇸','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇯','🇸🇿','🇸🇪','🇨🇭','🇸🇾',
  '🇹🇼','🇹🇯','🇹🇿','🇹🇭','🇹🇱','🇹🇬','🇹🇰','🇹🇴','🇹🇹','🇹🇳',
  '🇹🇷','🇹🇲','🇹🇨','🇹🇻','🇻🇮','🇺🇬','🇺🇦','🇦🇪','🇬🇧','🇺🇸',
  '🇺🇾','🇺🇿','🇻🇺','🇻🇦','🇻🇪','🇻🇳','🇼🇫','🇪🇭','🇾🇪','🇿🇲',
  '🇿🇼'
];

function renderEmojis(filter) {
  emojiGrid.innerHTML = '';
  const list = filter
    ? EMOJI_LIST.filter(e => e.includes(filter))
    : EMOJI_LIST;
  list.forEach(emoji => {
    const span = document.createElement('span');
    span.className = 'emoji-item';
    span.textContent = emoji;
    span.addEventListener('click', () => {
      messageInput.value += emoji;
      messageInput.focus();
    });
    emojiGrid.appendChild(span);
  });
}

renderEmojis();

emojiSearch.addEventListener('input', () => {
  renderEmojis(emojiSearch.value);
});

emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (activePicker === 'emoji') {
    closePickers();
    return;
  }
  closePickers();
  emojiPicker.classList.remove('hidden');
  emojiBtn.classList.add('active');
  activePicker = 'emoji';
});

// --- GIF Picker ---
async function searchGifs(query) {
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('GIPHY search error:', err);
    return [];
  }
}

async function loadTrendingGifs() {
  const url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=pg`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('GIPHY trending error:', err);
    return [];
  }
}

function renderGifs(gifs) {
  gifGrid.innerHTML = '';
  if (gifs.length === 0) {
    gifGrid.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">No GIFs found</div>';
    return;
  }
  gifs.forEach(gif => {
    const item = document.createElement('div');
    item.className = 'gif-item';
    const img = document.createElement('img');
    img.src = gif.images.fixed_height_small.url;
    img.alt = gif.title || 'GIF';
    img.loading = 'lazy';
    item.appendChild(img);
    item.addEventListener('click', () => {
      pendingImageFile = null;
      pendingImageURL = gif.images.original.url;
      showImagePreviewBar(gif.images.fixed_height_small.url, 'GIF');
      closePickers();
      messageInput.focus();
    });
    gifGrid.appendChild(item);
  });
}

async function initGifPicker() {
  const gifs = await loadTrendingGifs();
  renderGifs(gifs);
}

gifBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (activePicker === 'gif') {
    closePickers();
    return;
  }
  closePickers();
  gifPicker.classList.remove('hidden');
  gifBtn.classList.add('active');
  activePicker = 'gif';
  if (gifGrid.children.length === 0) {
    initGifPicker();
  }
});

gifSearch.addEventListener('input', () => {
  clearTimeout(gifSearchTimeout);
  const query = gifSearch.value.trim();
  if (!query) {
    loadTrendingGifs().then(renderGifs);
    return;
  }
  gifSearchTimeout = setTimeout(async () => {
    const gifs = await searchGifs(query);
    renderGifs(gifs);
  }, 400);
});

function closePickers() {
  emojiPicker.classList.add('hidden');
  gifPicker.classList.add('hidden');
  emojiBtn.classList.remove('active');
  gifBtn.classList.remove('active');
  activePicker = null;
}

// Close pickers on outside click
document.addEventListener('click', (e) => {
  if (activePicker && !emojiPicker.contains(e.target) && !gifPicker.contains(e.target) && e.target !== emojiBtn && e.target !== gifBtn) {
    closePickers();
  }
});

// Close pickers on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePickers();
});
