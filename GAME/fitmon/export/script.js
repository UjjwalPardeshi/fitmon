let detector;
let video = document.getElementById("video");
let canvas = document.getElementById("AIcanvas");
let ctx = canvas.getContext("2d");

let exerciseCounters = {
    "Bicep Curl": 0,
    "Squat": 0
};

let detectedExercise = "Unknown";
let exerciseLocked = false; // Lock detection once an exercise is identified
let stage = "down";
let lastRepTime = 0;

canvas.width = 640;
canvas.height = 480;


async function setupCamera() {
    try {
        console.log("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
        });

        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                video.style.display = "none";
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                console.log("Camera is ready!");
                resolve();
            };
        });
    } catch (error) {
        console.error("Camera access error:", error);
        alert("Camera error: Please allow access or check browser settings.");
    }
}

async function loadModel() {
    try {
        console.log("Loading pose detection model...");
        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.BlazePose, {
                runtime: 'tfjs',
                modelType: 'full'
            }
        );
        console.log("Model loaded successfully!");
        detectPose();
    } catch (error) {
        console.error("Error loading model:", error);
        alert("Failed to load pose detection model. Check console for details.");
    }
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

async function detectPose() {
    if (!detector || video.paused || video.ended) return;

    try {
        const poses = await detector.estimatePoses(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        if (poses.length > 0 && poses[0].keypoints) {
            let keypoints = poses[0].keypoints;

            keypoints.forEach(point => {
                if (point) {
                    point.x = canvas.width - (point.x / video.videoWidth) * canvas.width;
                    point.y = (point.y / video.videoHeight) * canvas.height;
                }
            });

            drawPose(keypoints);

            if (!exerciseLocked) {
                let detected = detectExercise(keypoints);
                if (detected !== "Unknown") {
                    detectedExercise = detected;
                    exerciseLocked = true;
                    document.getElementById("exercise-name").innerText = `Detected Exercise: ${detectedExercise}`;
                }
            }

            if (exerciseLocked) {
                exerciseList[detectedExercise].count(keypoints);
            }

            updateExerciseCounters();
        }
    } catch (error) {
        console.error("Pose detection error:", error);
    }

    requestAnimationFrame(detectPose);
}

const exerciseList = {
    "Bicep Curl": { detect: detectBicepCurl, count: countBicepCurls },
    "Squat": { detect: detectSquat, count: countSquats }
};

function detectExercise(keypoints) {
    for (let ex in exerciseList) {
        if (exerciseList[ex].detect(keypoints)) {
            return ex;
        }
    }
    return "Unknown";
}

function detectBicepCurl(keypoints) {
    let shoulder = keypoints[12], elbow = keypoints[14], wrist = keypoints[16];
    if (!shoulder || !elbow || !wrist) return false;
    let elbowAngle = calculateAngle(shoulder, elbow, wrist);
    return elbowAngle < 50;
}

function detectSquat(keypoints) {
    let hip = keypoints[24], knee = keypoints[26], ankle = keypoints[28];
    if (!hip || !knee || !ankle) return false;
    let kneeAngle = calculateAngle(hip, knee, ankle);
    return kneeAngle < 110;
}

function countBicepCurls(keypoints) {
    let elbowAngle = calculateAngle(keypoints[12], keypoints[14], keypoints[16]);
    if (elbowAngle > 140) stage = "down";

    let currentTime = Date.now();
    if (elbowAngle < 50 && stage === "down" && currentTime - lastRepTime > 800) {
        stage = "up";
        exerciseCounters["Bicep Curl"]++;
        lastRepTime = currentTime;
        updateExerciseCounters();
        unlockExerciseDetection();
    }
}

function countSquats(keypoints) {
    let kneeAngle = calculateAngle(keypoints[24], keypoints[26], keypoints[28]);
    if (kneeAngle > 160) stage = "up";

    let currentTime = Date.now();
    if (kneeAngle < 110 && stage === "up" && currentTime - lastRepTime > 1000) {
        stage = "down";
        exerciseCounters["Squat"]++;
        lastRepTime = currentTime;
        updateExerciseCounters();
        unlockExerciseDetection();
    }
}

function calculateAngle(A, B, C) {
    let a = Math.hypot(B.x - A.x, B.y - A.y);
    let b = Math.hypot(B.x - C.x, B.y - C.y);
    let c = Math.hypot(C.x - A.x, C.y - A.y);
    let angle = Math.acos((a * a + b * b - c * c) / (2 * a * b));
    return (angle * 180) / Math.PI;
}

function unlockExerciseDetection() {
    setTimeout(() => {
        exerciseLocked = false;
        detectedExercise = "Unknown";
        document.getElementById("exercise-name").innerText = "Detecting...";
    }, 1500); // Short delay before allowing new detection
}

function updateExerciseCounters() {
    document.getElementById("counter").innerHTML = `
        Bicep Curls: ${exerciseCounters["Bicep Curl"]} reps<br>
        Squats: ${exerciseCounters["Squat"]} reps
    `;
    window.FitmonAPI = {
        getExerciseCounts: function () {
            return {
                "Bicep Curl": exerciseCounters["Bicep Curl"],
                "Squat": exerciseCounters["Squat"]
            };
        }
    };
}

setupCamera().then(loadModel);