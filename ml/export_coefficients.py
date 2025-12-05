"""
Helper script to export model coefficients as JSON for JavaScript deployment
"""

import json
import joblib
from pathlib import Path

def export_coefficients(model_path='models/baseline_model.pkl', output_path='models/model_coefficients.json'):
    """Export model coefficients to JSON for JavaScript inference"""
    
    # Load model artifacts
    artifacts = joblib.load(model_path)
    model = artifacts['model']
    scaler = artifacts['scaler']
    feature_names = artifacts['feature_names']
    
    # Extract coefficients
    model_coefficients = {
        'intercept': float(model.intercept_),
        'coefficients': {
            feature: float(coef) 
            for feature, coef in zip(feature_names, model.coef_)
        },
        'scaler_mean': {
            feature: float(mean) 
            for feature, mean in zip(feature_names, scaler.mean_)
        },
        'scaler_scale': {
            feature: float(scale) 
            for feature, scale in zip(feature_names, scaler.scale_)
        },
        'metadata': {
            'model_type': 'ridge_regression',
            'n_features': len(feature_names),
            'feature_names': feature_names
        }
    }
    
    # Save to JSON
    with open(output_path, 'w') as f:
        json.dump(model_coefficients, f, indent=2)
    
    print(f"✓ Coefficients exported to {output_path}")
    print(f"  - Intercept: {model_coefficients['intercept']:.3f}")
    print(f"  - Features: {len(feature_names)}")
    print(f"  - File size: {Path(output_path).stat().st_size / 1024:.1f} KB")
    
    return model_coefficients

if __name__ == '__main__':
    import sys
    
    model_path = sys.argv[1] if len(sys.argv) > 1 else 'models/baseline_model.pkl'
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'models/model_coefficients.json'
    
    export_coefficients(model_path, output_path)
