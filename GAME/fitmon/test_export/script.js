let detector;
let video = document.getElementById("video");
let canvas = document.getElementById("AIcanvas");
let ctx = canvas.getContext("2d");
let stageRight = "down", stageLeft = "down";
let lastRepTimeRight = 0, lastRepTimeLeft = 0;

let exerciseCounters = {
    "Bicep Curl": 0,
    "Squat": 0,
    "Lateral Raise": 0,  // ✅ Added Lateral Raise counter
    "Lunge": 0,
};


let detectedExercise = "Unknown";
let exerciseLocked = false; // Lock detection once an exercise is identified
let stage = "down";
let lastRepTime = 0;

canvas.width = 1000;
canvas.height = 600;

async function setupCamera() {
    try {
        console.log("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1000, height: 600, facingMode: "user" },
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
    "Squat": { detect: detectSquat, count: countSquats },
    "Lateral Raise": { detect: detectLateralRaise, count: countLateralRaises },
    "Lunge": { detect: detectLunge, count: countLunges },
};

function detectExercise(keypoints) {
    for (let ex in exerciseList) {
        if (exerciseList[ex].detect(keypoints)) {
            return ex;
        }
    }
    return "Unknown";
}

function startExercise() {
    let exerciseDropdown = document.getElementById("exercise");
    selectedExercise = exerciseDropdown.value; // ✅ Ensure selected exercise is updated
    document.getElementById("exercise-name").innerText = `Exercise: ${selectedExercise}`;

    console.log(`Starting exercise: ${selectedExercise}`);
    detectPose(); // ✅ Start pose detection
}



function detectLunge(keypoints) {
    let leftHip = keypoints[23], rightHip = keypoints[24];
    let leftKnee = keypoints[25], rightKnee = keypoints[26];
    let leftAnkle = keypoints[27], rightAnkle = keypoints[28];

    if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) return false;

    let leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    let rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

    return (leftKneeAngle < 90 || rightKneeAngle < 90);  
    // ✅ Lunge detected when at least one knee is bent below 90°
}


function detectLateralRaise(keypoints) {
    let rightWrist = keypoints[16];
    let leftWrist = keypoints[15];
    let rightShoulder = keypoints[12];
    let leftShoulder = keypoints[11];

    if (!rightWrist || !leftWrist || !rightShoulder || !leftShoulder) return false;

    return rightWrist.y < rightShoulder.y && leftWrist.y < leftShoulder.y;
}

function detectBicepCurl(keypoints) {
    let rightShoulder = keypoints[12], rightElbow = keypoints[14], rightWrist = keypoints[16];
    let leftShoulder = keypoints[11], leftElbow = keypoints[13], leftWrist = keypoints[15];
    
    if (!rightShoulder || !rightElbow || !rightWrist || !leftShoulder || !leftElbow || !leftWrist) return false;
    
    let rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    let leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    
    return rightElbowAngle < 50 || leftElbowAngle < 50; // ✅ Detect curl on either arm
}


function detectSquat(keypoints) {
    let leftHip = keypoints[23], rightHip = keypoints[24];
    let leftKnee = keypoints[25], rightKnee = keypoints[26];
    let leftAnkle = keypoints[27], rightAnkle = keypoints[28];

    if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) return false;

    let leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    let rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

    return (leftKneeAngle < 110 && rightKneeAngle < 110);  
    // ✅ Squat detected when both knees are bent below 110°
}



function countLunges(keypoints) {
    let leftHip = keypoints[23], rightHip = keypoints[24];
    let leftKnee = keypoints[25], rightKnee = keypoints[26];
    let leftAnkle = keypoints[27], rightAnkle = keypoints[28];

    if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) return;

    let leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    let rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

    let currentTime = Date.now();

    if (leftKneeAngle < 90 || rightKneeAngle < 90) {
        stage = "down"; // ✅ Deep lunge position
    }

    if ((leftKneeAngle > 160 || rightKneeAngle > 160) && stage === "down" && currentTime - lastRepTime > 1000) {
        stage = "up"; // ✅ User returns to standing position
        exerciseCounters["Lunge"]++;
        lastRepTime = currentTime;
        updateExerciseCounters();
        unlockExerciseDetection();
    }
}


function countLateralRaises(keypoints) {
    let rightWrist = keypoints[16];
    let leftWrist = keypoints[15];
    let rightShoulder = keypoints[12];
    let leftShoulder = keypoints[11];

    if (!rightWrist || !leftWrist || !rightShoulder || !leftShoulder) return;

    let currentTime = Date.now();
    
    if (rightWrist.y < rightShoulder.y && leftWrist.y < leftShoulder.y && currentTime - lastRepTime > 1000) {
        exerciseCounters["Lateral Raise"]++;
        lastRepTime = currentTime;
        updateExerciseCounters();
        unlockExerciseDetection();
    }
}

function countBicepCurls(keypoints) {
    let rightElbowAngle = calculateAngle(keypoints[12], keypoints[14], keypoints[16]);
    let leftElbowAngle = calculateAngle(keypoints[11], keypoints[13], keypoints[15]);
    
    let currentTime = Date.now();
    
    // ✅ Track right arm
    if (rightElbowAngle > 140) stageRight = "down";
    if (rightElbowAngle < 40 && stageRight === "down" && currentTime - lastRepTimeRight > 800) {
        stageRight = "up";
        exerciseCounters["Bicep Curl"]++;
        lastRepTimeRight = currentTime;
        updateExerciseCounters();
        unlockExerciseDetection();
    }
    
    // ✅ Track left arm
    if (leftElbowAngle > 140) stageLeft = "down";
    if (leftElbowAngle < 40 && stageLeft === "down" && currentTime - lastRepTimeLeft > 800) {
        stageLeft = "up";
        exerciseCounters["Bicep Curl"]++;
        lastRepTimeLeft = currentTime;
        updateExerciseCounters();
        unlockExerciseDetection();
    }
}


function countSquats(keypoints) {
    let leftHip = keypoints[23], rightHip = keypoints[24];
    let leftKnee = keypoints[25], rightKnee = keypoints[26];
    let leftAnkle = keypoints[27], rightAnkle = keypoints[28];

    if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) return;

    let leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    let rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

    let currentTime = Date.now();

    if (leftKneeAngle < 110 && rightKneeAngle < 110) {
        stage = "down"; // ✅ Deep squat position
    }

    if (leftKneeAngle > 160 && rightKneeAngle > 160 && stage === "down" && currentTime - lastRepTime > 1000) {
        stage = "up"; // ✅ User returns to standing position
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

document.getElementById("exercise").addEventListener("change", function () {
    selectedExercise = this.value; // ✅ Update selected exercise
    document.getElementById("exercise-name").innerText = `Exercise: ${selectedExercise}`;
});

function updateExerciseCounters() {
    document.getElementById("counter").innerHTML = `
        Bicep Curls: ${exerciseCounters["Bicep Curl"]} reps<br>
        Squats: ${exerciseCounters["Squat"]} reps<br>
        Lateral Raises: ${exerciseCounters["Lateral Raise"]} reps<br>
        Lunges: ${exerciseCounters["Lunge"]} reps<br>
    `;
    document.getElementById("curls").innerHTML = exerciseCounters["Bicep Curl"]
    document.getElementById("squats").innerHTML = exerciseCounters["Squat"]
    document.getElementById("latraises").innerHTML = exerciseCounters["Lateral Raise"]
    document.getElementById("lunges").innerHTML = exerciseCounters["Lunge"]
}


setupCamera().then(loadModel);