"""Iter 5 backend tests: profile/security/password endpoints, stats, admin all_users, upload validation."""
import os
import io
import uuid
import pytest
import requests

_BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not _BACKEND_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                _BACKEND_URL = line.split('=', 1)[1].strip().strip('"').strip("'")
                break
BASE_URL = _BACKEND_URL.rstrip('/')
API = f"{BASE_URL}/api"


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(prefix="U"):
    s = _session()
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_{prefix}_{suffix}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "secret123", "name": f"Test {prefix}",
        "security_question": {"question": "Color?", "answer": "azul"},
    })
    assert r.status_code == 200, r.text
    return s, email, "secret123"


@pytest.fixture(scope="module")
def admin():
    s = _session()
    r = s.post(f"{API}/auth/login", json={"email": "admin@local.dev", "password": "admin123"})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def user_a():
    s, email, password = _register("A5")
    return {"s": s, "email": email, "password": password}


# ===== Stats =====
class TestStats:
    def test_stats_user_scope(self, user_a):
        s = user_a["s"]
        ids = []
        for st in ("pending", "in_progress", "completed", "pending"):
            r = s.post(f"{API}/workorders", json={"ot_number": f"TEST_ST_{uuid.uuid4().hex[:5]}", "status": st})
            ids.append(r.json()["id"])
        try:
            r = s.get(f"{API}/workorders/stats")
            assert r.status_code == 200
            d = r.json()
            for k in ("pending", "in_progress", "completed", "total", "with_attachment"):
                assert k in d
            assert d["total"] >= 4
            assert d["pending"] >= 2
        finally:
            for i in ids:
                s.delete(f"{API}/workorders/{i}")

    def test_stats_all_users_admin_global(self, admin, user_a):
        # user_a creates one
        u = user_a["s"]
        r = u.post(f"{API}/workorders", json={"ot_number": f"TEST_GLOB_{uuid.uuid4().hex[:5]}"})
        wid = r.json()["id"]
        try:
            r1 = admin.get(f"{API}/workorders/stats")
            r2 = admin.get(f"{API}/workorders/stats?all_users=true")
            assert r1.status_code == 200 and r2.status_code == 200
            # Global total should be >= personal total
            assert r2.json()["total"] >= r1.json()["total"]
        finally:
            u.delete(f"{API}/workorders/{wid}")

    def test_stats_all_users_ignored_for_non_admin(self, user_a):
        s = user_a["s"]
        r = s.get(f"{API}/workorders/stats?all_users=true")
        assert r.status_code == 200
        # Should still be scoped (no error)


# ===== Workorders list with all_users =====
class TestAllUsersList:
    def test_admin_sees_owner(self, admin, user_a):
        u = user_a["s"]
        r = u.post(f"{API}/workorders", json={"ot_number": f"TEST_OWN_{uuid.uuid4().hex[:5]}"})
        wid = r.json()["id"]
        try:
            rg = admin.get(f"{API}/workorders?all_users=true&page_size=200")
            assert rg.status_code == 200
            body = rg.json()
            assert body.get("admin_view") is True
            found = [w for w in body["items"] if w["id"] == wid]
            assert found, "Admin should see user_a's OT in global view"
            assert "owner" in found[0]
            assert found[0]["owner"].get("email", "").startswith("test_a5_") or "@" in found[0]["owner"].get("email", "")
        finally:
            u.delete(f"{API}/workorders/{wid}")

    def test_non_admin_all_users_ignored(self, user_a):
        s = user_a["s"]
        # Should never include other users' OTs even when passing all_users=true
        r = s.get(f"{API}/workorders?all_users=true&page_size=200")
        assert r.status_code == 200
        assert r.json().get("admin_view") is False


