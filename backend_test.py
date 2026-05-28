import requests
import sys
import json
import tempfile
import os
from datetime import datetime

class WorkOrderAPITester:
    def __init__(self, base_url="https://orden-trabajo-local.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_workorders = []

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.headers.get('content-type', '').startswith('application/json'):
                    try:
                        return success, response.json()
                    except:
                        return success, {}
                else:
                    return success, response.content
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error details: {error_detail}")
                except:
                    print(f"   Response text: {response.text}")

            return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "",
            200
        )
        return success

    def test_create_workorder(self, ot_number, requestor=None, task_detail=None, service_desk_number=None, observations=None):
        """Create a work order"""
        data = {"ot_number": ot_number}
        if requestor:
            data["requestor"] = requestor
        if task_detail:
            data["task_detail"] = task_detail
        if service_desk_number:
            data["service_desk_number"] = service_desk_number
        if observations:
            data["observations"] = observations

        success, response = self.run_test(
            f"Create Work Order {ot_number}",
            "POST",
            "workorders",
            200,
            data=data
        )
        if success and 'id' in response:
            self.created_workorders.append(response['id'])
            return response['id']
        return None

    def test_get_workorders(self, search=None, requestor=None):
        """Get all work orders with optional filters"""
        endpoint = "workorders"
        params = []
        if search:
            params.append(f"search={search}")
        if requestor:
            params.append(f"requestor={requestor}")
        
        if params:
            endpoint += "?" + "&".join(params)

        success, response = self.run_test(
            f"Get Work Orders (filters: {params})",
            "GET",
            endpoint,
            200
        )
        return success, response

    def test_get_workorder_by_id(self, workorder_id):
        """Get a specific work order by ID"""
        success, response = self.run_test(
            f"Get Work Order {workorder_id}",
            "GET",
            f"workorders/{workorder_id}",
            200
        )
        return success, response

    def test_update_workorder(self, workorder_id, updates):
        """Update a work order"""
        success, response = self.run_test(
            f"Update Work Order {workorder_id}",
            "PUT",
            f"workorders/{workorder_id}",
            200,
            data=updates
        )
        return success, response

    def test_upload_attachment(self, workorder_id, filename="test_file.txt", content="Test file content"):
        """Upload an attachment to a work order"""
        # Create a temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            with open(temp_file_path, 'rb') as f:
                files = {'file': (filename, f, 'text/plain')}
                success, response = self.run_test(
                    f"Upload Attachment to {workorder_id}",
                    "POST",
                    f"workorders/{workorder_id}/upload",
                    200,
                    files=files
                )
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)

        return success, response

    def test_download_attachment(self, workorder_id):
        """Download an attachment from a work order"""
        success, response = self.run_test(
            f"Download Attachment from {workorder_id}",
            "GET",
            f"workorders/{workorder_id}/attachment",
            200
        )
        return success, response

    def test_delete_workorder(self, workorder_id):
        """Delete a work order"""
        success, response = self.run_test(
            f"Delete Work Order {workorder_id}",
            "DELETE",
            f"workorders/{workorder_id}",
            200
        )
        return success, response

    def test_export_excel_all(self):
        """Test Excel export without filters"""
        success, response = self.run_test(
            "Export All Work Orders to Excel",
            "GET",
            "workorders/export/excel",
            200
        )
        if success and isinstance(response, bytes):
            print(f"   Excel file size: {len(response)} bytes")
            # Check if it's a valid Excel file by checking the header
            if response.startswith(b'PK'):  # Excel files are ZIP-based
                print("   ✅ Valid Excel file format detected")
            else:
                print("   ❌ Invalid Excel file format")
                return False
        return success

    def test_export_excel_with_filters(self, search=None, requestor=None):
        """Test Excel export with filters"""
        endpoint = "workorders/export/excel"
        params = []
        if search:
            params.append(f"search={search}")
        if requestor:
            params.append(f"requestor={requestor}")
        
        if params:
            endpoint += "?" + "&".join(params)

        success, response = self.run_test(
            f"Export Filtered Work Orders to Excel (filters: {params})",
            "GET",
            endpoint,
            200
        )
        if success and isinstance(response, bytes):
            print(f"   Excel file size: {len(response)} bytes")
            # Check if it's a valid Excel file
            if response.startswith(b'PK'):
                print("   ✅ Valid Excel file format detected")
            else:
                print("   ❌ Invalid Excel file format")
                return False
        return success

    def test_export_excel_no_data(self):
        """Test Excel export when no data exists"""
        success, response = self.run_test(
            "Export Excel with No Data",
            "GET",
            "workorders/export/excel",
            404  # Should return 404 when no data
        )
        return success

    def test_error_cases(self):
        """Test various error scenarios"""
        print("\n🔍 Testing Error Cases...")
        
        # Test getting non-existent work order
        self.run_test(
            "Get Non-existent Work Order",
            "GET",
            "workorders/non-existent-id",
            404
        )
        
        # Test updating non-existent work order
        self.run_test(
            "Update Non-existent Work Order",
            "PUT",
            "workorders/non-existent-id",
            404,
            data={"requestor": "Test"}
        )
        
        # Test deleting non-existent work order
        self.run_test(
            "Delete Non-existent Work Order",
            "DELETE",
            "workorders/non-existent-id",
            404
        )
        
        # Test creating work order without required field
        self.run_test(
            "Create Work Order Without OT Number",
            "POST",
            "workorders",
            422,
            data={"requestor": "Test User"}
        )

