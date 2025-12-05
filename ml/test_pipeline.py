"""
Test script for ML pipeline
Run this to verify everything works end-to-end
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from ml.feature_extractor import PRFeatureExtractor
from ml.inference import RiskPredictor

def test_feature_extraction():
    """Test feature extractor"""
    print("=" * 60)
    print("TEST 1: Feature Extraction")
    print("=" * 60)
    
    sample_pr = {
        'pullrequest': {
            'id': 123,
            'title': 'Fix critical SQL injection vulnerability',
            'description': 'BREAKING CHANGE: Updated authentication API',
            'author': {'display_name': 'Alice'},
            'created_on': '2025-12-05T10:00:00Z',
            'updated_on': '2025-12-05T14:00:00Z'
        },
        'repository': {'slug': 'backend-api'},
        'diff_stats': {
            'lines_added': 250,
            'lines_deleted': 120,
            'files': [
                'src/auth/login.js',
                'src/auth/session.js',
                'src/db/queries.js',
                'test/auth.test.js'
            ]
        },
        'commit_history': [
            {'hash': 'abc123'},
            {'hash': 'def456'},
            {'hash': 'ghi789'}
        ],
        'diff_text': '''
+++ src/auth/login.js
+ function authenticate(username, password) {
+   const query = "SELECT * FROM users WHERE username = '" + username + "'";
+   const apiKey = "sk-1234567890abcdef";
+   return db.execute(query);
+ }
'''
    }
    
    extractor = PRFeatureExtractor()
    
    # Extract features
    features = extractor.extract_features(sample_pr)
    print(f"\n✓ Extracted {len(features)} features")
    
    # Show some key features
    print("\n  Key security features:")
    security_features = {k: v for k, v in features.items() if k.startswith('security_')}
    for name, value in sorted(security_features.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"    {name}: {value:.1f}")
    
    # Extract axis scores
    axis_scores = extractor.extract_axis_scores(features)
    print("\n  Axis scores:")
    for axis, score in sorted(axis_scores.items(), key=lambda x: x[1], reverse=True):
        bar = '█' * int(score / 5)
        print(f"    {axis:20s}: {score:5.1f}/100 {bar}")
    
    return features, axis_scores

def test_model_prediction():
    """Test model inference"""
    print("\n" + "=" * 60)
    print("TEST 2: Model Prediction")
    print("=" * 60)
    
    # Check if model exists
    model_path = Path(__file__).parent / 'models' / 'baseline_model.pkl'
    if not model_path.exists():
        print("\n⚠️  Model not found. Run training first:")
        print("   jupyter notebook train_baseline.ipynb")
        return False
    
    # Load predictor
    try:
        predictor = RiskPredictor(str(model_path))
        print("\n✓ Model loaded successfully")
    except Exception as e:
        print(f"\n❌ Failed to load model: {e}")
        return False
    
    # Create test PR (high risk)
    high_risk_pr = {
        'pullrequest': {
            'id': 999,
            'title': 'Refactor entire authentication system',
            'description': 'BREAKING CHANGE: Complete auth rewrite. Removes old API.',
            'author': {'display_name': 'Bob'},
            'created_on': '2025-12-05T08:00:00Z',
            'updated_on': '2025-12-05T09:00:00Z'  # Fast review = risky
        },
        'repository': {'slug': 'backend-api'},
        'diff_stats': {
            'lines_added': 1500,
            'lines_deleted': 800,
            'files': [
                'src/auth/login.js',
                'src/auth/session.js',
                'src/auth/tokens.js',
                'src/middleware/auth.js',
                'config/secrets.yaml',
                '.env.production'
            ]
        },
        'commit_history': [{'hash': f'commit{i}'} for i in range(15)],
        'diff_text': '''
+++ src/auth/login.js
+ const password = "hardcoded_secret_123";
+ const query = "SELECT * FROM users WHERE id = " + userId;
+ eval(userInput);
+ if (x) {
+   if (y) {
+     if (z) {
+       while (true) {
+         // Deeply nested logic
+       }
+     }
+   }
+ }
+++ config/secrets.yaml
+ api_key: "sk-prod-1234567890"
'''
    }
    
    # Predict
    try:
        result = predictor.predict(high_risk_pr, explain=True)
        
        print(f"\n✓ Prediction successful")
        print(f"\n  Risk Score: {result['risk_score']}/100 ({result['risk_level'].upper()})")
        print(f"  Confidence: {result['confidence']*100:.0f}%")
        
        print(f"\n  Axis Scores:")
        for axis, score in sorted(result['axis_scores'].items(), key=lambda x: x[1], reverse=True):
            bar = '█' * int(score / 5)
            print(f"    {axis:20s}: {score:5.1f}/100 {bar}")
        
        print(f"\n  Top Contributing Features:")
        for i, feat in enumerate(result['top_features'][:5], 1):
            sign = '+' if feat['contribution'] > 0 else ''
            print(f"    {i}. {feat['feature']}")
            print(f"       Value: {feat['value']:.1f} | Contribution: {sign}{feat['contribution']:.1f}")
        
        # Validate high risk detection
        if result['risk_score'] > 70:
            print("\n✅ Correctly identified as HIGH RISK")
        else:
            print(f"\n⚠️  Expected high risk, got {result['risk_score']:.1f}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Prediction failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_javascript_export():
    """Test that coefficients can be exported for JS"""
    print("\n" + "=" * 60)
    print("TEST 3: JavaScript Export")
    print("=" * 60)
    
    coef_path = Path(__file__).parent / 'models' / 'model_coefficients.json'
    
    if not coef_path.exists():
        print("\n⚠️  Coefficients not exported. Run:")
        print("   python ml/export_coefficients.py")
        return False
    
    try:
        with open(coef_path, 'r') as f:
            coefficients = json.load(f)
        
        print(f"\n✓ Coefficients loaded")
        print(f"  - Intercept: {coefficients['intercept']:.3f}")
        print(f"  - Features: {len(coefficients['coefficients'])}")
        print(f"  - File size: {coef_path.stat().st_size / 1024:.1f} KB")
        
        # Verify structure
        required_keys = ['intercept', 'coefficients', 'scaler_mean', 'scaler_scale']
        missing = [k for k in required_keys if k not in coefficients]
        
        if missing:
            print(f"\n❌ Missing keys: {missing}")
            return False
        
        print("\n✅ Ready for JavaScript deployment")
        return True
        
    except Exception as e:
        print(f"\n❌ Failed to load coefficients: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("CODE RISK RADAR - ML PIPELINE TEST SUITE")
    print("=" * 60)
    
    results = []
    
    # Test 1: Feature extraction (always works)
    try:
        features, axes = test_feature_extraction()
        results.append(("Feature Extraction", True))
    except Exception as e:
        print(f"\n❌ Test 1 failed: {e}")
        results.append(("Feature Extraction", False))
    
    # Test 2: Model prediction (requires trained model)
    try:
        success = test_model_prediction()
        results.append(("Model Prediction", success))
    except Exception as e:
        print(f"\n❌ Test 2 failed: {e}")
        results.append(("Model Prediction", False))
    
    # Test 3: JS export (requires exported coefficients)
    try:
        success = test_javascript_export()
        results.append(("JavaScript Export", success))
    except Exception as e:
        print(f"\n❌ Test 3 failed: {e}")
        results.append(("JavaScript Export", False))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {test_name:30s}: {status}")
    
    all_passed = all(r[1] for r in results)
    
    if all_passed:
        print("\n🎉 All tests passed! ML pipeline is ready.")
    else:
        print("\n⚠️  Some tests failed. Check errors above.")
        failed = [name for name, passed in results if not passed]
        print(f"\nFailed tests: {', '.join(failed)}")
        print("\nTo fix:")
        print("  1. Run: python ml/generate_synthetic_data.py")
        print("  2. Run: jupyter notebook ml/train_baseline.ipynb (execute all cells)")
        print("  3. Run: python ml/export_coefficients.py")
        print("  4. Re-run: python ml/test_pipeline.py")
    
    return all_passed

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
