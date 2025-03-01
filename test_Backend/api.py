import cv2
import numpy as np
import mediapipe as mp
import asyncio
import uvicorn
from fastapi import FastAPI, WebSocket, BackgroundTasks
import threading

app = FastAPI()

# Initialize MediaPipe Pose
mp_pose = mp.solutions.pose

# Global counters
counter_bicep = 0
counter_bench_press = 0
counter_squats = 0
counter_lateral_raises = 0
counter_shoulder_press = 0
counter_triceps_extension = 0
counter_front_raises = 0
stage_front_raises = None
stage_bench_press = None
stage_triceps_extension = None
stage_shoulder_press = None
stage_bicep = None
stage_squats = None
stage_lateral_raises = None

# WebSocket clients
connected_clients = set()

# Calculate angle
def calculate_angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    angle = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(angle * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360 - angle
    return angle

async def send_ws_message(message):
    """Send message to all connected WebSocket clients."""
    for client in connected_clients:
        await client.send_json(message)

def exercise_analysis(exercise):
    """Handles exercise counting and WebSocket communication."""
    global counter_bicep, counter_front_raises, counter_squats,counter_bench_press, counter_triceps_extension, counter_lateral_raises, counter_shoulder_press, stage_bench_press,stage_front_raises, stage_triceps_extension, stage_shoulder_press, stage_bicep, stage_squats, stage_lateral_raises
    
    cap = cv2.VideoCapture(1)  # Open camera

    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image) 

            try:
                landmarks = results.pose_landmarks.landmark

                if exercise == "bicep_curl":
                    shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                    wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]

                    angle = calculate_angle(shoulder, elbow, wrist)

                    if angle > 130:
                        stage_bicep = "down"
                    if angle < 40 and stage_bicep == "down":
                        stage_bicep = "up"
                        counter_bicep += 1

                    message = {"exercise": "bicep_curl", "reps": counter_bicep}

                
                elif exercise == "triceps_extension":
                    shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                    wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
            
                    # Calculate angle
                    angle = calculate_angle(shoulder, elbow, wrist)

                    if angle < 40:
                        stage_triceps_extension = "down"
                    if angle > 140 and stage_triceps_extension == "down":
                        stage_triceps_extension = "up"
                        counter_triceps_extension += 1

                    message = {"exercise": "triceps_extension", "reps": counter_triceps_extension}
                
                elif exercise == "bench_press":
                    shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                    wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
            
                    # Calculate angle
                    angle = calculate_angle(shoulder, elbow, wrist)

                    if angle < 40:
                        stage_bench_press = "down"
                    if angle > 140 and stage_bench_press == "down":
                        stage_bench_press = "up"
                        counter_bench_press += 1

                    message = {"exercise": "bench_press", "reps": counter_bench_press}

                elif exercise == "shoulder_press":
                    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                    shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
            
                    # Calculate angle
                    angle = calculate_angle(elbow, shoulder, hip)

                    if angle < 40:
                        stage_shoulder_press = "down"
                    if angle > 130 and stage_shoulder_press == "down":
                        stage_shoulder_press = "up"
                        counter_shoulder_press += 1

                    message = {"exercise": "shoulder_press", "reps": counter_shoulder_press}
                    
                elif exercise == "squats":
                    hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
                    knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
                    ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]

                    angle = calculate_angle(hip, knee, ankle)

                    if angle > 160:
                        stage_squats = "down"
                    if angle < 90 and stage_squats == "down":
                        stage_squats = "up"
                        counter_squats += 1

                    message = {"exercise": "squats", "reps": counter_squats}

                elif exercise == "lateral_raises":
                    hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
                    shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]

                # Get coordinates
                    shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                    wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
            
                # Calculate angle
                    angle = calculate_angle(hip, shoulder, elbow)
                    angle2 = calculate_angle(shoulder, elbow, wrist)


                    if angle2 < 130:
                        print('Bad form')
                        bad_form = True  # Flag to track bad form
                    else:
                        bad_form = False  # Reset if form is correct

                    if angle < 40:
                        stage_lateral_raises = "down"

                    if angle > 85 and stage_lateral_raises == 'down' and not bad_form:  # Only count if form is correct
                        stage_lateral_raises = "up"
                        counter_lateral_raises += 1
                    print("Good rep:", counter_lateral_raises) 


                    message = {"exercise": "lateral_raises", "reps": counter_lateral_raises}


                elif exercise == "front_raises":
                    hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
                    shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]

                # Get coordinates
                    shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                    wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
            
                # Calculate angle
                    angle = calculate_angle(hip, shoulder, elbow)
                    angle2 = calculate_angle(shoulder, elbow, wrist)


                    if angle2 < 130:
                        print('Bad form')
                        bad_form = True  # Flag to track bad form
                    else:
                        bad_form = False  # Reset if form is correct

                    if angle < 40:
                        stage_front_raises = "down"

                    if angle > 85 and stage_front_raises == 'down' and not bad_form:  # Only count if form is correct
                        stage_front_raises = "up"
                        counter_front_raises += 1
                    print("Good rep:", counter_front_raises) 


                    message = {"exercise": "front_raises", "reps": counter_front_raises}

                asyncio.run(send_ws_message(message))  # Send real-time data

            except:
                pass

            cv2.imshow(f'{exercise} Exercise', frame)
            if cv2.waitKey(10) & 0xFF == ord('q'):
                break

    cap.release()
    cv2.destroyAllWindows()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Gym Trainer API!"}

@app.get("/start/{exercise}")
async def start_exercise(exercise: str, background_tasks: BackgroundTasks):
    if exercise in ["bicep_curl", "squats", "lateral_raises", "shoulder_press", "triceps_extension", "bench_press", "front_raises"]:
        background_tasks.add_task(lambda: exercise_analysis(exercise))
        return {"message": f"{exercise} exercise started!"}
    return {"error": "Invalid exercise type"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Handles WebSocket connections."""
    await websocket.accept()
    connected_clients.add(websocket)
    
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except:
        connected_clients.remove(websocket)
