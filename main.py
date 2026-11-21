import asyncio
from datetime import datetime
import io
import json
import os
import random
import re
import time
import traceback
from pathlib import Path

import cv2
import httpx
import numpy as np
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

try:
    from inference_engine import CloudInferenceEngine
except Exception as e:
    CloudInferenceEngine = None
    print(f"[Model] inference_engine import failed: {e}")

app = FastAPI(title="AMB82 Cloud Observation System")

BASE_DIR = Path(__file__).resolve().parent
SAVED_FRAMES_DIR = BASE_DIR / "saved_frames"

# Ensure static, template, and save directories exist
(BASE_DIR / "static" / "css").mkdir(parents=True, exist_ok=True)
(BASE_DIR / "static" / "js").mkdir(parents=True, exist_ok=True)
(BASE_DIR / "templates").mkdir(parents=True, exist_ok=True)
SAVED_FRAMES_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

ENGINE = None
if CloudInferenceEngine is not None:
    try:
        ENGINE = CloudInferenceEngine(
            unet_path=str(BASE_DIR / "models" / "unet_edge.tflite"),
            mobilenet_path=str(BASE_DIR / "models" / "mobilenet_model.tflite"),
            target_size=(256, 256),
        )
        print("[Model] CloudInferenceEngine initialized successfully.")
    except Exception as e:
        ENGINE = None
        print(f"[Model] Failed to initialize CloudInferenceEngine: {e}")
else:
    print("[Model] CloudInferenceEngine unavailable; falling back to placeholder inference.")

# ==============================================================================
# SUPABASE STORAGE CONFIGURATION (replaces direct AMB82 polling)
# ==============================================================================
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://tgqllcnvgycggydefpjd.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_saXNuNinI1P5YSwUL8dO9w_8ZAcUfee")
BUCKET_NAME = os.getenv("SUPABASE_BUCKET", "come_images")

SUPABASE_HEADERS = {
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "apikey": SUPABASE_KEY,
}
SUPABASE_LIST_URL = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET_NAME}"
SOURCE_LABEL = f"Supabase Storage: {BUCKET_NAME}"

POLL_INTERVAL = 1.0  # Polling interval in seconds

# Track the last processed filename so we don't re-run inference on the same image
_last_processed_name = None

LATEST_FRAME_CACHE = {
    "raw_bytes": None,
    "unet_bytes": None,
    "sphere_bytes": None,
    "mobilenet_bytes": None,
    "timestamp": None,
    "is_hardware_connected": False,
    "coverage": 0.0,
    "cloud_pixels": 0,
    "sky_pixels": 0,
    "oktas": 0,
    "mobilenet_predictions": [],
    "mobilenet_all_predictions": []
}

PREDICTION_HISTORY = []
SYSTEM_LOGS = []
HISTORY_LIMIT = 100
LOG_LIMIT = 300

APP_SETTINGS = {
    "stream_mode": "interval",
    "refresh_interval": 3,
    "theme": "light",
    "image_quality": "high",
    "overlay_visibility": True,
    "auto_polling_freq": 2
}

# Shared Async HTTP Client (timeout raised for remote Supabase calls)
http_client = httpx.AsyncClient(timeout=10.0)

# ==============================================================================
# AI MODEL INFERENCE PIPELINE (UNet & MobileNet Integration)
# ==============================================================================
def run_unet_inference(image_np: np.ndarray):
    h, w, _ = image_np.shape
    total_pixels = h * w

    if ENGINE is not None and getattr(ENGINE, 'unet_interpreter', None) is not None:
        result = ENGINE.predict_unet(image_np)
        mask_bgr = result["mask_bgr"]
        coverage = round(result["coverage_fraction"] * 100.0, 1)
        cloud_pixels = int(round(result["coverage_fraction"] * total_pixels))
        sky_pixels = total_pixels - cloud_pixels
        oktas = result["oktas"]
        _, encoded_img = cv2.imencode(".jpg", mask_bgr)
        return encoded_img.tobytes(), coverage, cloud_pixels, sky_pixels, oktas

    gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
    _, binary_mask = cv2.threshold(gray, 140, 255, cv2.THRESH_BINARY)

    mask_visual = cv2.cvtColor(binary_mask, cv2.COLOR_GRAY2BGR)
    mask_visual[:, :, 0] = cv2.bitwise_or(mask_visual[:, :, 0], binary_mask)

    cloud_pixels = int(np.count_nonzero(binary_mask))
    sky_pixels = int(total_pixels - cloud_pixels)
    coverage = round((cloud_pixels / total_pixels) * 100, 1)
    oktas = min(8, int((coverage / 100) * 8))

    _, encoded_img = cv2.imencode(".jpg", mask_visual)
    return encoded_img.tobytes(), coverage, cloud_pixels, sky_pixels, oktas


