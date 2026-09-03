"""
DenialGuard AI - XGBoost Model Training Pipeline
Trains binary classifier on the final cleaned & imputed dataset (training_dataset_final.csv),
recomputes historical feature lookups, evaluates on held-out test split,
and exports updated model artifacts and metrics.json.
"""

import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
import xgboost as xgb

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(CURRENT_DIR, "..", "..", "data", "training_dataset_final.csv")
MODEL_OUT_PATH = os.path.join(CURRENT_DIR, "model.pkl")
LOOKUPS_OUT_PATH = os.path.join(CURRENT_DIR, "feature_lookups.pkl")
METRICS_OUT_PATH = os.path.join(CURRENT_DIR, "metrics.json")

# 20 Locked Raw Feature Categorizations
CATEGORICAL_FEATURES = [
    "claim_type",
    "payer",
    "plan_type",
    "eligibility_status",
    "provider_specialty",
    "network_status",
    "icd10_code",
    "cpt_code",
    "modifiers",
    "pos_code",
    "pa_status",
    "referral_status",
]

NUMERICAL_FEATURES = [
    "units_billed",
    "charge_amount",
    "days_to_filing_deadline",
    "documentation_flag",
    "cob_flag",
    "hist_denial_rate_cpt_payer",
    "hist_denial_rate_provider_payer",
    "claim_amount_deviation",
]

def train_model():
    print(f"Loading final training dataset from {DATA_PATH}...")
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Final training CSV not found at {DATA_PATH}. Run impute_missing_fields.py first.")

    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} records. Calculating historical lookup tables on final dataset...")

    # Convert booleans to int for safe modeling
    df["documentation_flag"] = df["documentation_flag"].astype(int)
    df["cob_flag"] = df["cob_flag"].astype(int)
    df["denial_flag"] = df["denial_flag"].astype(int)

    # 1. Compute Historical Lookups on the new dataset
    global_denial_rate = float(df["denial_flag"].mean())
    
    # CPT + Payer denial rate lookup
    cpt_payer_stats = df.groupby(["cpt_code", "payer"])["denial_flag"].agg(["mean", "count"]).reset_index()
    cpt_payer_lookup = {
        f"{row['cpt_code']}::{row['payer']}": float(row['mean'])
        for _, row in cpt_payer_stats.iterrows()
    }

    # Provider Specialty + Payer denial rate lookup
    provider_payer_stats = df.groupby(["provider_specialty", "payer"])["denial_flag"].agg(["mean", "count"]).reset_index()
    provider_payer_lookup = {
        f"{row['provider_specialty']}::{row['payer']}": float(row['mean'])
        for _, row in provider_payer_stats.iterrows()
    }

    # CPT mean charge lookup
    cpt_charge_stats = df.groupby("cpt_code")["charge_amount"].mean().to_dict()
    global_mean_charge = float(df["charge_amount"].mean())

    feature_lookups = {
        "global_denial_rate": round(global_denial_rate, 4),
        "global_mean_charge": round(global_mean_charge, 2),
        "cpt_payer_denial_rates": cpt_payer_lookup,
        "provider_payer_denial_rates": provider_payer_lookup,
        "cpt_mean_charges": cpt_charge_stats,
    }

    # 2. Add Engineered Features to dataset
    df["hist_denial_rate_cpt_payer"] = df.apply(
        lambda r: cpt_payer_lookup.get(f"{r['cpt_code']}::{r['payer']}", global_denial_rate),
        axis=1
    )
    df["hist_denial_rate_provider_payer"] = df.apply(
        lambda r: provider_payer_lookup.get(f"{r['provider_specialty']}::{r['payer']}", global_denial_rate),
        axis=1
    )
    df["claim_amount_deviation"] = df.apply(
        lambda r: round(r["charge_amount"] - cpt_charge_stats.get(r["cpt_code"], global_mean_charge), 2),
        axis=1
    )

    feature_columns = CATEGORICAL_FEATURES + NUMERICAL_FEATURES
    X = df[feature_columns]
    y = df["denial_flag"]

    # 3. Train / Test Split (80/20 stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # 4. Fit Preprocessor (One-Hot Encoder for Categoricals, Passthrough for Numericals)
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
            (
                "num",
                "passthrough",
                NUMERICAL_FEATURES,
            ),
        ],
        verbose_feature_names_out=False,
    )

    print("Fitting preprocessor and transforming train/test sets...")
    X_train_encoded = preprocessor.fit_transform(X_train)
    X_test_encoded = preprocessor.transform(X_test)

    feature_names = list(preprocessor.get_feature_names_out())

    # 5. Train XGBoost Classifier
    print(f"Training XGBoost Classifier on {len(X_train)} samples...")
    neg_count = len(y_train) - sum(y_train)
    pos_count = max(1, sum(y_train))
    scale_pos = neg_count / pos_count

    xgb_model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=scale_pos,
        random_state=42,
        eval_metric="logloss",
        n_jobs=-1
    )
    xgb_model.fit(X_train_encoded, y_train)

    # 6. Evaluate on Held-out Test Set
    print("Evaluating model performance on held-out test split...")
    y_pred_proba = xgb_model.predict_proba(X_test_encoded)[:, 1]
    y_pred = (y_pred_proba >= 0.50).astype(int)

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred))
    rec = float(recall_score(y_test, y_pred))
    f1 = float(f1_score(y_test, y_pred))
    roc_auc = float(roc_auc_score(y_test, y_pred_proba))
    cm = confusion_matrix(y_test, y_pred).tolist()

    metrics = {
        "dataset_size": len(df),
        "test_size": len(y_test),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "confusion_matrix": {
            "true_negatives": cm[0][0],
            "false_positives": cm[0][1],
            "false_negatives": cm[1][0],
            "true_positives": cm[1][1],
        },
    }

    print("\n--- RETRAINED MODEL PERFORMANCE METRICS ---")
    print(f"Accuracy:  {metrics['accuracy']:.4f}")
    print(f"Precision: {metrics['precision']:.4f}")
    print(f"Recall:    {metrics['recall']:.4f}")
    print(f"F1 Score:  {metrics['f1_score']:.4f}")
    print(f"ROC AUC:   {metrics['roc_auc']:.4f}")
    print(f"Confusion Matrix: {cm}")

    # 7. Save Artifacts
    artifact = {
        "model": xgb_model,
        "preprocessor": preprocessor,
        "feature_names": feature_names,
        "categorical_features": CATEGORICAL_FEATURES,
        "numerical_features": NUMERICAL_FEATURES,
    }

    joblib.dump(artifact, MODEL_OUT_PATH)
    print(f"Saved updated model artifact to {MODEL_OUT_PATH}")

    joblib.dump(feature_lookups, LOOKUPS_OUT_PATH)
    print(f"Saved updated feature lookups to {LOOKUPS_OUT_PATH}")

    with open(METRICS_OUT_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved fresh metrics to {METRICS_OUT_PATH}")

    return metrics

if __name__ == "__main__":
    train_model()
