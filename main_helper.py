import os
from urllib import response
import httpx
import numpy as np
import cv2
import httpx
import fastapi
from fastapi import FastAPI
import time
from contextlib import asynccontextmanager

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://tgqllcnvgycggydefpjd.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_saXNuNinI1P5YSwUL8dO9w_8ZAcUfee")
BUCKET_NAME  = os.getenv("SUPABASE_BUCKET", "come_images")

SUPABASE_HEADERS = {
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "apikey": SUPABASE_KEY,
}

# This will hold our shared client
http_client: httpx.AsyncClient = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    # Create the client once when the app starts
    http_client = httpx.AsyncClient(timeout=10.0)
    print("[HTTP] Client opened")

    # Start your polling loop here too (if you have one)
    # polling_task = asyncio.create_task(your_polling_loop())
    yield

    # Close the client when the app shuts down
    await http_client.aclose()
    print("[HTTP] Client closed")


app = FastAPI(lifespan=lifespan)


# Track the last file we processed so we don't re-run inference on the same image
_last_processed_name = None

async def fetch_latest_frame(http_client: httpx.AsyncClient):
    """Fetch the most recent image from Supabase Storage and decode it with OpenCV."""
    global _last_processed_name

    # --- Step 1: List files, newest first, take only the latest ---
    list_url = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET_NAME}"
    list_payload = {
        "prefix": "",
        "limit": 1,
        "sortBy": {"column": "created_at", "order": "desc"},
    }

    list_resp = await http_client.post(list_url, json=list_payload, headers=SUPABASE_HEADERS)
    if list_resp.status_code != 200:
        print(f"[Supabase] List failed: {list_resp.status_code} {list_resp.text}")
        return None

    files = list_resp.json()
    if not files:
        print("[Supabase] Bucket is empty, no frames yet.")
        return None

    latest_name = files[0]["name"]

    # --- Optional: skip if we already processed this exact file ---
    if latest_name == _last_processed_name:
        return None  # No new frame since last poll

    # --- Step 2: Download the latest image ---
    download_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{latest_name}"
    response = await http_client.get(download_url, headers=SUPABASE_HEADERS)

    if response.status_code != 200:
        print(f"[Supabase] Download failed: {response.status_code}")
        return None

    # --- Step 3: Decode the JPEG into an OpenCV frame ---
    img_bytes = response.content
    np_arr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is not None:
        _last_processed_name = latest_name  # remember it
        print(f"[Supabase] Loaded latest frame: {latest_name}")

    return frame

async def fetch_amb82_frame():
    """Asynchronously fetches raw frames from the AMB82 and runs UNet, MobileNet, and Sphere transformations."""
    try:
        frame = await fetch_latest_frame(http_client)
        if frame is not None:
            img_bytes = response.content
            
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is not None:
                    # 1. UNet Segmentation
                cv2.imshow("frame", frame)
    #             unet_bytes, coverage, cloud_px, sky_px, oktas = run_unet_inference(frame)

    #             # 2. MobileNet Cloud Classification
    #             try:
    #                 mobilenet_bytes, predictions = run_mobilenet_inference(frame)
    #             except Exception as exc:
    #                 print(f"[AMB82] run_mobilenet_inference failed: {type(exc).__name__}: {exc}")
    #                 traceback.print_exc()
    #                 mobilenet_bytes = None
    #                 predictions = LATEST_FRAME_CACHE.get("mobilenet_predictions", [])

    #             # 3. Spherical Remap
    #             sphere_frame = map_image_to_sphere(frame)
    #             _, sphere_encoded = cv2.imencode(".jpg", sphere_frame)
    #             sphere_bytes = sphere_encoded.tobytes()

    #             # Synchronize Cache
    #             LATEST_FRAME_CACHE["raw_bytes"] = img_bytes
    #             LATEST_FRAME_CACHE["unet_bytes"] = unet_bytes
    #             LATEST_FRAME_CACHE["sphere_bytes"] = sphere_bytes
    #             LATEST_FRAME_CACHE["mobilenet_bytes"] = mobilenet_bytes
    #             LATEST_FRAME_CACHE["mobilenet_predictions"] = predictions
    #             LATEST_FRAME_CACHE["mobilenet_all_predictions"] = predictions
    #             LATEST_FRAME_CACHE["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    #             LATEST_FRAME_CACHE["is_hardware_connected"] = True
    #             LATEST_FRAME_CACHE["coverage"] = coverage
    #             LATEST_FRAME_CACHE["cloud_pixels"] = cloud_px
    #             LATEST_FRAME_CACHE["sky_pixels"] = sky_px
    #             LATEST_FRAME_CACHE["oktas"] = oktas

    #             # Store prediction history for the dashboard
    #             if predictions:
    #                 PREDICTION_HISTORY.insert(0, {
    #                     "timestamp": LATEST_FRAME_CACHE["timestamp"],
    #                     "cloud_class": predictions[0].get("type", "Unknown"),
    #                     "confidence": predictions[0].get("confidence", 0.0),
    #                     "coverage": coverage,
    #                     "oktas": oktas,
    #                     "details": predictions
    #                 })
    #                 if len(PREDICTION_HISTORY) > HISTORY_LIMIT:
    #                     PREDICTION_HISTORY.pop()

    #             SYSTEM_LOGS.insert(0, {
    #                 "time": datetime.now().strftime("%H:%M:%S"),
    #                 "source": "AMB82 Fetch",
    #                 "message": f"Fetched frame and updated predictions: {predictions[0]['type']} @ {predictions[0]['confidence']}%"
    #             })
    #             if len(SYSTEM_LOGS) > LOG_LIMIT:
    #                 SYSTEM_LOGS.pop()

    #             return True
    #         else:
    #             print("[AMB82] fetch_amb82_frame: decoded frame is None")
    #     else:
    #         print(f"[AMB82] fetch_amb82_frame: status {response.status_code}")
    except Exception as exc:
        error_msg = f"[AMB82] fetch_amb82_frame failed: {type(exc).__name__}: {exc}"
        print(error_msg)
    #     traceback.print_exc()
    #     SYSTEM_LOGS.insert(0, {
    #         "time": datetime.now().strftime("%H:%M:%S"),
    #         "source": "AMB82 Fetch",
    #         "message": error_msg
    #     })
    #     if len(SYSTEM_LOGS) > LOG_LIMIT:
    #         SYSTEM_LOGS.pop()

    # LATEST_FRAME_CACHE["is_hardware_connected"] = False
    return False


while True:
    fetch_latest_frame(http_client)

    time.sleep(2)  # Poll every second