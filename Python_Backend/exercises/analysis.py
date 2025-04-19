import cv2
import numpy as np
import mediapipe as mp
import asyncio
from websocket.handler import send_ws_message
from exercises.utils import calculate_angle

mp_pose = mp.solutions.pose

# Global counters and stages
counters = {
    "bicep_curl": 0, "bench_press": 0, "squats": 0, 
    "lateral_raises": 0, "shoulder_press": 0, 
    "triceps_extension": 0, "front_raises": 0
}
stages = {key: None for key in counters.keys()}

def exercise_analysis(exercise):
    """Handles exercise counting and WebSocket communication."""
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
                counter, stage = counters[exercise], stages[exercise]

                # Define landmark points for exercises
                points = {
                    "shoulder": [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                                 landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y],
                    "elbow": [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                              landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y],
                    "wrist": [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,
                              landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y],
                    "hip": [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x,
                            landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y],
                    "knee": [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x,
                             landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y],
                    "ankle": [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x,
                              landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]
                }

                if exercise == "bicep_curl":
                    angle = calculate_angle(points["shoulder"], points["elbow"], points["wrist"])
                    if angle > 130:
                        stage = "down"
                    if angle < 40 and stage == "down":
                        stage = "up"
                        counter += 1

                elif exercise == "bench_press":
                    angle = calculate_angle(points["shoulder"], points["elbow"], points["ankle"])
                    if angle < 40:
                        stage = "down"
                    if angle > 140 and stage == "down":
                        stage = "up"
                        counter += 1

                elif exercise == "squats":
                    angle = calculate_angle(points["hip"], points["knee"], points["ankle"])
                    if angle > 160:
                        stage = "down"
                    if angle < 90 and stage == "down":
                        stage = "up"
                        counter += 1

                elif exercise == "lateral_raises":
                    angle = calculate_angle(points["hip"], points["knee"], points["ankle"])
                    angle2 = calculate_angle(points["shoulder"], points["elbow"], points["wrist"])
                
                    if angle2 < 130:
                        print('Bad form')
                        bad_form = True  # Flag to track bad form
                    else:
                        bad_form = False  # Reset if form is correct

                    if angle < 40:
                        stage = "down"

                    if angle > 85 and stage == 'down' and not bad_form:  # Only count if form is correct
                        stage = "up"
                        counter += 1
                    print("Good rep:", counter) 

                elif exercise == "front_raises":
                    angle = calculate_angle(points["hip"], points["knee"], points["ankle"])
                    angle2 = calculate_angle(points["shoulder"], points["elbow"], points["wrist"])
                
                    if angle2 < 130:
                        print('Bad form')
                        bad_form = True  # Flag to track bad form
                    else:
                        bad_form = False  # Reset if form is correct

                    if angle < 40:
                        stage = "down"

                    if angle > 85 and stage == 'down' and not bad_form:  # Only count if form is correct
                        stage = "up"
                        counter += 1
                    print("Good rep:", counter) 


                elif exercise == "triceps_extension":
                    angle = calculate_angle(points["shoulder"], points["elbow"], points["wrist"])
                    if angle > 160:
                        stage = "down"
                    if angle < 90 and stage == "down":
                        stage = "up"
                        counter += 1
                
                counters[exercise] = counter
                stages[exercise] = stage

                message = {"exercise": exercise, "reps": counter}
                asyncio.run(send_ws_message(message))

            except Exception:
                pass

            cv2.imshow(f'{exercise} Exercise', frame)
            if cv2.waitKey(10) & 0xFF == ord('q'):
                break

    cap.release()
    cv2.destroyAllWindows()
