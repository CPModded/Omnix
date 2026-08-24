<!DOCTYPE html>
<html lang="fr">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>OMNIX AI Developer</title>

  <style>

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #08090d;
      color: #ffffff;
      font-family:
        Inter,
        system-ui,
        sans-serif;
    }

    .layout {
      display: flex;
      height: 100vh;
    }

    .sidebar {
      width: 280px;
      background: #101116;
      border-right: 1px solid #242630;
      padding: 20px;
      overflow-y: auto;
    }

    .logo {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 25px;
    }

    .badge {
      display: inline-block;
      padding: 5px 9px;
      border-radius: 8px;
      background: #241849;
      color: #b58cff;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 20px;
    }

    .files-title {
      color: #888b98;
      font-size: 12px;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    #files {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .file {
      padding: 8px;
      border-radius: 7px;
      cursor: pointer;
      font-size: 13px;
      color: #c6c8d1;
      word-break: break-all;
    }

    .file:hover {
      background: #1d1f27;
      color: white;
    }

    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .header {
      height: 70px;
      border-bottom: 1px solid #242630;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 25px;
    }

    .title {
      font-weight: 700;
    }

    .stats {
      display: flex;
      gap: 20px;
      color: #999cab;
      font-size: 13px;
    }

    .chat {
      flex: 1;
      overflow-y: auto;
      padding: 30px;
    }

    .message {
      max-width: 900px;
      margin-bottom: 25px;
      padding: 18px;
      border-radius: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .user {
      background: #171923;
      margin-left: auto;
    }

    .assistant {
      background: #11131a;
      border: 1px solid #262936;
    }

    .composer {
      border-top: 1px solid #242630;
      padding: 20px;
    }

    .composer-inner {
      max-width: 1000px;
      margin: auto;
      display: flex;
      gap: 10px;
    }

    textarea {
      flex: 1;
      resize: none;
      min-height: 70px;
      max-height: 250px;
      background: #151720;
      color: white;
      border: 1px solid #2b2e3a;
      border-radius: 12px;
      padding: 14px;
      outline: none;
      font-size: 14px;
    }

    textarea:focus {
      border-color: #8b5cf6;
    }

    button {
      border: none;
      border-radius: 10px;
      padding: 0 20px;
      background: #8b5cf6;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }

    button:hover {
      opacity: .9;
    }

    .system {
      color: #7d8190;
      text-align: center;
      font-size: 13px;
      margin: 15px;
    }

  </style>

</head>

<body>

<div class="layout">

  <aside class="sidebar">

    <div class="logo">
      OMNIX
    </div>

    <div class="badge">
      👑 OWNER • AI DEV
    </div>

    <div class="files-title">
      Projet OMNIX
    </div>

    <div id="files">
      Chargement...
    </div>

  </aside>


  <main class="main">

    <header class="header">

      <div class="title">
        🤖 OMNIX AI Developer
      </div>

      <div class="stats">

        <span>
          Tokens : <b id="tokens">—</b>
        </span>

        <span>
          Requêtes : <b id="requests">—</b>
        </span>

      </div>

    </header>


    <section
      id="chat"
      class="chat"
    >

      <div class="system">
        Console privée du propriétaire OMNIX.
      </div>

      <div class="message assistant">
        👋 Bonjour Weritale.

        Je suis ton environnement de développement IA OMNIX.

        Je peux analyser l'architecture,
        lire les fichiers autorisés,
        rechercher du code,
        expliquer les erreurs
        et t'aider à développer de nouvelles fonctionnalités.
      </div>

    </section>


    <div class="composer">

      <div class="composer-inner">

        <textarea
          id="message"
          placeholder="Demande quelque chose à OMNIX AI..."
        ></textarea>

        <button
          onclick="sendMessage()"
        >
          Envoyer
        </button>

      </div>

    </div>

  </main>

</div>


<script>

let requestCount = 0;
let tokenCount = 0;


/*
==================================================
 CHARGER LES FICHIERS
==================================================
*/

async function loadFiles() {

  const response =
    await fetch(
      '/api/ai-dev/files'
    );

  const data =
    await response.json();

  const container =
    document.getElementById(
      'files'
    );

  if (!data.success) {

    container.innerText =
      'Accès refusé.';

    return;
  }

  container.innerHTML = '';

  for (
    const file of data.files
  ) {

    const element =
      document.createElement(
        'div'
      );

    element.className =
      'file';

    element.textContent =
      file;

    element.onclick =
      () => readFile(file);

    container.appendChild(
      element
    );
  }
}


/*
==================================================
 LIRE UN FICHIER
==================================================
*/

async function readFile(file) {

  const response =
    await fetch(
      `/api/ai-dev/file?path=${encodeURIComponent(file)}`
    );

  const data =
    await response.json();

  if (!data.success) {

    addMessage(
      'assistant',
      '❌ ' + data.error
    );

    return;
  }

  addMessage(
    'assistant',
    `📄 ${file}\n\n${data.content}`
  );
}


/*
==================================================
 AJOUT MESSAGE
==================================================
*/

function addMessage(
  type,
  content
) {

  const chat =
    document.getElementById(
      'chat'
    );

  const element =
    document.createElement(
      'div'
    );

  element.className =
    `message ${type}`;

  element.textContent =
    content;

  chat.appendChild(
    element
  );

  chat.scrollTop =
    chat.scrollHeight;
}


/*
==================================================
 ENVOYER
==================================================
*/

async function sendMessage() {

  const input =
    document.getElementById(
      'message'
    );

  const message =
    input.value.trim();

  if (!message)
    return;

  addMessage(
    'user',
    message
  );

  input.value = '';

  addMessage(
    'assistant',
    '⏳ Analyse en cours...'
  );

  const chat =
    document.getElementById(
      'chat'
    );

  const loading =
    chat.lastElementChild;


  try {

    const response =
      await fetch(
        '/api/ai-dev/chat',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              message
            })
        }
      );

    const data =
      await response.json();

    loading.remove();

    if (!data.success) {

      addMessage(
        'assistant',
        '❌ ' + data.error
      );

      return;
    }

    addMessage(
      'assistant',
      data.answer
    );

    requestCount++;

    document.getElementById(
      'requests'
    ).textContent =
      requestCount;

  } catch (error) {

    loading.remove();

    addMessage(
      'assistant',
      '❌ Impossible de contacter OMNIX AI.'
    );
  }
}


/*
==================================================
 ENTER
==================================================
*/

document
  .getElementById('message')
  .addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Enter' &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendMessage();
      }

    }
  );


loadFiles();

</script>

</body>

</html>