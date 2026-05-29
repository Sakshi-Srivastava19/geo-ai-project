import pandas as pd
import random

data = []

for i in range(100):
    lat = round(random.uniform(12.5, 13.5), 2)
    lon = round(random.uniform(77.0, 78.0), 2)
    rainfall = random.randint(400, 1000)
    temp = random.randint(25, 40)
    veg = round(random.uniform(0.2, 0.8), 2)

    # Simple logic for label
    label = 1 if veg > 0.5 else 0

    data.append([lat, lon, rainfall, temp, veg, label])

df = pd.DataFrame(data, columns=[
    "latitude","longitude","rainfall","temperature","vegetation","label"
])

df.to_csv("../dataset/data1.csv", index=False)

print("Dataset created!")