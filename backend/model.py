import os
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

# Load dataset files
base_dir = os.path.dirname(__file__)
data_dir = os.path.join(base_dir, "..", "dataset")

files = [
    os.path.join(data_dir, "data.csv"),
    os.path.join(data_dir, "d.csv")
]

frames = []
for path in files:
    if os.path.exists(path):
        df_part = pd.read_csv(path)
        frames.append(df_part)
    else:
        print(f"Warning: dataset file not found: {path}")

if not frames:
    raise FileNotFoundError("No dataset files found to train the model.")

# Combine and clean
df = pd.concat(frames, ignore_index=True)
df.columns = df.columns.str.strip().str.lower()

required_cols = ["latitude", "longitude", "rainfall", "temperature", "vegetation", "label"]
for col in required_cols:
    if col not in df.columns:
        raise ValueError(f"Missing column: {col}")

# Remove exact duplicate rows to avoid overfitting on repeated examples
df = df.drop_duplicates().reset_index(drop=True)

# Features and target
X = df[["latitude", "longitude", "rainfall", "temperature", "vegetation"]]
y = df["label"]

# Split for validation
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

model = RandomForestClassifier(
    n_estimators=200,
    random_state=42,
    class_weight="balanced"
)

model.fit(X_train, y_train)

# Evaluate
train_preds = model.predict(X_train)
val_preds = model.predict(X_test)

print("Training accuracy:", round(accuracy_score(y_train, train_preds), 4))
print("Validation accuracy:", round(accuracy_score(y_test, val_preds), 4))
print("Classification report:\n", classification_report(y_test, val_preds, digits=4))

# Save model
model_path = os.path.join(base_dir, "geo_model.pkl")
joblib.dump(model, model_path)

print(f"✅ Model trained and saved to {model_path}")