import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import joblib

print("Generating synthetic data for Demand Forecasting...")

# Generating 1000 synthetic rows to train a reasonable Random Forest model
np.random.seed(42)

products = ['Product A', 'Product B', 'Product C', 'Product D']
n_samples = 1000

data = {
    'product': np.random.choice(products, n_samples),
    'month': np.random.randint(1, 13, n_samples),
    'promotions_active': np.random.choice([0, 1], n_samples),
    'past_sales': np.random.randint(10, 500, n_samples)
}

df = pd.DataFrame(data)

# Fake demand logic based on inputs so the model has something to learn
def calculate_demand(row):
    demand = row['past_sales'] * 1.1 # base demand
    if row['promotions_active'] == 1:
        demand *= 1.5
    if row['product'] == 'Product A':
        demand += 50
    elif row['product'] == 'Product B':
        demand -= 20
    # Seasonal effect
    if row['month'] in [11, 12]:
        demand *= 1.2
    return int(demand)

df['target_demand'] = df.apply(calculate_demand, axis=1)

# Encode categorical string 'product'
product_encoder = LabelEncoder()
df['product_encoded'] = product_encoder.fit_transform(df['product'])

X = df[['product_encoded', 'month', 'promotions_active', 'past_sales']]
y = df['target_demand']

print("Training RandomForestRegressor...")
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X, y)

print("Training complete! Model Score:", model.score(X, y))

# Save the model and encoder together
print("Saving model.pkl...")
artifact = {
    "model": model,
    "product_encoder": product_encoder
}
joblib.dump(artifact, "model.pkl")

print("Done. Saved as model.pkl")
