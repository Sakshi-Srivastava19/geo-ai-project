import pandas as pd

def preprocess(df):

    # remove spaces
    df.columns = df.columns.str.strip().str.lower()

    required_cols = [
        "latitude",
        "longitude",
        "rainfall",
        "temperature",
        "vegetation"
    ]

    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing column: {col}")

    return df[required_cols]