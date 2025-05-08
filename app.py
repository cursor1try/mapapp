from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from geopy.geocoders import Nominatim

import speech_recognition as sr
import re

app = Flask(__name__)
socketio = SocketIO(app)

# Initialize Speech Recognizer and Geocoder globally
recognizer = sr.Recognizer()
geolocator = Nominatim(user_agent="address_geocoder")

# Command patterns
COMMAND_PATTERNS = {
    'navigate': r"navigate to (.+)",
    'zoom': r"zoom (in|out)",
    'move': r"move (up|down|left|right)",
    'show': r"show (me )?(the )?(.+)( layer)?",
    'hide': r"hide (the )?(.+)( layer)?",
    'center': r"center (on|at) (.+)",
    'marker': r"add (a )?marker (at|on) (.+)"
}

@app.route('/')
def index():
    return render_template('index.html')

def recognize_speech():
    with sr.Microphone() as source:
        print("Listening...")
        recognizer.adjust_for_ambient_noise(source)
        audio = recognizer.listen(source)
        try:
            command = recognizer.recognize_google(audio)
            print(f"Recognized: {command}")
            return command.lower()
        except sr.UnknownValueError:
            print("Google Speech Recognition could not understand the audio")
            return ""
        except sr.RequestError as e:
            print(f"Could not request results; {e}")
            return ""

def process_command(command):
    for cmd_type, pattern in COMMAND_PATTERNS.items():
        match = re.match(pattern, command)
        if match:
            return {
                'type': cmd_type,
                'params': match.groups()
            }
    return None

@socketio.on('start_recognition')
def handle_recognition():
    command = recognize_speech()
    if not command:
        emit('recognized_command', {'error': 'Could not understand the command'})
        return

    processed = process_command(command)
    if not processed:
        emit('recognized_command', {'error': 'Command not recognized'})
        return

    try:
        if processed['type'] == 'navigate':
            city_name = processed['params'][0]
            location = geolocator.geocode(city_name)
            if location:
                emit('recognized_command', {
                    'type': 'navigate',
                    'city': city_name,
                    'latitude': location.latitude,
                    'longitude': location.longitude
                })
            else:
                emit('recognized_command', {'error': f'Location "{city_name}" not found'})

        elif processed['type'] == 'zoom':
            action = processed['params'][0]
            emit('recognized_command', {
                'type': 'zoom',
                'action': action
            })

        elif processed['type'] == 'move':
            direction = processed['params'][0]
            emit('recognized_command', {
                'type': 'move',
                'direction': direction
            })

        elif processed['type'] in ['show', 'hide']:
            layer_name = processed['params'][-1].strip()
            emit('recognized_command', {
                'type': processed['type'],
                'layer': layer_name
            })

        elif processed['type'] == 'center':
            location_name = processed['params'][1]
            location = geolocator.geocode(location_name)
            if location:
                emit('recognized_command', {
                    'type': 'center',
                    'latitude': location.latitude,
                    'longitude': location.longitude
                })
            else:
                emit('recognized_command', {'error': f'Location "{location_name}" not found'})

        elif processed['type'] == 'marker':
            location_name = processed['params'][2]
            location = geolocator.geocode(location_name)
            if location:
                emit('recognized_command', {
                    'type': 'marker',
                    'latitude': location.latitude,
                    'longitude': location.longitude
                })
            else:
                emit('recognized_command', {'error': f'Location "{location_name}" not found'})

    except Exception as e:
        print(f"Error processing command: {e}")
        emit('recognized_command', {'error': 'Error processing command'})

if __name__ == '__main__':
    socketio.run(app, debug=True)
