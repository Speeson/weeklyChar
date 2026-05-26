#!/usr/bin/env python3
import argparse
import os
import sys
import time

import requests
from dotenv import load_dotenv
from slpp import slpp as lua

load_dotenv()

SAVED_VARS_PATH = os.getenv("KEYSTONE_SAVED_VARIABLES_PATH")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
SYNC_TOKEN = os.getenv("SYNC_TOKEN", "")


def read_saved_vars(path):
    with open(path, encoding="utf-8") as f:
        content = f.read().strip()
    table_str = content[content.index("=") + 1:].strip()
    return lua.decode(table_str)


def send_character(character_data):
    url = f"{API_BASE_URL}/api/keystones/update"
    headers = {
        "Authorization": f"Bearer {SYNC_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "character": character_data.get("character"),
        "realm": character_data.get("realm"),
        "region": character_data.get("region", "eu"),
        "hasKeystone": character_data.get("hasKeystone", False),
        "keystoneLevel": character_data.get("keystoneLevel"),
        "keystoneChallengeMapId": character_data.get("keystoneChallengeMapId"),
        "keystoneMapId": character_data.get("keystoneMapId"),
        "keystoneDungeon": character_data.get("keystoneDungeon"),
        "updatedAt": character_data.get("updatedAt"),
        "updatedReason": character_data.get("updatedReason"),
    }
    return requests.post(url, json=payload, headers=headers, timeout=10)


def sync():
    if not SAVED_VARS_PATH:
        print("ERROR: KEYSTONE_SAVED_VARIABLES_PATH no está configurado en .env")
        sys.exit(1)

    if not os.path.exists(SAVED_VARS_PATH):
        print(f"ERROR: No se encuentra el archivo: {SAVED_VARS_PATH}")
        sys.exit(1)

    print(f"Leyendo: {SAVED_VARS_PATH}")

    try:
        data = read_saved_vars(SAVED_VARS_PATH)
    except Exception as e:
        print(f"ERROR al parsear el archivo: {e}")
        sys.exit(1)

    if not data:
        print("No se encontraron personajes en el archivo.")
        return

    for _, character in data.items():
        name = character.get("character", "?")
        realm = character.get("realm", "?")
        print(f"Enviando: {name} ({realm})...", end=" ")
        try:
            response = send_character(character)
            body = response.json()
            if response.status_code == 200:
                print(f"OK — {body.get('message', '')}")
            else:
                print(f"ERROR {response.status_code} — {body.get('message', response.text)}")
        except requests.exceptions.ConnectionError:
            print(f"ERROR: no se puede conectar a {API_BASE_URL}")
        except Exception as e:
            print(f"ERROR: {e}")


def watch():
    if not SAVED_VARS_PATH:
        print("ERROR: KEYSTONE_SAVED_VARIABLES_PATH no está configurado en .env")
        sys.exit(1)

    print(f"Watching: {SAVED_VARS_PATH}")
    print("Esperando cambios... (Ctrl+C para salir)\n")

    sync()

    last_mtime = os.path.getmtime(SAVED_VARS_PATH) if os.path.exists(SAVED_VARS_PATH) else 0

    try:
        while True:
            time.sleep(2)
            if not os.path.exists(SAVED_VARS_PATH):
                continue
            mtime = os.path.getmtime(SAVED_VARS_PATH)
            if mtime != last_mtime:
                last_mtime = mtime
                print("\nCambio detectado, sincronizando...")
                time.sleep(0.5)
                sync()
    except KeyboardInterrupt:
        print("\nDetenido.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KeystoneSync — sincronizador de piedras míticas+")
    parser.add_argument("--watch", action="store_true", help="Sincroniza automáticamente al detectar cambios en el archivo")
    args = parser.parse_args()

    if args.watch:
        watch()
    else:
        sync()
