"""
Inference API for Code Risk Radar
Can be deployed as FastAPI microservice or integrated into Forge Functions
"""

import json
import numpy as np
from pathlib import Path
from typing import Dict, List, Any
import joblib

from feature_extractor import PRFeatureExtractor


class RiskPredictor:
    """Production-ready risk prediction with explainability"""
    
    def __init__(self, model_path: str = 'models/baseline_model.pkl'):
        """Load trained model artifacts"""
        self.model_path = Path(model_path)
        self.extractor = PRFeatureExtractor()
        
        # Load model
        artifacts = joblib.load(self.model_path)
        self.model = artifacts['model']
        self.scaler = artifacts['scaler']
        self.feature_names = artifacts['feature_names']
        self.explainer = artifacts.get('explainer')
        
        print(f"✓ Model loaded from {model_path}")
    
    def predict(self, pr_payload: Dict[str, Any], explain: bool = True) -> Dict[str, Any]:
        """
        Predict risk score for a PR with explanations.
        
        Args:
            pr_payload: Bitbucket PR webhook payload
            explain: Include SHAP explanations (slower but more informative)
        
        Returns:
            {
                'risk_score': float,  # 0-100
                'risk_level': str,  # 'low' | 'medium' | 'high'
                'axis_scores': dict,  # 6 axis scores
                'top_features': list,  # Top 5 contributing features
                'confidence': float  # Model confidence (0-1)
            }
        """
        # Extract features
        features = self.extractor.extract_features(pr_payload)
        axis_scores = self.extractor.extract_axis_scores(features)
        
        # Prepare for model
        feature_vector = np.array([features[f] for f in self.feature_names]).reshape(1, -1)
        feature_vector_scaled = self.scaler.transform(feature_vector)
        
        # Predict
        risk_score = float(np.clip(self.model.predict(feature_vector_scaled)[0], 0, 100))
        
        # Determine risk level
        if risk_score < 30:
            risk_level = 'low'
        elif risk_score < 70:
            risk_level = 'medium'
        else:
            risk_level = 'high'
        
        # Get feature contributions
        top_features = self._get_top_features(
            feature_vector_scaled[0], 
            features,
            explain=explain
        )
        
        # Estimate confidence (simplified)
        confidence = self._estimate_confidence(risk_score, features)
        
        return {
            'risk_score': round(risk_score, 1),
            'risk_level': risk_level,
            'axis_scores': {k: round(v, 1) for k, v in axis_scores.items()},
            'top_features': top_features,
            'confidence': round(confidence, 2),
            'metadata': {
                'model_type': 'ridge_regression',
                'n_features': len(self.feature_names),
                'pr_id': pr_payload.get('pullrequest', {}).get('id')
            }
        }
    
    def _get_top_features(
        self, 
        feature_vector_scaled: np.ndarray, 
        features_raw: Dict[str, float],
        explain: bool = True,
        top_n: int = 5
    ) -> List[Dict[str, Any]]:
        """Get top contributing features with explanations"""
        
        if explain and self.explainer is not None:
            # Use SHAP for precise contributions
            try:
                shap_values = self.explainer.shap_values(feature_vector_scaled.reshape(1, -1))[0]
                
                # Sort by absolute SHAP value
                feature_contributions = [
                    {
                        'feature': name,
                        'value': features_raw[name],
                        'contribution': float(shap_val),
                        'impact': 'increases risk' if shap_val > 0 else 'decreases risk'
                    }
                    for name, shap_val in zip(self.feature_names, shap_values)
                ]
                
                # Sort by absolute contribution
                feature_contributions.sort(key=lambda x: abs(x['contribution']), reverse=True)
                return feature_contributions[:top_n]
                
            except Exception as e:
                print(f"SHAP failed, falling back to coefficients: {e}")
        
        # Fallback: use model coefficients
        contributions = []
        for i, name in enumerate(self.feature_names):
            coef = self.model.coef_[i]
            scaled_val = feature_vector_scaled[i]
            contribution = coef * scaled_val
            
            contributions.append({
                'feature': name,
                'value': features_raw[name],
                'contribution': float(contribution),
                'impact': 'increases risk' if contribution > 0 else 'decreases risk'
            })
        
        contributions.sort(key=lambda x: abs(x['contribution']), reverse=True)
        return contributions[:top_n]
    
    def _estimate_confidence(self, risk_score: float, features: Dict[str, float]) -> float:
        """
        Estimate prediction confidence based on feature values.
        Higher confidence when features are within training distribution.
        """
        # Simplified confidence: based on distance from boundaries
        if 30 <= risk_score <= 70:
            # Medium range = lower confidence (boundary region)
            return 0.7
        elif risk_score < 10 or risk_score > 90:
            # Extreme values = high confidence
            return 0.95
        else:
            return 0.85


