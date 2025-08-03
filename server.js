<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>اتاق گفتگوی اختصاصی</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.1/index.min.css">
  <style>
    :root {
      --primary: #4361ee;
      --primary-dark: #3a56d4;
      --danger: #f72585;
      --success: #2ecc71;
      --bg-color: #2c3e50;
      --card-bg: #34495e;
      --border-radius: 12px;
      --box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      --transition: all 0.3s ease;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: "Vazirmatn", sans-serif;
    }

    body {
      background-color: var(--bg-color);
      color: #f8f9fa;
      min-height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }

    .header {
      text-align: center;
      margin-bottom: 20px;
    }

    .header h1 {
      font-size: 1.8rem;
      margin-bottom: 10px;
    }

    .circle-container {
      position: relative;
      width: 90vw;
      height: 90vw;
      max-width: 600px;
      max-height: 600px;
      margin: 20px auto;
    }

    .user-circle {
      position: absolute;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
      background-color: var(--card-bg);
      box-shadow: var(--box-shadow);
    }

    .speaking {
      box-shadow: 0 0 0 3px var(--success);
    }

    .user-avatar {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background-size: cover;
      background-position: center;
      border: 2px solid #ecf0f1;
    }

    .user-name {
      font-size: 0.8rem;
      margin-top: 5px;
      text-align: center;
      font-weight: 500;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-speak {
      padding: 15px 30px;
      border: none;
      border-radius: var(--border-radius);
      font-weight: 500;
      font-size: 1.2rem;
      cursor: pointer;
      transition: var(--transition);
      margin-top: 20px;
      width: 150px;
      height: 60px;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-danger {
      background: var(--danger);
      color: white;
    }

    .status {
      position: fixed;
      top: 10px;
      left: 10px;
      background-color: rgba(0,0,0,0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 0.8rem;
    }

    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal-content {
      background-color: var(--card-bg);
      padding: 30px;
      border-radius: var(--border-radius);
      width: 90%;
      max-width: 400px;
      text-align: center;
    }

    .modal-title {
      font-size: 1.5rem;
      margin-bottom: 20px;
    }

    .code-input {
      width: 100%;
      padding: 12px;
      margin-bottom: 20px;
      border-radius: var(--border-radius);
      border: none;
      font-size: 1rem;
      text-align: center;
    }

    .submit-btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 12px 25px;
      border-radius: var(--border-radius);
      font-size: 1rem;
      cursor: pointer;
      transition: var(--transition);
    }

    .submit-btn:hover {
      background: var(--primary-dark);
    }

    .you-badge {
      font-size: 0.7rem;
      color: #aaa;
      margin-top: 3px;
    }

    @media (max-width: 768px) {
      .user-circle {
        width: 80px;
        height: 80px;
      }
      
      .user-avatar {
        width: 50px;
        height: 50px;
      }
      
      .user-name {
        font-size: 0.7rem;
      }

      .btn-speak {
        padding: 12px 24px;
        font-size: 1rem;
        width: 120px;
        height: 50px;
      }
    }
  </style>
</head>
<body>
  <div class="status" id="status">در حال اتصال...</div>
  
  <div id="codeModal" class="modal">
    <div class="modal-content">
      <h2 class="modal-title">ورود به اتاق گفتگو</h2>
      <p>لطفاً کد اختصاصی خود را وارد کنید:</p>
      <input type="text" class="code-input" id="codeInput" placeholder="کد 1 تا 8" autofocus>
      <button class="submit-btn" id="submitCode">تایید</button>
    </div>
  </div>

  <div class="header" style="display: none;" id="mainContent">
    <h1>اتاق گفتگوی اختصاصی</h1>
    <div id="userCount">0 کاربر متصل</div>
  </div>

  <div class="circle-container" id="circleContainer">
    <!-- کاربران به صورت دایره‌ای در اینجا نمایش داده می‌شوند -->
  </div>

  <button id="btnSpeak" class="btn-speak btn-primary" style="display: none;">صحبت</button>

  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/simple-peer@9.11.1/simplepeer.min.js"></script>
  <script>
    const socket = io("https://room-ft3k.onrender.com");
    const peers = {};
    let myStream;
    let isSpeaking = false;
    let myId = null;
    let currentSpeaker = null;
    let userInfo = null;

    // اطلاعات کاربران بر اساس کد
    const userData = {
      '1': {
        name: 'امیر الفا',
        image: 'https://jzlabel.com/wp-content/uploads/2021/04/love-emoji-01.jpg'
      },
      '2': {
        name: 'امیر تربت',
        image: 'https://jzlabel.com/wp-content/uploads/2021/04/father-emoji-01.jpg'
      },
      '3': {
        name: 'نسترن',
        image: 'https://static0.khabarfoori.com/servev2/N2VlNjEjvrMH/5Uwvb7W7Zm0,/file.jpg'
      },
      '4': {
        name: 'میلاد',
        image: 'https://jzlabel.com/wp-content/uploads/2021/04/vampire-emoji-01.jpg'
      },
      '5': {
        name: 'علی',
        image: 'https://jzlabel.com/wp-content/uploads/2021/04/vamp-emoji-01.jpg'
      },
      '6': {
        name: 'حامد',
        image: 'https://jzlabel.com/wp-content/uploads/2021/04/boy-emoji-01.jpg'
      },
      '7': {
        name: 'امید',
        image: 'https://jzlabel.com/wp-content/uploads/2021/04/dance-emoji-01.jpg'
      },
      '8': {
        name: 'شیوا',
        image: 'https://jzlabel.com/wp-content/uploads/2021/04/happy-emoji-01.jpg'
      }
    };

    // عناصر DOM
    const codeModal = document.getElementById('codeModal');
    const codeInput = document.getElementById('codeInput');
    const submitCode = document.getElementById('submitCode');
    const mainContent = document.getElementById('mainContent');
    const circleContainer = document.getElementById('circleContainer');
    const btnSpeak = document.getElementById('btnSpeak');
    const statusEl = document.getElementById('status');
    const userCountEl = document.getElementById('userCount');

    // رویدادهای سوکت
    socket.on("connect", () => {
      myId = socket.id;
      statusEl.textContent = "آماده ورود";
    });

    socket.on("disconnect", () => {
      statusEl.textContent = "قطع ارتباط";
    });

    socket.on("all-users", (userIds) => {
      userIds.forEach(id => {
        if (!peers[id]) createPeer(id, true);
      });
    });

    socket.on("user-joined", (id) => {
      if (!peers[id]) createPeer(id, false);
    });

    socket.on("user-left", (id) => {
      if (peers[id]) {
        peers[id].destroy();
        delete peers[id];
      }
      const audio = document.querySelector(`audio[data-id="${id}"]`);
      if (audio) audio.remove();
      updateUserCircles();
    });

    socket.on("signal", ({ from, data }) => {
      if (!peers[from]) createPeer(from, false);
      peers[from].signal(data);
    });

    socket.on("room-update", ({ users, speaker: newSpeaker }) => {
      // اگر کاربر قبلی در حال صحبت بود و حالا نیست، میکروفونش را قطع کنید
      if (currentSpeaker === myId && newSpeaker !== myId) {
        myStream.getAudioTracks().forEach(t => t.enabled = false);
        isSpeaking = false;
      }
      
      currentSpeaker = newSpeaker;
      updateUserCircles();
      updateSpeakButton();
      
      // مدیریت پخش صدا
      document.querySelectorAll("audio").forEach(audio => {
        const userId = audio.dataset.id;
        const peer = peers[userId];
        if (peer) {
          audio.muted = (userId !== currentSpeaker);
        }
      });

      if (currentSpeaker && currentSpeaker !== myId) {
        const audio = document.querySelector(`audio[data-id="${currentSpeaker}"]`);
        if (audio) {
          audio.play().catch(e => console.error("Error playing audio:", e));
        }
      }
    });

    socket.on("you-can-speak", () => {
      myStream.getAudioTracks().forEach(t => t.enabled = true);
      isSpeaking = true;
      updateSpeakButton();
    });

    socket.on("force-stop-speaking", () => {
      if (isSpeaking) {
        myStream.getAudioTracks().forEach(t => t.enabled = false);
        isSpeaking = false;
        updateSpeakButton();
        showNotification('صحبت شما پایان یافت');
      }
    });

    // ایجاد ارتباط peer-to-peer
    function createPeer(peerId, initiator) {
      const peer = new SimplePeer({
        initiator,
        trickle: false,
        stream: myStream
      });

      peer.on('signal', data => {
        socket.emit("signal", { to: peerId, from: socket.id, data });
      });

      peer.on('stream', stream => {
        const audio = document.querySelector(`audio[data-id="${peerId}"]`) || document.createElement('audio');
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.dataset.id = peerId;
        audio.muted = true;
        document.body.appendChild(audio);
      });

      peer.on('error', err => {
        console.error('Peer error:', err);
      });

      peers[peerId] = peer;
    }

    // نمایش کاربران به صورت دایره‌ای
    function updateUserCircles() {
      socket.emit("get-users", (users) => {
        circleContainer.innerHTML = '';
        userCountEl.textContent = `${users.length} کاربر متصل`;
        
        const centerX = circleContainer.offsetWidth / 2;
        const centerY = circleContainer.offsetHeight / 2;
        const radius = Math.min(centerX, centerY) - 60;
        
        users.forEach(([id, name, avatar], index) => {
          const angle = (index * (2 * Math.PI / users.length)) - Math.PI/2;
          const x = centerX + radius * Math.cos(angle) - 50;
          const y = centerY + radius * Math.sin(angle) - 50;
          
          const userDiv = document.createElement('div');
          userDiv.className = 'user-circle';
          userDiv.style.left = `${x}px`;
          userDiv.style.top = `${y}px`;
          userDiv.dataset.id = id;
          
          if (id === currentSpeaker) {
            userDiv.classList.add('speaking');
          }
          
          const avatarEl = document.createElement('div');
          avatarEl.className = 'user-avatar';
          avatarEl.style.backgroundImage = `url('${avatar}')`;
          userDiv.appendChild(avatarEl);
          
          const nameEl = document.createElement('div');
          nameEl.className = 'user-name';
          nameEl.textContent = name;
          userDiv.appendChild(nameEl);
          
          if (id === myId) {
            const youBadge = document.createElement('div');
            youBadge.className = 'you-badge';
            youBadge.textContent = '(شما)';
            userDiv.appendChild(youBadge);
          }
          
          circleContainer.appendChild(userDiv);
        });
      });
    }

    // به روزرسانی دکمه صحبت
    function updateSpeakButton() {
      if (currentSpeaker === myId) {
        btnSpeak.textContent = 'قطع صدا';
        btnSpeak.classList.remove('btn-primary');
        btnSpeak.classList.add('btn-danger');
      } else {
        btnSpeak.textContent = 'صحبت';
        btnSpeak.classList.remove('btn-danger');
        btnSpeak.classList.add('btn-primary');
      }
    }

    // نمایش نوتیفیکیشن
    function showNotification(message) {
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.backgroundColor = 'rgba(0,0,0,0.7)';
      notification.style.color = 'white';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '20px';
      notification.style.zIndex = '1000';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }

    // ورود با کد
    submitCode.addEventListener('click', () => {
      const code = codeInput.value.trim();
      if (code && userData[code]) {
        userInfo = userData[code];
        codeModal.style.display = 'none';
        mainContent.style.display = 'block';
        btnSpeak.style.display = 'block';
        
        // تنظیمات میکروفون
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          .then(stream => {
            myStream = stream;
            myStream.getAudioTracks().forEach(t => t.enabled = false);
            socket.emit("join", { name: userInfo.name, avatar: userInfo.image });
            showNotification('اتصال با موفقیت برقرار شد');
          })
          .catch(err => {
            console.error("Error accessing microphone:", err);
            socket.emit("join", { name: userInfo.name, avatar: userInfo.image });
            showNotification('خطا در دسترسی به میکروفون');
          });
      } else {
        alert('کد وارد شده معتبر نیست! لطفاً عددی بین 1 تا 8 وارد کنید.');
      }
    });

    // دکمه صحبت
    btnSpeak.addEventListener('click', () => {
      if (currentSpeaker === myId) {
        // اگر در حال صحبت هستیم، صحبت را قطع کنیم
        socket.emit("stop-speaking");
        myStream.getAudioTracks().forEach(t => t.enabled = false);
        isSpeaking = false;
        showNotification('صحبت شما پایان یافت');
      } else {
        // اگر کس دیگری در حال صحبت است، ابتدا صحبت او را قطع کنیم
        if (currentSpeaker) {
          socket.emit("force-stop-speaking");
        }
        // سپس صحبت خود را شروع کنیم
        socket.emit("start-speaking");
        showNotification('شما در حال صحبت هستید');
      }
      updateSpeakButton();
    });

    // فشار دادن Enter برای ارسال کد
    codeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitCode.click();
      }
    });
  </script>
</body>
</html>