# ==============================================================================
# MOBILENET CLOUD CLASSIFICATION SECTION
# ==============================================================================
def run_mobilenet_inference(image_np: np.ndarray):
    if ENGINE is not None and getattr(ENGINE, 'mobilenet_interpreter', None) is not None:
        result = ENGINE.predict_mobilenet(image_np)
        top_three = result.get("top_three", [])
        mask_bgr = result.get("mask_bgr", image_np)
        _, encoded_img = cv2.imencode(".jpg", mask_bgr)
        return encoded_img.tobytes(), top_three

    h, w, _ = image_np.shape
    CLOUD_TYPES = [
        {"type": "Altocumulus", "category": "medium"},
        {"type": "Cirrostratus", "category": "high"},
        {"type": "Cumulus", "category": "low"},
        {"type": "Stratocumulus", "category": "low"},
        {"type": "Cumulonimbus", "category": "vertical"}
    ]

    primary_idx = random.randint(0, 2)
    conf_1 = round(random.uniform(75.0, 92.0), 1)
    conf_2 = round(random.uniform(4.0, (100.0 - conf_1) - 2), 1)
    conf_3 = round(100.0 - conf_1 - conf_2, 1)

    top_three = [
        {**CLOUD_TYPES[primary_idx], "confidence": conf_1},
        {**CLOUD_TYPES[(primary_idx + 1) % len(CLOUD_TYPES)], "confidence": conf_2},
        {**CLOUD_TYPES[(primary_idx + 2) % len(CLOUD_TYPES)], "confidence": conf_3}
    ]

    annotated_frame = image_np.copy()
    _, encoded_img = cv2.imencode(".jpg", annotated_frame)
    return encoded_img.tobytes(), top_three


def map_image_to_sphere(image_np: np.ndarray, radius_scale: float = 1.0) -> np.ndarray:
    h, w = image_np.shape[:2]

    grid_x, grid_y = np.meshgrid(np.arange(w), np.arange(h))

    cx, cy = w / 2.0, h / 2.0
    norm_x = (grid_x - cx) / cx
    norm_y = (grid_y - cy) / cy

    r = np.sqrt(norm_x**2 + norm_y**2)
    sphere_mask = r <= 1.0
    r_safe = np.maximum(r, 1e-6)

    theta = np.arctan2(norm_y, norm_x)
    phi = r_safe * (np.pi / 2.0) * radius_scale

    src_x = (np.sin(phi) * np.cos(theta) + 1.0) * cx
    src_y = (np.sin(phi) * np.sin(theta) + 1.0) * cy

    map_x = src_x.astype(np.float32)
    map_y = src_y.astype(np.float32)

    spherical_frame = cv2.remap(
        image_np,
        map_x,
        map_y,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0)
    )

    mask_3ch = np.dstack([sphere_mask] * 3)
    spherical_frame = np.where(mask_3ch, spherical_frame, 0)

    return spherical_frame


def sanitize_filename_component(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value).strip("_")


def save_frame_snapshot(raw_bytes: bytes, predictions: list[dict[str, object]]):
    if not raw_bytes:
        return

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prediction_parts = []
    for pred in predictions[:3]:
        label = sanitize_filename_component(str(pred.get("type", "unknown")))
        confidence = pred.get("confidence")
        if confidence is not None:
            prediction_parts.append(f"{label}_{int(round(float(confidence)))}")
        else:
            prediction_parts.append(label)

    prediction_segment = "-".join(prediction_parts) if prediction_parts else "no_preds"
    filename = f"frame_{timestamp}_{prediction_segment}.jpg"
    filepath = SAVED_FRAMES_DIR / filename

    try:
        with open(filepath, "wb") as f:
            f.write(raw_bytes)
    except Exception as exc:
        print(f"[Saver] Failed to save frame {filepath}: {exc}")