# FastAPI Integration
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    
    app = FastAPI(
        title="Code Risk Radar Inference API",
        description="Risk prediction for Bitbucket pull requests",
        version="1.0.0"
    )
    
    # CORS for frontend access
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Initialize predictor globally
    predictor = RiskPredictor()
    
    class PRPayload(BaseModel):
        pullrequest: dict
        repository: dict
        diff_stats: dict
        commit_history: list
        diff_text: str
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {"status": "healthy", "model_loaded": predictor.model is not None}
    
    @app.post("/predict")
    async def predict_risk(payload: PRPayload):
        """
        Predict risk score for a PR
        
        **Request Body**: Bitbucket PR payload with diff_stats and diff_text
        
        **Response**:
        ```json
        {
          "risk_score": 75.2,
          "risk_level": "high",
          "axis_scores": {
            "complexity": 80.5,
            "security": 65.3,
            ...
          },
          "top_features": [
            {
              "feature": "security_hardcoded_secrets",
              "value": 2.0,
              "contribution": 12.5,
              "impact": "increases risk"
            },
            ...
          ],
          "confidence": 0.87
        }
        ```
        """
        try:
            result = predictor.predict(payload.dict(), explain=True)
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/predict/fast")
    async def predict_risk_fast(payload: PRPayload):
        """Fast prediction without SHAP explanations"""
        try:
            result = predictor.predict(payload.dict(), explain=False)
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/features")
    async def get_feature_names():
        """Get list of all features used by the model"""
        return {
            "features": predictor.feature_names,
            "count": len(predictor.feature_names)
        }
    
    print("\n✓ FastAPI app initialized")
    print("  Run with: uvicorn inference:app --reload")
    
except ImportError:
    print("FastAPI not installed. Install with: pip install fastapi uvicorn")
    app = None


# Standalone CLI usage
if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python inference.py <pr_payload.json>")
        sys.exit(1)
    
    # Load PR payload from file
    with open(sys.argv[1], 'r') as f:
        pr_data = json.load(f)
    
    # Initialize predictor
    predictor = RiskPredictor()
    
    # Make prediction
    result = predictor.predict(pr_data)
    
    # Pretty print result
    print("\n" + "="*60)
    print(f"RISK ANALYSIS FOR PR #{result['metadata']['pr_id']}")
    print("="*60)
    print(f"\n🎯 Risk Score: {result['risk_score']}/100 ({result['risk_level'].upper()})")
    print(f"   Confidence: {result['confidence']*100:.0f}%")
    
    print(f"\n📊 Axis Scores:")
    for axis, score in sorted(result['axis_scores'].items(), key=lambda x: x[1], reverse=True):
        bar = '█' * int(score / 5)
        print(f"   {axis:20s}: {score:5.1f}/100 {bar}")
    
    print(f"\n🔍 Top Contributing Features:")
    for i, feat in enumerate(result['top_features'], 1):
        sign = '+' if feat['contribution'] > 0 else ''
        print(f"   {i}. {feat['feature']}")
        print(f"      Value: {feat['value']:.2f}")
        print(f"      Contribution: {sign}{feat['contribution']:.2f} ({feat['impact']})")
    
    print("\n" + "="*60)
