from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)
import json, os
import pandas as pd
import joblib
from preprocess import preprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
@app.route("/")
def home():
    return "Backend is running 🚀"
app.config["JWT_SECRET_KEY"] = "this_is_a_super_secure_secret_key_1234567890_abcdef"

jwt = JWTManager(app)
CORS(app)

model = joblib.load(os.path.join(BASE_DIR, "geo_model.pkl"))

# ---------- USERS ----------
def load_users():
    users_path = os.path.join(BASE_DIR, "users.json")
    if not os.path.exists(users_path):
        return {}
    with open(users_path, "r") as f:
        return json.load(f)

def save_users(users):
    users_path = os.path.join(BASE_DIR, "users.json")
    with open(users_path, "w") as f:
        json.dump(users, f)

# ---------- HISTORY ----------
def load_history():
    history_path = os.path.join(BASE_DIR, "history.json")
    if not os.path.exists(history_path):
        return []
    with open(history_path, "r") as f:
        return json.load(f)

def save_history(data):
    history_path = os.path.join(BASE_DIR, "history.json")
    with open(history_path, "w") as f:
        json.dump(data, f)

# ---------- REGISTER ----------
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    users = load_users()

    if data["username"] in users:
        return jsonify({"msg": "User exists"}), 400

    users[data["username"]] = data["password"]
    save_users(users)

    return jsonify({"msg": "Registered successfully"})

# ---------- LOGIN ----------
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    users = load_users()

    if data["username"] in users and users[data["username"]] == data["password"]:
        token = create_access_token(identity=data["username"])
        return jsonify({"token": token})

    return jsonify({"msg": "Invalid credentials"}), 401

# ---------- PREDICT ----------
@app.route("/predict", methods=["POST"])
@jwt_required()
def predict():
    print("Prediction API HIT")

    user = get_jwt_identity()

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "Empty file"}), 400

    df = pd.read_csv(file)

    processed = preprocess(df)
    predictions = model.predict(processed)

    history = load_history()
    history.append({
        "user": user,
        "predictions": predictions.tolist()
    })
    save_history(history)

    return jsonify({
        "prediction": predictions.tolist(),
        "data": df.to_dict('records'),
        "accuracy": 0.85
    })

# ---------- HISTORY ----------
@app.route("/history", methods=["GET"])
@jwt_required()
def get_history():
    user = get_jwt_identity()
    history = load_history()

    user_history = [h for h in history if h["user"] == user]
    return jsonify(user_history)

# ---------- ADMIN ----------
@app.route("/admin", methods=["GET"])
@jwt_required()
def admin():
    user = get_jwt_identity()

    if user != "admin":
        return jsonify({"msg": "Access denied"}), 403

    users = load_users()
    history = load_history()

    return jsonify({
        "total_users": len(users),
        "total_predictions": len(history),
        "users": list(users.keys())
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)