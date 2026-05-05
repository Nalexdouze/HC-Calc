#!/usr/bin/env python3
"""HC Calculatrice - Backend Flask"""

import json
import os
import uuid
from flask import Flask, render_template, jsonify, request, abort

app = Flask(__name__)
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')

ICONS = ['washer', 'dishwasher', 'dryer', 'car', 'bolt', 'snowflake',
         'fan', 'tv', 'computer', 'kettle', 'iron', 'vacuum']


def load_config():
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_config(cfg):
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


@app.route('/')
def index():
    cfg = load_config()
    devices = [d for d in cfg['devices'] if d.get('visible', True)]
    return render_template('index.html', devices=devices, hc_bands=cfg['hc_bands'])

@app.route('/admin')
def admin():
    cfg = load_config()
    return render_template('admin.html', config=cfg, icons=ICONS)

@app.route('/api/config')
def api_config():
    return jsonify(load_config())

@app.route('/api/hc_bands', methods=['POST'])
def api_save_hc_bands():
    data = request.get_json(force=True)
    bands = data.get('hc_bands', [])
    cfg = load_config()
    cfg['hc_bands'] = bands
    save_config(cfg)
    return jsonify({'ok': True})

@app.route('/api/devices', methods=['POST'])
def api_save_devices():
    data = request.get_json(force=True)
    cfg = load_config()
    cfg['devices'] = data.get('devices', [])
    save_config(cfg)
    return jsonify({'ok': True})

@app.route('/api/devices/<device_id>/visibility', methods=['POST'])
def api_toggle_visibility(device_id):
    data = request.get_json(force=True)
    cfg = load_config()
    for dev in cfg['devices']:
        if dev['id'] == device_id:
            dev['visible'] = data.get('visible', True)
            save_config(cfg)
            return jsonify({'ok': True})
    abort(404)

@app.route('/api/devices', methods=['PUT'])
def api_add_device():
    data = request.get_json(force=True)
    cfg = load_config()
    new_dev = {
        'id': str(uuid.uuid4())[:8],
        'name': data.get('name', 'Nouvel appareil'),
        'icon': data.get('icon', 'bolt'),
        'mode': data.get('mode', 'fin'),
        'visible': True,
        'programs': []
    }
    cfg['devices'].append(new_dev)
    save_config(cfg)
    return jsonify({'ok': True, 'device': new_dev})

@app.route('/api/devices/<device_id>', methods=['DELETE'])
def api_delete_device(device_id):
    cfg = load_config()
    cfg['devices'] = [d for d in cfg['devices'] if d['id'] != device_id]
    save_config(cfg)
    return jsonify({'ok': True})

@app.route('/api/devices/<device_id>', methods=['PATCH'])
def api_update_device(device_id):
    data = request.get_json(force=True)
    cfg = load_config()
    for dev in cfg['devices']:
        if dev['id'] == device_id:
            for key in ('name', 'icon', 'mode', 'visible'):
                if key in data:
                    dev[key] = data[key]
            save_config(cfg)
            return jsonify({'ok': True})
    abort(404)

@app.route('/api/devices/<device_id>/programs', methods=['PUT'])
def api_add_program(device_id):
    data = request.get_json(force=True)
    cfg = load_config()
    for dev in cfg['devices']:
        if dev['id'] == device_id:
            prog = {
                'id': str(uuid.uuid4())[:8],
                'name': data.get('name', 'Programme'),
                'dur_h': int(data.get('dur_h', 1)),
                'dur_m': int(data.get('dur_m', 0)),
            }
            dev['programs'].append(prog)
            save_config(cfg)
            return jsonify({'ok': True, 'program': prog})
    abort(404)

@app.route('/api/devices/<device_id>/programs/<prog_id>', methods=['PATCH'])
def api_update_program(device_id, prog_id):
    data = request.get_json(force=True)
    cfg = load_config()
    for dev in cfg['devices']:
        if dev['id'] == device_id:
            for prog in dev['programs']:
                if prog['id'] == prog_id:
                    for key in ('name', 'dur_h', 'dur_m'):
                        if key in data:
                            prog[key] = data[key]
                    save_config(cfg)
                    return jsonify({'ok': True})
    abort(404)

@app.route('/api/devices/<device_id>/programs/<prog_id>', methods=['DELETE'])
def api_delete_program(device_id, prog_id):
    cfg = load_config()
    for dev in cfg['devices']:
        if dev['id'] == device_id:
            dev['programs'] = [p for p in dev['programs'] if p['id'] != prog_id]
            save_config(cfg)
            return jsonify({'ok': True})
    abort(404)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=False)
