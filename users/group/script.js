// Initialize Firebase
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
const messagesRef = database.ref('groupmessages');
const imagesRef = storage.ref('images');

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const usernameInput = document.getElementById('username-input');
const groupInput = document.getElementById('group-input');
const inputContainer = document.getElementById('input-container');
const uploadBtn = document.getElementById('file-upload-btn');

// Function to parse URL parameters
function getURLParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const user = urlParams.get('user');
  const group = urlParams.get('group');
  return { user, group };
}

// Function to populate input fields with URL parameters
function populateInputs() {
  const { user, group } = getURLParams();
  if (user && group) {
    usernameInput.value = user; // Set the username from URL parameter
    groupInput.value = group; // Set the group name from URL parameter
    usernameInput.classList.add('hidden');
    groupInput.classList.add('hidden');
  }
}

populateInputs(); // Call the function to populate inputs when the page loads

// Function to send the message
function sendMessage() {
  const text = messageInput.value.trim();
  const sender = usernameInput.value.trim();
  const group = groupInput.value.trim();
  const imageFile = document.getElementById('image-input').files[0]; // Get the selected image file

  if ((text !== '' || imageFile) && sender !== '' && group !== '') {
    const encryptedText = CryptoJS.AES.encrypt(text, group).toString();

    // If there's an image file, upload it to Firebase Storage first
    if (imageFile) {
      const uploadTask = imagesRef.child(imageFile.name).put(imageFile);
      uploadTask.on('state_changed',
        (snapshot) => {
          // Track upload progress if needed
        },
        (error) => {
          console.error('Error uploading image:', error);
        },
        () => {
          // When upload is complete, get the download URL and save message to database
          uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
            messagesRef.push({ sender, group, text: encryptedText, image: downloadURL, timestamp: firebase.database.ServerValue.TIMESTAMP });
            messageInput.value = '';
            clearFile(); // Clear file input and reset upload button after sending
          });
        }
      );
    } else {
      // If there's no image, save only text to database
      messagesRef.push({ sender, group, text: encryptedText, timestamp: firebase.database.ServerValue.TIMESTAMP });
      messageInput.value = '';
    }
  }
}

// Function to convert plain URLs to clickable links
function convertUrlsToLinks(text) {
  return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:inherit">$1</a>');
}

