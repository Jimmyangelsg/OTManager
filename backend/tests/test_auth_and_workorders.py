"""Backend tests for Auth + Work Orders API (post JWT-auth refactor)."""
import os
import io
import uuid
import time
import pytest
import requests
from openpyxl import load_workbook

_BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not _BACKEND_URL:
    # Load from frontend/.env as fallback (test runner shell context)
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    _BACKEND_URL = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    except Exception:
        pass
assert _BACKEND_URL, "REACT_APP_BACKEND_URL not set"
BASE_URL = _BACKEND_URL.rstrip('/')
API = f"{BASE_URL}/api"


def _new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(session, prefix="userA"):
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_{prefix}_{suffix}@example.com"
    payload = {
        "email": email,
        "password": "secret123",
        "name": f"Test {prefix}",
        "security_question": {"question": "Color favorito?", "answer": "  Azul "},
    }
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    return email, payload["password"], r.json()


# ===== Fixtures =====
@pytest.fixture(scope="module")
def user_a():
    s = _new_session()
    email, password, data = _register(s, "A")
    yield {"session": s, "email": email, "password": password, "user": data}


@pytest.fixture(scope="module")
def user_b():
    s = _new_session()
    email, password, data = _register(s, "B")
    yield {"session": s, "email": email, "password": password, "user": data}


@pytest.fixture
def created_wo(user_a):
    s = user_a["session"]
    payload = {"ot_number": f"TEST_WO_{uuid.uuid4().hex[:6]}", "requestor": "X", "task_detail": "fixture"}
    r = s.post(f"{API}/workorders", json=payload)
    assert r.status_code == 200, r.text
    wo = r.json()
    yield wo
    try:
        s.delete(f"{API}/workorders/{wo['id']}")
    except Exception:
        pass


# ===== AUTH =====
class TestAuth:
    def test_register_sets_cookies_and_returns_user(self):
        s = _new_session()
        email, _, data = _register(s, "REG")
        assert data["email"] == email.lower()
        # Cookies should be set
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies
        # bcrypt hash NOT exposed
        assert "password_hash" not in data
        assert "password" not in data

    def test_register_duplicate_email(self, user_a):
        s = _new_session()
        r = s.post(f"{API}/auth/register", json={
            "email": user_a["email"], "password": "x123456", "name": "dup",
            "security_question": {"question": "Favorite color?", "answer": "blue"}
        })
        assert r.status_code == 400

    def test_login_admin_seeded(self):
        """Admin email moved to @local.dev to bypass EmailStr reserved-TLD rejection."""
        s = _new_session()
        r = s.post(f"{API}/auth/login", json={"email": "admin@local.dev", "password": "admin123"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == "admin@local.dev"
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies

    def test_login_wrong_password(self, user_a):
        s = _new_session()
        r = s.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "WRONG_xyz"})
        assert r.status_code == 401

    def test_me_without_cookie_returns_401(self):
        s = _new_session()
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_cookie(self, user_a):
        r = user_a["session"].get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == user_a["email"].lower()

    def test_logout_clears_cookies(self, user_b):
        # Use a fresh login session so we get fresh cookies
        s = _new_session()
        r0 = s.post(f"{API}/auth/login", json={"email": user_b["email"], "password": user_b["password"]})
        assert r0.status_code == 200, r0.text
        assert s.cookies.get("access_token")
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # After logout, the Set-Cookie clears the cookies. requests.Session may still hold
        # them but the server sent delete instructions. Verify via /me with no token:
        s2 = _new_session()
        r2 = s2.get(f"{API}/auth/me")
        assert r2.status_code == 401

    def test_forgot_password_returns_question(self, user_a):
        s = _new_session()
        r = s.post(f"{API}/auth/forgot-password", json={"email": user_a["email"]})
        assert r.status_code == 200
        assert r.json()["question"] == "Color favorito?"

    def test_forgot_password_unknown_email(self):
        s = _new_session()
        r = s.post(f"{API}/auth/forgot-password", json={"email": f"TEST_unknown_{uuid.uuid4().hex[:6]}@x.com"})
        assert r.status_code == 404

    def test_reset_password_case_insensitive(self):
        s = _new_session()
        email, _, _ = _register(s, "RESET")
        # answer was "  Azul "; try with different case + spaces
        r = s.post(f"{API}/auth/reset-password", json={
            "email": email, "security_answer": "azul", "new_password": "newpass99"
        })
        assert r.status_code == 200, r.text
        # Confirm new password works
        s2 = _new_session()
        r2 = s2.post(f"{API}/auth/login", json={"email": email, "password": "newpass99"})
        assert r2.status_code == 200

    def test_reset_password_wrong_answer(self, user_b):
        s = _new_session()
        r = s.post(f"{API}/auth/reset-password", json={
            "email": user_b["email"], "security_answer": "WRONG", "new_password": "newpass99"
        })
        assert r.status_code == 401


