from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity
)

import pandas as pd
import joblib
import json
import os

from preprocess import preprocess

# ================= APP =================
app = Flask(__name__)

CORS(app)

app.config["JWT_SECRET_KEY"] = "geo_ai_dashboard_super_secure_secret_key_for_project_2026"

jwt = JWTManager(app)

# ================= LOAD MODEL =================
model = joblib.load("geo_model.pkl")

# ================= HOME =================
@app.route("/")
def home():
    return "Geo-AI Backend Running Successfully 🚀"

# ================= USERS =================
def load_users():

    if not os.path.exists("users.json"):
        return {}

    with open("users.json", "r") as f:
        return json.load(f)

def save_users(users):

    with open("users.json", "w") as f:
        json.dump(users, f)

# ================= HISTORY =================
def load_history():

    if not os.path.exists("history.json"):
        return []

    with open("history.json", "r") as f:
        return json.load(f)

def save_history(history):

    with open("history.json", "w") as f:
        json.dump(history, f)

# ================= REGISTER =================
@app.route("/register", methods=["POST"])
def register():

    data = request.json

    users = load_users()

    username = data.get("username")
    password = data.get("password")

    if username in users:
        return jsonify({"msg": "User already exists"}), 400

    users[username] = password

    save_users(users)

    return jsonify({
        "msg": "Registration successful"
    })

# ================= LOGIN =================
@app.route("/login", methods=["POST"])
def login():

    data = request.json

    users = load_users()

    username = data.get("username")
    password = data.get("password")

    if username not in users:
        return jsonify({
            "msg": "User not found"
        }), 401

    if users[username] != password:
        return jsonify({
            "msg": "Invalid password"
        }), 401

    token = create_access_token(identity=username)

    return jsonify({
        "token": token
    })

# ================= PREDICT =================
@app.route("/predict", methods=["POST"])
@jwt_required()
def predict():

    print("Prediction API HIT")

    try:

        if "file" not in request.files:
            return jsonify({
                "error": "No file uploaded"
            }), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({
                "error": "Empty file"
            }), 400

        # ===== READ CSV =====
        df = pd.read_csv(file)

        # ===== CLEAN COLUMN NAMES =====
        df.columns = df.columns.str.strip().str.lower()

        print(df.columns)

        # ===== PREPROCESS =====
        processed = preprocess(df)

        # ===== PREDICTION =====
        predictions = model.predict(processed)

        results = []

        for i in range(len(predictions)):

            results.append({

                "lat": float(df.iloc[i]["latitude"]),
                "lon": float(df.iloc[i]["longitude"]),
                "prediction": int(predictions[i])

            })

        # ===== ACCURACY =====
        accuracy = None

        if "label" in df.columns:

            accuracy = round(
                float(model.score(processed, df["label"])),
                2
            )

        # ===== SAVE HISTORY =====
        history = load_history()

        history.append({

            "user": get_jwt_identity(),

            "results": results,

            "timestamp": pd.Timestamp.now().isoformat()

        })

        save_history(history)

        return jsonify({

            "prediction": results,

            "accuracy": accuracy

        })

    except Exception as e:

        print(str(e))

        return jsonify({
            "error": str(e)
        }), 500

# ================= HISTORY =================
@app.route("/history", methods=["GET"])
@jwt_required()
def history():

    user = get_jwt_identity()

    history_data = load_history()

    user_history = []

    for item in history_data:

        if item["user"] == user:
            user_history.append(item)

    return jsonify(user_history)

# ================= ADMIN =================
@app.route("/admin", methods=["GET"])
@jwt_required()
def admin():

    user = get_jwt_identity()

    if user != "admin":

        return jsonify({
            "msg": "Access denied"
        }), 403

    users = load_users()

    history = load_history()

    return jsonify({

        "total_users": len(users),

        "total_predictions": len(history),

        "users": list(users.keys())

    })

# ================= MAIN =================
if __name__ == "__main__":

    app.run(debug=True)