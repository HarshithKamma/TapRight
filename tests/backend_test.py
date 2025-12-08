#!/usr/bin/env python3
"""
TapRight Backend API Test Suite
Tests all backend endpoints including auth, cards, profile, and location-based recommendations
"""

import requests
import json
import time
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://smartswipe-2.preview.emergentagent.com/api"

# Test data
test_user = {
    "name": "Sarah Johnson",
    "email": f"sarah.johnson.{int(time.time())}@tapright.com",
    "phone": "+1-555-0123",
    "password": "SecurePass123!"
}

# Global variables to store test state
auth_token = None
user_id = None
available_cards = []
added_card_ids = []

# ANSI color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test(test_name):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST: {test_name}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")

def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")

def print_error(message):
    print(f"{RED}✗ {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ {message}{RESET}")

def print_response(response):
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text}")

# ============ TEST 1: USER SIGNUP ============
def test_signup():
    print_test("User Signup - POST /api/auth/signup")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/signup",
            json=test_user,
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if 'token' in data and 'user' in data:
                global auth_token, user_id
                auth_token = data['token']
                user_id = data['user']['id']
                print_success(f"Signup successful! User ID: {user_id}")
                print_success(f"JWT Token received: {auth_token[:50]}...")
                return True
            else:
                print_error("Response missing 'token' or 'user' field")
                return False
        else:
            print_error(f"Signup failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during signup: {str(e)}")
        return False

# ============ TEST 2: USER LOGIN ============
def test_login():
    print_test("User Login - POST /api/auth/login")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json={
                "email": test_user["email"],
                "password": test_user["password"]
            },
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if 'token' in data and 'user' in data:
                print_success("Login successful!")
                print_success(f"Token matches signup: {data['token'] == auth_token}")
                return True
            else:
                print_error("Response missing 'token' or 'user' field")
                return False
        else:
            print_error(f"Login failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during login: {str(e)}")
        return False

# ============ TEST 3: GET PROFILE (Protected) ============
def test_get_profile():
    print_test("Get Profile - GET /api/profile (Protected)")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BACKEND_URL}/profile",
            headers=headers,
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('email') == test_user['email']:
                print_success("Profile retrieved successfully!")
                return True
            else:
                print_error("Profile data doesn't match test user")
                return False
        else:
            print_error(f"Get profile failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during get profile: {str(e)}")
        return False

# ============ TEST 4: GET ALL CARDS ============
def test_get_all_cards():
    print_test("Get All Credit Cards - GET /api/cards")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/cards",
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            global available_cards
            available_cards = response.json()
            
            if len(available_cards) == 7:
                print_success(f"Retrieved {len(available_cards)} credit cards")
                
                # Verify expected cards
                issuers = [card['issuer'] for card in available_cards]
                expected_issuers = ["American Express", "Chase", "Discover", "Citi", "Capital One"]
                
                print_info(f"Card issuers: {', '.join(set(issuers))}")
                
                for card in available_cards:
                    print_info(f"  - {card['name']} ({card['issuer']})")
                
                return True
            else:
                print_error(f"Expected 7 cards, got {len(available_cards)}")
                return False
        else:
            print_error(f"Get cards failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during get cards: {str(e)}")
        return False

# ============ TEST 5: ADD CARDS TO WALLET ============
def test_add_cards_to_wallet():
    print_test("Add Cards to User Wallet - POST /api/user-cards")
    
    if not auth_token or not available_cards:
        print_error("Prerequisites not met. Skipping test.")
        return False
    
    # Add 3 cards to wallet
    cards_to_add = available_cards[:3]
    success_count = 0
    
    for card in cards_to_add:
        try:
            headers = {"Authorization": f"Bearer {auth_token}"}
            response = requests.post(
                f"{BACKEND_URL}/user-cards?card_id={card['id']}",
                headers=headers,
                timeout=10
            )
            
            print(f"\nAdding {card['name']}...")
            print_response(response)
            
            if response.status_code == 200:
                added_card_ids.append(card['id'])
                print_success(f"Added {card['name']} to wallet")
                success_count += 1
            else:
                print_error(f"Failed to add {card['name']}")
                
        except Exception as e:
            print_error(f"Exception adding {card['name']}: {str(e)}")
    
    if success_count == len(cards_to_add):
        print_success(f"Successfully added {success_count} cards to wallet")
        return True
    else:
        print_error(f"Only added {success_count}/{len(cards_to_add)} cards")
        return False

