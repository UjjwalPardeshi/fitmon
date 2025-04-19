let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

let stageRight = "down", stageLeft = "down";
let lastRepTimeRight = 0, lastRepTimeLeft = 0;
let stage = "down", lastRepTime = 0;
let selectedExercise = null;
let detector = null;

let yogaTimer = null;
let yogaStartTime = null;
let yogaSeconds = 0;
let exerciseCounters = {
  "Bicep Curl": 0,
  "Squat": 0,
  "Lateral Raise": 0,
  "Lunge": 0,
  "Triceps Extension": 0
};

const exerciseList = {
  "Bicep Curl": countBicepCurls,
  "Squat": countSquats,
  "Lateral Raise": countLateralRaises,
  "Lunge": countLunges,
  "Triceps Extension": countTricepsExtensions
};



function startYoga() {
  selectedExercise = "Yoga";
  document.getElementById("exercise-name").innerText = "Exercise: Yoga 🧘";
  document.getElementById("yoga-seconds").innerText = "0";
  setupCamera().then(() => {
    loadModel().then(() => {
      detectYogaPose(); // Not detectPose()
    });
  });
}

async function detectYogaPose() {
  if (!detector || video.paused || video.ended) return;

  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (poses.length > 0 && poses[0].keypoints) {
    const keypoints = poses[0].keypoints;
    drawPose(keypoints);

    const isCorrect = isTreePose(keypoints);

    if (isCorrect) {
      if (!yogaStartTime) {
        yogaStartTime = Date.now();
        yogaTimer = setInterval(() => {
          yogaSeconds = Math.floor((Date.now() - yogaStartTime) / 1000);
          document.getElementById("yoga-seconds").innerText = yogaSeconds;
        }, 1000);
      }
    } else {
      if (yogaTimer) {
        clearInterval(yogaTimer);
        yogaTimer = null;
        yogaStartTime = null;
        yogaSeconds = 0;
        document.getElementById("yoga-seconds").innerText = "0";
      }
    }
  }

  requestAnimationFrame(detectYogaPose);
}



function startSpecificExercise(exerciseName) {
  selectedExercise = exerciseName;
  document.getElementById("exercise-name").innerText = `Exercise: ${selectedExercise}`;
  setupCamera().then(() => {
    loadModel().then(() => {
      detectPose();
    });
  });
}

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1000, height: 600, facingMode: "user" }
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        resolve();
      };
    });
  } catch (error) {
    alert("Camera access error. Please check browser permissions.");
  }
}

async function loadModel() {
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.BlazePose,
    { runtime: 'tfjs', modelType: 'full' }
  );
}

async function detectPose() {
  if (!detector || video.paused || video.ended) return;

  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (poses.length > 0 && poses[0].keypoints) {
    const keypoints = poses[0].keypoints;
    drawPose(keypoints);

    if (selectedExercise && exerciseList[selectedExercise]) {
      exerciseList[selectedExercise](keypoints);
    }

    updateExerciseCounters();
  }

  requestAnimationFrame(detectPose);
}

function drawPose(keypoints) {
  const connections = [[11,12],[12,24],[11,23],[23,24],[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28]];
  keypoints.forEach(kp => {
    if (kp && kp.score > 0.5) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }
  });
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 4;
  connections.forEach(([i, j]) => {
    const kp1 = keypoints[i], kp2 = keypoints[j];
    if (kp1 && kp2 && kp1.score > 0.5 && kp2.score > 0.5) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  });
}

function updateExerciseCounters() {
    const current = selectedExercise || "Bicep Curl";
    const count = exerciseCounters[current];
  
    document.getElementById("big-count").innerText = count;
  
    document.getElementById("counter").innerHTML = `
      Bicep Curls: ${exerciseCounters["Bicep Curl"]} reps<br>
      Squats: ${exerciseCounters["Squat"]} reps<br>
      Lateral Raises: ${exerciseCounters["Lateral Raise"]} reps<br>
      Lunges: ${exerciseCounters["Lunge"]} reps<br>
      Triceps Extensions: ${exerciseCounters["Triceps Extension"]} reps
    `;
  }
  
// --- YOGA --- 

