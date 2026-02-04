"""
WebSocket handler for real-time stock price updates from Polygon/Massive API
"""
import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from app.config import settings

logger = logging.getLogger(__name__)

# Store active WebSocket connections
active_connections: Dict[str, Set[WebSocket]] = {}

# Polygon WebSocket connection
_polygon_ws = None
_polygon_subscriptions: Set[str] = set()

async def connect_polygon_websocket():
    """Connect to Polygon WebSocket for real-time data"""
    global _polygon_ws, _polygon_subscriptions
    
    if not settings.polygon_api_key:
        logger.warning("Polygon API key not configured, WebSocket disabled")
        return None
    
    try:
        import websockets
        uri = "wss://socket.polygon.io/stocks"
        
        async def handle_polygon_messages():
            global _polygon_ws
            while True:
                try:
                    async with websockets.connect(uri) as ws:
                        _polygon_ws = ws
                        
                        # Authenticate
                        await ws.send(json.dumps({
                            "action": "auth",
                            "params": settings.polygon_api_key
                        }))
                        
                        # Wait for authentication confirmation
                        auth_response = await ws.recv()
                        logger.info(f"✅ Connected to Polygon WebSocket: {auth_response}")
                        
                        # Subscribe to already requested symbols
                        if _polygon_subscriptions:
                            for symbol in _polygon_subscriptions:
                                await ws.send(json.dumps({
                                    "action": "subscribe",
                                    "params": f"AM.{symbol}"  # Aggregate Minute bars for real-time
                                }))
                                logger.info(f"📡 Subscribed to {symbol} on Polygon WebSocket")
                        
                        # Listen for messages and broadcast to clients
                        async for message in ws:
                            try:
                                data = json.loads(message)
                                
                                # Handle aggregate bars (AM.*) - real-time price updates
                                if isinstance(data, list):
                                    for item in data:
                                        if item.get("ev") == "AM":  # Aggregate Minute
                                            symbol = item.get("sym", "").replace("AM.", "")
                                            price = item.get("c")  # close price
                                            
                                            # Broadcast to all connected clients for this symbol
                                            if symbol in active_connections:
                                                disconnected = set()
                                                for client in active_connections[symbol]:
                                                    try:
                                                        await client.send_json({
                                                            "type": "price_update",
                                                            "symbol": symbol,
                                                            "price": price,
                                                            "timestamp": item.get("t"),
                                                            "volume": item.get("v"),
                                                            "open": item.get("o"),
                                                            "high": item.get("h"),
                                                            "low": item.get("l")
                                                        })
                                                    except:
                                                        disconnected.add(client)
                                                
                                                # Remove disconnected clients
                                                for client in disconnected:
                                                    active_connections[symbol].discard(client)
                                                    if not active_connections[symbol]:
                                                        del active_connections[symbol]
                            except Exception as e:
                                logger.error(f"Error processing Polygon message: {e}")
                except Exception as e:
                    logger.error(f"Polygon WebSocket connection error: {e}")
                    _polygon_ws = None
                    # Reconnect after 5 seconds
                    await asyncio.sleep(5)
        
        # Start WebSocket handler
        asyncio.create_task(handle_polygon_messages())
        
    except ImportError:
        logger.warning("websockets package not installed, WebSocket disabled")
        return None
    except Exception as e:
        logger.error(f"Failed to connect to Polygon WebSocket: {e}")
        return None

async def subscribe_to_symbol(symbol: str):
    """Subscribe to a symbol on Polygon WebSocket"""
    global _polygon_ws, _polygon_subscriptions
    
    symbol_upper = symbol.upper()
    _polygon_subscriptions.add(symbol_upper)
    
    if _polygon_ws:
        try:
            await _polygon_ws.send(json.dumps({
                "action": "subscribe",
                "params": f"AM.{symbol_upper}"  # Aggregate Minute bars
            }))
            logger.info(f"📡 Subscribed to {symbol_upper} on Polygon WebSocket")
        except Exception as e:
            logger.error(f"Error subscribing to {symbol_upper}: {e}")

async def handle_stock_websocket(websocket: WebSocket, symbol: str):
    """Handle individual client WebSocket connection for stock updates"""
    await websocket.accept()
    symbol_upper = symbol.upper()
    
    # Add to active connections
    if symbol_upper not in active_connections:
        active_connections[symbol_upper] = set()
    active_connections[symbol_upper].add(websocket)
    
    # Subscribe to Polygon WebSocket if not already subscribed
    await subscribe_to_symbol(symbol_upper)
    
    logger.info(f"✅ Client connected for {symbol_upper} (total: {len(active_connections[symbol_upper])})")
    
    try:
        # Keep connection alive and handle client messages
        while True:
            data = await websocket.receive_text()
            # Echo back or handle client messages if needed
            try:
                message = json.loads(data)
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except:
                pass
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error for {symbol_upper}: {e}")
    finally:
        # Remove from active connections
        if symbol_upper in active_connections:
            active_connections[symbol_upper].discard(websocket)
            if not active_connections[symbol_upper]:
                del active_connections[symbol_upper]
                # Unsubscribe from Polygon if no more clients
                _polygon_subscriptions.discard(symbol_upper)
                if _polygon_ws:
                    try:
                        await _polygon_ws.send(json.dumps({
                            "action": "unsubscribe",
                            "params": f"AM.{symbol_upper}"
                        }))
                    except:
                        pass
        logger.info(f"❌ Client disconnected for {symbol_upper}")