# ============ TEST 6: GET USER CARDS ============
def test_get_user_cards():
    print_test("Get User's Cards - GET /api/user-cards (Protected)")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BACKEND_URL}/user-cards",
            headers=headers,
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            user_cards = response.json()
            
            if len(user_cards) == len(added_card_ids):
                print_success(f"Retrieved {len(user_cards)} cards from wallet")
                for card in user_cards:
                    print_info(f"  - {card['card_name']} ({card['card_issuer']})")
                return True
            else:
                print_error(f"Expected {len(added_card_ids)} cards, got {len(user_cards)}")
                return False
        else:
            print_error(f"Get user cards failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during get user cards: {str(e)}")
        return False

# ============ TEST 7: UPDATE QUESTIONNAIRE ============
def test_update_questionnaire():
    print_test("Update Questionnaire - PUT /api/profile/questionnaire (Protected)")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        questionnaire_data = {
            "monthly_rent": 2500.00,
            "monthly_expenses": 3500.00,
            "card_payments": 1500.00
        }
        
        response = requests.put(
            f"{BACKEND_URL}/profile/questionnaire",
            headers=headers,
            json=questionnaire_data,
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            print_success("Questionnaire updated successfully")
            return True
        else:
            print_error(f"Update questionnaire failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during update questionnaire: {str(e)}")
        return False

# ============ TEST 8: LOCATION CHECK - NEARBY POI ============
def test_location_check_nearby_poi():
    print_test("Location Check - Nearby POI - POST /api/location/check")
    
    if not auth_token or not user_id:
        print_error("Prerequisites not met. Skipping test.")
        return False
    
    # Test with Starbucks Downtown coordinates
    location_data = {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "user_id": user_id
    }
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BACKEND_URL}/location/check",
            headers=headers,
            json=location_data,
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('found'):
                if 'recommendation' in data:
                    rec = data['recommendation']
                    print_success("POI detected and recommendation generated!")
                    print_info(f"Merchant: {rec.get('merchant_name')}")
                    print_info(f"Category: {rec.get('category')}")
                    print_info(f"Recommended Card: {rec.get('recommended_card')}")
                    print_info(f"Reward Rate: {rec.get('reward_rate')}")
                    print_info(f"Message: {rec.get('message')}")
                    return True
                else:
                    print_info("POI found but no recommendation (might be throttled or no cards)")
                    return True
            else:
                print_error("No POI found at test coordinates")
                return False
        else:
            print_error(f"Location check failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during location check: {str(e)}")
        return False

# ============ TEST 9: LOCATION CHECK - THROTTLING ============
def test_location_check_throttling():
    print_test("Location Check - Throttling Test (Same location within 4 hours)")
    
    if not auth_token or not user_id:
        print_error("Prerequisites not met. Skipping test.")
        return False
    
    # Same location as previous test
    location_data = {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "user_id": user_id
    }
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BACKEND_URL}/location/check",
            headers=headers,
            json=location_data,
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('throttled'):
                print_success("Throttling working correctly - notification blocked")
                return True
            elif 'recommendation' in data:
                print_error("Expected throttling but got new recommendation")
                return False
            else:
                print_info("Response received but unclear if throttled")
                return True
        else:
            print_error(f"Location check failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during throttling test: {str(e)}")
        return False

# ============ TEST 10: LOCATION CHECK - NO NEARBY POI ============
def test_location_check_no_poi():
    print_test("Location Check - No Nearby POI")
    
    if not auth_token or not user_id:
        print_error("Prerequisites not met. Skipping test.")
        return False
    
    # Random location with no POI
    location_data = {
        "latitude": 45.5231,
        "longitude": -122.6765,
        "user_id": user_id
    }
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BACKEND_URL}/location/check",
            headers=headers,
            json=location_data,
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            
            if not data.get('found'):
                print_success("Correctly returned 'No merchants nearby'")
                return True
            else:
                print_error("Expected no POI but found one")
                return False
        else:
            print_error(f"Location check failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during no POI test: {str(e)}")
        return False

