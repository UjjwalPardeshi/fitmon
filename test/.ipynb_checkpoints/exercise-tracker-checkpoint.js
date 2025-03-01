let detector;
let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

let exerciseCounters = {
    "Bicep Curl": 0,
    "Squat": 0
};

let detectedExercise = "Unknown";
let stage = "down";

canvas.width = 640;
canvas.height = 480;

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
        });

        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                video.style.display = "none";  
                resolve();
            };
        });
    } catch (error) {
        console.error("Camera access denied or error:", error);
        alert("Failed to access the camera. Please allow permissions or check browser settings.");
    }
}


async function loadModel() {
    detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.BlazePose, {
            runtime: 'tfjs',
            modelType: 'full'
        }
    );
    detectPose();
}

async function detectPose() {
    if (!detector || video.paused || video.ended) return;

    const poses = await detector.estimatePoses(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Flip the video horizontally
    ctx.save();
    ctx.scale(-1, 1); 
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    if (poses.length > 0) {
        let keypoints = poses[0].keypoints;

        keypoints.forEach(point => {
            point.x = canvas.width - (point.x / video.videoWidth) * canvas.width;
            point.y = (point.y / video.videoHeight) * canvas.height;
        });

        drawPose(keypoints);

        // Detect the exercise based on movement
        detectedExercise = detectExercise(keypoints);
        document.getElementById("exercise-name").innerText = `Exercise: ${detectedExercise}`;

        if (detectedExercise === "Bicep Curl") {
            countBicepCurls(keypoints);
        } else if (detectedExercise === "Squat") {
            countSquats(keypoints);
        }
    }

    requestAnimationFrame(detectPose);
}

function detectExercise(keypoints) {
    let shoulder = keypoints[12];
    let elbow = keypoints[14];
    let wrist = keypoints[16];

    let hip = keypoints[24];
    let knee = keypoints[26];
    let ankle = keypoints[28];

    if (shoulder && elbow && wrist) {
        let elbowAngle = calculateAngle(shoulder, elbow, wrist);
        if (elbowAngle < 50) return "Bicep Curl";
    }

    if (hip && knee && ankle) {
        let kneeAngle = calculateAngle(hip, knee, ankle);
        if (kneeAngle < 110) return "Squat";
    }

    return "Unknown";
}

function drawPose(keypoints) {
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 3;

    keypoints.forEach(point => {
        if (point && point.score > 0.5) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = "red";
            ctx.fill();
        }
    });
}

function countBicepCurls(keypoints) {
    if (!keypoints || keypoints.length < 17) return;

    let shoulder = keypoints[12] || null;
    let elbow = keypoints[14] || null;
    let wrist = keypoints[16] || null;

    if (!shoulder || !elbow || !wrist || shoulder.score < 0.5 || elbow.score < 0.5 || wrist.score < 0.5) return;

    let elbowAngle = calculateAngle(shoulder, elbow, wrist);

    if (elbowAngle > 140) stage = "down";

    if (elbowAngle < 50 && stage === "down") {
        stage = "up";
        exerciseCounters["Bicep Curl"]++;
        updateCounters();
        setTimeout(() => { stage = "down"; }, 500);
    }
}

function countSquats(keypoints) {
    if (!keypoints || keypoints.length < 17) return;

    let hip = keypoints[24] || null;
    let knee = keypoints[26] || null;
    let ankle = keypoints[28] || null;

    if (!hip || !knee || !ankle || hip.score < 0.5 || knee.score < 0.5 || ankle.score < 0.5) return;

    let kneeAngle = calculateAngle(hip, knee, ankle);

    if (kneeAngle > 160) stage = "up";

    if (kneeAngle < 110 && stage === "up") {
        stage = "down";
        exerciseCounters["Squat"]++;
        updateCounters();
        setTimeout(() => { stage = "up"; }, 500);
    }
}

function calculateAngle(A, B, C) {
    let a = Math.hypot(B.x - A.x, B.y - A.y);
    let b = Math.hypot(B.x - C.x, B.y - C.y);
    let c = Math.hypot(C.x - A.x, C.y - A.y);

    let angle = Math.acos((a * a + b * b - c * c) / (2 * a * b));
    return (angle * 180) / Math.PI;
}

function updateCounters() {
    document.getElementById("bicep-counter").innerText = `Bicep Curls: ${exerciseCounters["Bicep Curl"]}`;
    document.getElementById("squat-counter").innerText = `Squats: ${exerciseCounters["Squat"]}`;
}

setupCamera().then(loadModel);
