"""
validate_phase10.py — Validación de integración completa del sistema LUMA.
Ejecutar con: python validate_phase10.py
Requiere el backend corriendo en localhost:8000
"""
import sys
import json
import time
import requests

BASE = "http://localhost:8000/api/v1"
AUTH_TOKEN = None

# ── Colores ──────────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

passed = []
failed = []

def check(name, condition, detail=""):
    if condition:
        passed.append(name)
        print(f"  {GREEN}✓{RESET} {name}")
    else:
        failed.append(name)
        print(f"  {RED}✗{RESET} {name} {YELLOW}({detail}){RESET}")

def section(title):
    print(f"\n{BOLD}{CYAN}{'─'*50}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'─'*50}{RESET}")

def auth_headers():
    return {"Authorization": f"Bearer {AUTH_TOKEN}"}

# ── 1. Autenticación ─────────────────────────────────────────────────────────
section("1. AUTENTICACIÓN")
try:
    r = requests.post(f"{BASE}/auth/token/", json={"username": "admin", "password": "luma2025"}, timeout=5)
    check("POST /auth/token/ → 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        AUTH_TOKEN = r.json().get("access")
        check("Token JWT retornado", bool(AUTH_TOKEN))
    else:
        print(f"  {RED}FATAL: No se puede autenticar. Detener.{RESET}")
        sys.exit(1)
except Exception as e:
    print(f"  {RED}FATAL: Backend no responde → {e}{RESET}")
    sys.exit(1)

# Token de refresh
try:
    r_refresh = requests.post(f"{BASE}/auth/token/refresh/", json={"refresh": r.json().get("refresh")}, timeout=5)
    check("POST /auth/token/refresh/ → 200", r_refresh.status_code == 200)
except:
    check("POST /auth/token/refresh/ → 200", False, "error de conexión")

# /me/
r_me = requests.get(f"{BASE}/auth/me/", headers=auth_headers(), timeout=5)
check("GET /auth/me/ → 200", r_me.status_code == 200)
if r_me.status_code == 200:
    me = r_me.json()
    check("Me tiene role='owner'", me.get("role") == "owner", f"role={me.get('role')}")

# ── 2. Config de Tienda ───────────────────────────────────────────────────────
section("2. CONFIGURACIÓN DE TIENDA")
r_config = requests.get(f"{BASE}/config/store/", headers=auth_headers(), timeout=5)
check("GET /config/store/ → 200", r_config.status_code == 200)
if r_config.status_code == 200:
    cfg = r_config.json()
    check("Config tiene 'name'", "name" in cfg)
    check("Config tiene 'whatsapp'", "whatsapp" in cfg)
    check("Config tiene 'primary_color'", "primary_color" in cfg)
    check("Config tiene plantillas WhatsApp", "msg_confirmed" in cfg)

# Config pública (portal de clientes)
r_pub = requests.get(f"{BASE}/store/config/", timeout=5)
check("GET /store/config/ → 200 (pública, sin auth)", r_pub.status_code == 200)
if r_pub.status_code == 200:
    pub = r_pub.json()
    check("Config pública NO expone plantillas WA", "msg_confirmed" not in pub)
    check("Config pública tiene 'name'", "name" in pub)

# ── 3. Inventario ─────────────────────────────────────────────────────────────
section("3. INVENTARIO")
r_cats = requests.get(f"{BASE}/inventory/categories/", headers=auth_headers(), timeout=5)
check("GET /inventory/categories/ → 200", r_cats.status_code == 200)

r_prods = requests.get(f"{BASE}/inventory/products/", headers=auth_headers(), timeout=5)
check("GET /inventory/products/ → 200", r_prods.status_code == 200)
if r_prods.status_code == 200:
    data = r_prods.json()
    products = data.get("results", data) if isinstance(data, dict) else data
    check("Productos retorna lista", isinstance(products, list))
    if products:
        p = products[0]
        check("Producto tiene 'total_stock'", "total_stock" in p)
        check("Producto tiene 'variants'", "variants" in p or "variant_count" in p)
        check("Producto tiene 'price'", "price" in p)

r_variants = requests.get(f"{BASE}/inventory/variants/", headers=auth_headers(), timeout=5)
check("GET /inventory/variants/ → 200", r_variants.status_code == 200)

r_movements = requests.get(f"{BASE}/inventory/movements/", headers=auth_headers(), timeout=5)
check("GET /inventory/movements/ → 200", r_movements.status_code == 200)

# ── 4. Caja ───────────────────────────────────────────────────────────────────
section("4. CAJA")
r_sessions = requests.get(f"{BASE}/cash/sessions/", headers=auth_headers(), timeout=5)
check("GET /cash/sessions/ → 200", r_sessions.status_code == 200)

r_cash_mov = requests.get(f"{BASE}/cash/movements/", headers=auth_headers(), timeout=5)
check("GET /cash/movements/ → 200", r_cash_mov.status_code == 200)

# ── 5. Ventas ─────────────────────────────────────────────────────────────────
section("5. VENTAS")
r_sales = requests.get(f"{BASE}/sales/", headers=auth_headers(), timeout=5)
check("GET /sales/ → 200", r_sales.status_code == 200)

r_returns = requests.get(f"{BASE}/sales/returns/", headers=auth_headers(), timeout=5)
check("GET /sales/returns/ → 200 o 404", r_returns.status_code in [200, 404])

# ── 6. Pedidos ────────────────────────────────────────────────────────────────
section("6. PEDIDOS (portal → admin)")
r_orders = requests.get(f"{BASE}/orders/", headers=auth_headers(), timeout=5)
check("GET /orders/ → 200", r_orders.status_code == 200)
if r_orders.status_code == 200:
    data = r_orders.json()
    orders = data.get("results", data) if isinstance(data, dict) else data
    check("Pedidos retorna lista", isinstance(orders, list))
    if orders:
        o = orders[0]
        check("Pedido tiene 'status'", "status" in o)
        check("Pedido tiene 'items'", "items" in o or "item_count" in o)
        check("Pedido tiene 'total'", "total" in o)
        check("Pedido tiene 'number'", "number" in o)

# ── 7. Clientes ───────────────────────────────────────────────────────────────
section("7. CLIENTES")
r_customers = requests.get(f"{BASE}/customers/", headers=auth_headers(), timeout=5)
check("GET /customers/ → 200", r_customers.status_code == 200)

r_loyalty = requests.get(f"{BASE}/customers/loyalty/", headers=auth_headers(), timeout=5)
check("GET /customers/loyalty/ → 200 o 404", r_loyalty.status_code in [200, 404])

# ── 8. Reportes ───────────────────────────────────────────────────────────────
section("8. REPORTES")
r_dash = requests.get(f"{BASE}/reports/dashboard/", headers=auth_headers(), timeout=5)
check("GET /reports/dashboard/ → 200", r_dash.status_code == 200)
if r_dash.status_code == 200:
    d = r_dash.json()
    check("Dashboard tiene 'today_revenue'",    "today_revenue"    in d)
    check("Dashboard tiene 'today_sales_count'","today_sales_count" in d)
    check("Dashboard tiene 'new_orders'",       "new_orders"       in d)
    check("Dashboard tiene 'sales_chart'",      "sales_chart"      in d)
    check("Dashboard tiene 'top_products'",     "top_products"     in d)
    check("Dashboard tiene 'stock_alerts'",     "stock_alerts"     in d)

r_report = requests.get(f"{BASE}/reports/sales/?days=30", headers=auth_headers(), timeout=5)
check("GET /reports/sales/?days=30 → 200", r_report.status_code == 200)
if r_report.status_code == 200:
    rd = r_report.json()
    check("Sales report tiene 'total_revenue'",    "total_revenue"    in rd)
    check("Sales report tiene 'sales_by_day'",     "sales_by_day"     in rd)
    check("Sales report tiene 'top_products'",     "top_products"     in rd)
    check("Sales report tiene 'payment_methods'",  "payment_methods"  in rd)
    check("Sales report tiene 'sales_by_category'","sales_by_category" in rd)
    check("Sales report tiene 'total_stock'",      "total_stock"      in rd)

r_export = requests.get(f"{BASE}/reports/export/sales/", headers=auth_headers(), timeout=8)
check("GET /reports/export/sales/ → 200 (xlsx)", r_export.status_code == 200)

# ── 9. Usuarios ───────────────────────────────────────────────────────────────
section("9. USUARIOS")
r_users = requests.get(f"{BASE}/auth/users/", headers=auth_headers(), timeout=5)
check("GET /auth/users/ → 200", r_users.status_code == 200)
if r_users.status_code == 200:
    users = r_users.json()
    users_list = users.get("results", users) if isinstance(users, dict) else users
    check("Lista de usuarios retorna lista", isinstance(users_list, list))

# ── 10. Portal Público (store endpoints) ──────────────────────────────────────
section("10. PORTAL DE CLIENTES (endpoints públicos)")
r_store_prods = requests.get(f"{BASE}/store/products/", timeout=5)
check("GET /store/products/ → 200 (sin auth)", r_store_prods.status_code == 200)
if r_store_prods.status_code == 200:
    sp = r_store_prods.json()
    store_prods = sp.get("results", sp) if isinstance(sp, dict) else sp
    check("Store products retorna lista", isinstance(store_prods, list))
    if store_prods:
        p = store_prods[0]
        check("Store product tiene 'variants'", "variants" in p)
        check("Store product tiene 'price'", "price" in p)
        check("Store product tiene 'is_visible'", "is_visible" in p)

r_store_cats = requests.get(f"{BASE}/store/categories/", timeout=5)
check("GET /store/categories/ → 200 (sin auth)", r_store_cats.status_code == 200)

# Test POST pedido (portal)
if r_store_prods.status_code == 200 and store_prods:
    p0 = store_prods[0]
    variants = p0.get("variants", [])
    available = [v for v in variants if v.get("stock", 0) > 0]
    if available:
        v0 = available[0]
        order_payload = {
            "items": [{"variant_id": v0["id"], "quantity": 1}],
            "customer_name": "Test Cliente",
            "customer_phone": "3000000000",
        }
        r_order_post = requests.post(f"{BASE}/store/orders/", json=order_payload, timeout=5)
        check("POST /store/orders/ → 201", r_order_post.status_code == 201, f"status={r_order_post.status_code}")
        if r_order_post.status_code == 201:
            new_order = r_order_post.json()
            check("Pedido creado tiene 'number'", "number" in new_order)
            check("Pedido creado tiene 'total'",  "total"  in new_order)
            check("Pedido creado tiene 'items'",  "items"  in new_order)
            check("Pedido tiene status='new'",    new_order.get("status") == "new")
    else:
        print(f"  {YELLOW}─ Sin variantes con stock disponibles, skip test de pedido{RESET}")
else:
    print(f"  {YELLOW}─ Sin productos en tienda, no se puede probar flujo de pedido{RESET}")

# ── RESUMEN ───────────────────────────────────────────────────────────────────
section("RESUMEN")
total = len(passed) + len(failed)
pct   = round(len(passed) / total * 100) if total else 0

print(f"\n  Pruebas totales : {total}")
print(f"  {GREEN}Pasadas        : {len(passed)}{RESET}")
print(f"  {RED}Fallidas       : {len(failed)}{RESET}")
print(f"  Completitud    : {pct}%\n")

if failed:
    print(f"{BOLD}{RED}  Pruebas fallidas:{RESET}")
    for f in failed:
        print(f"    {RED}✗{RESET} {f}")

print()
if pct == 100:
    print(f"{BOLD}{GREEN}  🎉 Sistema 100% validado — Producción lista.{RESET}\n")
elif pct >= 80:
    print(f"{BOLD}{YELLOW}  ⚠️  Sistema {pct}% completo — Revisar los errores antes de producción.{RESET}\n")
else:
    print(f"{BOLD}{RED}  ✗ Sistema {pct}% completo — Hay problemas críticos.{RESET}\n")