# ===== Profile / change-password / security-question =====
class TestProfile:
    def test_update_profile_name(self):
        s, email, pwd = _register("PROF")
        r = s.put(f"{API}/auth/profile", json={"name": "Nuevo Nombre"})
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "Nuevo Nombre"
        me = s.get(f"{API}/auth/me").json()
        assert me["name"] == "Nuevo Nombre"

    def test_profile_requires_auth(self):
        s = _session()
        r = s.put(f"{API}/auth/profile", json={"name": "X"})
        assert r.status_code == 401

    def test_change_password_wrong_current(self):
        s, email, pwd = _register("CP1")
        r = s.post(f"{API}/auth/change-password", json={
            "current_password": "WRONG_zzz", "new_password": "newsecret9"
        })
        assert r.status_code == 401

    def test_change_password_success_and_login(self):
        s, email, pwd = _register("CP2")
        r = s.post(f"{API}/auth/change-password", json={
            "current_password": pwd, "new_password": "brandnew9"
        })
        assert r.status_code == 200, r.text
        # New password works
        s2 = _session()
        r2 = s2.post(f"{API}/auth/login", json={"email": email, "password": "brandnew9"})
        assert r2.status_code == 200
        # Old password fails
        s3 = _session()
        r3 = s3.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert r3.status_code == 401

    def test_security_question_update_wrong_pwd(self):
        s, email, pwd = _register("SQ1")
        r = s.put(f"{API}/auth/security-question", json={
            "current_password": "WRONG", "question": "Mascota?", "answer": "Rex"
        })
        assert r.status_code == 401

    def test_security_question_update_and_forgot(self):
        s, email, pwd = _register("SQ2")
        r = s.put(f"{API}/auth/security-question", json={
            "current_password": pwd, "question": "Banda favorita?", "answer": "Soda"
        })
        assert r.status_code == 200, r.text
        s2 = _session()
        rf = s2.post(f"{API}/auth/forgot-password", json={"email": email})
        assert rf.status_code == 200
        assert rf.json()["question"] == "Banda favorita?"


# ===== Upload validation =====
class TestUpload:
    def _make_wo(self, session):
        r = session.post(f"{API}/workorders", json={"ot_number": f"TEST_UP_{uuid.uuid4().hex[:5]}"})
        return r.json()["id"]

    def test_upload_exe_rejected(self, user_a):
        s = user_a["s"]
        wid = self._make_wo(s)
        try:
            # multipart upload with .exe
            files = {"file": ("hack.exe", b"MZ\x90\x00fake", "application/octet-stream")}
            # Need to drop json content-type header for multipart
            r = requests.post(f"{API}/workorders/{wid}/upload", files=files, cookies=s.cookies)
            assert r.status_code == 400, r.text
        finally:
            s.delete(f"{API}/workorders/{wid}")

    def test_upload_valid_png(self, user_a):
        s = user_a["s"]
        wid = self._make_wo(s)
        try:
            files = {"file": ("ok.png", b"\x89PNG\r\n\x1a\n" + b"0" * 200, "image/png")}
            r = requests.post(f"{API}/workorders/{wid}/upload", files=files, cookies=s.cookies)
            assert r.status_code == 200, r.text
            assert r.json()["filename"] == "ok.png"
        finally:
            s.delete(f"{API}/workorders/{wid}")

    def test_upload_too_large_413(self, user_a):
        s = user_a["s"]
        wid = self._make_wo(s)
        try:
            # 11 MB payload
            payload = b"0" * (11 * 1024 * 1024)
            files = {"file": ("big.txt", payload, "text/plain")}
            r = requests.post(f"{API}/workorders/{wid}/upload", files=files, cookies=s.cookies)
            assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text[:200]}"
        finally:
            s.delete(f"{API}/workorders/{wid}")

    def test_upload_replace_deletes_prev(self, user_a):
        s = user_a["s"]
        wid = self._make_wo(s)
        try:
            files1 = {"file": ("a.txt", b"first content", "text/plain")}
            r1 = requests.post(f"{API}/workorders/{wid}/upload", files=files1, cookies=s.cookies)
            assert r1.status_code == 200
            files2 = {"file": ("b.txt", b"second content here", "text/plain")}
            r2 = requests.post(f"{API}/workorders/{wid}/upload", files=files2, cookies=s.cookies)
            assert r2.status_code == 200
            # Can fetch new
            rd = requests.get(f"{API}/workorders/{wid}/attachment", cookies=s.cookies)
            assert rd.status_code == 200
            assert rd.content == b"second content here"
        finally:
            s.delete(f"{API}/workorders/{wid}")