# ============ TEST 11: LOCATION CHECK - DIFFERENT POI ============
def test_location_check_different_poi():
    print_test("Location Check - Different POI (Chevron Station)")
    
    if not auth_token or not user_id:
        print_error("Prerequisites not met. Skipping test.")
        return False
    
    # Chevron Station coordinates
    location_data = {
        "latitude": 37.7849,
        "longitude": -122.4094,
        "user_id": user_id
    }
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BACKEND_URL}/location/check",
            headers=headers,
            json=location_data,
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('found'):
                if 'recommendation' in data:
                    rec = data['recommendation']
                    print_success("Different POI detected successfully!")
                    print_info(f"Merchant: {rec.get('merchant_name')}")
                    print_info(f"Category: {rec.get('category')}")
                    print_info(f"Recommended Card: {rec.get('recommended_card')}")
                    return True
                else:
                    print_info("POI found but no recommendation")
                    return True
            else:
                print_error("No POI found at Chevron coordinates")
                return False
        else:
            print_error(f"Location check failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during different POI test: {str(e)}")
        return False

# ============ TEST 12: DELETE USER CARD ============
def test_delete_user_card():
    print_test("Delete User Card - DELETE /api/user-cards/{card_id}")
    
    if not auth_token or not added_card_ids:
        print_error("Prerequisites not met. Skipping test.")
        return False
    
    # Delete the first card
    card_id_to_delete = added_card_ids[0]
    
    try:
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.delete(
            f"{BACKEND_URL}/user-cards/{card_id_to_delete}",
            headers=headers,
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 200:
            print_success(f"Card deleted successfully")
            
            # Verify deletion
            verify_response = requests.get(
                f"{BACKEND_URL}/user-cards",
                headers=headers,
                timeout=10
            )
            
            if verify_response.status_code == 200:
                remaining_cards = verify_response.json()
                if len(remaining_cards) == len(added_card_ids) - 1:
                    print_success(f"Verified: {len(remaining_cards)} cards remaining")
                    return True
                else:
                    print_error("Card count doesn't match after deletion")
                    return False
            else:
                print_error("Failed to verify deletion")
                return False
        else:
            print_error(f"Delete card failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during delete card: {str(e)}")
        return False

# ============ TEST 13: PROTECTED ENDPOINT WITHOUT TOKEN ============
def test_protected_endpoint_no_token():
    print_test("Protected Endpoint Without Token - Should Fail")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/profile",
            timeout=10
        )
        
        print_response(response)
        
        if response.status_code == 401 or response.status_code == 403:
            print_success("Correctly rejected request without token")
            return True
        else:
            print_error(f"Expected 401/403, got {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception during no token test: {str(e)}")
        return False

# ============ MAIN TEST RUNNER ============
def run_all_tests():
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TapRight Backend API Test Suite{RESET}")
    print(f"{BLUE}Backend URL: {BACKEND_URL}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    results = {}
    
    # Run tests in order
    results['Signup'] = test_signup()
    results['Login'] = test_login()
    results['Get Profile'] = test_get_profile()
    results['Get All Cards'] = test_get_all_cards()
    results['Add Cards to Wallet'] = test_add_cards_to_wallet()
    results['Get User Cards'] = test_get_user_cards()
    results['Update Questionnaire'] = test_update_questionnaire()
    results['Location Check - Nearby POI'] = test_location_check_nearby_poi()
    results['Location Check - Throttling'] = test_location_check_throttling()
    results['Location Check - No POI'] = test_location_check_no_poi()
    results['Location Check - Different POI'] = test_location_check_different_poi()
    results['Delete User Card'] = test_delete_user_card()
    results['Protected Endpoint No Token'] = test_protected_endpoint_no_token()
    
    # Print summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{test_name}: {status}")
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}Total: {passed}/{total} tests passed{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    return results

if __name__ == "__main__":
    run_all_tests()