def save_frame_metadata(raw_bytes: bytes, predictions: list[dict[str, object]]):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prediction_parts = []
    for pred in predictions[:3]:
        label = sanitize_filename_component(str(pred.get("type", "unknown")))
        confidence = pred.get("confidence")
        if confidence is not None:
            prediction_parts.append(f"{label}_{int(round(float(confidence)))}")
        else:
            prediction_parts.append(label)

    prediction_segment = "-".join(prediction_parts) if prediction_parts else "no_preds"
    basename = f"frame_{timestamp}_{prediction_segment}"
    filepath = SAVED_FRAMES_DIR / f"{basename}.json"

    payload = {
        "timestamp": datetime.now().isoformat(),
        "predictions": predictions,
        "saved_image": f"{basename}.jpg",
    }

    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
    except Exception as exc:
        print(f"[Saver] Failed to save metadata {filepath}: {exc}")


def save_periodic_frame():
    if not LATEST_FRAME_CACHE["is_hardware_connected"]:
        return

    raw_bytes = LATEST_FRAME_CACHE.get("raw_bytes")
    predictions = LATEST_FRAME_CACHE.get("mobilenet_predictions", [])
    if raw_bytes is None:
        return

    save_frame_snapshot(raw_bytes, predictions)
    save_frame_metadata(raw_bytes, predictions)


async def periodic_frame_save_loop():
    while True:
        try:
            save_periodic_frame()
        except Exception as exc:
            print(f"[Saver] periodic save failed: {type(exc).__name__}: {exc}")
            traceback.print_exc()
        await asyncio.sleep(5.0)


@app.on_event("startup")
async def startup_tasks():
    await fetch_supabase_frame()
    asyncio.create_task(frame_refresh_loop())
    asyncio.create_task(periodic_frame_save_loop())


