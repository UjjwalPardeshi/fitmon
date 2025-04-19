let detector, video, canvas, ctx;
let poseTimer = 0;
let bestTime = 0;
let timerInterval;

const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");

startBtn.onclick = startPose;
stopBtn.onclick = stopPose;

async function initCamera() {
  video = document.getElementById("video");
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve();
    };
  });
}

async function loadModel() {
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
    runtime: "tfjs",
    modelType: "full"
  });
}

async function startPose() {
  poseTimer = 0;
  document.getElementById("pose-time").innerText = "0";
  document.getElementById("best-time").innerText = bestTime;

  await initCamera();
  await loadModel();
  timerInterval = setInterval(() => {
    poseTimer++;
    document.getElementById("pose-time").innerText = poseTimer;
    if (poseTimer > bestTime) {
      bestTime = poseTimer;
      document.getElementById("best-time").innerText = bestTime;
    }
  }, 1000);
  detectPose();
}

function stopPose() {
  clearInterval(timerInterval);
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
}

async function detectPose() {
  if (!detector || video.paused || video.ended) return;

  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPose(poses[0].keypoints);


  if (poses.length > 0 && poses[0].keypoints) {
    drawPose(poses[0].keypoints);
  }
  requestAnimationFrame(detectPose);
}

function drawPose(keypoints) {
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 11], [11, 13], [13, 15],
    [6, 12], [12, 14], [14, 16],
    [11, 12]
  ];

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  keypoints.forEach(kp => {
    if (kp.score > 0.5) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "white";
      ctx.fill();
    }
  });

  connections.forEach(([i, j]) => {
    if (keypoints[i].score > 0.5 && keypoints[j].score > 0.5) {
      ctx.beginPath();
      ctx.moveTo(keypoints[i].x, keypoints[i].y);
      ctx.lineTo(keypoints[j].x, keypoints[j].y);
      ctx.stroke();
    }
  });
}