function isTreePose(keypoints) {
    const leftAnkle = keypoints[27];
    const rightAnkle = keypoints[28];
    const leftKnee = keypoints[25];
    const rightKnee = keypoints[26];
    const leftHip = keypoints[23];
    const rightHip = keypoints[24];
    const leftWrist = keypoints[15];
    const rightWrist = keypoints[16];
    const leftElbow = keypoints[13];
    const rightElbow = keypoints[14];
  
    if (!leftAnkle || !rightAnkle || !leftKnee || !rightKnee || !leftHip || !rightHip || !leftWrist || !rightWrist || !leftElbow || !rightElbow) {
      return false;
    }
  
    // ✅ One leg is lifted (one ankle much higher than the other)
    const ankleDiff = Math.abs(leftAnkle.y - rightAnkle.y);
    const oneLegLifted = ankleDiff > 80;
  
    // ✅ Hands are close together (distance between wrists small)
    const wristDistance = Math.hypot(leftWrist.x - rightWrist.x, leftWrist.y - rightWrist.y);
    const handsTogether = wristDistance < 100;
  
    return oneLegLifted && handsTogether;
  }
  
  
// -------- REP COUNT FUNCTIONS --------

function calculateAngle(A, B, C) {
  let a = Math.hypot(B.x - A.x, B.y - A.y);
  let b = Math.hypot(B.x - C.x, B.y - C.y);
  let c = Math.hypot(C.x - A.x, C.y - A.y);
  return (Math.acos((a * a + b * b - c * c) / (2 * a * b)) * 180) / Math.PI;
}
function countBicepCurls(keypoints) {
    const angleR = calculateAngle(keypoints[12], keypoints[14], keypoints[16]);
    const angleL = calculateAngle(keypoints[11], keypoints[13], keypoints[15]);
    const now = Date.now();
  
    // Right arm
    if (angleR > 150) stageRight = "down";
    if (angleR < 40 && stageRight === "down" && now - lastRepTimeRight > 800) {
      stageRight = "up";
      exerciseCounters["Bicep Curl"]++;
      lastRepTimeRight = now;
    }
  
    // Left arm
    if (angleL > 150) stageLeft = "down";
    if (angleL < 40 && stageLeft === "down" && now - lastRepTimeLeft > 800) {
      stageLeft = "up";
      exerciseCounters["Bicep Curl"]++;
      lastRepTimeLeft = now;
    }
  }
  
  function countSquats(keypoints) {
    const leftKnee = calculateAngle(keypoints[23], keypoints[25], keypoints[27]);
    const rightKnee = calculateAngle(keypoints[24], keypoints[26], keypoints[28]);
    const now = Date.now();
  
    if (leftKnee < 110 && rightKnee < 110) stage = "down";
    if (leftKnee > 160 && rightKnee > 160 && stage === "down" && now - lastRepTime > 1000) {
      stage = "up";
      exerciseCounters["Squat"]++;
      lastRepTime = now;
    }
  }
  
  function countLunges(keypoints) {
    const leftKnee = calculateAngle(keypoints[23], keypoints[25], keypoints[27]);
    const rightKnee = calculateAngle(keypoints[24], keypoints[26], keypoints[28]);
    const now = Date.now();
  
    if (leftKnee < 90 || rightKnee < 90) stage = "down";
    if ((leftKnee > 160 || rightKnee > 160) && stage === "down" && now - lastRepTime > 1000) {
      stage = "up";
      exerciseCounters["Lunge"]++;
      lastRepTime = now;
    }
  }
  
  function countLateralRaises(keypoints) {
    const now = Date.now();
    const leftWristY = keypoints[15].y;
    const rightWristY = keypoints[16].y;
    const leftShoulderY = keypoints[11].y;
    const rightShoulderY = keypoints[12].y;
  
    if (leftWristY > leftShoulderY && rightWristY > rightShoulderY) {
      stage = "down";
    }
  
    if (leftWristY < leftShoulderY && rightWristY < rightShoulderY && stage === "down" && now - lastRepTime > 1000) {
      stage = "up";
      exerciseCounters["Lateral Raise"]++;
      lastRepTime = now;
    }
  }
  
  function countTricepsExtensions(keypoints) {
    const angle = calculateAngle(keypoints[12], keypoints[14], keypoints[16]);
    const wristY = keypoints[16].y;
    const shoulderY = keypoints[12].y;
    const now = Date.now();
  
    if (wristY < shoulderY && angle > 160) {
      stage = "up";
    }
  
    if (angle < 90 && stage === "up" && now - lastRepTime > 1000) {
      stage = "down";
      exerciseCounters["Triceps Extension"]++;
      lastRepTime = now;
    }
  }
  