// Function to convert markdown syntax to HTML
function convertMarkdownToHTML(text) {
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>'); // Bold (alternative syntax)
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italics
  text = text.replace(/_(.*?)_/g, '<em>$1</em>'); // Italics (alternative syntax)
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>'); // Strikethrough
  text = text.replace(/`(.*?)`/g, '<code>$1</code>'); // Inline code
  text = text.replace(/^\s*([-+*])\s*(.*)$/gm, '<li>$2</li>'); // Lists
  text = text.replace(/^(#+)\s*(.*)$/gm, (match, p1, p2) => `<h${p1.length}>${p2}</h${p1.length}>`); // Headings
  return text;
}

// Function to append a message to the chat window
function appendMessage(username, text, imageUrl, isSent) {
  const messageContainer = document.getElementById('chat-messages');

  const messageElement = document.createElement('div');
  const messageClass = isSent ? 'sent-message' : 'received-message';
  messageElement.className = `message-bubble ${messageClass}`;

  let messageContent = '';

  // If the message is sent by the current user, display "You" instead of the username
  if (isSent) {
    messageContent += ``;
  } else {
    messageContent += `<strong>${username}:</strong>`;
  }

  // Check if message contains image
  if (imageUrl) {
    messageContent += `<br><img src="${imageUrl}" style="max-width: 200px; max-height: 200px;">`;
  }

  // Add a line break if both image and text are present
  if (imageUrl && text) {
    messageContent += '<br>';
  }

  // Convert markdown syntax to HTML for text messages
  if (text) {
    const formattedText = convertMarkdownToHTML(text);
    messageContent += ` ${formattedText}`;
  }

  messageElement.innerHTML = messageContent;

  messageContainer.appendChild(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Function to generate a shared key
function sharedKey(sender, recipient) {
  return `${sender}-${recipient}-shared-key`;
}

// Function to handle the keydown event for the message input
document.getElementById('message-input').addEventListener('keydown', function(event) {
  const cursorPosition = this.selectionStart; // Get cursor position
  const value = this.value; // Get current input value

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault(); // Prevent default behavior (sending message)
    sendMessage(); // Call the sendMessage function when Enter is pressed without Shift
  } else if (event.key === 'Enter' && event.shiftKey) {
    this.value = value.slice(0, cursorPosition) + '\n' + value.slice(cursorPosition); // Add a new line character at cursor position
    this.selectionStart = this.selectionEnd = cursorPosition + 1; // Set cursor position after the added new line character
    event.preventDefault(); // Prevent default behavior (sending message)
  }
});

// Function to handle the child added event for Firebase
messagesRef.on('child_added', (snapshot) => {
  const message = snapshot.val();
  appendDecryptedMessage(message.sender, message.group, message.text, message.image);
});

// Function to decrypt and append a message to the chat window
function appendDecryptedMessage(sender, group, encryptedText, imageUrl) {
  const decryptedText = CryptoJS.AES.decrypt(encryptedText, group).toString(CryptoJS.enc.Utf8);

  const currentSender = usernameInput.value.trim();
  const currentGroup = groupInput.value.trim();

  // Only append messages when the group matches the current group
  if (group === currentGroup) {
    appendMessage(sender, decryptedText, imageUrl, sender === currentSender); // Set isSent based on comparison
  }
}


let uploadCount = 0; // Initialize a counter for uploaded files

// Event listener for file input change
document.getElementById('image-input').addEventListener('change', function() {
  const fileInput = this.files[0];
  if (fileInput) {
    const fileName = fileInput.name;
    const fileExt = fileName.split('.').pop(); // Get the file extension
    const baseName = fileName.substring(0, fileName.lastIndexOf('.')); // Get the file name without extension

    const uniqueNumber = Math.floor(10000000 + Math.random() * 90000000); // Generate random 8-digit code
    const newFileName = `${baseName}_${uniqueNumber}.${fileExt}`; // Append unique number to the file name

    // Create a new file object with the renamed file
    const renamedFile = new File([fileInput], newFileName, { type: fileInput.type });

    // Replace the file input with the renamed file
    this.files[0] = renamedFile;

    // Update button text to "Uploaded"
    const uploadBtn = document.getElementById('file-upload-btn');
    uploadBtn.classList.add('attached');
    uploadBtn.innerHTML = 'Uploaded!';

    // Upload the renamed file to Firebase Storage
    const uploadTask = imagesRef.child(newFileName).put(renamedFile);
    uploadTask.on('state_changed',
      (snapshot) => {
        // Track upload progress if needed
      },
      (error) => {
        console.error('Error uploading image:', error);
      },
      () => {
        // When upload is complete, get the download URL and save message to database
        uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
          // Once the download URL is obtained, you can use it to display the image or send it in a message
          console.log('Image uploaded. Download URL:', downloadURL);
        });
      }
    );
  }
});

// Function to clear the file input and reset the upload button
function clearFile() {
  const fileInput = document.getElementById('image-input');
  fileInput.value = ''; // Clear the file input
  // Reset the upload button even if there's no image selected
  const uploadBtn = document.getElementById('file-upload-btn');
  uploadBtn.classList.remove('attached');
  uploadBtn.innerHTML = `
    <i class="material-icons icon">cloud_upload</i>
    <span id="file-upload-label">Upload Image</span>
  `;
}

// Function to preview the selected image
function previewImage() {
  const fileInput = document.getElementById('image-input');
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const imageUrl = e.target.result;
      const previewPopup = document.getElementById('preview-popup');
      const popupImage = document.getElementById('popup-image');
      popupImage.src = imageUrl;
      previewPopup.classList.add('visible');
      document.getElementById('blur-overlay').classList.add('blurred'); // Apply blur effect to overlay
      popupImage.classList.add('zoom-in');
    };
    reader.readAsDataURL(file);
  }
}

// Function to close the preview popup
function closePreview() {
  const previewPopup = document.getElementById('preview-popup');
  previewPopup.classList.remove('visible');
  document.getElementById('blur-overlay').classList.remove('blurred'); // Remove blur effect from overlay
}

// Event listeners for the preview and close buttons
document.getElementById('preview-btn').addEventListener('click', previewImage);
document.getElementById('close-preview-btn').addEventListener('click', closePreview);

// Event listener to close the preview popup when clicking outside the image
document.getElementById('preview-popup').addEventListener('click', (event) => {
  if (event.target === document.getElementById('preview-popup')) {
    closePreview();
  }
});