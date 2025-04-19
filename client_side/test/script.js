let detector, video, canvas, ctx;
let selectedExercise = "";
let count = 0;
let stage = "down";
let lastRepTime = 0;

window.onload = async () => {
  video = document.getElementById("video");
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  await setupCamera();
  await loadModel();
};

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
  });
  video.srcObject = stream;
  return new Promise(resolve => {
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

function startExercise(name) {
  selectedExercise = name;
  count = 0;
  document.getElementById("exercise-name").textContent = `Selected: ${name}`;
  document.getElementById("counter").textContent = "Reps: 0";
  requestAnimationFrame(detectPose);
}

function calculateAngle(A, B, C) {
  const a = Math.hypot(B.x - A.x, B.y - A.y);
  const b = Math.hypot(B.x - C.x, B.y - C.y);
  const c = Math.hypot(C.x - A.x, C.y - A.y);
  return (Math.acos((a*a + b*b - c*c) / (2 * a * b)) * 180) / Math.PI;
}

function drawPose(keypoints) {
  const connections = [
    [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 12], [23, 24], [11, 23], [12, 24],
    [23, 25], [25, 27], [24, 26], [26, 28]
  ];

  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;

  connections.forEach(([a, b]) => {
    const kp1 = keypoints[a], kp2 = keypoints[b];
    if (kp1.score > 0.4 && kp2.score > 0.4) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  });

  keypoints.forEach(kp => {
    if (kp.score > 0.4) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }
  });
}

async function detectPose() {
  if (!detector || !selectedExercise) return;

  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();

  if (poses.length > 0) {
    const keypoints = poses[0].keypoints;
    drawPose(keypoints);

    // Example for Bicep Curl (left arm)
    if (selectedExercise === "Bicep Curl") {
      const angle = calculateAngle(keypoints[11], keypoints[13], keypoints[15]);
      const now = Date.now();

      if (angle > 140) stage = "down";
      if (angle < 40 && stage === "down" && now - lastRepTime > 800) {
        stage = "up";
        count++;
        lastRepTime = now;
        document.getElementById("counter").textContent = `Reps: ${count}`;
      }
    }

    // TODO: Add similar logic for other exercises here
  }

  requestAnimationFrame(detectPose);
}
