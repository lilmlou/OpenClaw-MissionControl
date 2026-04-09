#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class OpenClawAPITester:
    def __init__(self, base_url="https://openclaw-dashboard-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else f"{self.api_url}/"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(response_data) <= 3:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list) and len(response_data) <= 2:
                        print(f"   Response: {len(response_data)} items")
                    else:
                        print(f"   Response: {type(response_data).__name__} with data")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'url': url,
                    'response': response.text[:200]
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")

            return success, response.json() if success and response.text else {}

        except requests.exceptions.RequestException as e:
            self.failed_tests.append({
                'name': name,
                'error': str(e),
                'url': url
            })
            print(f"❌ Failed - Network Error: {str(e)}")
            return False, {}
        except Exception as e:
            self.failed_tests.append({
                'name': name,
                'error': str(e),
                'url': url
            })
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_basic_endpoints(self):
        """Test basic API endpoints"""
        print("=" * 50)
        print("TESTING BASIC ENDPOINTS")
        print("=" * 50)
        
        # Test root endpoint
        self.run_test("API Root", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_providers_endpoint(self):
        """Test providers endpoint"""
        print("\n" + "=" * 50)
        print("TESTING PROVIDERS ENDPOINT")
        print("=" * 50)
        
        success, response = self.run_test("Get Providers", "GET", "providers", 200)
        if success and response:
            providers = list(response.keys())
            print(f"   Found providers: {providers}")
            
            # Check if expected providers exist
            expected_providers = ["anthropic", "openai", "google", "nvidia", "meta-llama", "deepseek"]
            for provider in expected_providers:
                if provider in response:
                    models = response[provider].get('models', [])
                    print(f"   ✅ {provider}: {len(models)} models")
                else:
                    print(f"   ❌ Missing provider: {provider}")

    def test_conversations_endpoint(self):
        """Test conversations CRUD operations"""
        print("\n" + "=" * 50)
        print("TESTING CONVERSATIONS ENDPOINT")
        print("=" * 50)
        
        # Get conversations
        success, conversations = self.run_test("Get Conversations", "GET", "conversations", 200)
        
        # Create a conversation
        conv_data = {
            "title": "Test Conversation",
            "model_id": "gpt-4o",
            "provider": "openai"
        }
        success, new_conv = self.run_test("Create Conversation", "POST", "conversations", 200, conv_data)
        
        if success and new_conv:
            conv_id = new_conv.get('id')
            print(f"   Created conversation ID: {conv_id}")
            
            # Get specific conversation
            self.run_test("Get Specific Conversation", "GET", f"conversations/{conv_id}", 200)
            
            # Add message to conversation
            message_data = {"content": "Hello, this is a test message"}
            self.run_test("Add Message", "POST", f"conversations/{conv_id}/messages", 200, message_data)
            
            # Delete conversation
            self.run_test("Delete Conversation", "DELETE", f"conversations/{conv_id}", 200)

    def test_skills_endpoint(self):
        """Test skills endpoint"""
        print("\n" + "=" * 50)
        print("TESTING SKILLS ENDPOINT")
        print("=" * 50)
        
        success, skills = self.run_test("Get Skills", "GET", "skills", 200)
        if success and skills:
            print(f"   Found {len(skills)} skills")
            expected_skills = ["deep-research", "code-review", "web-scraper", "file-manager", 
                             "task-scheduler", "mcp-builder", "slack-gif-creator", "canvas-design"]
            
            skill_ids = [skill.get('id') for skill in skills]
            for expected_skill in expected_skills:
                if expected_skill in skill_ids:
                    print(f"   ✅ Found skill: {expected_skill}")
                else:
                    print(f"   ❌ Missing skill: {expected_skill}")
            
            # Test skill toggle if we have skills
            if skills:
                first_skill_id = skills[0].get('id')
                if first_skill_id:
                    self.run_test("Toggle Skill", "PUT", f"skills/{first_skill_id}/toggle", 200)

    def test_jobs_endpoint(self):
        """Test jobs endpoint"""
        print("\n" + "=" * 50)
        print("TESTING JOBS ENDPOINT")
        print("=" * 50)
        
        success, jobs = self.run_test("Get Jobs", "GET", "jobs", 200)
        if success:
            print(f"   Found {len(jobs)} jobs")
        
        # Create a job
        self.run_test("Create Job", "POST", "jobs?name=Test Job", 200)

    def test_approvals_endpoint(self):
        """Test approvals endpoint"""
        print("\n" + "=" * 50)
        print("TESTING APPROVALS ENDPOINT")
        print("=" * 50)
        
        success, approvals = self.run_test("Get Approvals", "GET", "approvals", 200)
        if success:
            print(f"   Found {len(approvals)} approvals")
            
            # Test approval actions if we have approvals
            if approvals:
                first_approval_id = approvals[0].get('id')
                if first_approval_id:
                    self.run_test("Approve Request", "PUT", f"approvals/{first_approval_id}/approve", 200)

    def test_settings_endpoint(self):
        """Test settings endpoint"""
        print("\n" + "=" * 50)
        print("TESTING SETTINGS ENDPOINT")
        print("=" * 50)
        
        success, settings = self.run_test("Get Settings", "GET", "settings", 200)
        
        # Update settings
        settings_data = {
            "id": "user_settings",
            "default_model": "gpt-4o",
            "default_provider": "openai",
            "web_search_enabled": True,
            "agent_mode_enabled": True,
            "writing_style": "normal",
            "enabled_skills": ["deep-research", "code-review"]
        }
        self.run_test("Update Settings", "PUT", "settings", 200, settings_data)

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests ({len(self.failed_tests)}):")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"   {i}. {test['name']}")
                if 'expected' in test:
                    print(f"      Expected: {test['expected']}, Got: {test['actual']}")
                if 'error' in test:
                    print(f"      Error: {test['error']}")
                print(f"      URL: {test['url']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n🎯 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    print("🚀 Starting OpenClaw Mission Control API Tests")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = OpenClawAPITester()
    
    # Run all tests
    tester.test_basic_endpoints()
    tester.test_providers_endpoint()
    tester.test_conversations_endpoint()
    tester.test_skills_endpoint()
    tester.test_jobs_endpoint()
    tester.test_approvals_endpoint()
    tester.test_settings_endpoint()
    
    # Print summary
    all_passed = tester.print_summary()
    
    print(f"\n⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())