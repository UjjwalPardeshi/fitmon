import cv2
import mediapipe as mp
import numpy as np
import asyncio
from fastapi import FastAPI, WebSocket, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

counter = {"bicep_curl": 0, "front_raises": 0, "squats": 0, "bench_press": 0, "triceps_extension": 0, "lateral_raises": 0, "shoulder_press": 0}
stage = {exercise: None for exercise in counter}

async def send_ws_message(message):
    async with websockets.connect("ws://localhost:8000/ws") as websocket:
        await websocket.send_json(message)

def calculate_angle(a, b, c):
    a = np.array(a)  
    b = np.array(b)
    c = np.array(c)
    
    ba = a - b
    bc = c - b
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.arccos(cosine_angle)
    return np.degrees(angle)

def classify_exercise(landmarks):
    shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
    wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
    hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
    knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
    ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]

    elbow_angle = calculate_angle(shoulder, elbow, wrist)
    knee_angle = calculate_angle(hip, knee, ankle)
    shoulder_angle = calculate_angle(hip, shoulder, elbow)

    if knee_angle < 100:  return "squats"
    if elbow_angle < 40:  return "bicep_curl"
    if shoulder_angle > 85:  return "front_raises"
    if elbow_angle > 140:  return "triceps_extension"
    if knee_angle > 160 and shoulder_angle > 130:  return "shoulder_press"
    if shoulder_angle < 40 and elbow_angle > 85:  return "lateral_raises"
    return None

def count_reps(exercise, landmarks):
    global counter, stage
    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
    wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
    
    elbow_angle = calculate_angle(elbow, wrist, [0, wrist[1] - 0.1])
    
    if elbow_angle > 140:
        stage[exercise] = "down"
    if elbow_angle < 40 and stage[exercise] == "down":
        stage[exercise] = "up"
        counter[exercise] += 1

def exercise_analysis():
    cap = cv2.VideoCapture(1)
    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image)

            try:
                landmarks = results.pose_landmarks.landmark
                detected_exercise = classify_exercise(landmarks)

                if detected_exercise:
                    count_reps(detected_exercise, landmarks)
                    message = {"exercise": detected_exercise, "reps": counter[detected_exercise]}
                    asyncio.run(send_ws_message(message))
            except:
                pass

            cv2.imshow('Exercise Detection', frame)
            if cv2.waitKey(10) & 0xFF == ord('q'):
                break

    cap.release()
    cv2.destroyAllWindows()

@app.get("/start")
async def start_exercise(background_tasks: BackgroundTasks):
    background_tasks.add_task(exercise_analysis)
    return {"message": "Exercise detection started!"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            await websocket.send_json(counter)
            await asyncio.sleep(1)
        except:
            break
