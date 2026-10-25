// Reference to the Firebase Realtime Database
const database = firebase.database();

let currentUser = null;
let otherUser = null;

function setUsername() {
  currentUser = document.getElementById('username').value;
  alert(`Username set to: ${currentUser}`);
}

function startChat() {
  otherUser = document.getElementById('otherUsername').value;
  displayChat();
}

function displayChat() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = ''; // Clear previous messages
  
    const chatId = generateChatId(currentUser, otherUser);
    const chatRef = database.ref(`chats/${chatId}`);
  
    // Listen for changes in the chat
    chatRef.on('child_added', (snapshot) => {
      const message = snapshot.val();
      const messageElement = document.createElement('div');
      messageElement.innerText = `${message.sender}: ${message.text}`;
      chatMessages.appendChild(messageElement);
  
      // Scroll to the bottom of the chatMessages div to always show the latest message
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const messageText = messageInput.value;

  if (currentUser && otherUser && messageText.trim() !== '') {
    const chatId = generateChatId(currentUser, otherUser);
    const chatRef = database.ref(`chats/${chatId}`);

    chatRef.push({
      sender: currentUser,
      text: messageText
    });

    messageInput.value = ''; // Clear the input field
  }
}

function generateChatId(user1, user2) {
  const users = [user1, user2].sort(); // Sort usernames alphabetically
  return `${users[0]}_${users[1]}`;
}