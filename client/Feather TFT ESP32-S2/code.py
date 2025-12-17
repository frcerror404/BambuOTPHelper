import time
import json
import ssl
import wifi
import socketpool
import board
import displayio
import terminalio

from adafruit_display_text import label
from adafruit_display_shapes.rect import Rect

import adafruit_connection_manager
import adafruit_minimqtt.adafruit_minimqtt as MQTT

# ---------------- CONFIG ----------------

WIFI_SSID = ""
WIFI_PASSWORD = ""

MQTT_BROKER = ""
MQTT_PORT = 8883
MQTT_TOPIC = ""

# If your broker requires auth, set these (otherwise leave as None)
MQTT_USERNAME = ""
MQTT_PASSWORD = ""

# UI / timing
FALLBACK_TTL_S = 300.0     # default 5 minutes
UI_TICK_S = 0.2            # UI refresh cadence
RECONNECT_DELAY_S = 2.0    # retry delay when MQTT is down

PLACEHOLDER_CODE = "------"
CLEAR_AFTER_S = 360.0   # 6 minutes

# ---------------- DISPLAY (CircuitPython 10) ----------------
display = board.DISPLAY
display.auto_refresh = True

main_group = displayio.Group()
display.root_group = main_group

# Background
bg_bitmap = displayio.Bitmap(display.width, display.height, 1)
bg_palette = displayio.Palette(1)
bg_palette[0] = 0x000000
main_group.append(displayio.TileGrid(bg_bitmap, pixel_shader=bg_palette))