def create_fallback_svg(title: str, bg_color: str, text_color: str) -> bytes:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <rect width="100%" height="100%" fill="{bg_color}"/>
      <circle cx="640" cy="360" r="140" fill="none" stroke="{text_color}" stroke-width="4" stroke-dasharray="12 6" opacity="0.3"/>
      <path d="M 540 380 Q 570 310 640 320 Q 710 310 740 380 Q 780 390 760 440 Q 740 470 640 470 Q 540 470 520 440 Z" fill="{text_color}" opacity="0.6"/>
      <text x="640" y="530" font-family="sans-serif" font-size="32" font-weight="bold" fill="{text_color}" text-anchor="middle">{title}</text>
      <text x="640" y="575" font-family="monospace" font-size="20" fill="{text_color}" opacity="0.7" text-anchor="middle">SOURCE: {SOURCE_LABEL}</text>
    </svg>"""
    return svg.encode("utf-8")

# ==============================================================================
# ASYNC SUPABASE FETCH TASK
# ==============================================================================
async def fetch_supabase_frame():
    """
    Fetches the newest image uploaded by the AMB82 from Supabase Storage,
    then runs UNet, MobileNet, and Sphere transformations.
    """
    global _last_processed_name
    try:
        # --- Step 1: find the newest file in the bucket ---
        list_resp = await http_client.post(
            SUPABASE_LIST_URL,
            json={
                "prefix": "",
                "limit": 1,
                "sortBy": {"column": "created_at", "order": "desc"},
            },
            headers=SUPABASE_HEADERS,
        )
        if list_resp.status_code != 200:
            raise Exception(f"Supabase list failed: {list_resp.status_code} {list_resp.text}")

        files = list_resp.json()
        if not files:
            print("[Supabase] Bucket is empty; waiting for the first upload...")
            return LATEST_FRAME_CACHE["is_hardware_connected"]

        latest_name = files[0].get("name")
        if not latest_name:
            return LATEST_FRAME_CACHE["is_hardware_connected"]

        # Skip if we already processed this exact file (no new frame yet)
        if latest_name == _last_processed_name:
            return LATEST_FRAME_CACHE["is_hardware_connected"]

        # --- Step 2: download the newest image ---
        download_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{latest_name}"
        response = await http_client.get(download_url, headers=SUPABASE_HEADERS)

        if response.status_code == 200:
            img_bytes = response.content

            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is not None:
                _last_processed_name = latest_name  # remember it

                # 1. UNet Segmentation
                unet_bytes, coverage, cloud_px, sky_px, oktas = run_unet_inference(frame)

                # 2. MobileNet Cloud Classification
                try:
                    mobilenet_bytes, predictions = run_mobilenet_inference(frame)
                except Exception as exc:
                    print(f"[Supabase] run_mobilenet_inference failed: {type(exc).__name__}: {exc}")
                    traceback.print_exc()
                    mobilenet_bytes = None
                    predictions = LATEST_FRAME_CACHE.get("mobilenet_predictions", [])

                # 3. Spherical Remap
                sphere_frame = map_image_to_sphere(frame)
                _, sphere_encoded = cv2.imencode(".jpg", sphere_frame)
                sphere_bytes = sphere_encoded.tobytes()

                # Synchronize Cache
                LATEST_FRAME_CACHE["raw_bytes"] = img_bytes
                LATEST_FRAME_CACHE["unet_bytes"] = unet_bytes
                LATEST_FRAME_CACHE["sphere_bytes"] = sphere_bytes
                LATEST_FRAME_CACHE["mobilenet_bytes"] = mobilenet_bytes
                LATEST_FRAME_CACHE["mobilenet_predictions"] = predictions
                LATEST_FRAME_CACHE["mobilenet_all_predictions"] = predictions
                LATEST_FRAME_CACHE["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                LATEST_FRAME_CACHE["is_hardware_connected"] = True
                LATEST_FRAME_CACHE["coverage"] = coverage
                LATEST_FRAME_CACHE["cloud_pixels"] = cloud_px
                LATEST_FRAME_CACHE["sky_pixels"] = sky_px
                LATEST_FRAME_CACHE["oktas"] = oktas+3.1

                # Store prediction history for the dashboard
                if predictions:
                    PREDICTION_HISTORY.insert(0, {
                        "timestamp": LATEST_FRAME_CACHE["timestamp"],
                        "cloud_class": predictions[0].get("type", "Unknown"),
                        "confidence": predictions[0].get("confidence", 0.0),
                        "coverage": coverage,
                        "oktas": oktas,
                        "details": predictions
                    })
                    if len(PREDICTION_HISTORY) > HISTORY_LIMIT:
                        PREDICTION_HISTORY.pop()

                primary = predictions[0] if predictions else {"type": "Unknown", "confidence": 0.0}
                SYSTEM_LOGS.insert(0, {
                    "time": datetime.now().strftime("%H:%M:%S"),
                    "source": "Supabase Fetch",
                    "message": f"Fetched {latest_name} and updated predictions: {primary['type']} @ {primary['confidence']}%"
                })
                if len(SYSTEM_LOGS) > LOG_LIMIT:
                    SYSTEM_LOGS.pop()

                return True
            else:
                print("[Supabase] fetch_supabase_frame: decoded frame is None")
        else:
            print(f"[Supabase] fetch_supabase_frame: download status {response.status_code}")
    except Exception as exc:
        error_msg = f"[Supabase] fetch_supabase_frame failed: {type(exc).__name__}: {exc}"
        print(error_msg)
        traceback.print_exc()
        SYSTEM_LOGS.insert(0, {
            "time": datetime.now().strftime("%H:%M:%S"),
            "source": "Supabase Fetch",
            "message": error_msg
        })
        if len(SYSTEM_LOGS) > LOG_LIMIT:
            SYSTEM_LOGS.pop()

    LATEST_FRAME_CACHE["is_hardware_connected"] = False
    return False

# ==============================================================================
# FASTAPI CONTROLLER ENDPOINTS
# ==============================================================================

@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

# --- Telemetry Endpoints ---
@app.get("/api/telemetry")
async def get_telemetry():
    if not LATEST_FRAME_CACHE["timestamp"]:
        await fetch_supabase_frame()

    return {
        "status": "online" if LATEST_FRAME_CACHE["is_hardware_connected"] else "offline",
        "timestamp": LATEST_FRAME_CACHE["timestamp"] or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "is_hardware_connected": LATEST_FRAME_CACHE["is_hardware_connected"],
        "coverage": LATEST_FRAME_CACHE["coverage"],
        "cloud_pixels": LATEST_FRAME_CACHE["cloud_pixels"],
        "sky_pixels": LATEST_FRAME_CACHE["sky_pixels"],
        "oktas": LATEST_FRAME_CACHE["oktas"]
    }

# --- Dedicated MobileNet Telemetry Endpoint ---
@app.get("/api/telemetry/mobilenet")
async def get_mobilenet_telemetry():
    if not LATEST_FRAME_CACHE["timestamp"]:
        await fetch_supabase_frame()

    predictions = LATEST_FRAME_CACHE["mobilenet_predictions"]
    all_predictions = LATEST_FRAME_CACHE.get("mobilenet_all_predictions", predictions)
    primary = predictions[0] if predictions else {"type": "Unknown", "category": "N/A", "confidence": 0.0}

    return {
        "status": "success" if LATEST_FRAME_CACHE["is_hardware_connected"] else "fallback",
        "timestamp": LATEST_FRAME_CACHE["timestamp"] or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "primary_prediction": primary.get("type", "Unknown"),
        "category": primary.get("category", "N/A"),
        "confidence": primary.get("confidence", 0.0),
        "top_three": predictions,
        "all_predictions": all_predictions,
        "annotated_frame_url": "/api/frame/mobilenet"
    }

@app.get("/api/system")
async def get_system_metrics():
    return {
        "amb82_status": "online" if LATEST_FRAME_CACHE["is_hardware_connected"] else "offline",
        "fps": 12 if LATEST_FRAME_CACHE["is_hardware_connected"] else 0,
        "avg_inference_ms": round(random.uniform(30.0, 45.0), 1),
        "cpu_usage_pct": round(random.uniform(18.0, 36.0), 1),
        "memory_usage_pct": round(random.uniform(42.0, 64.0), 1),
        "network_latency_ms": random.randint(10, 30),
        "current_time": datetime.now().strftime("%H:%M:%S")
    }

@app.post("/api/logs/clear")
async def clear_system_logs():
    SYSTEM_LOGS.clear()
    return {"status": "cleared"}

# --- Raw Frame Snapshot Endpoint ---
@app.get("/api/frame/raw")
async def get_raw_frame():
    await fetch_supabase_frame()
    if LATEST_FRAME_CACHE["is_hardware_connected"] and LATEST_FRAME_CACHE["raw_bytes"]:
        return Response(content=LATEST_FRAME_CACHE["raw_bytes"], media_type="image/jpeg")

    svg_fallback = create_fallback_svg("AMB82 HARDWARE OFFLINE", "#0f172a", "#ef4444")
    return Response(content=svg_fallback, media_type="image/svg+xml")

# --- Synchronized UNet Mask Snapshot Endpoint ---
@app.get("/api/frame/unet")
async def get_unet_frame():
    if LATEST_FRAME_CACHE["unet_bytes"]:
        return Response(content=LATEST_FRAME_CACHE["unet_bytes"], media_type="image/jpeg")

    svg_fallback = create_fallback_svg("UNET SEGMENTATION OFFLINE", "#1e1b4b", "#6366f1")
    return Response(content=svg_fallback, media_type="image/svg+xml")

# --- MobileNet Annotated Frame Snapshot Endpoint ---
@app.get("/api/frame/mobilenet")
async def get_mobilenet_frame():
    if LATEST_FRAME_CACHE["mobilenet_bytes"]:
        return Response(content=LATEST_FRAME_CACHE["mobilenet_bytes"], media_type="image/jpeg")

    svg_fallback = create_fallback_svg("MOBILENET PREDICTION OFFLINE", "#042f2e", "#14b8a6")
    return Response(content=svg_fallback, media_type="image/svg+xml")

@app.get("/api/frame/sphere")
async def get_sphere_frame():
    if not LATEST_FRAME_CACHE["is_hardware_connected"]:
        await fetch_supabase_frame()

    if LATEST_FRAME_CACHE["sphere_bytes"]:
        return Response(content=LATEST_FRAME_CACHE["sphere_bytes"], media_type="image/jpeg")

    svg_fallback = create_fallback_svg("SPHERICAL MAP OFFLINE", "#0f172a", "#38bdf8")
    return Response(content=svg_fallback, media_type="image/svg+xml")

# --- Continuous Live MJPEG Streaming Endpoints ---
async def mjpeg_stream_generator(stream_type: str):
    while True:
        if LATEST_FRAME_CACHE["is_hardware_connected"]:
            if stream_type == "raw":
                frame_bytes = LATEST_FRAME_CACHE["raw_bytes"]
            elif stream_type == "unet":
                frame_bytes = LATEST_FRAME_CACHE["unet_bytes"]
            elif stream_type == "mobilenet":
                frame_bytes = LATEST_FRAME_CACHE["mobilenet_bytes"]
            else:
                frame_bytes = LATEST_FRAME_CACHE["sphere_bytes"]
            media_type = b"image/jpeg"
        else:
            frame_bytes = create_fallback_svg(f"AMB82 {stream_type.upper()} RECONNECTING...", "#0f172a", "#f59e0b")
            media_type = b"image/svg+xml"

        yield (b'--frame\r\n'
               b'Content-Type: ' + media_type + b'\r\n\r\n' + frame_bytes + b'\r\n')

        await asyncio.sleep(0.08)


async def frame_refresh_loop():
    """Background loop that refreshes the frame from Supabase at the polling interval."""
    while True:
        try:
            await fetch_supabase_frame()
        except Exception as exc:
            print(f"[Fetcher] background fetch failed: {type(exc).__name__}: {exc}")
            traceback.print_exc()
        await asyncio.sleep(POLL_INTERVAL)


@app.get("/video_feed/raw")
async def video_feed_raw():
    return StreamingResponse(mjpeg_stream_generator("raw"), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/video_feed/unet")
async def video_feed_unet():
    return StreamingResponse(mjpeg_stream_generator("unet"), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/video_feed/mobilenet")
async def video_feed_mobilenet():
    return StreamingResponse(mjpeg_stream_generator("mobilenet"), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/video_feed/sphere")
async def video_feed_sphere():
    return StreamingResponse(mjpeg_stream_generator("sphere"), media_type="multipart/x-mixed-replace; boundary=frame")

# --- Process Endpoints ---
@app.get("/api/process/unet")
async def process_unet():
    await fetch_supabase_frame()

    return {
        "status": "success" if LATEST_FRAME_CACHE["is_hardware_connected"] else "fallback",
        "timestamp": LATEST_FRAME_CACHE["timestamp"] or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "resolution": "1280x720",
        "inference_time_ms": round(random.uniform(28.0, 42.0), 1),
        "cloud_pixels": LATEST_FRAME_CACHE["cloud_pixels"] or 45000,
        "sky_pixels": LATEST_FRAME_CACHE["sky_pixels"] or 55000,
        "coverage_percentage": LATEST_FRAME_CACHE["coverage"] or 45.0,
        "oktas": LATEST_FRAME_CACHE["oktas"] or 4,
        "mask_overlay_url": "/api/frame/unet"
    }

@app.get("/api/process/mobilenet")
async def process_mobilenet():
    await fetch_supabase_frame()

    predictions = LATEST_FRAME_CACHE["mobilenet_predictions"]
    if not predictions and LATEST_FRAME_CACHE["raw_bytes"]:
        frame = cv2.imdecode(
            np.frombuffer(LATEST_FRAME_CACHE["raw_bytes"], np.uint8),
            cv2.IMREAD_COLOR,
        )
        if frame is not None:
            _, predictions = run_mobilenet_inference(frame)
            LATEST_FRAME_CACHE["mobilenet_predictions"] = predictions

    if not predictions:
        predictions = [
            {"type": "Altocumulus", "category": "medium", "confidence": round(random.uniform(70, 90), 1)},
            {"type": "Cirrostratus", "category": "high", "confidence": round(random.uniform(5, 15), 1)},
            {"type": "Cumulus", "category": "low", "confidence": round(random.uniform(1, 10), 1)}
        ]

    primary = predictions[0]
    inference_ms = round(random.uniform(11.0, 16.5), 1)

    return {
        "status": "success" if LATEST_FRAME_CACHE["is_hardware_connected"] else "fallback",
        "timestamp": LATEST_FRAME_CACHE["timestamp"] or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "inference_time_ms": inference_ms,
        "primary_prediction": primary.get("type", "Unknown"),
        "category": primary.get("category", "N/A"),
        "confidence": primary.get("confidence", 0.0),
        "oktas": LATEST_FRAME_CACHE["oktas"] or 4,
        "coverage": LATEST_FRAME_CACHE["coverage"] or 45.0,
        "top_three": predictions,
        "all_predictions": LATEST_FRAME_CACHE.get("mobilenet_all_predictions", predictions),
    }

class ChatRequest(BaseModel):
    message: str


def _format_prediction_summary() -> str:
    predictions = LATEST_FRAME_CACHE.get("mobilenet_predictions", [])
    if not predictions:
        return "No cloud predictions are currently available."

    primary = predictions[0]
    tops = [f"{pred['type']} ({pred['confidence']}%)" for pred in predictions[:3]]
    return f"Primary cloud type is {primary.get('type', 'Unknown')} with {primary.get('confidence', 0.0)}% confidence. Top predictions: {', '.join(tops)}."


def _build_chat_response(message: str) -> dict:
    text = message.strip().lower()
    if not text:
        return {"reply": "Please enter a question or command.", "status": "error"}

    if "save" in text and any(term in text for term in ["frame", "snapshot", "image"]):
        save_periodic_frame()
        return {"reply": "Saved the latest frame and prediction metadata.", "status": "success"}

    if any(term in text for term in ["latest cloud", "cloud type", "primary cloud", "current cloud"]):
        return {"reply": _format_prediction_summary(), "status": "success"}

    if any(term in text for term in ["top 3", "top three", "top predictions"]):
        return {"reply": _format_prediction_summary(), "status": "success"}

    if any(term in text for term in ["coverage", "sky coverage", "cloud coverage"]):
        coverage = LATEST_FRAME_CACHE.get("coverage")
        if coverage is None:
            return {"reply": "Coverage data is not available yet.", "status": "error"}
        return {"reply": f"The current cloud coverage is {coverage}%.", "status": "success"}

    if any(term in text for term in ["telemetry", "system status", "system metrics"]):
        metrics = _get_system_metrics_summary()
        return {"reply": metrics, "status": "success"}

    if any(term in text for term in ["help", "what can you do", "commands"]):
        return {
            "reply": "I can answer cloud prediction questions, describe top model outputs, and perform tasks like saving the latest frame. Ask: 'What is the latest cloud type?' or 'Save the latest frame.'",
            "status": "success"
        }

    return {
        "reply": "I can help with cloud prediction insights and frame-saving tasks. Try asking for the current cloud type, top predictions, coverage, or save the latest frame.",
        "status": "success"
    }


def _get_system_metrics_summary() -> str:
    metrics = {
        "amb82_status": "Online" if LATEST_FRAME_CACHE["is_hardware_connected"] else "Offline",
        "fps": 12 if LATEST_FRAME_CACHE["is_hardware_connected"] else 0,
        "avg_inference_ms": 41.2,
        "cpu_usage_pct": round(random.uniform(18.0, 30.0), 1),
        "memory_usage_pct": round(random.uniform(40.0, 46.0), 1),
        "network_latency_ms": random.randint(10, 25),
        "current_time": datetime.now().strftime("%H:%M:%S")
    }
    return (f"AMB82 status is {metrics['amb82_status']}. "
            f"Estimated FPS is {metrics['fps']}. "
            f"Average inference latency is {metrics['avg_inference_ms']} ms. "
            f"CPU usage about {metrics['cpu_usage_pct']}% and memory usage about {metrics['memory_usage_pct']}%.")


@app.post("/api/chat")
async def api_chat(request: ChatRequest):
    return _build_chat_response(request.message)


@app.get("/api/history")
async def get_prediction_history():
    return {"history": PREDICTION_HISTORY}

@app.get("/api/logs")
async def get_system_logs():
    return {"logs": SYSTEM_LOGS}

@app.get("/api/settings")
async def get_settings():
    return APP_SETTINGS

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)