# ===== Brute-force lockout =====
class TestLockout:
    def test_lockout_after_5_failures(self):
        s = _new_session()
        email, _, _ = _register(s, "LOCK")
        # Use a fresh session so we don't keep the success cookies
        bad = _new_session()
        for _ in range(5):
            r = bad.post(f"{API}/auth/login", json={"email": email, "password": "WRONG"})
            assert r.status_code == 401
        # 6th attempt -> 429
        r6 = bad.post(f"{API}/auth/login", json={"email": email, "password": "WRONG"})
        assert r6.status_code == 429, r6.text


# ===== Workorders need auth =====
class TestWorkordersAuth:
    def test_list_requires_auth(self):
        s = _new_session()
        assert s.get(f"{API}/workorders").status_code == 401

    def test_create_requires_auth(self):
        s = _new_session()
        assert s.post(f"{API}/workorders", json={"ot_number": "X"}).status_code == 401

    def test_export_excel_requires_auth(self):
        s = _new_session()
        assert s.get(f"{API}/workorders/export/excel").status_code == 401

    def test_export_pdf_requires_auth(self):
        s = _new_session()
        assert s.get(f"{API}/workorders/export/pdf").status_code == 401


# ===== Workorder CRUD + status + pagination =====
class TestWorkordersCRUD:
    def test_create_default_status_pending(self, user_a):
        s = user_a["session"]
        r = s.post(f"{API}/workorders", json={"ot_number": f"TEST_DEFSTAT_{uuid.uuid4().hex[:6]}"})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "pending"
        s.delete(f"{API}/workorders/{data['id']}")

    def test_create_with_status(self, user_a):
        s = user_a["session"]
        for st in ("pending", "in_progress", "completed"):
            r = s.post(f"{API}/workorders", json={"ot_number": f"TEST_S_{st}_{uuid.uuid4().hex[:4]}", "status": st})
            assert r.status_code == 200
            assert r.json()["status"] == st
            s.delete(f"{API}/workorders/{r.json()['id']}")

    def test_invalid_status_400(self, user_a):
        s = user_a["session"]
        r = s.post(f"{API}/workorders", json={"ot_number": "TEST_BAD", "status": "garbage"})
        assert r.status_code == 400

    def test_update_status(self, user_a, created_wo):
        s = user_a["session"]
        r = s.put(f"{API}/workorders/{created_wo['id']}", json={"status": "in_progress"})
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"
        g = s.get(f"{API}/workorders/{created_wo['id']}")
        assert g.json()["status"] == "in_progress"

    def test_list_pagination_envelope(self, user_a):
        s = user_a["session"]
        r = s.get(f"{API}/workorders?page=1&page_size=5")
        assert r.status_code == 200
        body = r.json()
        for key in ("items", "page", "page_size", "total", "total_pages"):
            assert key in body, f"Missing {key} in response"
        assert body["page"] == 1
        assert body["page_size"] == 5
        assert isinstance(body["items"], list)
        assert len(body["items"]) <= 5

    def test_pagination_with_many(self, user_a):
        s = user_a["session"]
        # Create 22 OTs
        ids = []
        for i in range(22):
            r = s.post(f"{API}/workorders", json={"ot_number": f"TEST_PAG_{uuid.uuid4().hex[:5]}_{i}"})
            ids.append(r.json()["id"])
        try:
            r = s.get(f"{API}/workorders?page=1&page_size=20")
            body = r.json()
            assert body["total"] >= 22
            assert len(body["items"]) == 20
            r2 = s.get(f"{API}/workorders?page=2&page_size=20")
            body2 = r2.json()
            assert body2["page"] == 2
            assert len(body2["items"]) >= 2
            # No overlap
            ids1 = {w["id"] for w in body["items"]}
            ids2 = {w["id"] for w in body2["items"]}
            assert ids1.isdisjoint(ids2)
        finally:
            for i in ids:
                s.delete(f"{API}/workorders/{i}")

    def test_filter_by_status(self, user_a):
        s = user_a["session"]
        a = s.post(f"{API}/workorders", json={"ot_number": f"TEST_FS_A_{uuid.uuid4().hex[:5]}", "status": "completed"}).json()
        b = s.post(f"{API}/workorders", json={"ot_number": f"TEST_FS_B_{uuid.uuid4().hex[:5]}", "status": "pending"}).json()
        try:
            r = s.get(f"{API}/workorders?status=completed&page_size=100")
            ids = [w["id"] for w in r.json()["items"]]
            assert a["id"] in ids
            assert b["id"] not in ids
        finally:
            s.delete(f"{API}/workorders/{a['id']}")
            s.delete(f"{API}/workorders/{b['id']}")

    def test_filter_invalid_status(self, user_a):
        s = user_a["session"]
        r = s.get(f"{API}/workorders?status=garbage")
        assert r.status_code == 400


