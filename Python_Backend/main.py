import asyncio
import uvicorn
from fastapi import FastAPI, WebSocket, BackgroundTasks
from exercises.analysis import exercise_analysis
from websocket.handler import websocket_endpoint

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Gym Trainer API!"}

@app.get("/start/{exercise}")
async def start_exercise(exercise: str, background_tasks: BackgroundTasks):
    valid_exercises = [
        "bicep_curl", "squats", "lateral_raises", "shoulder_press",
        "triceps_extension", "bench_press", "front_raises"
    ]
    
    if exercise in valid_exercises:
        background_tasks.add_task(lambda: exercise_analysis(exercise))
        return {"message": f"{exercise} exercise started!"}
    
    return {"error": "Invalid exercise type"}

app.websocket("/ws")(websocket_endpoint)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
