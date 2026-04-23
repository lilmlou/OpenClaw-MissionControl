#!/usr/bin/env python3
import asyncio
import json
import websockets

GATEWAY_URL = "ws://127.0.0.1:18789"

async def test_gateway():
    print(f"Connecting to gateway at {GATEWAY_URL}...")
    try:
        async with websockets.connect(GATEWAY_URL) as ws:
            print("Connected! Sending test message...")
            
            # Try sending a chat message
            test_msg = {
                "type": "chat.message",
                "id": "test-123",
                "threadId": "test-thread",
                "content": "Hello, this is a test!",
                "model": "huggingface/Qwen/Qwen3-Coder-480B-A35B-Instruct",
                "timestamp": 1234567890
            }
            await ws.send(json.dumps(test_msg))
            print(f"Sent: {test_msg}")
            
            # Wait for response
            print("Waiting for response...")
            async for msg in ws:
                print(f"Received: {msg}")
                
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_gateway())