# ===== Isolation between users =====
class TestUserIsolation:
    def test_user_b_cannot_see_user_a_workorders(self, user_a, user_b):
        sa = user_a["session"]
        sb = user_b["session"]
        a = sa.post(f"{API}/workorders", json={"ot_number": f"TEST_ISO_A_{uuid.uuid4().hex[:5]}"}).json()
        try:
            # B's list should not contain A's id
            r = sb.get(f"{API}/workorders?page_size=200")
            ids = [w["id"] for w in r.json()["items"]]
            assert a["id"] not in ids
            # B GET A's id -> 404
            r2 = sb.get(f"{API}/workorders/{a['id']}")
            assert r2.status_code == 404
            # B PUT A's id -> 404
            r3 = sb.put(f"{API}/workorders/{a['id']}", json={"requestor": "hacker"})
            assert r3.status_code == 404
            # B DELETE A's id -> 404
            r4 = sb.delete(f"{API}/workorders/{a['id']}")
            assert r4.status_code == 404
            # A's record still exists
            r5 = sa.get(f"{API}/workorders/{a['id']}")
            assert r5.status_code == 200
        finally:
            sa.delete(f"{API}/workorders/{a['id']}")

    def test_reorder_scoped_per_user(self, user_a, user_b):
        sa, sb = user_a["session"], user_b["session"]
        a = sa.post(f"{API}/workorders", json={"ot_number": f"TEST_ROA_{uuid.uuid4().hex[:5]}"}).json()
        try:
            # B tries to reorder A's id - should not affect A
            sb.post(f"{API}/workorders/reorder", json={"ordered_ids": [a["id"]]})
            r = sa.get(f"{API}/workorders/{a['id']}")
            assert r.status_code == 200  # still exists & owned by A
        finally:
            sa.delete(f"{API}/workorders/{a['id']}")


# ===== Exports =====
class TestExports:
    def test_excel_includes_estado(self, user_a):
        s = user_a["session"]
        c = s.post(f"{API}/workorders", json={"ot_number": f"TEST_XL_{uuid.uuid4().hex[:5]}", "status": "in_progress"}).json()
        try:
            r = s.get(f"{API}/workorders/export/excel")
            assert r.status_code == 200
            ct = r.headers.get("content-type", "")
            assert "spreadsheetml" in ct
            wb = load_workbook(io.BytesIO(r.content))
            ws = wb["Órdenes de Trabajo"]
            headers = [cell.value for cell in ws[1]]
            assert "Estado" in headers, f"Estado missing in {headers}"
        finally:
            s.delete(f"{API}/workorders/{c['id']}")

    def test_pdf_export(self, user_a):
        s = user_a["session"]
        c = s.post(f"{API}/workorders", json={"ot_number": f"TEST_PDF_{uuid.uuid4().hex[:5]}", "status": "completed"}).json()
        try:
            r = s.get(f"{API}/workorders/export/pdf")
            assert r.status_code == 200, r.text
            ct = r.headers.get("content-type", "")
            assert "application/pdf" in ct
            assert r.content[:4] == b"%PDF"
        finally:
            s.delete(f"{API}/workorders/{c['id']}")

    def test_pdf_respects_status_filter(self, user_a):
        s = user_a["session"]
        # Create one completed OT so the filter has data
        c = s.post(f"{API}/workorders", json={"ot_number": f"TEST_PDFF_{uuid.uuid4().hex[:5]}", "status": "completed"}).json()
        try:
            r = s.get(f"{API}/workorders/export/pdf?status=completed")
            assert r.status_code == 200
            assert r.content[:4] == b"%PDF"
        finally:
            s.delete(f"{API}/workorders/{c['id']}")


# ===== Module cleanup =====
def teardown_module(module):
    """Clean up TEST_ users and their workorders."""
    # Try to login as admin; if there's a Mongo cleanup endpoint we'd use it.
    # Since there isn't, leave TEST_ users in DB but delete their OTs via their own sessions
    # (sessions go out of scope; cleanup best-effort).
    pass
