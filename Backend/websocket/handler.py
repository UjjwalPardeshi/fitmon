from fastapi import WebSocket

connected_clients = set()

async def send_ws_message(message):
    """Send message to all connected WebSocket clients."""
    for client in connected_clients:
        await client.send_json(message)

async def websocket_endpoint(websocket: WebSocket):
    """Handles WebSocket connections."""
    await websocket.accept()
    connected_clients.add(websocket)
    
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except:
        connected_clients.remove(websocket)