# Big code label
code_label = label.Label(
    terminalio.FONT,
    text="------",
    color=0x00FF66,   # bright green
    scale=5,
)
code_label.anchor_point = (0.5, 0.5)
code_label.anchored_position = (display.width // 2, display.height // 2 - 10)
main_group.append(code_label)

# MQTT status label (top-left)
mqtt_label = label.Label(
    terminalio.FONT,
    text="MQTT: DOWN",
    color=0xFF3333,  # red
    scale=1,
)
mqtt_label.anchor_point = (0.0, 0.0)
mqtt_label.anchored_position = (4, 4)
main_group.append(mqtt_label)



# ------------- PROGRESS BAR (Bitmap-based; reliable in CP10) -------------

BAR_MARGIN = 6
BAR_HEIGHT = 10
bar_x = BAR_MARGIN
bar_y = display.height - BAR_MARGIN - BAR_HEIGHT
bar_width_max = display.width - 2 * BAR_MARGIN

# Bitmap with 2 colors: 0=empty, 1=filled
bar_bitmap = displayio.Bitmap(bar_width_max, BAR_HEIGHT, 2)
bar_palette = displayio.Palette(2)
bar_palette[0] = 0x222222  # empty (dark gray)
bar_palette[1] = 0xFFAA00  # filled (orange; we'll change to red near end)

bar_tile = displayio.TileGrid(bar_bitmap, pixel_shader=bar_palette, x=bar_x, y=bar_y)
main_group.append(bar_tile)

# Optional outline (static) using a Rect just for border (doesn't animate)
bar_outline = Rect(
    bar_x - 1, bar_y - 1,
    bar_width_max + 2, BAR_HEIGHT + 2,
    fill=None, outline=0x555555, stroke=1
)
main_group.append(bar_outline)

_bar_last_width = -1  # track previous width so we only update changed columns

# Info label: placed just above the progress bar
info_label = label.Label(
    terminalio.FONT,
    text="Waiting for code...",
    color=0x8888FF,
    scale=1,
)

info_label.anchor_point = (0.5, 1.0)  # center horizontally, bottom-aligned
info_label.anchored_position = (
    display.width // 2,
    bar_y - 4,   # 4px gap above the progress bar
)

main_group.append(info_label)


def clear_code_ui():
    global latest_code, last_received_monotonic, expires_monotonic
    latest_code = None
    last_received_monotonic = None
    expires_monotonic = None
    code_label.text = PLACEHOLDER_CODE
    info_label.text = "Waiting for code..."
    set_progress_fraction(0.0)


def set_progress_fraction(frac):
    global _bar_last_width

    if frac < 0:
        frac = 0
    if frac > 1:
        frac = 1

    new_width = int(bar_width_max * frac)

    # Change fill color near the end (e.g., <60s remaining assuming 5 min)
    # This works by changing palette index 1.
    if frac <= (60.0 / FALLBACK_TTL_S):
        bar_palette[1] = 0xFF3333  # red
    else:
        bar_palette[1] = 0xFFAA00  # orange

    # Only redraw the columns that changed since last time
    if _bar_last_width == -1:
        # First draw: clear everything
        for x in range(bar_width_max):
            v = 1 if x < new_width else 0
            for y in range(BAR_HEIGHT):
                bar_bitmap[x, y] = v
    elif new_width > _bar_last_width:
        # Bar grew (fill more columns)
        for x in range(_bar_last_width, new_width):
            for y in range(BAR_HEIGHT):
                bar_bitmap[x, y] = 1
    elif new_width < _bar_last_width:
        # Bar shrank (clear columns)
        for x in range(new_width, _bar_last_width):
            for y in range(BAR_HEIGHT):
                bar_bitmap[x, y] = 0

    _bar_last_width = new_width


# ---------------- STATE ----------------

mqtt_connected = False

latest_code = None
last_received_monotonic = None
expires_monotonic = None  # monotonic time when it expires
ttl_s = FALLBACK_TTL_S

# ---------------- WIFI ----------------

print("Connecting Wi-Fi...")
wifi.radio.connect(WIFI_SSID, WIFI_PASSWORD)
print("Wi-Fi connected:", wifi.radio.ipv4_address)

pool = socketpool.SocketPool(wifi.radio)
ssl_context = ssl.create_default_context()

# ---------------- MQTT CALLBACKS ----------------

def on_connect(client, userdata, flags, rc):
    global mqtt_connected
    mqtt_connected = True
    mqtt_label.text = "MQTT: OK"
    mqtt_label.color = 0x00FF66
    print("MQTT connected, subscribing:", MQTT_TOPIC)
    client.subscribe(MQTT_TOPIC)

def on_disconnect(client, userdata, rc):
    global mqtt_connected
    mqtt_connected = False
    mqtt_label.text = "MQTT: DOWN"
    mqtt_label.color = 0xFF3333
    print("MQTT disconnected")

def on_message(client, topic, message):
    global latest_code, last_received_monotonic, expires_monotonic, ttl_s

    # message may be str or bytes depending on version
    if isinstance(message, (bytes, bytearray)):
        try:
            message = message.decode("utf-8", "ignore")
        except Exception:
            return

    print("MQTT message:", topic, message)

    try:
        data = json.loads(message)
    except Exception:
        return

    code = data.get("code")
    if not code:
        return

    # Optional: let server send ttlSeconds (best for microcontrollers)
    ttlSeconds = data.get("ttlSeconds")
    if isinstance(ttlSeconds, (int, float)) and ttlSeconds > 0:
        ttl_s = float(ttlSeconds)
    else:
        ttl_s = FALLBACK_TTL_S

    # Only update if it's new
    if code != latest_code:
        latest_code = code
        code_label.text = str(code)

        last_received_monotonic = time.monotonic()
        expires_monotonic = last_received_monotonic + ttl_s

        # reset bar to full immediately
        set_progress_fraction(1.0)
        info_label.text = "Code received just now"

# ---------------- MQTT CLIENT SETUP ----------------

# connection_manager is the recommended socket setup for CP networking libs
radio = wifi.radio
cm = adafruit_connection_manager.ConnectionManager(radio)

mqtt = MQTT.MQTT(
    broker=MQTT_BROKER,
    port=MQTT_PORT,
    username=MQTT_USERNAME,
    password=MQTT_PASSWORD,
    socket_pool=pool,
    ssl_context=ssl_context,
    is_ssl=True,
    keep_alive=60,
)

mqtt.on_connect = on_connect
mqtt.on_disconnect = on_disconnect
mqtt.on_message = on_message

# ---------------- MAIN LOOP ----------------

def update_ui_time():
    now = time.monotonic()

    if last_received_monotonic is None:
        info_label.text = "Waiting for code..."
        if code_label.text != PLACEHOLDER_CODE:
            code_label.text = PLACEHOLDER_CODE
        set_progress_fraction(0.0)
        return

    elapsed = now - last_received_monotonic

    # NEW: clear the UI after 6 minutes
    if elapsed >= CLEAR_AFTER_S:
        clear_code_ui()
        return

    # "last received" label
    if elapsed < 5:
        info_label.text = "Code received just now"
    elif elapsed < 60:
        info_label.text = "Code received {}s ago".format(int(elapsed))
    else:
        mins = int(elapsed // 60)
        secs = int(elapsed % 60)
        info_label.text = "Code received {}m {:02d}s ago".format(mins, secs)

    # Progress bar countdown
    if expires_monotonic is None:
        remaining = FALLBACK_TTL_S - elapsed
        if remaining < 0:
            remaining = 0
        set_progress_fraction(remaining / FALLBACK_TTL_S)
        return

    remaining = expires_monotonic - now
    if remaining < 0:
        remaining = 0

    frac = remaining / ttl_s if ttl_s > 0 else 0
    set_progress_fraction(frac)

# Initial connect attempt
while True:
    try:
        mqtt_label.text = "MQTT: CONNECT"
        mqtt_label.color = 0xFFAA00  # orange
        print("Connecting MQTT...")
        mqtt.connect()
        break
    except Exception as e:
        print("MQTT connect failed:", e)
        mqtt_connected = False
        mqtt_label.text = "MQTT: DOWN"
        mqtt_label.color = 0xFF3333
        time.sleep(RECONNECT_DELAY_S)

# Loop forever
while True:
    update_ui_time()

    try:
        mqtt.loop()  # handles keepalive + incoming messages
    except Exception as e:
        print("MQTT loop error:", e)
        mqtt_connected = False
        mqtt_label.text = "MQTT: DOWN"
        mqtt_label.color = 0xFF3333

        # Try reconnect
        try:
            mqtt.disconnect()
        except Exception:
            pass

        time.sleep(RECONNECT_DELAY_S)

        try:
            mqtt_label.text = "MQTT: CONNECT"
            mqtt_label.color = 0xFFAA00
            mqtt.connect()
        except Exception as e2:
            print("MQTT reconnect failed:", e2)
            mqtt_label.text = "MQTT: DOWN"
            mqtt_label.color = 0xFF3333

    time.sleep(UI_TICK_S)
