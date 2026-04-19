from flask import Flask, jsonify, render_template
from SimConnect import SimConnect, AircraftRequests
import json
import math
import time
from datetime import datetime, timedelta, timezone, date
import webbrowser
import threading
import os
import ctypes
import sys
from flask import send_from_directory


if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    os.environ["PATH"] = os.pathsep.join([bundle_dir, os.environ["PATH"]])
    ctypes.CDLL(os.path.join(bundle_dir, "SimConnect.dll"))

app = Flask(__name__)

def load_advanced_config():
    config = {
        "simbrief_username": None,
        "auto_load_simbrief": None,
        "disable_prompts": None,
        "disable_route_popup": None,
        "custom_zoom_levels": None,
        "port": 5000,
        "cesium_token": None,
        "msfs_custom_pln_path": None,
    }

    try:
         #config_path = os.path.join(os.path.dirname(sys.executable), "advanced_config.txt")
         config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "advanced_config.txt")
         with open(config_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()

                if not line or line.startswith("#") or "=" not in line:
                    continue

                key, value = line.split("=", 1)
                key = key.strip().lower()
                value = value.strip()


                if key == "simbrief_username" and value:
                    config["simbrief_username"] = value

                elif key == "auto_load_simbrief" and value.lower() == "yes":
                    config["auto_load_simbrief"] = "yes"
                elif key == "disable_prompts" and value.lower() == "yes":
                    config["disable_prompts"] = "yes"
                elif key == "disableroutepopup" and value.lower() == "yes":
                    config["disable_route_popup"] = "yes"
                elif key == "custom_zoom_levels":
                    try:
                        parts = [float(x.strip()) for x in value.split(",") if x.strip()]
                        if all(2 <= z <= 18 for z in parts):
                            config["custom_zoom_levels"] = parts
                    except Exception:
                        pass
                elif key == "port":
                    try:
                        port_num = int(value)
                        if 1024 <= port_num <= 65535:
                            config["port"] = port_num
                    except ValueError:
                        pass
                elif key == "cesium_token" and value:
                    config["cesium_token"] = value
                elif key == "msfs_custom_pln_path" and value:
                    expanded = os.path.expandvars(value.strip('"'))
                    if os.path.isdir(expanded):
                        config["msfs_custom_pln_path"] = expanded

    except FileNotFoundError:
        pass

    return config


advanced_config = load_advanced_config()

FALLBACK_CESIUM_TOKEN = ""
ALLOW_3D_MODE = True

MSFS_PLN_PATHS = {
    "steam_2020": r"%APPDATA%\Microsoft Flight Simulator\MISSIONS\Custom\CustomFlight\CUSTOMFLIGHT.PLN",
    "steam_2024": r"%APPDATA%\Microsoft Flight Simulator 2024\MISSIONS\Custom\CustomFlight\CUSTOMFLIGHT.PLN",
    "store_2020": r"%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalState\MISSIONS\Custom\CustomFlight\CUSTOMFLIGHT.PLN",
    "store_2024": r"%LOCALAPPDATA%\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalState\MISSIONS\Custom\CustomFlight\CUSTOMFLIGHT.PLN",
}

def parse_dms(dms_str):
    """Convert MSFS DMS coordinate string to decimal degrees.
    Format: N40° 29' 29.10",W80° 13' 57.72",+001146.37
    Returns (lat, lon) as floats or raises ValueError."""
    import re
    pattern = r'([NS])(\d+)°\s*(\d+)\'\s*([\d.]+)"[,\s]*([EW])(\d+)°\s*(\d+)\'\s*([\d.]+)"'
    m = re.search(pattern, dms_str)
    if not m:
        raise ValueError(f"Cannot parse DMS: {dms_str}")
    ns, lat_d, lat_m, lat_s, ew, lon_d, lon_m, lon_s = m.groups()
    lat = float(lat_d) + float(lat_m) / 60 + float(lat_s) / 3600
    lon = float(lon_d) + float(lon_m) / 60 + float(lon_s) / 3600
    if ns == 'S': lat = -lat
    if ew == 'W': lon = -lon
    return lat, lon

class SimConnectWorker:
    def __init__(self):
        self._lock = threading.Lock()
        self._stop = threading.Event()

        self._sm = None
        self._aq = None
        self._connected = False

        self._last_log_ts = 0.0
        self._last_ok_ts = 0.0

        self._latest = {
            "available": False,
            "latitude": None,
            "longitude": None,
            "altitude": None,
            "ground_speed": None,
            "heading": None,
            "sim_time_utc": None,
            "sim_time_seconds": None,
            "zulu_day": None,
            "zulu_month": None,
            "ground_alt": None,
            "sim_rate": 1.0,
        }

    def _log_throttled(self, msg: str, every_sec: float = 2.0):
        now = time.time()
        if now - self._last_log_ts >= every_sec:
            print(msg)
            self._last_log_ts = now

    def _set_unavailable(self):
        with self._lock:
            self._latest["available"] = False

    def get_latest(self):
        with self._lock:
            return dict(self._latest)

    def _connect(self):
        self._sm = SimConnect()
        self._aq = AircraftRequests(self._sm, _time=500)
        self._connected = True
        self._last_ok_ts = time.time()
        print("Connected to MSFS via SimConnect")

    def _disconnect(self):
        try:
            if self._sm and hasattr(self._sm, "exit"):
                self._sm.exit()
        except Exception:
            pass
        self._sm = None
        self._aq = None
        self._connected = False

    def run(self):
        backoff = 1.0

        while not self._stop.is_set():
            try:
                if (not self._connected) or (self._aq is None):
                    self._connect()
                    backoff = 1.0

                lat = self._aq.get("PLANE_LATITUDE")
                lon = self._aq.get("PLANE_LONGITUDE")

                if lat is None or lon is None or (abs(lat) < 0.1 and abs(lon) < 0.1):
                    self._set_unavailable()
                    time.sleep(0.5)
                    continue

                altitude = self._aq.get("INDICATED_ALTITUDE")
                ground_speed = self._aq.get("GROUND_VELOCITY")
                ground_alt = self._aq.get("PLANE_ALT_ABOVE_GROUND")

                try:
                    heading = (math.degrees(self._aq.get("PLANE_HEADING_DEGREES_TRUE")) - 45)
                except Exception:
                    heading = None

                sim_time_seconds = self._aq.get("ZULU_TIME")
                sim_time_iso = None
                if sim_time_seconds is not None:
                    try:
                        sim_time = (datetime.min + timedelta(seconds=sim_time_seconds)).time()
                        sim_time_iso = sim_time.isoformat(timespec="seconds")
                    except Exception:
                        sim_time_iso = None

                try:
                    zulu_day = int(self._aq.get("ZULU_DAY_OF_MONTH") or 1)
                except Exception:
                    zulu_day = 1

                try:
                    zulu_month = int(self._aq.get("ZULU_MONTH_OF_YEAR") or 1)
                except Exception:
                    zulu_month = 1

                try:
                    sim_rate = float(self._aq.get("SIMULATION_RATE") or 1.0)
                except Exception:
                    sim_rate = 1.0

                with self._lock:
                    self._latest.update({
                        "available": True,
                        "latitude": lat,
                        "longitude": lon,
                        "altitude": altitude,
                        "ground_speed": ground_speed,
                        "heading": heading,
                        "sim_time_utc": sim_time_iso,
                        "sim_time_seconds": sim_time_seconds,
                        "zulu_day": zulu_day,
                        "zulu_month": zulu_month,
                        "sim_rate": sim_rate,
                        "ground_alt": ground_alt,
                    })

                self._last_ok_ts = time.time()

                # Poll rate
                time.sleep(0.5)

                if time.time() - self._last_ok_ts > 5:
                    raise RuntimeError("SimConnect stalled (no fresh data)")

            except Exception as e:
                self._log_throttled(f"SimConnect error: {e}")
                self._set_unavailable()
                self._disconnect()

                time.sleep(backoff)
                backoff = min(backoff * 1.5, 10.0)

        self._disconnect()

    def stop(self):
        self._stop.set()


sim_worker = SimConnectWorker()
threading.Thread(target=sim_worker.run, daemon=True).start()

@app.route("/msfs_config")
def get_msfs_config():
    custom_path = advanced_config.get("msfs_custom_pln_path")
    return jsonify({
        "hasCustomPath": bool(custom_path),
    })

@app.route("/msfs_flightplan")
def get_msfs_flightplan():
    import xml.etree.ElementTree as ET
    import glob
    from flask import request as freq

    variant = freq.args.get("variant", "steam_2020")

    if variant == "custom":
        custom_dir = advanced_config.get("msfs_custom_pln_path")
        if not custom_dir:
            return jsonify({"error": "no_custom_path"}), 400
        pln_files = glob.glob(os.path.join(custom_dir, "*.pln"))
        pln_files += glob.glob(os.path.join(custom_dir, "*.PLN"))
        if not pln_files:
            return jsonify({"error": "file_not_found"}), 404
        path = max(pln_files, key=os.path.getmtime)
    else:
        raw_path = MSFS_PLN_PATHS.get(variant)
        if not raw_path:
            return jsonify({"error": "invalid_variant"}), 400
        path = os.path.expandvars(raw_path)
        if not os.path.exists(path):
            return jsonify({"error": "file_not_found", "path": path}), 404

    try:
        tree = ET.parse(path)
        root = tree.getroot()
        fp   = root.find("FlightPlan.FlightPlan")
        if fp is None:
            return jsonify({"error": "parse_error"}), 500

        origin_icao = fp.findtext("DepartureID", "").strip()
        dest_icao   = fp.findtext("DestinationID", "").strip()

        if not origin_icao or not dest_icao:
            return jsonify({"error": "missing_airports"}), 500

        waypoints = []
        waypoint_nodes = fp.findall("ATCWaypoint")

        for node in waypoint_nodes[1:]:
            pos = node.findtext("WorldPosition", "").strip()
            if not pos:
                continue
            try:
                lat, lon = parse_dms(pos)
                waypoints.append([lat, lon])
            except ValueError:
                continue

        return jsonify({
            "origin":      origin_icao,
            "destination": dest_icao,
            "waypoints":   waypoints
        })

    except ET.ParseError:
        return jsonify({"error": "parse_error"}), 500
    except Exception as e:
        return jsonify({"error": "unknown", "detail": str(e)}), 500

@app.route("/cesium_token")
def get_cesium_token():
    personal = advanced_config.get("cesium_token")
    has_personal = bool(personal)
    token = personal if has_personal else FALLBACK_CESIUM_TOKEN
    return jsonify({
        "token": token,
        "hasPersonalToken": has_personal,
        "allow3DMode": ALLOW_3D_MODE and has_personal,
    })

@app.route("/default_autosimbrief")
def get_default_autosimbrief():
    auto = advanced_config.get("auto_load_simbrief")
    return jsonify({"auto": auto})

@app.route("/default_simbrief")
def get_default_simbrief():
    username = advanced_config.get("simbrief_username")
    return jsonify({"username": username})

@app.route("/default_disable_prompts")
def get_default_disable_prompts():
    disable = advanced_config.get("disable_prompts")
    return jsonify({"disable": disable})

@app.route("/default_disable_route_popup")
def get_default_disable_route_popup():
    disable = advanced_config.get("disable_route_popup")
    return jsonify({"disable": disable})

@app.route("/default_custom_zoom_levels")
def get_default_custom_zoom_levels():
    levels = advanced_config.get("custom_zoom_levels")
    return jsonify({"levels": levels})

@app.route('/')
def home():
    return render_template('map.html')

@app.route('/globe')
def globe_view():
    return render_template('globe.html')


@app.route('/position')
def get_position():
    data = sim_worker.get_latest()

    if not data.get("available"):
        return jsonify({
            'latitude': None,
            'longitude': None,
            'altitude': None,
            'groundspeed': None,
            'heading': None,
            'available': False
        })

    return jsonify({
        'latitude': data.get("latitude"),
        'longitude': data.get("longitude"),
        'altitude': data.get("altitude"),
        'groundspeed': data.get("ground_speed"),
        'heading': data.get("heading"),
        'ground_alt': data.get("ground_alt"),
        'available': True
    })


@app.route('/live_data')
def get_live_data():
    data = sim_worker.get_latest()

    if not data.get("available"):
        return jsonify({ "available": False })

    return jsonify({
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "altitude": data.get("altitude"),
        "ground_speed": data.get("ground_speed"),
        "sim_time_utc": data.get("sim_time_utc"),
        "sim_time_seconds": data.get("sim_time_seconds"),
        "heading": data.get("heading"),
        "zulu_day": data.get("zulu_day"),
        "zulu_month": data.get("zulu_month"),
        "sim_rate": data.get("sim_rate"),
        "ground_alt": data.get("ground_alt"),
        "available": True
    })

@app.route('/lookup_airport/<icao>')
def lookup_airport(icao):
    try:
        path = os.path.join(os.path.dirname(__file__), 'airports.json')
        with open(path, "r", encoding="utf-8") as f:
            airports = json.load(f)
        icao = icao.strip().upper()
        airport = airports.get(icao)
        if airport and "lat" in airport and "lon" in airport:
            return jsonify({
                "icao": icao,
                "iata": airport.get("iata", ""),
                "city": airport.get("city", "Unknown City"),
                "name": airport.get("name", "Unknown Airport"),
                "lat": airport["lat"],
                "lon": airport["lon"],
                "tz": airport.get("tz", None),
                "elevation": airport.get("elevation", 0)
            })
        else:
            return jsonify({"error": f"Airport {icao} not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def open_browser():
    webbrowser.open_new("http://localhost:5000")

if __name__ == "__main__":
    import socket

    port = advanced_config.get("port", 5000)

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
    except:
        local_ip = "127.0.0.1"
    finally:
        s.close()

    print(f"\nMSFS Passenger Map is running!")
    print(f"Access on this PC:     http://localhost:{port}")
    print(f"Access on other device: http://{local_ip}:{port}\n")

    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

    app.run(host="0.0.0.0", port=port)
