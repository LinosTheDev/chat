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
const messagesRef = database.ref('dms');
const imagesRef = storage.ref('images');

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const usernameInput = document.getElementById('username-input');
const recipientInput = document.getElementById('recipient-input');
const inputContainer = document.getElementById('input-container');
const uploadBtn = document.getElementById('file-upload-btn');

// Function to parse URL parameters
function getURLParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const withUser = urlParams.get('with');
  const user = urlParams.get('user');
  return { withUser, user };
}

// Function to populate input fields with URL parameters
function populateInputs() {
  const { withUser, user } = getURLParams();
  if (withUser && user) {
    recipientInput.value = withUser; // Now 'with' parameter is the recipient
    usernameInput.value = user; // Now 'user' parameter is the sender
    usernameInput.classList.add('hidden');
    recipientInput.classList.add('hidden');
    // Call listenForTypingStatus after populating the recipient input
    listenForTypingStatus(user, withUser);
  }
}

populateInputs(); // Call the function to populate inputs when the page loads

// Function to listen for typing status
function listenForTypingStatus(sender, recipient) {
  const typingRef = database.ref('typing');
  const sharedKey = [sender, recipient].sort().join('-');

  // Attach a listener to the typing reference to continuously listen for changes
  typingRef.child(sharedKey).on('value', (snapshot) => {
    console.log("Snapshot:", snapshot.val()); // Log the snapshot data

    // Initialize typing status
    let isTyping = false;

    // Check each entry under the sender-recipient pair
    snapshot.forEach((childSnapshot) => {
      const typingData = childSnapshot.val();
      console.log("Typing data:", typingData); // Log the typing data

      // Check if the user is typing
      if (typingData.sender === recipient && typingData.typing === 'yes') {
        isTyping = true;
      }
    });

    // Show/hide typing indicator message
    const typingIndicator = document.getElementById('typing-indicator');
    if (isTyping) {
      typingIndicator.textContent = `${recipient} is typing...`;
      typingIndicator.style.display = 'block';
    } else {
      typingIndicator.style.display = 'none';
    }
  });
}

// Function to send typing message
function sendTypingMessage(sender, recipient, isTyping) {
  const typingRef = database.ref('typing');

  // Create a shared key to ensure consistent storage of typing status
  const sharedKey = [sender, recipient].sort().join('-');

  // Check if there's an existing entry for the shared key
  typingRef.child(sharedKey).once('value', (snapshot) => {
    if (snapshot.exists()) {
      // Update the existing entries with the new typing status
      snapshot.forEach((childSnapshot) => {
        const typingKey = childSnapshot.key;
        const typingData = childSnapshot.val();
        if (typingData.sender === sender) {
          typingRef.child(sharedKey).child(typingKey).update({
            typing: isTyping ? 'yes' : 'no'
          }, (error) => {
            if (error) {
              console.error('Error updating typing message:', error);
            }
          });
        }
      });
    } else {
      // If no entry exists, create new entries for sender and recipient
      const senderKey = typingRef.child(sharedKey).push().key;
      const recipientKey = typingRef.child(sharedKey).push().key;

      typingRef.child(sharedKey).child(senderKey).set({
        sender: sender,
        recipient: recipient,
        typing: 'no'
      }, (error) => {
        if (error) {
          console.error('Error sending typing message:', error);
        }
      });

      typingRef.child(sharedKey).child(recipientKey).set({
        sender: recipient,
        recipient: sender,
        typing: 'no'
      }, (error) => {
        if (error) {
          console.error('Error sending typing message:', error);
        }
      });
    }
  });
}

// Function to send the message
function sendMessage() {
  const text = messageInput.value.trim();
  const sender = usernameInput.value.trim();
  const recipient = recipientInput.value.trim();
  const imageFile = document.getElementById('image-input').files[0]; // Get the selected image file

  if ((text !== '' || imageFile) && sender !== '' && recipient !== '') {
    const key = sharedKey(sender, recipient);
    const encryptedText = CryptoJS.AES.encrypt(text, key).toString();

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
            messagesRef.push({ sender, recipient, text: encryptedText, image: downloadURL, timestamp: firebase.database.ServerValue.TIMESTAMP });
            messageInput.value = '';
            clearFile(); // Clear file input and reset upload button after sending
          });
        }
      );
    } else {
      // If there's no image, save only text to database
      messagesRef.push({ sender, recipient, text: encryptedText, timestamp: firebase.database.ServerValue.TIMESTAMP });
      messageInput.value = '';
    }

    // Send typing message when user sends a message
    sendTypingMessage(sender, recipient, false);
  }
}

// Function to handle keyup event in the message input box
document.getElementById('message-input').addEventListener('keyup', function(event) {
  const sender = usernameInput.value.trim();
  const recipient = recipientInput.value.trim();
  const isTyping = this.value.trim() !== ''; // Check if the message input box is not empty
  
  // Check if the pressed key is not Enter
  if (event.key !== 'Enter') {
    sendTypingMessage(sender, recipient, isTyping);
  }
});