def main():
    print("🚀 Starting Work Order Management API Tests")
    print("=" * 60)
    
    tester = WorkOrderAPITester()
    
    # Test API root
    if not tester.test_root_endpoint():
        print("❌ API root endpoint failed, stopping tests")
        return 1

    # Test creating work orders
    print("\n📝 Testing Work Order Creation...")
    wo1_id = tester.test_create_workorder(
        "OT-2024-001",
        requestor="Juan Pérez",
        task_detail="Mantenimiento preventivo del servidor principal",
        service_desk_number="SD-12345",
        observations="Requiere apagado programado"
    )
    
    wo2_id = tester.test_create_workorder(
        "OT-2024-002",
        requestor="María García",
        task_detail="Actualización de software",
        service_desk_number="SD-12346"
    )

    if not wo1_id or not wo2_id:
        print("❌ Work order creation failed, stopping tests")
        return 1

    # Test getting all work orders
    print("\n📋 Testing Work Order Retrieval...")
    success, workorders = tester.test_get_workorders()
    if success:
        print(f"   Found {len(workorders)} work orders")

    # Test search functionality
    print("\n🔍 Testing Search Functionality...")
    success, filtered = tester.test_get_workorders(search="OT-2024-001")
    if success:
        print(f"   Search for 'OT-2024-001' returned {len(filtered)} results")

    # Test filter by requestor
    success, filtered = tester.test_get_workorders(requestor="Juan")
    if success:
        print(f"   Filter by requestor 'Juan' returned {len(filtered)} results")

    # Test getting specific work order
    print("\n📄 Testing Individual Work Order Retrieval...")
    tester.test_get_workorder_by_id(wo1_id)

    # Test file upload
    print("\n📎 Testing File Upload...")
    tester.test_upload_attachment(wo2_id, "test_document.txt", "This is a test document for OT-2024-002")

    # Test file download
    print("\n⬇️ Testing File Download...")
    tester.test_download_attachment(wo2_id)

    # Test updating work order
    print("\n✏️ Testing Work Order Updates...")
    tester.test_update_workorder(wo1_id, {
        "requestor": "María García",
        "observations": "Actualizado: Requiere apagado programado el viernes"
    })

    # Verify update worked
    success, updated_wo = tester.test_get_workorder_by_id(wo1_id)
    if success and updated_wo.get('requestor') == 'María García':
        print("✅ Update verification successful")
    else:
        print("❌ Update verification failed")

    # Test error cases
    tester.test_error_cases()

    # Test Excel export with data
    print("\n📊 Testing Excel Export Functionality...")
    
    # First, create some test data for export
    print("   Creating test data for export...")
    test_wo1_id = tester.test_create_workorder(
        "OT-2024-001",
        requestor="Juan Pérez",
        task_detail="Mantenimiento servidor",
        service_desk_number="SD-001",
        observations="Prueba de exportación"
    )
    
    test_wo2_id = tester.test_create_workorder(
        "OT-2024-002", 
        requestor="María García",
        task_detail="Actualización sistema",
        service_desk_number="SD-002"
    )
    
    test_wo3_id = tester.test_create_workorder(
        "OT-2024-003",
        requestor="Carlos López", 
        task_detail="Soporte técnico",
        service_desk_number="SD-003"
    )

    if test_wo1_id and test_wo2_id and test_wo3_id:
        # Test export all work orders
        tester.test_export_excel_all()
        
        # Test export with search filter
        tester.test_export_excel_with_filters(search="OT-2024-001")
        
        # Test export with requestor filter
        tester.test_export_excel_with_filters(requestor="Juan")
        
        # Clean up test data
        print("\n🧹 Cleaning up export test data...")
        tester.test_delete_workorder(test_wo1_id)
        tester.test_delete_workorder(test_wo2_id)
        tester.test_delete_workorder(test_wo3_id)
        
        # Test export with no data (should return 404)
        tester.test_export_excel_no_data()

    # Test deletion
    print("\n🗑️ Testing Work Order Deletion...")
    tester.test_delete_workorder(wo1_id)
    
    # Verify deletion worked
    success, _ = tester.test_get_workorder_by_id(wo1_id)
    if not success:
        print("✅ Deletion verification successful")
        tester.tests_passed += 1
    else:
        print("❌ Deletion verification failed")
    tester.tests_run += 1

    # Clean up remaining work orders
    print("\n🧹 Cleaning up remaining work orders...")
    for wo_id in tester.created_workorders[1:]:  # Skip the first one as it's already deleted
        tester.test_delete_workorder(wo_id)

    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())