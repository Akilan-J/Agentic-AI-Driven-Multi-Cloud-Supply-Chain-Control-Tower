import azure.functions as func
import logging
import json
import joblib
import os
import pandas as pd

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

model = None
product_encoder = None

# Hardcoded reorder level for demo purposes
REORDER_LEVEL = 20

def load_model():
    global model, product_encoder
    if model is None:
        try:
            model_path = os.path.join(os.path.dirname(__file__), 'model.pkl')
            artifact = joblib.load(model_path)
            model = artifact['model']
            product_encoder = artifact['product_encoder']
            logging.info("ML model and encoders loaded successfully.")
        except Exception as e:
            logging.error(f"Failed to load ML model: {e}")
            raise ValueError(f"Failed to load ML model: {e}")

def _run_prediction(req: func.HttpRequest) -> dict:
    load_model()
        
    req_body = req.get_json()
    product = req_body.get('product')
    current_stock = req_body.get('current_stock')
    month = req_body.get('month')
    promotions_active = req_body.get('promotions_active')
    past_sales = req_body.get('past_sales')

    if None in [product, current_stock, month, promotions_active, past_sales]:
        raise ValueError("Missing one or more required fields.")

    # Convert numeric fields
    try:
        current_stock = int(current_stock)
        month = int(month)
        promotions_active = int(promotions_active)
        past_sales = int(past_sales)
    except ValueError:
        raise ValueError("Numeric fields must be integers.")

    # Encode product
    try:
        product_encoded = product_encoder.transform([product])[0]
    except ValueError:
        raise ValueError(f"Unknown product: {product}")

    # Prepare DataFrame for prediction (consistent with training feature names)
    input_data = pd.DataFrame([{
        'product_encoded': product_encoded,
        'month': month,
        'promotions_active': promotions_active,
        'past_sales': past_sales
    }])

    # Predict demand
    predicted_demand = int(model.predict(input_data)[0])

    # Agent Decision Logic
    # if current_stock < (reorder_level + predicted_demand): decision = "REORDER NEEDED"
    if current_stock < (REORDER_LEVEL + predicted_demand):
        decision = "REORDER NEEDED"
    else:
        decision = "STOCK OK"

    return {
        "product": product,
        "current_stock": current_stock,
        "predicted_demand": predicted_demand,
        "reorder_level": REORDER_LEVEL,
        "decision": decision
    }

# ============================================================================
# ENDPOINT 1: predict_supply (Used by UI, sends message to Service Bus)
# ============================================================================
@app.route(route="predict_supply", methods=["POST"])
@app.service_bus_queue_output(
    arg_name="msg",
    connection="ServiceBusConnection",
    queue_name="disasterqueue")
def predict_supply(req: func.HttpRequest, msg: func.Out[str]) -> func.HttpResponse:
    logging.info('predict_supply processed a request.')
    try:
        result = _run_prediction(req)
        
        # Output message to Service Bus
        msg.set(json.dumps(result))
        
        return func.HttpResponse(
            json.dumps(result),
            mimetype="application/json",
            status_code=200
        )
    except ValueError as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=400, mimetype="application/json")
    except Exception as e:
        logging.error(f"Error: {e}")
        return func.HttpResponse(json.dumps({"error": f"Server error: {str(e)}"}), status_code=500, mimetype="application/json")


# ============================================================================
# ENDPOINT 2: predict_only (Used by Logic App, NO Service Bus output)
# ============================================================================
@app.route(route="predict_only", methods=["POST"])
def predict_only(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('predict_only processed a request.')
    try:
        result = _run_prediction(req)
        
        return func.HttpResponse(
            json.dumps(result),
            mimetype="application/json",
            status_code=200
        )
    except ValueError as e:
        return func.HttpResponse(json.dumps({"error": str(e)}), status_code=400, mimetype="application/json")
    except Exception as e:
        logging.error(f"Error: {e}")
        return func.HttpResponse(json.dumps({"error": f"Server error: {str(e)}"}), status_code=500, mimetype="application/json")