// Function to handle the child added event for Firebase
database.ref('typing').on('child_added', (snapshot) => {
  // Store the key of the typing message for future updates
  typingKey = snapshot.key;
});

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
function appendMessage(username, text, isSent, imageUrl) {
    const messageContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');

    // Set the class for the message container
    const messageClass = isSent ? 'sent-message' : 'received-message';
    messageElement.className = `message-bubble ${messageClass}`;
  
    // Create a container for the text and image
    const contentContainer = document.createElement('div');
  
    if (imageUrl) {
        // Create an image element
        const imageElement = document.createElement('img');
        imageElement.src = imageUrl;
        imageElement.style.maxWidth = '200px';
        imageElement.style.maxHeight = '200px';
        imageElement.className = 'image';
        contentContainer.appendChild(imageElement);
    }
  
    if (text) {
        // Convert markdown syntax to HTML for text messages
        const formattedText = convertMarkdownToHTML(text);
        const textElement = document.createElement('div');
        textElement.innerHTML = formattedText;
        contentContainer.appendChild(textElement);
    }

    messageElement.appendChild(contentContainer);
    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Function to decrypt and append a message to the chat window
function appendDecryptedMessage(sender, recipient, encryptedText, imageUrl) {
  const decryptedText = CryptoJS.AES.decrypt(encryptedText, sharedKey(sender, recipient)).toString(CryptoJS.enc.Utf8);

  const currentSender = usernameInput.value.trim();
  const currentRecipient = recipientInput.value.trim();

  if ((sender === currentSender && recipient === currentRecipient) || (sender === currentRecipient && recipient === currentSender)) {
    const username = sender === currentSender ? 'You' : sender;
    const isSent = sender === currentSender;
    appendMessage(username, decryptedText, isSent, imageUrl);
  }
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
  appendDecryptedMessage(message.sender, message.recipient, message.text, message.image);
});

let uploadCount = 0; // Initialize a counter for uploaded files

// Event listener for file input change
document.getElementById('image-input').addEventListener('change', function() {
  const fileInput = this.files[0];
  if (fileInput) {
    uploadBtn.classList.add('attached');
    uploadBtn.innerHTML = 'Uploaded!';
  } else {
    uploadBtn.classList.remove('attached');
    uploadBtn.innerHTML = `
      <i class="material-icons icon">cloud_upload</i>
      <span id="file-upload-label">Upload Image</span>
    `;
  }
});

  // Rename the file to append a unique number
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
        // When upload is complete, reset file input and upload button
        clearFile();
      }
    );
  }

// Function to clear the file input and reset the upload button
function clearFile() {
  const fileInput = document.getElementById('image-input');
  fileInput.value = ''; // Clear the file input
  // Only remove the 'attached' class and reset the button text if the upload button has 'attached' class
  if (uploadBtn.classList.contains('attached')) {
    uploadBtn.classList.remove('attached');
    uploadBtn.innerHTML = `
      <i class="material-icons icon">cloud_upload</i>
      <span id="file-upload-label">Upload Image</span>
    `;
  }
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

// Function to handle the file input change
document.getElementById('image-input').addEventListener('change', function() {
  const fileInput = this.files[0];
  if (fileInput) {
    uploadBtn.classList.add('attached');
    uploadBtn.innerHTML = 'Uploaded!';
  } else {
    uploadBtn.classList.remove('attached');
    uploadBtn.innerHTML = `
      <i class="material-icons icon">cloud_upload</i>
      <span id="file-upload-label">Upload Image</span>
    `;
  }
});

// Function to clear the file input and reset the upload button
function clearFile() {
  const fileInput = document.getElementById('image-input');
  fileInput.value = '';
  uploadBtn.classList.remove('attached');
  uploadBtn.innerHTML = `
    <i class="material-icons icon">cloud_upload</i>
    <span id="file-upload-label">Upload Image</span>
  `;
}

// Function to preview an image before uploading
function previewImage() {
  const fileInput = document.getElementById('image-input');
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      const image = document.getElementById('popup-image');
      image.src = event.target.result;
      document.getElementById('preview-popup').classList.add('visible');
    }
    reader.readAsDataURL(file);
  }
}

// Function to close the image preview
function closePreview() {
  document.getElementById('preview-popup').classList.remove('visible');
}

// Function to close the preview if clicked outside the image
window.onclick = function(event) {
  const previewPopup = document.getElementById('preview-popup');
  if (event.target == previewPopup) {
    previewPopup.classList.remove('visible');
  }
}

// Function to blur the background when the image preview is shown
function blurBackground() {
  document.getElementById('blur-overlay').classList.add('blurred');
}

// Function to remove the background blur when the image preview is closed
function removeBackgroundBlur() {
  document.getElementById('blur-overlay').classList.remove('blurred');
}